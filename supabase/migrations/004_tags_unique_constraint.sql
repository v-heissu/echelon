-- Add unique constraint on tags(project_id, slug) for proper upsert support
-- Drop the existing index first since the unique constraint creates its own index
DROP INDEX IF EXISTS idx_tags_project_slug;
ALTER TABLE tags ADD CONSTRAINT tags_project_slug_unique UNIQUE (project_id, slug);
