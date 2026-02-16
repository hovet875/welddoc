CREATE TABLE IF NOT EXISTS parameter_weld_joint_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parameter_weld_joint_types_active ON parameter_weld_joint_types (is_active);
CREATE INDEX IF NOT EXISTS idx_parameter_weld_joint_types_sort ON parameter_weld_joint_types (sort_order);

INSERT INTO parameter_weld_joint_types (label, sort_order)
VALUES
  ('BW', 1),
  ('FW', 2)
ON CONFLICT (label) DO NOTHING;
