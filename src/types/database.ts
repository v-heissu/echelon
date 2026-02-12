export type UserRole = 'admin' | 'client';
export type ProjectRole = 'viewer' | 'editor';
export type Schedule = 'weekly' | 'monthly' | 'manual';
export type SerpSource = 'google_organic' | 'google_news';
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';
export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  created_at: string;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  industry: string;
  keywords: string[];
  competitors: string[];
  sources: SerpSource[];
  schedule: Schedule;
  schedule_day: number;
  language: string;
  location_code: number;
  is_active: boolean;
  created_at: string;
}

export interface ProjectUser {
  project_id: string;
  user_id: string;
  role: ProjectRole;
}

export interface Scan {
  id: string;
  project_id: string;
  trigger_type: 'scheduled' | 'manual';
  status: ScanStatus;
  started_at: string | null;
  completed_at: string | null;
  total_tasks: number;
  completed_tasks: number;
}

export interface SerpResult {
  id: string;
  scan_id: string;
  keyword: string;
  source: SerpSource;
  position: number;
  url: string;
  title: string;
  snippet: string;
  domain: string;
  is_competitor: boolean;
  excerpt: string | null;
  fetched_at: string;
}

export interface ThemeEntry {
  name: string;
  confidence: number;
}

export interface EntityEntry {
  name: string;
  type: 'brand' | 'person' | 'product' | 'technology' | 'location';
}

export interface AiAnalysis {
  id: string;
  serp_result_id: string;
  themes: ThemeEntry[];
  sentiment: Sentiment;
  sentiment_score: number;
  entities: EntityEntry[];
  summary: string;
  language_detected: string;
  analyzed_at: string;
}

export interface Tag {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  count: number;
  last_seen_at: string;
}

export interface JobQueue {
  id: string;
  scan_id: string;
  keyword: string;
  source: SerpSource;
  status: JobStatus;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// Joined types for UI
export interface SerpResultWithAnalysis extends SerpResult {
  ai_analysis: AiAnalysis | null;
}

export interface ProjectWithUsers extends Project {
  project_users: (ProjectUser & { users: User })[];
}

export interface ScanWithProgress extends Scan {
  progress: number; // 0-100
}
