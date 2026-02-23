CREATE TABLE IF NOT EXISTS parameter_welder_cert_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id UUID NULL REFERENCES parameter_standards(id) ON DELETE SET NULL,
  fm_group_id UUID NULL REFERENCES parameter_standard_fm_groups(id) ON DELETE SET NULL,
  material_id UUID NULL REFERENCES parameter_materials(id) ON DELETE SET NULL,
  welding_process_code TEXT NULL,
  joint_type TEXT NULL REFERENCES parameter_weld_joint_types(label) ON UPDATE CASCADE ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT parameter_welder_cert_scopes_welding_process_code_format CHECK (
    welding_process_code IS NULL OR welding_process_code ~ '^[0-9]{2,4}$'
  )
);

CREATE INDEX IF NOT EXISTS idx_parameter_welder_cert_scopes_active
  ON parameter_welder_cert_scopes (is_active);

CREATE INDEX IF NOT EXISTS idx_parameter_welder_cert_scopes_standard
  ON parameter_welder_cert_scopes (standard_id);

CREATE INDEX IF NOT EXISTS idx_parameter_welder_cert_scopes_material
  ON parameter_welder_cert_scopes (material_id);

CREATE INDEX IF NOT EXISTS idx_parameter_welder_cert_scopes_process
  ON parameter_welder_cert_scopes (welding_process_code);

CREATE INDEX IF NOT EXISTS idx_parameter_welder_cert_scopes_joint
  ON parameter_welder_cert_scopes (joint_type);

CREATE INDEX IF NOT EXISTS idx_parameter_welder_cert_scopes_sort
  ON parameter_welder_cert_scopes (sort_order, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parameter_welder_cert_scopes_unique
  ON parameter_welder_cert_scopes (
    COALESCE(standard_id::text, ''),
    COALESCE(fm_group_id::text, ''),
    COALESCE(material_id::text, ''),
    COALESCE(welding_process_code, ''),
    COALESCE(joint_type, '')
  );

ALTER TABLE parameter_welder_cert_scopes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "admin_parameter_welder_cert_scopes_insert"
    ON parameter_welder_cert_scopes
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "admin_parameter_welder_cert_scopes_update"
    ON parameter_welder_cert_scopes
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "admin_parameter_welder_cert_scopes_delete"
    ON parameter_welder_cert_scopes
    FOR DELETE
    TO authenticated
    USING (public.is_admin());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "user_parameter_welder_cert_scopes_select"
    ON parameter_welder_cert_scopes
    FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
