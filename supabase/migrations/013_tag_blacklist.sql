-- Tag blacklist: stores blacklisted tag names per project.
-- Results with blacklisted tags are hard-deleted (not soft-flagged).

CREATE TABLE IF NOT EXISTS tag_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, tag_name)
);

CREATE INDEX IF NOT EXISTS idx_tag_blacklist_project ON tag_blacklist(project_id);

-- Drop old soft-filter columns (replaced by hard delete)
ALTER TABLE ai_analysis DROP COLUMN IF EXISTS is_off_topic;
ALTER TABLE ai_analysis DROP COLUMN IF EXISTS off_topic_reason;

-- Drop last_filter_at from projects (no longer needed)
ALTER TABLE projects DROP COLUMN IF EXISTS last_filter_at;

-- Drop the old partial index if it exists
DROP INDEX IF EXISTS idx_ai_analysis_off_topic;

NOTIFY pgrst, 'reload schema';
