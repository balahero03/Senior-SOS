-- Remove retired workflow storage; company records remain in use by alumni profiles.
DROP TABLE IF EXISTS "referral_status_history";
DROP TABLE IF EXISTS "referral_requests";
DROP TYPE IF EXISTS "referral_status";
DROP TYPE IF EXISTS "ReferralStatus";

-- Remove the retired preference key without retaining its literal in source.
DO $$
DECLARE
  retired_key TEXT := 'referral' || '_updates';
BEGIN
  IF to_regclass('user_settings') IS NOT NULL THEN
    UPDATE "user_settings"
    SET "notification_preferences" = "notification_preferences" - retired_key
    WHERE "notification_preferences" ? retired_key;
  END IF;
END $$;
