-- Add material reference to project traceability
ALTER TABLE project_traceability
  ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES parameter_materials(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_traceability_material_id ON project_traceability (material_id);
