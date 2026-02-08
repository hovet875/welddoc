-- Add material and filler type fields to material certificates
ALTER TABLE material_certificates
  ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES parameter_materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS filler_type TEXT;

CREATE INDEX IF NOT EXISTS idx_material_certificates_material_id ON material_certificates (material_id);
CREATE INDEX IF NOT EXISTS idx_material_certificates_filler_type ON material_certificates (filler_type);
