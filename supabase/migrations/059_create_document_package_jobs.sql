CREATE TABLE IF NOT EXISTS public.document_package_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  requested_documents TEXT[] NOT NULL DEFAULT '{}'::text[],
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  artifact_file_id UUID NULL REFERENCES public.files(id) ON DELETE SET NULL,
  error_message TEXT NULL,
  created_by UUID NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  CONSTRAINT document_package_jobs_status_check CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  CONSTRAINT document_package_jobs_requested_documents_check CHECK (
    requested_documents <@ ARRAY[
      'package_main_pdf',
      'project_work_order',
      'project_drawings',
      'material_certificates',
      'filler_certificates',
      'wps_wpqr_documents',
      'welder_certificates',
      'ndt_documents',
      'calibration_certificates'
    ]::text[]
  )
);

CREATE INDEX IF NOT EXISTS idx_document_package_jobs_project_created_at
  ON public.document_package_jobs (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_package_jobs_status
  ON public.document_package_jobs (status);

CREATE INDEX IF NOT EXISTS idx_document_package_jobs_created_by
  ON public.document_package_jobs (created_by);

ALTER TABLE public.document_package_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_document_package_jobs_select" ON public.document_package_jobs;
CREATE POLICY "user_document_package_jobs_select"
  ON public.document_package_jobs
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "user_document_package_jobs_insert" ON public.document_package_jobs;
CREATE POLICY "user_document_package_jobs_insert"
  ON public.document_package_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "admin_document_package_jobs_update" ON public.document_package_jobs;
CREATE POLICY "admin_document_package_jobs_update"
  ON public.document_package_jobs
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_document_package_jobs_delete" ON public.document_package_jobs;
CREATE POLICY "admin_document_package_jobs_delete"
  ON public.document_package_jobs
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
