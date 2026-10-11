-- Keep PostgreSQL enum names aligned with the @@map values in schema.prisma.
-- The previous migration recreated these as Prisma's default PascalCase names,
-- even though the schema maps them to snake_case.
ALTER TYPE "UserRole" RENAME TO user_role;
ALTER TYPE "AccountStatus" RENAME TO account_status;
ALTER TYPE "VerificationStatus" RENAME TO verification_status;
ALTER TYPE "RequestStatus" RENAME TO request_status;
ALTER TYPE "MentorshipStatus" RENAME TO mentorship_status;
ALTER TYPE "MentorshipFrequency" RENAME TO mentorship_frequency;
ALTER TYPE "ReferralStatus" RENAME TO referral_status;
