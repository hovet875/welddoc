-- Material certificates (material + filler wire)
CREATE TABLE IF NOT EXISTS material_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_type TEXT NOT NULL CHECK (certificate_type IN ('material', 'filler')),
  supplier TEXT,
  heat_numbers TEXT[] NOT NULL DEFAULT '{}'::text[],
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_certificates_type ON material_certificates (certificate_type);
CREATE INDEX IF NOT EXISTS idx_material_certificates_supplier ON material_certificates (supplier);
CREATE INDEX IF NOT EXISTS idx_material_certificates_created_at ON material_certificates (created_at);
CREATE INDEX IF NOT EXISTS idx_material_certificates_file_id ON material_certificates (file_id);
