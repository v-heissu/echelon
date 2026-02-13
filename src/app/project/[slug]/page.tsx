'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { KPICards } from '@/components/dashboard/kpi-cards';
import { SentimentChart } from '@/components/dashboard/sentiment-chart';
import { DomainBarChart } from '@/components/dashboard/domain-bar-chart';
import { ThemeBubbleChart } from '@/components/dashboard/theme-bubble-chart';
import { BarChart3, Loader2, AlertTriangle } from 'lucide-react';

interface DashboardData {
  kpi: { total_results: number; unique_domains: number; competitor_mentions: number; avg_sentiment: number };
  delta: { total_results: number; unique_domains: number; competitor_mentions: number; avg_sentiment: number };
  sentiment_distribution: { date: string; positive: number; negative: number; neutral: number; mixed: number }[];
  top_domains: { domain: string; count: number; is_competitor: boolean }[];
  scan_dates: string[];
  active_scan: { total_tasks: number; completed_tasks: number } | null;
}

interface ProcessResult {
  status: 'processed' | 'no_jobs' | 'error';
  keyword?: string;
  error?: string;
  pendingCount: number;
}

export default function ProjectDashboard() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [themes, setThemes] = useState<{ name: string; count: number; sentiment: string; sentiment_score: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);

  const loadData = useCallback(async () => {
    try {
      const [dashRes, tagsRes] = await Promise.all([
        fetch(`/api/projects/${slug}/dashboard`),
        fetch(`/api/projects/${slug}/tags`),
      ]);

      if (dashRes.ok) {
        const dashData = await dashRes.json();
        if (mountedRef.current) setData(dashData);
      }
      if (tagsRes.ok) {
        const tags = await tagsRes.json();
        if (mountedRef.current) {
          setThemes(
            tags.map((t: { name: string; count: number }) => ({
              name: t.name,
              count: t.count,
              sentiment: 'neutral',
              sentiment_score: 0,
            }))
          );
        }
      }
    } catch {
      // Network error, will retry
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [slug]);

  // Process jobs one at a time from the browser.
  // Browser HTTP requests stay alive (unlike Vercel serverless fire-and-forget).
  // Each call to /api/scans/process processes ONE job and returns the result.
  // We chain calls until all jobs are done.
  const processJobsLoop = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    if (mountedRef.current) {
      setProcessingStatus('Avvio elaborazione...');
      setProcessingError(null);
    }

    let totalProcessed = 0;
    let consecutiveErrors = 0;

    while (mountedRef.current) {
      try {
        const res = await fetch('/api/scans/process', { method: 'POST' });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          const errMsg = errData.detail || errData.error || `HTTP ${res.status}`;
          console.error('Process endpoint error:', errMsg);
          if (mountedRef.current) setProcessingError(`Errore worker: ${errMsg}`);
          break;
        }

        const result: ProcessResult = await res.json();

        if (result.status === 'processed') {
          totalProcessed++;
          consecutiveErrors = 0;
          if (mountedRef.current) {
            setProcessingStatus(`Elaborato: "${result.keyword}" (${totalProcessed} completati)`);
            setProcessingError(null);
          }
          // Refresh dashboard data every 2 jobs
          if (totalProcessed % 2 === 0) loadData();
        } else if (result.status === 'error') {
          consecutiveErrors++;
          console.error(`Job error (${result.keyword}):`, result.error);
          if (mountedRef.current) {
            setProcessingStatus(`Errore su "${result.keyword}", riprovando...`);
          }
          // Stop after too many consecutive errors
          if (consecutiveErrors >= 5) {
            if (mountedRef.current) {
              setProcessingError(`Troppi errori consecutivi. Ultimo: ${result.error}`);
            }
            break;
          }
        } else if (result.status === 'no_jobs') {
          break;
        }

        if (result.pendingCount === 0) break;
      } catch (error) {
        console.error('Process fetch error:', error);
        if (mountedRef.current) setProcessingError('Errore di rete durante elaborazione');
        break;
      }
    }

    processingRef.current = false;
    if (mountedRef.current) {
      setProcessingStatus(null);
      loadData(); // Final refresh
    }
  }, [loadData]);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
  }, [loadData]);

  // When active scan detected, start processing from browser
  useEffect(() => {
    if (!loading && data?.active_scan && !processingRef.current) {
      processJobsLoop();
    }
  }, [loading, data?.active_scan, processJobsLoop]);

  // Poll dashboard data every 15s during active scan, 60s otherwise
  useEffect(() => {
    if (loading) return;

    const pollInterval = data?.active_scan ? 15000 : 60000;

    const interval = setInterval(() => {
      loadData();
      // Re-trigger processing if scan still active and processor stopped
      if (data?.active_scan && !processingRef.current) {
        processJobsLoop();
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [loading, data?.active_scan, loadData, processJobsLoop]);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <div className="h-8 w-36 rounded-lg animate-shimmer" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-lg animate-shimmer" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-80 rounded-lg animate-shimmer" />
          <div className="h-80 rounded-lg animate-shimmer" />
        </div>
      </div>
    );
  }

  if (!data || (data.kpi.total_results === 0 && !data.active_scan && !processingStatus)) {
    return (
      <div className="text-center py-20 animate-fade-in-up">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="h-8 w-8 text-accent" />
        </div>
        <h3 className="text-lg font-semibold text-primary mb-1">Nessun dato disponibile</h3>
        <p className="text-sm text-muted-foreground">Avvia una scan per iniziare il monitoraggio.</p>
      </div>
    );
  }

  const activeScan = data.active_scan;
  const scanProgress = activeScan && activeScan.total_tasks > 0
    ? Math.round((activeScan.completed_tasks / activeScan.total_tasks) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Panoramica delle performance di monitoraggio</p>
      </div>

      {activeScan && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="h-4 w-4 text-accent animate-spin" />
            <span className="text-sm font-medium text-primary">
              Scan in corso... {activeScan.completed_tasks}/{activeScan.total_tasks} task completati
            </span>
            <span className="ml-auto text-sm font-semibold text-accent">{scanProgress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
          {processingStatus && (
            <p className="text-xs text-muted-foreground mt-2">{processingStatus}</p>
          )}
        </div>
      )}

      {processingError && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{processingError}</p>
            <button
              className="text-xs text-red-600 underline mt-1"
              onClick={() => {
                setProcessingError(null);
                processJobsLoop();
              }}
            >
              Riprova
            </button>
          </div>
        </div>
      )}

      <KPICards kpi={data.kpi} delta={data.delta} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SentimentChart data={data.sentiment_distribution} />
        <DomainBarChart data={data.top_domains} />
      </div>

      <ThemeBubbleChart data={themes} />
    </div>
  );
}
