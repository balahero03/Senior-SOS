-- Align PostgreSQL enum names with the @@map values in schema.prisma.
-- Some databases already have the mapped snake_case names (from the initial
-- migration), while others have Prisma's default PascalCase names. Rename only
-- when the source exists and the destination does not; never drop either type.
DO $$
BEGIN
  IF to_regtype('user_role') IS NULL THEN
    IF to_regtype('"UserRole"') IS NOT NULL THEN
      ALTER TYPE "UserRole" RENAME TO user_role;
    ELSE
      RAISE EXCEPTION 'Neither "UserRole" nor user_role exists in the current schema';
    END IF;
  END IF;
  IF to_regtype('account_status') IS NULL THEN
    IF to_regtype('"AccountStatus"') IS NOT NULL THEN
      ALTER TYPE "AccountStatus" RENAME TO account_status;
    ELSE
      RAISE EXCEPTION 'Neither "AccountStatus" nor account_status exists in the current schema';
    END IF;
  END IF;
  IF to_regtype('verification_status') IS NULL THEN
    IF to_regtype('"VerificationStatus"') IS NOT NULL THEN
      ALTER TYPE "VerificationStatus" RENAME TO verification_status;
    ELSE
      RAISE EXCEPTION 'Neither "VerificationStatus" nor verification_status exists in the current schema';
    END IF;
  END IF;
  IF to_regtype('request_status') IS NULL THEN
    IF to_regtype('"RequestStatus"') IS NOT NULL THEN
      ALTER TYPE "RequestStatus" RENAME TO request_status;
    ELSE
      RAISE EXCEPTION 'Neither "RequestStatus" nor request_status exists in the current schema';
    END IF;
  END IF;
  IF to_regtype('mentorship_status') IS NULL THEN
    IF to_regtype('"MentorshipStatus"') IS NOT NULL THEN
      ALTER TYPE "MentorshipStatus" RENAME TO mentorship_status;
    ELSE
      RAISE EXCEPTION 'Neither "MentorshipStatus" nor mentorship_status exists in the current schema';
    END IF;
  END IF;
  IF to_regtype('mentorship_frequency') IS NULL THEN
    IF to_regtype('"MentorshipFrequency"') IS NOT NULL THEN
      ALTER TYPE "MentorshipFrequency" RENAME TO mentorship_frequency;
    ELSE
      RAISE EXCEPTION 'Neither "MentorshipFrequency" nor mentorship_frequency exists in the current schema';
    END IF;
  END IF;
  IF to_regtype('referral_status') IS NULL THEN
    IF to_regtype('"ReferralStatus"') IS NOT NULL THEN
      ALTER TYPE "ReferralStatus" RENAME TO referral_status;
    ELSE
      RAISE EXCEPTION 'Neither "ReferralStatus" nor referral_status exists in the current schema';
    END IF;
  END IF;
END $$;
