-- Project drawings
CREATE TABLE IF NOT EXISTS project_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id),
  drawing_no TEXT NOT NULL,
  revision TEXT NOT NULL DEFAULT 'A',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_drawings_project ON project_drawings (project_id);
CREATE INDEX IF NOT EXISTS idx_project_drawings_created_at ON project_drawings (created_at);
