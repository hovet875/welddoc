create or replace function public.get_system_usage_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  table_usage jsonb := '[]'::jsonb;
  bucket_usage jsonb := '[]'::jsonb;
  type_usage jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can read system usage stats.'
      using errcode = '42501';
  end if;

  with target_tables as (
    select unnest(
      array[
        'files',
        'project_welds',
        'project_weld_logs',
        'project_drawings',
        'project_pressure_tests',
        'project_pressure_test_rows',
        'projects',
        'material_certificates',
        'welder_certificates',
        'ndt_reports',
        'ndt_report_welders',
        'ndt_certificates',
        'wps',
        'wpqr',
        'profiles',
        'ubibot_hourly'
      ]::text[]
    ) as table_name
  ),
  stats as (
    select
      t.table_name,
      coalesce(c.reltuples, 0)::bigint as row_estimate,
      coalesce(pg_total_relation_size(to_regclass(format('public.%I', t.table_name))), 0)::bigint as total_bytes
    from target_tables t
    left join pg_class c on c.oid = to_regclass(format('public.%I', t.table_name))
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table_name', s.table_name,
        'row_estimate', s.row_estimate,
        'total_bytes', s.total_bytes
      )
      order by s.total_bytes desc, s.table_name asc
    ),
    '[]'::jsonb
  )
  into table_usage
  from stats s;

  with bucket_stats as (
    select
      coalesce(bucket, 'ukjent') as bucket_name,
      count(*)::bigint as file_count,
      coalesce(sum(coalesce(size_bytes, 0)), 0)::bigint as total_bytes
    from public.files
    group by coalesce(bucket, 'ukjent')
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucket', b.bucket_name,
        'file_count', b.file_count,
        'total_bytes', b.total_bytes
      )
      order by b.total_bytes desc, b.bucket_name asc
    ),
    '[]'::jsonb
  )
  into bucket_usage
  from bucket_stats b;

  with type_stats as (
    select
      coalesce(type, 'ukjent') as type_name,
      count(*)::bigint as file_count,
      coalesce(sum(coalesce(size_bytes, 0)), 0)::bigint as total_bytes
    from public.files
    group by coalesce(type, 'ukjent')
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'type', t.type_name,
        'file_count', t.file_count,
        'total_bytes', t.total_bytes
      )
      order by t.total_bytes desc, t.type_name asc
    ),
    '[]'::jsonb
  )
  into type_usage
  from type_stats t;

  return jsonb_build_object(
    'generated_at', now(),
    'table_usage', table_usage,
    'storage', jsonb_build_object(
      'file_count', (select count(*)::bigint from public.files),
      'total_bytes', (select coalesce(sum(coalesce(size_bytes, 0)), 0)::bigint from public.files),
      'bucket_usage', bucket_usage,
      'type_usage', type_usage
    )
  );
end;
$$;

grant execute on function public.get_system_usage_stats() to authenticated;
grant execute on function public.get_system_usage_stats() to service_role;
