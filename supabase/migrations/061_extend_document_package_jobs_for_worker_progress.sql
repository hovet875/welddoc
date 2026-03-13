ALTER TABLE public.document_package_jobs
  ADD COLUMN IF NOT EXISTS main_pdf_file_id UUID NULL REFERENCES public.files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_zip_file_id UUID NULL REFERENCES public.files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS progress_percent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_step TEXT NULL,
  ADD COLUMN IF NOT EXISTS progress_message TEXT NULL,
  ADD COLUMN IF NOT EXISTS progress_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS worker_ref TEXT NULL,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ NULL;

ALTER TABLE public.document_package_jobs
  DROP CONSTRAINT IF EXISTS document_package_jobs_progress_percent_check;

ALTER TABLE public.document_package_jobs
  ADD CONSTRAINT document_package_jobs_progress_percent_check CHECK (
    progress_percent >= 0 AND progress_percent <= 100
  );

CREATE INDEX IF NOT EXISTS idx_document_package_jobs_worker_ref
  ON public.document_package_jobs (worker_ref);
