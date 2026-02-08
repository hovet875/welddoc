ALTER TABLE files
  ALTER COLUMN created_by SET DEFAULT auth.uid();
