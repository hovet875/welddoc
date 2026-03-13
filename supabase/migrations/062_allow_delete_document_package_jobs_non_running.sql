DROP POLICY IF EXISTS "admin_document_package_jobs_delete" ON public.document_package_jobs;
DROP POLICY IF EXISTS "user_document_package_jobs_delete_non_running" ON public.document_package_jobs;

CREATE POLICY "user_document_package_jobs_delete_non_running"
  ON public.document_package_jobs
  FOR DELETE
  TO authenticated
  USING (status <> 'running');