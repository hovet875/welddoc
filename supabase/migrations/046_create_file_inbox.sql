CREATE TABLE IF NOT EXISTS file_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  target TEXT NOT NULL CHECK (target IN ('ndt_report', 'material_certificate')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processed', 'error')),
  source_folder TEXT NOT NULL,
  source_path TEXT NOT NULL,
  suggested_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_file_inbox_target_status_received
  ON file_inbox (target, status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_file_inbox_file_id
  ON file_inbox (file_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_inbox_unique_new_file_target
  ON file_inbox (file_id, target)
  WHERE status = 'new';

ALTER TABLE file_inbox ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "admin_file_inbox_all"
    ON file_inbox
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
