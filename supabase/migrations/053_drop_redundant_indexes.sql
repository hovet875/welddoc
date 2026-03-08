-- Drop indexes that are redundant because equivalent unique keys/indexes already exist.
-- This keeps read-performance while reducing write overhead and index bloat.

-- Covered by unique constraint projects_project_no_key (UNIQUE(project_no)).
drop index if exists public.idx_projects_project_no;

-- Covered by unique constraint project_pressure_tests_project_id_key (UNIQUE(project_id)).
drop index if exists public.idx_project_pressure_tests_project_id;

-- Covered by unique constraint project_pressure_test_rows_project_line_key (UNIQUE(project_id, line_no)).
drop index if exists public.idx_project_pressure_test_rows_project_line;
drop index if exists public.idx_project_pressure_test_rows_project_id;

-- Covered by unique constraint file_links_unique (UNIQUE(file_id, entity_type, entity_id)).
drop index if exists public.idx_file_links_file;

-- Covered by unique index uq_project_welds_log_no (UNIQUE(log_id, weld_no)).
drop index if exists public.idx_project_welds_log;
