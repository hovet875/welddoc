-- Add user profile fields used in Settings page
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;
