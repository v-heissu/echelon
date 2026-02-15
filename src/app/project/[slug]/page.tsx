'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { KPICards } from '@/components/dashboard/kpi-cards';
import { AiBriefing } from '@/components/dashboard/ai-briefing';
import { DomainBarChart } from '@/components/dashboard/domain-bar-chart';
import { SentimentChart } from '@/components/dashboard/sentiment-chart';
import { ThemeTreemap } from '@/components/dashboard/theme-treemap';
import { PublicationTimeline } from '@/components/dashboard/publication-timeline';
import { BarChart3, Loader2, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Timer, AlertTriangle, Zap } from 'lucide-react';

interface DashboardData {
  kpi: { total_results: number; unique_domains: number; competitor_mentions: number; avg_sentiment: number; alert_count: number };
  delta: { total_results: number; unique_domains: number; competitor_mentions: number; avg_sentiment: number; alert_count: number };
  sentiment_distribution: { date: string; positive: number; negative: number; neutral: number; mixed: number }[];
  top_domains: { domain: string; count: number; is_competitor: boolean }[];
  theme_sentiments: { name: string; count: number; sentiment: string; sentiment_score: number }[];
  publication_timeline: { date: string; count: number }[];
  scan_dates: string[];
  active_scan: { id: string; total_tasks: number; completed_tasks: number } | null;
  ai_briefing: string | null;
  scan_count: number;
}

interface ScanJob {
  id: string;
  keyword: string;
  source: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  duration_ms: number | null;
}

function formatJobDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return '';
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

