-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_no INTEGER NOT NULL UNIQUE,
  work_order TEXT NOT NULL,
  customer TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE projects
  ADD CONSTRAINT projects_project_no_range CHECK (project_no BETWEEN 1 AND 10000);

CREATE INDEX IF NOT EXISTS idx_projects_active ON projects (is_active);
CREATE INDEX IF NOT EXISTS idx_projects_project_no ON projects (project_no);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects (created_at);
