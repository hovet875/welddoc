-- Rename app parameter tables to parameter_* naming
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'materials')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'parameter_materials') THEN
    ALTER TABLE materials RENAME TO parameter_materials;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'job_titles')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'parameter_job_titles') THEN
    ALTER TABLE job_titles RENAME TO parameter_job_titles;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'standards')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'parameter_standards') THEN
    ALTER TABLE standards RENAME TO parameter_standards;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'standard_fm_groups')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'parameter_standard_fm_groups') THEN
    ALTER TABLE standard_fm_groups RENAME TO parameter_standard_fm_groups;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_materials_active')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_parameter_materials_active') THEN
    ALTER INDEX idx_materials_active RENAME TO idx_parameter_materials_active;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_materials_sort')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_parameter_materials_sort') THEN
    ALTER INDEX idx_materials_sort RENAME TO idx_parameter_materials_sort;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_job_titles_active')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_parameter_job_titles_active') THEN
    ALTER INDEX idx_job_titles_active RENAME TO idx_parameter_job_titles_active;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_standards_sort')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_parameter_standards_sort') THEN
    ALTER INDEX idx_standards_sort RENAME TO idx_parameter_standards_sort;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_standard_fm_groups_standard')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_parameter_standard_fm_groups_standard') THEN
    ALTER INDEX idx_standard_fm_groups_standard RENAME TO idx_parameter_standard_fm_groups_standard;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_standard_fm_groups_sort')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_parameter_standard_fm_groups_sort') THEN
    ALTER INDEX idx_standard_fm_groups_sort RENAME TO idx_parameter_standard_fm_groups_sort;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'standards_label_revision_key')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parameter_standards_label_revision_key') THEN
    ALTER TABLE parameter_standards
      RENAME CONSTRAINT standards_label_revision_key TO parameter_standards_label_revision_key;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'standard_fm_groups_unique')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parameter_standard_fm_groups_unique') THEN
    ALTER TABLE parameter_standard_fm_groups
      RENAME CONSTRAINT standard_fm_groups_unique TO parameter_standard_fm_groups_unique;
  END IF;
END $$;

COMMIT;
