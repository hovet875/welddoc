ALTER TABLE project_welds
  ADD COLUMN IF NOT EXISTS visual_report_id UUID;

DO $$
BEGIN
  ALTER TABLE project_welds
    ADD CONSTRAINT project_welds_visual_report_id_fkey
    FOREIGN KEY (visual_report_id) REFERENCES ndt_reports(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_welds_visual_report_id
  ON project_welds (visual_report_id);

UPDATE project_welds pw
SET visual_report_id = nr.id
FROM ndt_reports nr
WHERE pw.visual_report_id IS NULL
  AND pw.visual_inspector IS NOT NULL
  AND trim(pw.visual_inspector) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND nr.id::text = trim(pw.visual_inspector);
