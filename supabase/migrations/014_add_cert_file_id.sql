ALTER TABLE welder_certificates
  ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES files(id);

ALTER TABLE ndt_certificates
  ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES files(id);
