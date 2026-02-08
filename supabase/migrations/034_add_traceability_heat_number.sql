alter table if exists project_traceability
  add column if not exists heat_number text null;

create index if not exists idx_project_traceability_heat_number
  on project_traceability(heat_number);
