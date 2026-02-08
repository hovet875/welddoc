-- Replace report_year with report_date
ALTER TABLE ndt_reports
  ADD COLUMN IF NOT EXISTS report_date DATE;

UPDATE ndt_reports
SET report_date = COALESCE(report_date, created_at::date)
WHERE report_date IS NULL;

ALTER TABLE ndt_reports
  DROP COLUMN IF EXISTS report_year;
