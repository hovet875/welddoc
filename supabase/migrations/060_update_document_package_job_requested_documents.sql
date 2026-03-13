ALTER TABLE public.document_package_jobs
  DROP CONSTRAINT IF EXISTS document_package_jobs_requested_documents_check;

-- The documentation package module is treated as a clean start.
-- This migration intentionally re-states the fixed package contract so
-- local databases that ran an earlier draft still end up on the same model.
ALTER TABLE public.document_package_jobs
  ADD CONSTRAINT document_package_jobs_requested_documents_check CHECK (
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
  );
