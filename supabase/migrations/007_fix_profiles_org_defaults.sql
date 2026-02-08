-- Ensure profiles.organization_id doesn't block auth user creation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles'
      AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE profiles
      ALTER COLUMN organization_id DROP NOT NULL,
      ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
  END IF;
END $$;