ALTER TABLE project_welds
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE project_welds
  ALTER COLUMN status TYPE boolean
  USING (
    CASE
      WHEN status IS NULL THEN false
      WHEN lower(trim(status::text)) IN ('godkjent', 'true', '1', 'yes', 'ja') THEN true
      ELSE false
    END
  );

ALTER TABLE project_welds
  ALTER COLUMN status SET DEFAULT false;

ALTER TABLE project_welds
  ALTER COLUMN status SET NOT NULL;
