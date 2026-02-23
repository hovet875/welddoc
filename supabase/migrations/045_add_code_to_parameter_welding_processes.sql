ALTER TABLE parameter_welding_processes
  ADD COLUMN IF NOT EXISTS code TEXT;

UPDATE parameter_welding_processes
SET code = parsed.code
FROM (
  SELECT
    id,
    CASE
      WHEN label ~ '^\s*[0-9]{2,4}\s*-\s*' THEN regexp_replace(label, '^\s*([0-9]{2,4})\s*-\s*.*$', '\1')
      WHEN label ~ '^\s*[0-9]{2,4}\s*$' THEN regexp_replace(label, '^\s*([0-9]{2,4})\s*$', '\1')
      ELSE NULL
    END AS code
  FROM parameter_welding_processes
) parsed
WHERE parameter_welding_processes.id = parsed.id
  AND (parameter_welding_processes.code IS NULL OR btrim(parameter_welding_processes.code) = '')
  AND parsed.code IS NOT NULL;

UPDATE parameter_welding_processes
SET code = btrim(code)
WHERE code IS NOT NULL;

UPDATE parameter_welding_processes
SET label = btrim(regexp_replace(label, '^\s*[0-9]{2,4}\s*-\s*', ''))
WHERE label ~ '^\s*[0-9]{2,4}\s*-\s*';

UPDATE parameter_welding_processes
SET label = code
WHERE code IS NOT NULL
  AND btrim(label) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_parameter_welding_processes_code_unique
  ON parameter_welding_processes (code)
  WHERE code IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE parameter_welding_processes
    ADD CONSTRAINT parameter_welding_processes_code_format
    CHECK (
      code IS NULL
      OR code ~ '^[0-9]{2,4}$'
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
