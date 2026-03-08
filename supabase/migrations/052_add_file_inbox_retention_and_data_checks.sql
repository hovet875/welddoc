-- File inbox retention helper.
-- Deletes old processed/error inbox rows in controllable batches.
create or replace function public.prune_file_inbox(
  p_retention_days integer default 90,
  p_batch_limit integer default 1000
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_retention_days, 90), 3650));
  v_limit integer := greatest(1, least(coalesce(p_batch_limit, 1000), 20000));
  v_cutoff timestamptz;
  v_deleted integer := 0;
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    raise exception 'Only admins or service role can prune file inbox.'
      using errcode = '42501';
  end if;

  v_cutoff := now() - make_interval(days => v_days);

  with to_delete as (
    select fi.id
    from public.file_inbox fi
    where fi.status in ('processed', 'error')
      and coalesce(fi.processed_at, fi.received_at) < v_cutoff
    order by coalesce(fi.processed_at, fi.received_at) asc, fi.id asc
    limit v_limit
  )
  delete from public.file_inbox fi
  using to_delete td
  where fi.id = td.id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.prune_file_inbox(integer, integer) to authenticated;
grant execute on function public.prune_file_inbox(integer, integer) to service_role;

-- Data quality constraints.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_welds_weld_no_positive'
      and conrelid = 'public.project_welds'::regclass
  ) then
    alter table public.project_welds
      add constraint project_welds_weld_no_positive
      check (weld_no > 0) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ndt_reports_weld_count_nonnegative'
      and conrelid = 'public.ndt_reports'::regclass
  ) then
    alter table public.ndt_reports
      add constraint ndt_reports_weld_count_nonnegative
      check (weld_count is null or weld_count >= 0) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ndt_reports_defect_count_nonnegative'
      and conrelid = 'public.ndt_reports'::regclass
  ) then
    alter table public.ndt_reports
      add constraint ndt_reports_defect_count_nonnegative
      check (defect_count is null or defect_count >= 0) not valid;
  end if;
end;
$$;
