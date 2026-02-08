-- Standards master data
CREATE TABLE IF NOT EXISTS standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  has_fm_group BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT standards_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_standards_sort ON standards (sort_order);

-- FM groups per standard
CREATE TABLE IF NOT EXISTS standard_fm_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id UUID NOT NULL REFERENCES standards(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT standard_fm_groups_unique UNIQUE (standard_id, label)
);

CREATE INDEX IF NOT EXISTS idx_standard_fm_groups_standard ON standard_fm_groups (standard_id);
CREATE INDEX IF NOT EXISTS idx_standard_fm_groups_sort ON standard_fm_groups (sort_order);
