-- NDT methods parameter table
CREATE TABLE IF NOT EXISTS parameter_ndt_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parameter_ndt_methods_active ON parameter_ndt_methods (is_active);
CREATE INDEX IF NOT EXISTS idx_parameter_ndt_methods_sort ON parameter_ndt_methods (sort_order);

INSERT INTO parameter_ndt_methods (code, label, sort_order)
VALUES
  ('VT', 'VT', 1),
  ('MT', 'MT', 2),
  ('PT', 'PT', 3),
  ('RT', 'RT', 4),
  ('UT', 'UT', 5)
ON CONFLICT (code) DO NOTHING;

-- NDT reports basket
CREATE TABLE IF NOT EXISTS ndt_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files(id),
  method_id UUID REFERENCES parameter_ndt_methods(id),
  weld_count INTEGER,
  defect_count INTEGER,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ndt_reports_method ON ndt_reports (method_id);
CREATE INDEX IF NOT EXISTS idx_ndt_reports_created_at ON ndt_reports (created_at);

CREATE TABLE IF NOT EXISTS ndt_report_welders (
  report_id UUID NOT NULL REFERENCES ndt_reports(id) ON DELETE CASCADE,
  welder_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, welder_id)
);

CREATE INDEX IF NOT EXISTS idx_ndt_report_welders_welder ON ndt_report_welders (welder_id);
