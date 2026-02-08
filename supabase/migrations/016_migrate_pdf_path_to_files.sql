-- Migrate legacy pdf_path into files + file_links (best effort)

-- Welder certificates
WITH to_move AS (
  SELECT id AS cert_id, pdf_path
  FROM welder_certificates
  WHERE file_id IS NULL AND pdf_path IS NOT NULL AND pdf_path <> ''
), inserted AS (
  INSERT INTO files (id, bucket, path, type, mime_type, created_at)
  SELECT gen_random_uuid(), 'welder-certs', t.pdf_path, 'welder_certificate', 'application/pdf', now()
  FROM to_move t
  RETURNING id, path
)
UPDATE welder_certificates wc
SET file_id = i.id
FROM inserted i
WHERE wc.pdf_path = i.path;

INSERT INTO file_links (file_id, entity_type, entity_id)
SELECT wc.file_id, 'welder_certificate', wc.id
FROM welder_certificates wc
WHERE wc.file_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- NDT certificates
WITH to_move AS (
  SELECT id AS cert_id, pdf_path
  FROM ndt_certificates
  WHERE file_id IS NULL AND pdf_path IS NOT NULL AND pdf_path <> ''
), inserted AS (
  INSERT INTO files (id, bucket, path, type, mime_type, created_at)
  SELECT gen_random_uuid(), 'ndt-certs', t.pdf_path, 'ndt_report', 'application/pdf', now()
  FROM to_move t
  RETURNING id, path
)
UPDATE ndt_certificates nc
SET file_id = i.id
FROM inserted i
WHERE nc.pdf_path = i.path;

INSERT INTO file_links (file_id, entity_type, entity_id)
SELECT nc.file_id, 'ndt_report', nc.id
FROM ndt_certificates nc
WHERE nc.file_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- WPQR
WITH to_move AS (
  SELECT id AS wpqr_id, pdf_path
  FROM wpqr
  WHERE file_id IS NULL AND pdf_path IS NOT NULL AND pdf_path <> ''
), inserted AS (
  INSERT INTO files (id, bucket, path, type, mime_type, created_at)
  SELECT gen_random_uuid(), 'docs', t.pdf_path, 'wpqr', 'application/pdf', now()
  FROM to_move t
  RETURNING id, path
)
UPDATE wpqr w
SET file_id = i.id
FROM inserted i
WHERE w.pdf_path = i.path;

INSERT INTO file_links (file_id, entity_type, entity_id)
SELECT w.file_id, 'wpqr', w.id
FROM wpqr w
WHERE w.file_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- WPS
WITH to_move AS (
  SELECT id AS wps_id, pdf_path
  FROM wps
  WHERE file_id IS NULL AND pdf_path IS NOT NULL AND pdf_path <> ''
), inserted AS (
  INSERT INTO files (id, bucket, path, type, mime_type, created_at)
  SELECT gen_random_uuid(), 'docs', t.pdf_path, 'wps', 'application/pdf', now()
  FROM to_move t
  RETURNING id, path
)
UPDATE wps w
SET file_id = i.id
FROM inserted i
WHERE w.pdf_path = i.path;

INSERT INTO file_links (file_id, entity_type, entity_id)
SELECT w.file_id, 'wps', w.id
FROM wps w
WHERE w.file_id IS NOT NULL
ON CONFLICT DO NOTHING;
