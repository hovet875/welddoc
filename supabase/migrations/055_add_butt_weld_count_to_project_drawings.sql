ALTER TABLE public.project_drawings
  ADD COLUMN IF NOT EXISTS butt_weld_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.project_drawings
  ALTER COLUMN butt_weld_count SET DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_drawings_butt_weld_count_nonnegative'
      AND conrelid = 'public.project_drawings'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'project_drawings_butt_weld_count_positive'
        AND conrelid = 'public.project_drawings'::regclass
    ) THEN
      ALTER TABLE public.project_drawings
        DROP CONSTRAINT project_drawings_butt_weld_count_positive;
    END IF;

    ALTER TABLE public.project_drawings
      ADD CONSTRAINT project_drawings_butt_weld_count_nonnegative
      CHECK (butt_weld_count >= 0) NOT VALID;
  END IF;
END $$;
