ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_normalize_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
