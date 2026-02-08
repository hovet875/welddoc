ALTER TABLE IF EXISTS ndt_report_welders
  ADD COLUMN IF NOT EXISTS weld_count INTEGER,
  ADD COLUMN IF NOT EXISTS defect_count INTEGER;

-- Backfill per-welder counts when a report only has one welder.
UPDATE ndt_report_welders rw
SET
  weld_count = r.weld_count,
  defect_count = r.defect_count
FROM ndt_reports r
WHERE r.id = rw.report_id
  AND (SELECT COUNT(*) FROM ndt_report_welders rw2 WHERE rw2.report_id = r.id) = 1
  AND rw.weld_count IS NULL
  AND rw.defect_count IS NULL;
