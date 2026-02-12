-- Echelon Web Monitor - Initial Schema
-- This migration creates the complete database schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE user_role AS ENUM ('admin', 'client');
CREATE TYPE project_role AS ENUM ('viewer', 'editor');
CREATE TYPE schedule_type AS ENUM ('weekly', 'monthly', 'manual');
CREATE TYPE serp_source AS ENUM ('google_organic', 'google_news');
CREATE TYPE scan_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE sentiment_type AS ENUM ('positive', 'negative', 'neutral', 'mixed');
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ============================================
-- TABLES
-- ============================================

-- Users table (linked to Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT '',
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  competitors JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources JSONB NOT NULL DEFAULT '["google_organic", "google_news"]'::jsonb,
  schedule schedule_type NOT NULL DEFAULT 'manual',
  schedule_day INT NOT NULL DEFAULT 1,
  language TEXT NOT NULL DEFAULT 'it',
  location_code INT NOT NULL DEFAULT 2380,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project-User association
CREATE TABLE project_users (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'viewer',
  PRIMARY KEY (project_id, user_id)
);

-- Scans
CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  status scan_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_tasks INT NOT NULL DEFAULT 0,
  completed_tasks INT NOT NULL DEFAULT 0
);

-- SERP Results
CREATE TABLE serp_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  source serp_source NOT NULL,
  position INT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  snippet TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  is_competitor BOOLEAN NOT NULL DEFAULT false,
  excerpt TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Analysis
CREATE TABLE ai_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  serp_result_id UUID NOT NULL REFERENCES serp_results(id) ON DELETE CASCADE,
  themes JSONB NOT NULL DEFAULT '[]'::jsonb,
  sentiment sentiment_type NOT NULL DEFAULT 'neutral',
  sentiment_score FLOAT NOT NULL DEFAULT 0.0,
  entities JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT NOT NULL DEFAULT '',
  language_detected TEXT NOT NULL DEFAULT '',
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tags (materialized)
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  count INT NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Job Queue
CREATE TABLE job_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  source serp_source NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_serp_results_scan_keyword ON serp_results(scan_id, keyword);
CREATE INDEX idx_serp_results_domain ON serp_results(domain);
CREATE INDEX idx_serp_results_is_competitor ON serp_results(is_competitor);
CREATE INDEX idx_ai_analysis_serp_result ON ai_analysis(serp_result_id);
CREATE INDEX idx_ai_analysis_themes ON ai_analysis USING GIN(themes);
CREATE INDEX idx_tags_project_slug ON tags(project_id, slug);
CREATE INDEX idx_tags_project_count ON tags(project_id, count DESC);
CREATE INDEX idx_job_queue_status_created ON job_queue(status, created_at);
CREATE INDEX idx_scans_project ON scans(project_id);
CREATE INDEX idx_project_users_user ON project_users(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE serp_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

-- Users: admin sees all, client sees self
CREATE POLICY "Admin full access on users" ON users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (id = auth.uid());

-- Projects: admin sees all, client sees assigned
CREATE POLICY "Admin full access on projects" ON projects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE POLICY "Client view assigned projects" ON projects
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM project_users pu WHERE pu.project_id = id AND pu.user_id = auth.uid())
  );

-- Project Users: admin full, client read own
CREATE POLICY "Admin full access on project_users" ON project_users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE POLICY "Client view own memberships" ON project_users
  FOR SELECT USING (user_id = auth.uid());

-- Scans: admin full, client reads own projects
CREATE POLICY "Admin full access on scans" ON scans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE POLICY "Client view scans of assigned projects" ON scans
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM project_users pu WHERE pu.project_id = project_id AND pu.user_id = auth.uid())
  );

-- SERP Results: via scan -> project chain
CREATE POLICY "Admin full access on serp_results" ON serp_results
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE POLICY "Client view serp_results of assigned projects" ON serp_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scans s
      JOIN project_users pu ON pu.project_id = s.project_id
      WHERE s.id = scan_id AND pu.user_id = auth.uid()
    )
  );

-- AI Analysis: via serp_result -> scan -> project chain
CREATE POLICY "Admin full access on ai_analysis" ON ai_analysis
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE POLICY "Client view ai_analysis of assigned projects" ON ai_analysis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM serp_results sr
      JOIN scans s ON s.id = sr.scan_id
      JOIN project_users pu ON pu.project_id = s.project_id
      WHERE sr.id = serp_result_id AND pu.user_id = auth.uid()
    )
  );

-- Tags: via project
CREATE POLICY "Admin full access on tags" ON tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE POLICY "Client view tags of assigned projects" ON tags
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM project_users pu WHERE pu.project_id = project_id AND pu.user_id = auth.uid())
  );

-- Job Queue: admin only
CREATE POLICY "Admin full access on job_queue" ON job_queue
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
