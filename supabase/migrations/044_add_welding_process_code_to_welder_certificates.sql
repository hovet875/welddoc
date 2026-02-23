ALTER TABLE welder_certificates
  ADD COLUMN IF NOT EXISTS welding_process_code TEXT;

CREATE INDEX IF NOT EXISTS idx_welder_certificates_welding_process_code
  ON welder_certificates (welding_process_code);

DO $$
BEGIN
  ALTER TABLE welder_certificates
    ADD CONSTRAINT welder_certificates_welding_process_code_format
    CHECK (
      welding_process_code IS NULL
      OR welding_process_code ~ '^[0-9]{2,4}$'
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

