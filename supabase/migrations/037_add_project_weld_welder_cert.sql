ALTER TABLE project_welds
  ADD COLUMN IF NOT EXISTS welder_cert_id uuid null references welder_certificates(id) on delete set null;

CREATE INDEX IF NOT EXISTS idx_project_welds_welder_cert_id ON project_welds (welder_cert_id);
