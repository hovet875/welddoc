DROP POLICY IF EXISTS "user_document_package_jobs_insert" ON public.document_package_jobs;
DROP POLICY IF EXISTS "admin_document_package_jobs_insert" ON public.document_package_jobs;

CREATE POLICY "admin_document_package_jobs_insert"
  ON public.document_package_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "user_document_package_jobs_delete" ON public.document_package_jobs;
DROP POLICY IF EXISTS "admin_document_package_jobs_delete" ON public.document_package_jobs;

CREATE POLICY "admin_document_package_jobs_delete"
  ON public.document_package_jobs
  FOR DELETE
  TO authenticated
  USING (public.is_admin());