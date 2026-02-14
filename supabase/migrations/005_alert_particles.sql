-- Add alert particles (semantic keywords) to projects for hi-priority detection
-- When AI analysis detects these particles in entities/themes, results are flagged as hi-priority

ALTER TABLE projects ADD COLUMN IF NOT EXISTS alert_keywords JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add hi-priority flag to ai_analysis
ALTER TABLE ai_analysis ADD COLUMN IF NOT EXISTS is_hi_priority BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ai_analysis ADD COLUMN IF NOT EXISTS priority_reason TEXT;

-- Index for quick hi-priority lookups
CREATE INDEX IF NOT EXISTS idx_ai_analysis_hi_priority ON ai_analysis(is_hi_priority) WHERE is_hi_priority = true;
