-- SeniorSOS — Initial PostgreSQL Migration
-- Source: Database Schema & Integration Design (PDF)
--
-- Generated via: prisma migrate dev --name init --create-only
-- Then extended with:
--   - Special partial / expression indexes Prisma cannot express
--   - CHECK constraints Prisma cannot express
--   - profile_visibility CHECK on user_settings
--
-- Apply with: npx prisma migrate dev  (or migrate deploy in production)

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE "user_role" AS ENUM ('STUDENT', 'ALUMNI', 'ADMIN');
CREATE TYPE "account_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');
CREATE TYPE "verification_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "request_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');
CREATE TYPE "mentorship_status" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'CANCELLED', 'ENDED');
CREATE TYPE "mentorship_frequency" AS ENUM ('ONE_TIME', 'WEEKLY', 'MONTHLY');

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE "users" (
  "id"                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"              VARCHAR(150)  NOT NULL,
  "email"             VARCHAR(255)  NOT NULL UNIQUE,
  "password_hash"     TEXT          NOT NULL,
  "role"              "user_role"   NOT NULL DEFAULT 'STUDENT',
  "status"            "account_status" NOT NULL DEFAULT 'ACTIVE',
  "email_verified_at" TIMESTAMPTZ(6),
  "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- ─── Departments ──────────────────────────────────────────────────────────────
CREATE TABLE "departments" (
  "id"   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(20)  NOT NULL UNIQUE,
  "name" VARCHAR(150) NOT NULL UNIQUE
);

-- ─── Academic profiles ────────────────────────────────────────────────────────
-- One row per student and alumnus. Shared academic info lives here so
-- graduation_year and department are not duplicated across student/alumni tables.
CREATE TABLE "academic_profiles" (
  "user_id"         UUID       PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "department_id"   UUID       NOT NULL REFERENCES "departments"("id"),
  "graduation_year" SMALLINT   NOT NULL CHECK ("graduation_year" BETWEEN 1950 AND 2100),
  "bio"             TEXT,
  "career_interests" TEXT
);

CREATE INDEX "idx_academic_department_year"
  ON "academic_profiles"("department_id", "graduation_year");

-- ─── Companies (normalised) ───────────────────────────────────────────────────
-- "Amazon" / "amazon " map to the same row via name_key = lower(trim(name)).
CREATE TABLE "companies" (
  "id"       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"     VARCHAR(200) NOT NULL,
  "name_key" VARCHAR(200) NOT NULL UNIQUE
);

-- ─── Alumni profiles ──────────────────────────────────────────────────────────
-- Alumni-specific fields only. ADMIN has no profile rows.
CREATE TABLE "alumni_profiles" (
  "user_id"             UUID                  PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "company_id"          UUID                  REFERENCES "companies"("id"),
  "designation"         VARCHAR(200),
  "experience_years"    NUMERIC(4,1)          CHECK ("experience_years" >= 0),
  "verification_status" "verification_status" NOT NULL DEFAULT 'PENDING',
  "verified_at"         TIMESTAMPTZ(6)
);

CREATE INDEX "idx_alumni_company" ON "alumni_profiles"("company_id");

-- ─── Skills ───────────────────────────────────────────────────────────────────
CREATE TABLE "skills" (
  "id"   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE "user_skills" (
  "user_id"     UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "skill_id"    UUID        NOT NULL REFERENCES "skills"("id") ON DELETE CASCADE,
  "proficiency" VARCHAR(30),
  PRIMARY KEY ("user_id", "skill_id")
);

-- ─── Connection requests ──────────────────────────────────────────────────────
CREATE TABLE "connection_requests" (
  "id"          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  "sender_id"   UUID             NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "receiver_id" UUID             NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "status"      "request_status" NOT NULL DEFAULT 'PENDING',
  "created_at"  TIMESTAMPTZ(6)  NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ(6)  NOT NULL DEFAULT NOW(),
  CHECK ("sender_id" <> "receiver_id")
);

-- At most one pending request for an unordered user pair.
-- Prisma cannot express this — kept here manually per PDF section 3.2.
CREATE UNIQUE INDEX "uq_pending_connection_pair"
  ON "connection_requests" (LEAST("sender_id", "receiver_id"), GREATEST("sender_id", "receiver_id"))
  WHERE "status" = 'PENDING';

CREATE INDEX "idx_conn_req_sender_status"   ON "connection_requests"("sender_id", "status");
CREATE INDEX "idx_conn_req_receiver_status" ON "connection_requests"("receiver_id", "status");

-- ─── Accepted connections ─────────────────────────────────────────────────────
-- One row per pair in canonical order (user_a < user_b).
-- The PK is the final guard against duplicates.
CREATE TABLE "connections" (
  "user_a"          UUID          NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "user_b"          UUID          NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "connected_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "graph_synced_at" TIMESTAMPTZ(6),      -- NULL = not yet mirrored to Neo4j
  PRIMARY KEY ("user_a", "user_b"),
  CHECK ("user_a" < "user_b")
);

CREATE INDEX "idx_connections_user_b" ON "connections"("user_b");

-- Partial index — Prisma cannot express this.
CREATE INDEX "idx_connections_unsynced"
  ON "connections"("connected_at")
  WHERE "graph_synced_at" IS NULL;

-- ─── Mentorship ───────────────────────────────────────────────────────────────
-- Request and relationship lifecycle in one table.
CREATE TABLE "mentorship_requests" (
  "id"               UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  "mentee_id"        UUID                   NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "mentor_id"        UUID                   NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "focus_area"       VARCHAR(150)           NOT NULL,
  "help_description" TEXT,
  "goals"            TEXT,
  "frequency"        "mentorship_frequency" NOT NULL DEFAULT 'ONE_TIME',
  "status"           "mentorship_status"    NOT NULL DEFAULT 'PENDING',
  "started_at"       TIMESTAMPTZ(6),         -- set when status → ACTIVE
  "ended_at"         TIMESTAMPTZ(6),         -- set when status → ENDED
  "created_at"       TIMESTAMPTZ(6)         NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ(6)         NOT NULL DEFAULT NOW(),
  CHECK ("mentee_id" <> "mentor_id"),
  CHECK (("status" IN ('ACTIVE', 'ENDED')) = ("started_at" IS NOT NULL)),
  CHECK (("status" = 'ENDED') = ("ended_at" IS NOT NULL)),
  CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);

-- No duplicate open (pending or active) mentorship for the same pair.
-- Prisma cannot express this partial unique index.
CREATE UNIQUE INDEX "uq_open_mentorship"
  ON "mentorship_requests" ("mentee_id", "mentor_id")
  WHERE "status" IN ('PENDING', 'ACTIVE');

CREATE INDEX "idx_mentorship_mentor_status" ON "mentorship_requests"("mentor_id", "status");
CREATE INDEX "idx_mentorship_mentee_status" ON "mentorship_requests"("mentee_id", "status");

-- ─── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE "notifications" (
  "id"           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipient_id" UUID          NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "actor_id"     UUID          REFERENCES "users"("id") ON DELETE SET NULL,
  "type"         VARCHAR(50)   NOT NULL,
  "payload"      JSONB         NOT NULL DEFAULT '{}'::JSONB,
  "read_at"      TIMESTAMPTZ(6),
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_notifications_recipient_created"
  ON "notifications"("recipient_id", "created_at" DESC);

-- ─── User settings ────────────────────────────────────────────────────────────
CREATE TABLE "user_settings" (
  "user_id"                  UUID         PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "profile_visibility"       VARCHAR(30)  NOT NULL DEFAULT 'COLLEGE'
    CHECK ("profile_visibility" IN ('COLLEGE', 'CONNECTIONS_ONLY')),
  "notification_preferences" JSONB        NOT NULL DEFAULT
    '{"connection_requests":true,"messages":true,"mentorship_requests":true,
      "community_activity":false}'::JSONB,
  "updated_at"               TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- ─── Refresh tokens ───────────────────────────────────────────────────────────
CREATE TABLE "refresh_tokens" (
  "id"         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    UUID          NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" TEXT          NOT NULL UNIQUE,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens"("user_id");

-- ─── Audit logs ───────────────────────────────────────────────────────────────
CREATE TABLE "audit_logs" (
  "id"          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id"    UUID         REFERENCES "users"("id") ON DELETE SET NULL,
  "action"      VARCHAR(100) NOT NULL,
  "target_type" VARCHAR(100),
  "target_id"   UUID,
  "metadata"    JSONB        NOT NULL DEFAULT '{}'::JSONB,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_audit_actor_created" ON "audit_logs"("actor_id", "created_at" DESC);
