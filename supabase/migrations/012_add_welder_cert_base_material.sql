ALTER TABLE welder_certificates
  ADD COLUMN IF NOT EXISTS base_material_id UUID REFERENCES materials(id);
