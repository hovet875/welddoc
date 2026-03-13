-- Separate filler manufacturer and filler diameter from generic thickness.
-- Goal:
-- - project_traceability.filler_manufacturer
-- - project_traceability.filler_diameter
-- - material_certificates.filler_manufacturer
-- - material_certificates.filler_diameter
-- - filler profiles use filler_manufacturer + filler_type + filler_diameter

alter table public.project_traceability
  add column if not exists filler_manufacturer text null,
  add column if not exists filler_diameter text null;

create index if not exists idx_project_traceability_filler_lookup
  on public.project_traceability(type_code, filler_manufacturer, filler_type, filler_diameter);

alter table public.material_certificates
  add column if not exists filler_manufacturer text null,
  add column if not exists filler_diameter text null;

create index if not exists idx_material_certificates_filler_lookup
  on public.material_certificates(certificate_type, filler_manufacturer, filler_type, filler_diameter);

-- Expand allowed profile field keys with filler_manufacturer and filler_diameter.
do $$
begin
  alter table public.parameter_traceability_profile_fields
    drop constraint if exists parameter_traceability_profile_fields_field_key_check;

  alter table public.parameter_traceability_profile_fields
    add constraint parameter_traceability_profile_fields_field_key_check
      check (
        field_key in (
          'dn',
          'dn2',
          'od',
          'od2',
          'sch',
          'pressure_class',
          'thickness',
          'filler_manufacturer',
          'filler_type',
          'filler_diameter',
          'description',
          'custom_dimension'
        )
      );
exception
  when undefined_table then null;
end $$;

-- Backfill certificate diameter from legacy "filler_type + mm"-pattern.
update public.material_certificates mc
set filler_diameter = replace((regexp_match(mc.filler_type, '([0-9]+(?:[.,][0-9]+)?)\s*mm\s*$'))[1], ',', '.')
where mc.certificate_type = 'filler'
  and mc.filler_diameter is null
  and mc.filler_type is not null
  and mc.filler_type ~* '([0-9]+(?:[.,][0-9]+)?)\s*mm\s*$';

update public.material_certificates mc
set filler_type = nullif(trim(regexp_replace(mc.filler_type, '\s*([0-9]+(?:[.,][0-9]+)?)\s*mm\s*$', '', 'i')), '')
where mc.certificate_type = 'filler'
  and mc.filler_type is not null
  and mc.filler_type ~* '([0-9]+(?:[.,][0-9]+)?)\s*mm\s*$';

-- Backfill traceability filler diameter from legacy thickness where relevant.
update public.project_traceability pt
set filler_diameter = nullif(trim(coalesce(pt.thickness, '')), '')
where pt.filler_diameter is null
  and trim(coalesce(pt.thickness, '')) <> ''
  and (
    trim(coalesce(pt.filler_type, '')) <> ''
    or exists (
      select 1
      from public.parameter_traceability_profiles p
      where p.id = pt.profile_id
        and p.certificate_type = 'filler'
    )
  );

-- For filler profiles (except CUSTOM), migrate any legacy "thickness as diameter".
delete from public.parameter_traceability_profile_fields f
using public.parameter_traceability_profiles p
where f.profile_id = p.id
  and p.certificate_type = 'filler'
  and p.code <> 'CUSTOM'
  and f.field_key = 'thickness'
  and exists (
    select 1
    from public.parameter_traceability_profile_fields x
    where x.profile_id = f.profile_id
      and x.field_key = 'filler_diameter'
  );

update public.parameter_traceability_profile_fields f
set
  field_key = 'filler_diameter',
  label = 'Diameter (mm)',
  input_mode = 'option',
  option_group_key = 'filler_diameter'
from public.parameter_traceability_profiles p
where f.profile_id = p.id
  and p.certificate_type = 'filler'
  and p.code <> 'CUSTOM'
  and f.field_key = 'thickness';

with filler_profiles as (
  select p.id
  from public.parameter_traceability_profiles p
  where p.certificate_type = 'filler'
    and p.code <> 'CUSTOM'
),
field_rows as (
  select
    fp.id as profile_id,
    x.field_key,
    x.label,
    x.input_mode,
    x.option_group_key,
    x.required,
    x.sort_order
  from filler_profiles fp
  cross join lateral (
    values
      ('filler_manufacturer', 'Produsent', 'option', 'filler_manufacturer', true, 30),
      ('filler_type', 'Sveisetilsett type', 'option', 'filler_type', true, 40),
      ('filler_diameter', 'Diameter (mm)', 'option', 'filler_diameter', true, 50)
  ) as x(field_key, label, input_mode, option_group_key, required, sort_order)
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
  fr.required,
  fr.sort_order
from field_rows fr
on conflict (profile_id, field_key) do update
set
  label = excluded.label,
  input_mode = excluded.input_mode,
  option_group_key = excluded.option_group_key,
  required = excluded.required,
  sort_order = excluded.sort_order;

-- Include new filler columns in heat search view.
create or replace view public.material_certificate_heats
with (security_invoker='on')
as
select
  mc.id as certificate_id,
  mc.certificate_type,
  mc.material_id,
  mc.filler_type,
  mc.file_id,
  f.label as file_label,
  mc.created_at,
  trim(both from h.heat) as heat_number,
  mc.filler_manufacturer,
  mc.filler_diameter
from public.material_certificates mc
left join public.files f
  on f.id = mc.file_id
cross join lateral unnest(coalesce(mc.heat_numbers, array[]::text[])) as h(heat)
where trim(both from coalesce(h.heat, '')) <> '';

alter view public.material_certificate_heats owner to postgres;

-- Replace RPC with filler_manufacturer + filler_diameter support.
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
  text,
  uuid,
  text,
  text,
  text,
  text
);

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
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
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
  p_custom_dimension text default null,
  p_filler_manufacturer text default null,
  p_filler_diameter text default null
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
    filler_manufacturer,
    filler_diameter,
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
    nullif(trim(coalesce(p_filler_manufacturer, '')), ''),
    nullif(trim(coalesce(p_filler_diameter, '')), ''),
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
  text,
  text,
  text
) to anon, authenticated, service_role;
