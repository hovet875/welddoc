ALTER TABLE wpqr
  ADD COLUMN IF NOT EXISTS doc_date DATE;

ALTER TABLE wps
  ADD COLUMN IF NOT EXISTS doc_date DATE;

UPDATE wpqr
SET doc_date = COALESCE(doc_date, created_at::date)
WHERE doc_date IS NULL;

UPDATE wps
SET doc_date = COALESCE(doc_date, created_at::date)
WHERE doc_date IS NULL;

ALTER TABLE wpqr
  ALTER COLUMN doc_date SET DEFAULT CURRENT_DATE;

ALTER TABLE wps
  ALTER COLUMN doc_date SET DEFAULT CURRENT_DATE;

ALTER TABLE wpqr
  ALTER COLUMN doc_date SET NOT NULL;

ALTER TABLE wps
  ALTER COLUMN doc_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wpqr_doc_date ON wpqr (doc_date DESC);
CREATE INDEX IF NOT EXISTS idx_wps_doc_date ON wps (doc_date DESC);
