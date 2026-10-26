-- Roles/schema ownership are provisioned explicitly before this migration.
-- No auth tables or domain entities are managed by this history.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_namespace
    WHERE nspname = 'business' AND pg_get_userbyid(nspowner) = current_user
  ) THEN
    RAISE EXCEPTION 'Business schema must be provisioned separately';
  END IF;
END $$;
