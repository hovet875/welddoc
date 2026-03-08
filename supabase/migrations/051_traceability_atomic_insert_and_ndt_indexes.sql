-- Make project_traceability code indexes safe under concurrency.
-- 1) Backfill missing code_index values.
-- 2) Resolve existing duplicates by moving extra rows to new indexes after current max.
-- 3) Enforce NOT NULL + UNIQUE(project_id, type_code, code_index).
-- 4) Add an atomic insert function that allocates next code_index inside the database.

with missing as (
  select
    pt.id,
    pt.project_id,
    pt.type_code,
    row_number() over (
      partition by pt.project_id, pt.type_code
      order by pt.created_at, pt.id
    ) as rn
  from public.project_traceability pt
  where pt.code_index is null
),
base as (
  select
    pt.project_id,
    pt.type_code,
    coalesce(max(pt.code_index), 0) as max_code
  from public.project_traceability pt
  group by pt.project_id, pt.type_code
)
update public.project_traceability pt
set code_index = b.max_code + m.rn
from missing m
join base b
  on b.project_id = m.project_id
 and b.type_code = m.type_code
where pt.id = m.id;

with duplicate_rows as (
  select
    pt.id,
    pt.project_id,
    pt.type_code,
    pt.created_at,
    row_number() over (
      partition by pt.project_id, pt.type_code, pt.code_index
      order by pt.created_at, pt.id
    ) as dup_pos
  from public.project_traceability pt
  where pt.code_index is not null
),
needs_fix as (
  select
    dr.id,
    dr.project_id,
    dr.type_code,
    dr.created_at
  from duplicate_rows dr
  where dr.dup_pos > 1
),
base as (
  select
    pt.project_id,
    pt.type_code,
    coalesce(max(pt.code_index), 0) as max_code
  from public.project_traceability pt
  group by pt.project_id, pt.type_code
),
reassigned as (
  select
    nf.id,
    b.max_code
      + row_number() over (
          partition by nf.project_id, nf.type_code
          order by nf.created_at, nf.id
        ) as new_code_index
  from needs_fix nf
  join base b
    on b.project_id = nf.project_id
   and b.type_code = nf.type_code
)
update public.project_traceability pt
set code_index = r.new_code_index
from reassigned r
where pt.id = r.id;

alter table public.project_traceability
alter column code_index set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_traceability_project_id_type_code_code_index_key'
      and conrelid = 'public.project_traceability'::regclass
  ) then
    alter table public.project_traceability
      add constraint project_traceability_project_id_type_code_code_index_key
      unique (project_id, type_code, code_index);
  end if;
end;
$$;

drop index if exists public.idx_project_traceability_type_seq;

create or replace function public.create_project_traceability_with_next_index(
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
  p_heat_number text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_next_index integer;
begin
  if p_project_id is null then
    raise exception 'project_id is required' using errcode = '23502';
  end if;

  if coalesce(trim(p_type_code), '') = '' then
    raise exception 'type_code is required' using errcode = '23502';
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
    code_index,
    dn,
    dn2,
    sch,
    pressure_class,
    thickness,
    filler_type,
    material_id,
    material_certificate_id,
    heat_number
  )
  values (
    v_id,
    p_project_id,
    p_type_code,
    v_next_index,
    nullif(trim(coalesce(p_dn, '')), ''),
    nullif(trim(coalesce(p_dn2, '')), ''),
    nullif(trim(coalesce(p_sch, '')), ''),
    nullif(trim(coalesce(p_pressure_class, '')), ''),
    nullif(trim(coalesce(p_thickness, '')), ''),
    nullif(trim(coalesce(p_filler_type, '')), ''),
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
  text
) to anon, authenticated, service_role;

-- NDT list query support indexes.
create index if not exists idx_ndt_reports_report_date_created_at
  on public.ndt_reports using btree (report_date desc nulls last, created_at desc);

create index if not exists idx_ndt_reports_title_report_date_created_at
  on public.ndt_reports using btree (title, report_date desc nulls last, created_at desc);
