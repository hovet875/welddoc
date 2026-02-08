ALTER TABLE standards
  DROP CONSTRAINT IF EXISTS standards_code_key;

ALTER TABLE standards
  DROP COLUMN IF EXISTS code;

ALTER TABLE standards
  ADD COLUMN IF NOT EXISTS revision INT4;

ALTER TABLE standards
  ADD CONSTRAINT standards_label_revision_key UNIQUE (label, revision);