CREATE TABLE IF NOT EXISTS parameter_ndt_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parameter_ndt_suppliers_active
  ON parameter_ndt_suppliers (is_active);

CREATE INDEX IF NOT EXISTS idx_parameter_ndt_suppliers_sort
  ON parameter_ndt_suppliers (sort_order);

CREATE TABLE IF NOT EXISTS parameter_ndt_inspectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES parameter_ndt_suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT parameter_ndt_inspectors_supplier_name_key UNIQUE (supplier_id, name)
);

CREATE INDEX IF NOT EXISTS idx_parameter_ndt_inspectors_supplier
  ON parameter_ndt_inspectors (supplier_id);

CREATE INDEX IF NOT EXISTS idx_parameter_ndt_inspectors_active
  ON parameter_ndt_inspectors (is_active);

CREATE INDEX IF NOT EXISTS idx_parameter_ndt_inspectors_sort
  ON parameter_ndt_inspectors (sort_order);

ALTER TABLE parameter_ndt_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameter_ndt_inspectors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "admin_parameter_ndt_suppliers_ALL"
    ON parameter_ndt_suppliers
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "user_parameter_ndt_suppliers_select"
    ON parameter_ndt_suppliers
    FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "admin_parameter_ndt_inspectors_ALL"
    ON parameter_ndt_inspectors
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "user_parameter_ndt_inspectors_select"
    ON parameter_ndt_inspectors
    FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
