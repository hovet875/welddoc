ALTER TABLE public.project_drawings
  ALTER COLUMN file_id DROP NOT NULL;

ALTER TABLE public.project_drawings
  ADD COLUMN IF NOT EXISTS is_placeholder boolean NOT NULL DEFAULT false;
