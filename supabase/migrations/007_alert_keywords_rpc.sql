-- Ensure the column exists with proper defaults
ALTER TABLE projects ADD COLUMN IF NOT EXISTS alert_keywords JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Force PostgREST to reload its schema cache so it knows about alert_keywords
NOTIFY pgrst, 'reload schema';

-- RPC function that bypasses PostgREST column cache entirely
-- Uses SECURITY DEFINER so it runs with the function owner's privileges
CREATE OR REPLACE FUNCTION set_project_alert_keywords(p_slug TEXT, p_keywords JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  UPDATE projects
  SET alert_keywords = p_keywords
  WHERE slug = p_slug
  RETURNING alert_keywords INTO result;

  RETURN result;
END;
$$;
