-- Enable RLS
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_links ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write files metadata
CREATE POLICY "files_select_authenticated" ON files
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "files_insert_authenticated" ON files
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "files_update_authenticated" ON files
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "files_delete_authenticated" ON files
  FOR DELETE TO authenticated
  USING (true);

-- Allow authenticated users to manage file links
CREATE POLICY "file_links_select_authenticated" ON file_links
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "file_links_insert_authenticated" ON file_links
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "file_links_delete_authenticated" ON file_links
  FOR DELETE TO authenticated
  USING (true);
