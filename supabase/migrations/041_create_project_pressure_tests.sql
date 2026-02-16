CREATE TABLE IF NOT EXISTS project_pressure_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  test_type TEXT NOT NULL DEFAULT 'pressure' CHECK (test_type IN ('pressure', 'leak')),
  test_date DATE,
  test_location TEXT,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  test_equipment TEXT,
  gauge_id TEXT,
  gauge_cert_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  comments TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_pressure_tests_project_id
  ON project_pressure_tests (project_id);

CREATE TABLE IF NOT EXISTS project_pressure_test_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  drawing_no TEXT,
  description TEXT,
  test_medium TEXT,
  working_pressure TEXT,
  test_pressure TEXT,
  hold_time TEXT,
  result TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_pressure_test_rows_project_line_key UNIQUE (project_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_project_pressure_test_rows_project_id
  ON project_pressure_test_rows (project_id);

CREATE INDEX IF NOT EXISTS idx_project_pressure_test_rows_project_line
  ON project_pressure_test_rows (project_id, line_no);

ALTER TABLE project_pressure_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_pressure_test_rows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "admin_project_pressure_tests_ALL"
    ON project_pressure_tests
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "user_project_pressure_tests_select"
    ON project_pressure_tests
    FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "admin_project_pressure_test_rows_ALL"
    ON project_pressure_test_rows
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "user_project_pressure_test_rows_select"
    ON project_pressure_test_rows
    FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
