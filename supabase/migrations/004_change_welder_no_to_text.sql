-- Ensure welder_no is stored as 3-digit text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles'
      AND column_name = 'welder_no'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE profiles
      ALTER COLUMN welder_no TYPE text
      USING lpad(welder_no::text, 3, '0');
  END IF;
END $$;
