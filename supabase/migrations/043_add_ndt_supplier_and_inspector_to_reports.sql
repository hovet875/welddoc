ALTER TABLE ndt_reports
  ADD COLUMN IF NOT EXISTS ndt_supplier_id UUID REFERENCES parameter_ndt_suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ndt_inspector_id UUID REFERENCES parameter_ndt_inspectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ndt_reports_supplier_id ON ndt_reports (ndt_supplier_id);
CREATE INDEX IF NOT EXISTS idx_ndt_reports_inspector_id ON ndt_reports (ndt_inspector_id);
