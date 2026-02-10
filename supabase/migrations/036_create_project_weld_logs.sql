-- Project weld logs
create table if not exists project_weld_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  drawing_id uuid not null references project_drawings(id) on delete cascade,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists uq_project_weld_logs_drawing on project_weld_logs (project_id, drawing_id);
create index if not exists idx_project_weld_logs_project on project_weld_logs (project_id);
create index if not exists idx_project_weld_logs_drawing on project_weld_logs (drawing_id);

-- Project welds
create table if not exists project_welds (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references project_weld_logs(id) on delete cascade,
  weld_no int not null,
  joint_type text null,
  component_a_id uuid null references project_traceability(id) on delete set null,
  component_b_id uuid null references project_traceability(id) on delete set null,
  welder_id uuid null references profiles(id) on delete set null,
  wps_id uuid null references wps(id) on delete set null,
  weld_date date null,
  filler_traceability_id uuid null references project_traceability(id) on delete set null,
  visual_inspector text null,
  crack_inspector text null,
  crack_report_id uuid null references ndt_reports(id) on delete set null,
  crack_report_no text null,
  volumetric_inspector text null,
  volumetric_report_id uuid null references ndt_reports(id) on delete set null,
  volumetric_report_no text null,
  status text not null default 'kontroll',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists uq_project_welds_log_no on project_welds (log_id, weld_no);
create index if not exists idx_project_welds_log on project_welds (log_id);
create index if not exists idx_project_welds_status on project_welds (status);
