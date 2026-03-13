-- Profile-driven traceability on top of fixed traceability columns.
-- Strategy:
-- 1) Keep project_traceability as fixed columns (adds od/od2/description/custom_dimension + profile_id).
-- 2) Add profile metadata tables that define which fixed fields are used for a profile.
-- 3) Backfill a default profile per existing type from legacy use_* flags.
-- 4) Add optional recommended profiles for common combinations (OD-based and custom).
-- 5) Update create_project_traceability_with_next_index to accept profile + new fixed columns.

create table if not exists public.parameter_traceability_profiles (
  id uuid primary key default gen_random_uuid(),
  type_code text not null references public.parameter_traceability_types(code) on delete cascade,
  code text not null,
  label text not null,
  certificate_type text not null default 'material'
    constraint parameter_traceability_profiles_certificate_type_check
      check (certificate_type in ('material', 'filler')),
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_parameter_traceability_profiles_type_code
  on public.parameter_traceability_profiles(type_code, code);

create unique index if not exists uq_parameter_traceability_profiles_default_per_type
  on public.parameter_traceability_profiles(type_code)
  where is_default;

create index if not exists idx_parameter_traceability_profiles_type
  on public.parameter_traceability_profiles(type_code, is_active, sort_order, created_at desc);

create table if not exists public.parameter_traceability_profile_fields (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.parameter_traceability_profiles(id) on delete cascade,
  field_key text not null
    constraint parameter_traceability_profile_fields_field_key_check
      check (field_key in (
        'dn',
        'dn2',
        'od',
        'od2',
        'sch',
        'pressure_class',
        'thickness',
        'filler_type',
        'description',
        'custom_dimension'
      )),
  label text not null,
  input_mode text not null default 'text'
    constraint parameter_traceability_profile_fields_input_mode_check
      check (input_mode in ('option', 'text', 'number')),
  option_group_key text null,
  required boolean not null default true,
  sort_order integer not null default 0,
  default_value text null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_parameter_traceability_profile_fields_profile_key
  on public.parameter_traceability_profile_fields(profile_id, field_key);

create index if not exists idx_parameter_traceability_profile_fields_profile
  on public.parameter_traceability_profile_fields(profile_id, sort_order, created_at);

alter table public.project_traceability
  add column if not exists profile_id uuid null references public.parameter_traceability_profiles(id) on delete set null,
  add column if not exists od text null,
  add column if not exists od2 text null,
  add column if not exists description text null,
  add column if not exists custom_dimension text null;

create index if not exists idx_project_traceability_profile_id
  on public.project_traceability(profile_id);

-- Backfill one default profile per existing traceability type.
insert into public.parameter_traceability_profiles (
  type_code,
  code,
  label,
  certificate_type,
  is_default,
  is_active,
  sort_order
)
select
  t.code as type_code,
  'DEFAULT' as code,
  'Standard' as label,
  case when t.use_filler_type then 'filler' else 'material' end as certificate_type,
  true as is_default,
  true as is_active,
  0 as sort_order
from public.parameter_traceability_types t
where not exists (
  select 1
  from public.parameter_traceability_profiles p
  where p.type_code = t.code
    and p.code = 'DEFAULT'
);

with defaults as (
  select
    t.code as type_code,
    p.id as profile_id,
    t.use_dn,
    t.use_dn2,
    t.use_sch,
    t.use_pressure,
    t.use_thickness,
    t.use_filler_type,
    t.default_sch,
    t.default_pressure
  from public.parameter_traceability_types t
  join public.parameter_traceability_profiles p
    on p.type_code = t.code
   and p.code = 'DEFAULT'
),
rows as (
  select
    d.profile_id,
    x.field_key,
    x.label,
    x.input_mode,
    x.option_group_key,
    x.required,
    x.sort_order,
    x.default_value
  from defaults d
  cross join lateral (
    values
      ('dn', 'DN', 'option', 'dn', d.use_dn, 10, null::text),
      ('dn2', 'DN2', 'option', 'dn', d.use_dn2, 20, null::text),
      ('sch', 'SCH', 'option', 'sch', d.use_sch, 30, d.default_sch),
      ('pressure_class', 'Trykklasse', 'option', 'pn', d.use_pressure, 40, d.default_pressure),
      ('thickness', 'Tykkelse (mm)', 'number', null, d.use_thickness, 50, null::text),
      ('filler_type', 'Sveisetilsett type', 'option', 'filler_type', d.use_filler_type, 60, null::text)
  ) as x(field_key, label, input_mode, option_group_key, required, sort_order, default_value)
  where x.required
)
insert into public.parameter_traceability_profile_fields (
  profile_id,
  field_key,
  label,
  input_mode,
  option_group_key,
  required,
  sort_order,
  default_value
)
select
  r.profile_id,
  r.field_key,
  r.label,
  r.input_mode,
  r.option_group_key,
  true,
  r.sort_order,
  r.default_value
from rows r
on conflict (profile_id, field_key) do update
set
  label = excluded.label,
  input_mode = excluded.input_mode,
  option_group_key = excluded.option_group_key,
  required = excluded.required,
  sort_order = excluded.sort_order,
  default_value = excluded.default_value;

-- Recommended alternative profiles (non-default) for common combinations.
insert into public.parameter_traceability_profiles (type_code, code, label, certificate_type, is_default, is_active, sort_order)
select t.code, 'OD_THK', 'OD + tykkelse', 'material', false, true, 20
from public.parameter_traceability_types t
where t.code in ('P', 'B')
  and not exists (
    select 1
    from public.parameter_traceability_profiles p
    where p.type_code = t.code
      and p.code = 'OD_THK'
  );

insert into public.parameter_traceability_profiles (type_code, code, label, certificate_type, is_default, is_active, sort_order)
select t.code, 'OD_OD2_THK', 'OD + OD2 + tykkelse', 'material', false, true, 20
from public.parameter_traceability_types t
where t.code in ('TR', 'RC', 'RE')
  and not exists (
    select 1
    from public.parameter_traceability_profiles p
    where p.type_code = t.code
      and p.code = 'OD_OD2_THK'
  );

insert into public.parameter_traceability_profiles (type_code, code, label, certificate_type, is_default, is_active, sort_order)
select t.code, 'FILLER_THK', 'Tilsett + tykkelse', 'filler', false, true, 20
from public.parameter_traceability_types t
where t.code = 'ST'
  and not exists (
    select 1
    from public.parameter_traceability_profiles p
    where p.type_code = t.code
      and p.code = 'FILLER_THK'
  );

insert into public.parameter_traceability_profiles (type_code, code, label, certificate_type, is_default, is_active, sort_order)
select
  t.code,
  'CUSTOM',
  'Custom',
  case when t.use_filler_type then 'filler' else 'material' end,
  false,
  true,
  90
from public.parameter_traceability_types t
where not exists (
  select 1
  from public.parameter_traceability_profiles p
  where p.type_code = t.code
    and p.code = 'CUSTOM'
);

with target_profiles as (
  select
    p.id as profile_id,
    p.type_code,
    p.code
  from public.parameter_traceability_profiles p
  where
    (p.type_code in ('P', 'B') and p.code = 'OD_THK')
    or (p.type_code in ('TR', 'RC', 'RE') and p.code = 'OD_OD2_THK')
    or (p.type_code = 'ST' and p.code = 'FILLER_THK')
),
field_rows as (
  select
    tp.profile_id,
    x.field_key,
    x.label,
    x.input_mode,
    x.option_group_key,
    x.required,
    x.sort_order
  from target_profiles tp
  cross join lateral (
    values
      ('od', 'OD', 'text', null, true, 10),
      ('od2', 'OD2', 'text', null, tp.code = 'OD_OD2_THK', 20),
      ('thickness', 'Tykkelse (mm)', 'number', null, true, 30),
      ('filler_type', 'Sveisetilsett type', 'option', 'filler_type', tp.code = 'FILLER_THK', 40)
  ) as x(field_key, label, input_mode, option_group_key, required, sort_order)
  where x.required
)
insert into public.parameter_traceability_profile_fields (
  profile_id,
  field_key,
  label,
  input_mode,
  option_group_key,
  required,
  sort_order
)
select
  fr.profile_id,
  fr.field_key,
  fr.label,
  fr.input_mode,
  fr.option_group_key,
  true,
  fr.sort_order
from field_rows fr
on conflict (profile_id, field_key) do update
set
  label = excluded.label,
  input_mode = excluded.input_mode,
  option_group_key = excluded.option_group_key,
  required = excluded.required,
  sort_order = excluded.sort_order;

insert into public.parameter_traceability_profile_fields (
  profile_id,
  field_key,
  label,
  input_mode,
  option_group_key,
  required,
  sort_order
)
select
  p.id as profile_id,
  'description' as field_key,
  'Beskrivelse' as label,
  'text' as input_mode,
  null as option_group_key,
  true as required,
  10 as sort_order
from public.parameter_traceability_profiles p
where p.code = 'CUSTOM'
on conflict (profile_id, field_key) do update
set
  label = excluded.label,
  input_mode = excluded.input_mode,
  option_group_key = excluded.option_group_key,
  required = excluded.required,
  sort_order = excluded.sort_order;

insert into public.parameter_traceability_profile_fields (
  profile_id,
  field_key,
  label,
  input_mode,
  option_group_key,
  required,
  sort_order
)
select
  p.id as profile_id,
  'custom_dimension' as field_key,
  'Spesifikasjon' as label,
  'text' as input_mode,
  null as option_group_key,
  false as required,
  20 as sort_order
from public.parameter_traceability_profiles p
where p.code = 'CUSTOM'
on conflict (profile_id, field_key) do update
set
  label = excluded.label,
  input_mode = excluded.input_mode,
  option_group_key = excluded.option_group_key,
  required = excluded.required,
  sort_order = excluded.sort_order;

-- Backfill profile_id on existing traceability rows to the default profile for each type.
update public.project_traceability pt
set profile_id = p.id
from public.parameter_traceability_profiles p
where pt.profile_id is null
  and p.type_code = pt.type_code
  and p.is_default = true;

with ranked_profiles as (
  select
    pt.id as traceability_id,
    p.id as profile_id,
    row_number() over (
      partition by pt.id
      order by p.is_default desc, p.sort_order asc, p.created_at asc
    ) as rn
  from public.project_traceability pt
  join public.parameter_traceability_profiles p
    on p.type_code = pt.type_code
  where pt.profile_id is null
),
best_profile as (
  select traceability_id, profile_id
  from ranked_profiles
  where rn = 1
)
update public.project_traceability pt
set profile_id = bp.profile_id
from best_profile bp
where pt.id = bp.traceability_id
  and pt.profile_id is null;

-- Replace old RPC signature with profile-aware fixed-column signature.
drop function if exists public.create_project_traceability_with_next_index(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text
);

create function public.create_project_traceability_with_next_index(
  p_project_id uuid,
  p_type_code text,
  p_dn text default null,
  p_dn2 text default null,
  p_sch text default null,
  p_pressure_class text default null,
  p_thickness text default null,
  p_filler_type text default null,
  p_material_id uuid default null,
  p_material_certificate_id uuid default null,
  p_heat_number text default null,
  p_profile_id uuid default null,
  p_od text default null,
  p_od2 text default null,
  p_description text default null,
  p_custom_dimension text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_next_index integer;
  v_profile_id uuid;
begin
  if p_project_id is null then
    raise exception 'project_id is required' using errcode = '23502';
  end if;

  if coalesce(trim(p_type_code), '') = '' then
    raise exception 'type_code is required' using errcode = '23502';
  end if;

  if p_profile_id is not null then
    select p.id
      into v_profile_id
    from public.parameter_traceability_profiles p
    where p.id = p_profile_id
      and p.type_code = p_type_code;

    if v_profile_id is null then
      raise exception 'profile_id is invalid for type_code %', p_type_code using errcode = '23503';
    end if;
  else
    select p.id
      into v_profile_id
    from public.parameter_traceability_profiles p
    where p.type_code = p_type_code
      and p.is_active = true
    order by p.is_default desc, p.sort_order asc, p.created_at asc
    limit 1;

    if v_profile_id is null then
      raise exception 'profile_id is required (no profile configured for type_code %)', p_type_code using errcode = '23502';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_project_id::text || ':' || p_type_code, 0)
  );

  select coalesce(max(pt.code_index), 0) + 1
    into v_next_index
  from public.project_traceability pt
  where pt.project_id = p_project_id
    and pt.type_code = p_type_code;

  insert into public.project_traceability (
    id,
    project_id,
    type_code,
    profile_id,
    code_index,
    dn,
    dn2,
    od,
    od2,
    sch,
    pressure_class,
    thickness,
    filler_type,
    description,
    custom_dimension,
    material_id,
    material_certificate_id,
    heat_number
  )
  values (
    v_id,
    p_project_id,
    p_type_code,
    v_profile_id,
    v_next_index,
    nullif(trim(coalesce(p_dn, '')), ''),
    nullif(trim(coalesce(p_dn2, '')), ''),
    nullif(trim(coalesce(p_od, '')), ''),
    nullif(trim(coalesce(p_od2, '')), ''),
    nullif(trim(coalesce(p_sch, '')), ''),
    nullif(trim(coalesce(p_pressure_class, '')), ''),
    nullif(trim(coalesce(p_thickness, '')), ''),
    nullif(trim(coalesce(p_filler_type, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_custom_dimension, '')), ''),
    p_material_id,
    p_material_certificate_id,
    nullif(trim(coalesce(p_heat_number, '')), '')
  );

  return v_id;
end;
$$;

grant execute on function public.create_project_traceability_with_next_index(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text
) to anon, authenticated, service_role;

alter table public.parameter_traceability_profiles enable row level security;
alter table public.parameter_traceability_profile_fields enable row level security;

do $$
begin
  create policy "admin_parameter_traceability_profiles_insert"
    on public.parameter_traceability_profiles
    for insert
    to authenticated
    with check (public.is_admin());
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "admin_parameter_traceability_profiles_update"
    on public.parameter_traceability_profiles
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "admin_parameter_traceability_profiles_delete"
    on public.parameter_traceability_profiles
    for delete
    to authenticated
    using (public.is_admin());
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "user_parameter_traceability_profiles_select"
    on public.parameter_traceability_profiles
    for select
    to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "admin_parameter_traceability_profile_fields_insert"
    on public.parameter_traceability_profile_fields
    for insert
    to authenticated
    with check (public.is_admin());
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "admin_parameter_traceability_profile_fields_update"
    on public.parameter_traceability_profile_fields
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "admin_parameter_traceability_profile_fields_delete"
    on public.parameter_traceability_profile_fields
    for delete
    to authenticated
    using (public.is_admin());
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "user_parameter_traceability_profile_fields_select"
    on public.parameter_traceability_profile_fields
    for select
    to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;
