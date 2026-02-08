-- Add description + standard ref to NDT methods
ALTER TABLE parameter_ndt_methods
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS standard_id UUID REFERENCES parameter_standards(id);

CREATE INDEX IF NOT EXISTS idx_parameter_ndt_methods_standard ON parameter_ndt_methods (standard_id);

-- Update NDT reports fields
ALTER TABLE ndt_reports
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS customer TEXT,
  ADD COLUMN IF NOT EXISTS report_year INTEGER;

ALTER TABLE ndt_reports
  DROP COLUMN IF EXISTS notes;
