-- Files metadata
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT NOT NULL,
  label TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT files_bucket_path_key UNIQUE (bucket, path)
);

CREATE INDEX IF NOT EXISTS idx_files_type ON files (type);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files (created_at);

-- Generic links between files and domain entities
CREATE TABLE IF NOT EXISTS file_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT file_links_unique UNIQUE (file_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_file_links_entity ON file_links (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_file_links_file ON file_links (file_id);
