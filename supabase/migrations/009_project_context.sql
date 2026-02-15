-- Add optional project context/purpose field for AI briefing enrichment
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_context TEXT DEFAULT NULL;

COMMENT ON COLUMN projects.project_context IS 'Optional free-text description of the project purpose/scope, used to enrich AI briefing generation';
