-- Ensure profiles has safe defaults so auth triggers won't fail
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS login_enabled BOOLEAN DEFAULT true;

ALTER TABLE profiles
  ALTER COLUMN role SET DEFAULT 'user',
  ALTER COLUMN role DROP NOT NULL,
  ALTER COLUMN login_enabled SET DEFAULT true,
  ALTER COLUMN login_enabled DROP NOT NULL;