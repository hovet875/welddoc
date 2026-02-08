-- Add certificate type for material certificates
ALTER TABLE material_certificates
  ADD COLUMN IF NOT EXISTS cert_type TEXT NOT NULL DEFAULT '3.1'
  CHECK (cert_type IN ('2.1', '2.2', '3.1', '3.2'));

CREATE INDEX IF NOT EXISTS idx_material_certificates_cert_type ON material_certificates (cert_type);

-- Add SHA-256 checksum to files to prevent duplicates
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS sha256 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_files_sha256_unique ON files (sha256) WHERE sha256 IS NOT NULL;
