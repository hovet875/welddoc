-- RLS hardening + clearer policy model.
-- 1) Tighten supplier select policy to authenticated only.
-- 2) Replace broad admin *_ALL policies with explicit admin write policies.
--    Existing user insert/select policies are kept as-is.

do $$
declare
  r record;
begin
  -- This policy previously omitted "TO authenticated", which made it PUBLIC.
  execute 'drop policy if exists "user_parameter_suppliers_select" on public.parameter_suppliers';
  execute 'create policy "user_parameter_suppliers_select" on public.parameter_suppliers for select to authenticated using (true)';

  for r in
    select *
    from (
      values
        ('file_inbox', 'admin_file_inbox_all', true),
        ('file_links', 'admin_file_links_ALL', false),
        ('files', 'admin_files_ALL', false),
        ('ndt_certificates', 'admin_full_access_ndt', false),
        ('profiles', 'admin_full_access_profiles', false),
        ('welder_certificates', 'admin_full_access_welder_certificates', false),
        ('wpqr', 'admin_full_access_wpqr', false),
        ('wps', 'admin_full_access_wps', false),
        ('material_certificates', 'admin_material_certificates_ALL', false),
        ('ndt_report_welders', 'admin_ndt_report_welders_ALL', false),
        ('ndt_reports', 'admin_ndt_reports_ALL', false),
        ('parameter_customers', 'admin_parameter_customers_ALL', false),
        ('parameter_ndt_inspectors', 'admin_parameter_ndt_inspectors_ALL', false),
        ('parameter_ndt_methods', 'admin_parameter_ndt_methods_ALL', false),
        ('parameter_ndt_suppliers', 'admin_parameter_ndt_suppliers_ALL', false),
        ('parameter_suppliers', 'admin_parameter_suppliers_ALL', false),
        ('parameter_traceability_options', 'admin_parameter_traceability_options_ALL', false),
        ('parameter_traceability_types', 'admin_parameter_traceability_types_ALL', false),
        ('parameter_job_titles', 'job_titles_admin_ALL', false),
        ('parameter_materials', 'materials_admin_ALL', false),
        ('parameter_welding_processes', 'admin_parameter_welding_processes_ALL', false),
        ('project_drawings', 'admin_project_drawings_ALL', false),
        ('project_pressure_test_rows', 'admin_project_pressure_test_rows_ALL', false),
        ('project_pressure_tests', 'admin_project_pressure_tests_ALL', false),
        ('project_traceability', 'admin_project_traceability_ALL', false),
        ('project_weld_logs', 'admin_project_weld_logs_ALL', false),
        ('project_welds', 'admin_project_welds_ALL', false),
        ('projects', 'projects_admin_ALL', false),
        ('parameter_standard_fm_groups', 'standard_fm_groups_admin_ALL', false),
        ('parameter_standards', 'standards_admin_ALL', false)
    ) as t(table_name, policy_name, add_admin_select)
  loop
    execute format('drop policy if exists %I on public.%I', r.policy_name, r.table_name);

    execute format('drop policy if exists %I on public.%I', r.policy_name || '_insert', r.table_name);
    execute format('drop policy if exists %I on public.%I', r.policy_name || '_update', r.table_name);
    execute format('drop policy if exists %I on public.%I', r.policy_name || '_delete', r.table_name);

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_admin())',
      r.policy_name || '_insert',
      r.table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',
      r.policy_name || '_update',
      r.table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_admin())',
      r.policy_name || '_delete',
      r.table_name
    );

    if r.add_admin_select then
      execute format('drop policy if exists %I on public.%I', r.policy_name || '_select', r.table_name);
      execute format(
        'create policy %I on public.%I for select to authenticated using (public.is_admin())',
        r.policy_name || '_select',
        r.table_name
      );
    end if;
  end loop;
end;
$$;
