-- Material traceability parameters and project traceability

create table if not exists parameter_traceability_types (
  code text primary key,
  label text not null,
  use_dn boolean not null default false,
  use_dn2 boolean not null default false,
  use_sch boolean not null default false,
  use_pressure boolean not null default false,
  use_thickness boolean not null default false,
  use_filler_type boolean not null default false,
  default_sch text null,
  default_pressure text null,
  created_at timestamptz not null default now()
);

create table if not exists parameter_traceability_options (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  value text not null,
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_parameter_traceability_options_group on parameter_traceability_options(group_key);

create table if not exists project_traceability (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  type_code text not null references parameter_traceability_types(code) on delete restrict,
  code_index int null,
  dn text null,
  dn2 text null,
  sch text null,
  pressure_class text null,
  thickness text null,
  filler_type text null,
  material_certificate_id uuid null references material_certificates(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_traceability_project on project_traceability(project_id);

-- Seed default type layout
insert into parameter_traceability_types (code, label, use_dn, use_dn2, use_sch, use_pressure, use_thickness, use_filler_type, default_sch, default_pressure)
values
  ('P', 'Rør', true, false, true, false, false, false, '10s', null),
  ('B', 'Bend', true, false, true, false, false, false, '10s', null),
  ('T', 'T-stykke', true, false, true, false, false, false, '10s', null),
  ('TR', 'T-stykke reduserende', true, true, true, false, false, false, '10s', null),
  ('RC', 'Kon sentrisk', true, true, true, false, false, false, '10s', null),
  ('RE', 'Kon eksentrisk', true, true, true, false, false, false, '10s', null),
  ('EC', 'End cap', true, false, true, false, false, false, '10s', null),
  ('F', 'Flens', true, false, false, true, false, false, null, 'PN10'),
  ('R', 'Sveisering', true, false, false, true, false, false, null, 'PN10'),
  ('PL', 'Plate', false, false, false, false, true, false, null, null),
  ('ST', 'Sveisetilsett', false, false, false, false, false, true, null, null)
on conflict (code) do nothing;

-- Seed options
insert into parameter_traceability_options (group_key, value, is_default, sort_order)
values
  ('dn', '10', false, 1),
  ('dn', '15', false, 2),
  ('dn', '20', false, 3),
  ('dn', '25', false, 4),
  ('dn', '32', false, 5),
  ('dn', '40', false, 6),
  ('dn', '50', false, 7),
  ('dn', '65', false, 8),
  ('dn', '80', false, 9),
  ('dn', '100', false, 10),
  ('dn', '125', false, 11),
  ('dn', '150', false, 12),
  ('dn', '200', false, 13),
  ('dn', '250', false, 14),
  ('dn', '300', false, 15),
  ('sch', '10s', true, 1),
  ('sch', '20', false, 2),
  ('sch', '40', false, 3),
  ('sch', '80', false, 4),
  ('pn', 'PN10', true, 1),
  ('pn', 'PN16', false, 2),
  ('pn', 'PN25', false, 3),
  ('pn', 'PN40', false, 4)
on conflict do nothing;
