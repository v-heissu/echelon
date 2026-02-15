-- Add off-topic detection fields to ai_analysis
-- The context-filter agent marks results as off-topic when they are not relevant
-- to the project's industry, keywords, competitors, or project_context.

ALTER TABLE ai_analysis ADD COLUMN IF NOT EXISTS is_off_topic BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ai_analysis ADD COLUMN IF NOT EXISTS off_topic_reason TEXT;

-- Index for quick off-topic lookups (partial index on true values)
CREATE INDEX IF NOT EXISTS idx_ai_analysis_off_topic ON ai_analysis(is_off_topic) WHERE is_off_topic = true;

-- Track when the last context-filter run happened per project
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_filter_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