export default function ProjectDashboard() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobDetails, setJobDetails] = useState<ScanJob[]>([]);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const mountedRef = useRef(true);
  const scanIdRef = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const dashRes = await fetch(`/api/projects/${slug}/dashboard`);
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        if (mountedRef.current) {
          setData(dashData);
          if (dashData.active_scan?.id) {
            scanIdRef.current = dashData.active_scan.id;
          }
        }
      }
    } catch {
      // Network error, will retry
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [slug]);

  // Poll scan status (lightweight) for progress bar updates
  const pollScanStatus = useCallback(async () => {
    if (!scanIdRef.current) return;
    try {
      const res = await fetch(`/api/scans/${scanIdRef.current}/status`);
      if (res.ok) {
        const statusData = await res.json();
        if (mountedRef.current) {
          setData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              active_scan: statusData.status === 'running' ? {
                id: statusData.id,
                total_tasks: statusData.total_tasks,
                completed_tasks: statusData.completed_tasks,
              } : null,
            };
          });
          setJobDetails(statusData.jobs || []);
        }
      }
    } catch {
      // Ignore polling errors
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    scanIdRef.current = null;
    loadData();
    return () => { mountedRef.current = false; };
  }, [loadData]);

  // Browser-driven processing loop: calls /api/scans/process to process one job at a time
  const processingRef = useRef(false);
  const processJobsLoop = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      while (mountedRef.current) {
        const res = await fetch('/api/scans/process', { method: 'POST' });
        if (!res.ok) break;
        const result = await res.json();

        if (result.status === 'no_jobs') break;
        if (result.status === 'error') {
          console.warn('[processJobsLoop] Job error:', result.error);
        }
        if (result.pendingCount === 0) break;

        // Rate limiting: 4s delay between Gemini calls (15 RPM free tier)
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    } catch {
      // Network error, will retry on next trigger
    } finally {
      processingRef.current = false;
      // Reload dashboard data after processing completes
      if (mountedRef.current) loadData();
    }
  }, [loadData]);

  // Poll: fast during scan (3s for status, 15s for full data), slow otherwise (60s)
  // Also kick off browser-driven processing when a scan is active
  useEffect(() => {
    if (loading) return;

    const isActive = !!data?.active_scan;

    if (isActive) {
      // Start browser-driven processing
      processJobsLoop();
      const statusInterval = setInterval(pollScanStatus, 3000);
      const dataInterval = setInterval(loadData, 15000);
      return () => { clearInterval(statusInterval); clearInterval(dataInterval); };
    } else {
      const interval = setInterval(loadData, 60000);
      return () => clearInterval(interval);
    }
  }, [loading, data?.active_scan, loadData, pollScanStatus, processJobsLoop]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="h-8 w-48 rounded-xl animate-shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl animate-shimmer" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-80 rounded-2xl animate-shimmer" />
          <div className="h-80 rounded-2xl animate-shimmer" />
        </div>
      </div>
    );
  }

  if (!data || (data.kpi.total_results === 0 && !data.active_scan)) {
    return (
      <div className="text-center py-24 animate-fade-in-up">
        <div className="w-20 h-20 rounded-3xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
          <BarChart3 className="h-10 w-10 text-accent" />
        </div>
        <h3 className="text-xl font-semibold text-primary mb-2">Nessun dato disponibile</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">Avvia una scan dal pannello admin per iniziare il monitoraggio.</p>
      </div>
    );
  }

  const activeScan = data.active_scan;
  const scanProgress = activeScan && activeScan.total_tasks > 0
    ? Math.round((activeScan.completed_tasks / activeScan.total_tasks) * 100)
    : 0;

  const themes = data.theme_sentiments?.length > 0
    ? data.theme_sentiments
    : [];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Panoramica delle performance di monitoraggio</p>
        </div>
      </div>

      {/* Scan Progress - Server-side processing banner */}
      {activeScan && (
        <div className="rounded-2xl bg-white border border-accent/20 shadow-sm overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center animate-progress-pulse">
                <Loader2 className="h-4 w-4 text-accent animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">
                    Scan in elaborazione
                  </span>
                  <span className="text-sm font-bold text-accent tabular-nums">
                    {activeScan.completed_tasks}/{activeScan.total_tasks} ({scanProgress}%)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Elaborazione in corso. Non chiudere questa pagina fino al completamento.
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2.5 rounded-full bg-[#f0f2f5] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-light transition-all duration-700 ease-out"
                style={{ width: `${Math.max(scanProgress, 2)}%` }}
              />
            </div>

            {/* Accordion toggle */}
            <button
              onClick={() => setShowJobDetails(!showJobDetails)}
              className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {showJobDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showJobDetails ? 'Nascondi dettagli' : 'Mostra dettagli task'}
            </button>
          </div>

          {/* Job details accordion */}
          {showJobDetails && (
            <div className="border-t border-[#f0f2f5] animate-slide-down">
              <div className="p-4 max-h-80 overflow-y-auto space-y-1">
                {/* Status summary */}
                {jobDetails.length > 0 && (
                  <div className="flex items-center gap-4 mb-3 pb-2 border-b border-[#f0f2f5] text-xs">
                    <span className="flex items-center gap-1 text-positive">
                      <CheckCircle2 className="h-3 w-3" />
                      {jobDetails.filter(j => j.status === 'completed').length} completati
                    </span>
                    <span className="flex items-center gap-1 text-accent">
                      <Loader2 className="h-3 w-3" />
                      {jobDetails.filter(j => j.status === 'processing').length} in corso
                    </span>
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="h-3 w-3" />
                      {jobDetails.filter(j => j.status === 'failed').length} falliti
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {jobDetails.filter(j => j.status === 'pending').length} in coda
                    </span>
                  </div>
                )}

                {jobDetails.length > 0 ? (
                  jobDetails.map((job) => (
                    <div key={job.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[#f8f9fa] text-xs">
                      {job.status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-positive shrink-0" />}
                      {job.status === 'failed' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                      {job.status === 'processing' && <Loader2 className="h-3.5 w-3.5 text-accent animate-spin shrink-0" />}
                      {job.status === 'pending' && <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className="font-medium text-primary truncate min-w-[100px]">{job.keyword}</span>
                      <span className="text-muted-foreground shrink-0 text-[10px] bg-[#f0f2f5] px-1.5 py-0.5 rounded">
                        {job.source === 'google_organic' ? 'Web' : 'News'}
                      </span>

                      {/* Duration for completed jobs */}
                      {job.duration_ms != null && (
                        <span className="text-muted-foreground flex items-center gap-0.5 shrink-0">
                          <Timer className="h-3 w-3" />
                          {formatJobDuration(job.duration_ms)}
                        </span>
                      )}

                      {/* Live elapsed for processing jobs */}
                      {job.status === 'processing' && job.started_at && (
                        <span className="text-accent flex items-center gap-0.5 shrink-0">
                          <Zap className="h-3 w-3" />
                          {formatElapsed(job.started_at)}
                        </span>
                      )}

                      {/* Retry indicator */}
                      {job.retry_count > 0 && (
                        <span className="flex items-center gap-0.5 text-orange-500 shrink-0">
                          <AlertTriangle className="h-3 w-3" />
                          {job.retry_count}/3
                        </span>
                      )}

                      {job.error_message && (
                        <span className="text-destructive truncate ml-auto max-w-[200px]" title={job.error_message}>
                          {job.error_message}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    In attesa dei primi risultati...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1. AI Briefing */}
      <AiBriefing briefing={data.ai_briefing} scanCount={data.scan_count} />

      {/* 2. KPI Cards */}
      <KPICards kpi={data.kpi} delta={data.delta} />

      {/* 3. Top Domini (promoted) + 4. Sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DomainBarChart data={data.top_domains} />
        <SentimentChart
          data={data.sentiment_distribution}
          onSentimentClick={(s) => router.push(`/project/${slug}/results?sentiment=${s}`)}
        />
      </div>

      {/* 5. Treemap Temi (full width) */}
      <ThemeTreemap
        data={themes}
        onThemeClick={(t) => router.push(`/project/${slug}/results?tag=${encodeURIComponent(t)}`)}
      />

      {/* 6. Articoli per Scan */}
      {data.publication_timeline && data.publication_timeline.length > 0 && (
        <PublicationTimeline data={data.publication_timeline} />
      )}
    </div>
  );
}
