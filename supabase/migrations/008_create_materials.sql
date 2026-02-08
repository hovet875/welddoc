-- Materials master data
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  material_code TEXT NOT NULL UNIQUE,
  material_group TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_materials_active ON materials (is_active);
CREATE INDEX IF NOT EXISTS idx_materials_sort ON materials (sort_order);

-- Link WPS/WPQR to materials (nullable for manual backfill)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'wpqr'
  ) THEN
    ALTER TABLE wpqr
      ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id);

    -- Allow nullable legacy text until backfilled
    ALTER TABLE wpqr
      ALTER COLUMN materiale DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'wps'
  ) THEN
    ALTER TABLE wps
      ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id);

    ALTER TABLE wps
      ALTER COLUMN materiale DROP NOT NULL;
  END IF;
END $$;