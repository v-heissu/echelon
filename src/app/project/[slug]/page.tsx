'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { KPICards } from '@/components/dashboard/kpi-cards';
import { SentimentChart } from '@/components/dashboard/sentiment-chart';
import { DomainBarChart } from '@/components/dashboard/domain-bar-chart';
import { ThemeBubbleChart } from '@/components/dashboard/theme-bubble-chart';
import { PublicationTimeline } from '@/components/dashboard/publication-timeline';
import { BarChart3, Loader2, AlertTriangle, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Timer, Zap } from 'lucide-react';

interface DashboardData {
  kpi: { total_results: number; unique_domains: number; competitor_mentions: number; avg_sentiment: number };
  delta: { total_results: number; unique_domains: number; competitor_mentions: number; avg_sentiment: number };
  sentiment_distribution: { date: string; positive: number; negative: number; neutral: number; mixed: number }[];
  top_domains: { domain: string; count: number; is_competitor: boolean }[];
  theme_sentiments: { name: string; count: number; sentiment: string; sentiment_score: number }[];
  publication_timeline: { date: string; count: number }[];
  scan_dates: string[];
  active_scan: { id: string; total_tasks: number; completed_tasks: number } | null;
}

interface ProcessResult {
  status: 'processed' | 'no_jobs' | 'error';
  keyword?: string;
  source?: string;
  error?: string;
  pendingCount: number;
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

const PARALLEL_WORKERS = 3;

export default function ProjectDashboard() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [jobDetails, setJobDetails] = useState<ScanJob[]>([]);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [processedKeywords, setProcessedKeywords] = useState<{ keyword: string; source: string; status: 'ok' | 'error' }[]>([]);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const scanIdRef = useRef<string | null>(null);
  const dataRef = useRef<DashboardData | null>(null);

  const loadData = useCallback(async () => {
    try {
      const dashRes = await fetch(`/api/projects/${slug}/dashboard`);
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        if (mountedRef.current) {
          setData(dashData);
          dataRef.current = dashData;
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
  // Uses functional setState to avoid stale closure on `data`
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

  // Process single job worker
  const processOne = useCallback(async (): Promise<ProcessResult | null> => {
    try {
      const res = await fetch('/api/scans/process', { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        // If auth/forbidden error, return special status to stop loop immediately
        if (res.status === 401 || res.status === 403) {
          return { status: 'no_jobs', error: errData.detail || errData.error, pendingCount: 0 };
        }
        return { status: 'error', error: errData.detail || errData.error, pendingCount: -1 };
      }
      return await res.json();
    } catch {
      return { status: 'error', error: 'Errore di rete', pendingCount: -1 };
    }
  }, []);

  // Process jobs with parallel workers
  const processJobsLoop = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    if (mountedRef.current) {
      setProcessingStatus('Avvio elaborazione...');
      setProcessingError(null);
      setProcessedKeywords([]);
    }

    let totalProcessed = 0;
    let consecutiveErrors = 0;
    let allDone = false;

    while (mountedRef.current && !allDone) {
      // Launch parallel workers
      const promises = Array.from({ length: PARALLEL_WORKERS }, () => processOne());
      const results = await Promise.all(promises);

      for (const result of results) {
        if (!result || !mountedRef.current) continue;

        if (result.status === 'processed') {
          totalProcessed++;
          consecutiveErrors = 0;
          if (mountedRef.current) {
            const keyword = result.keyword || '';
            const source = result.source === 'google_organic' ? 'Web' : 'News';
            setProcessingStatus(`${totalProcessed} task completati — ultimo: ${keyword} (${source})`);
            setProcessingError(null);
            setProcessedKeywords(prev => [
              ...prev,
              { keyword: result.keyword || '', source: result.source || '', status: 'ok' },
            ]);
          }
        } else if (result.status === 'error') {
          consecutiveErrors++;
          if (mountedRef.current) {
            setProcessedKeywords(prev => [
              ...prev,
              { keyword: result.keyword || '?', source: result.source || '', status: 'error' },
            ]);
          }
          if (consecutiveErrors >= 8) {
            if (mountedRef.current) {
              setProcessingError(`Troppi errori consecutivi. Ultimo: ${result.error}`);
            }
            allDone = true;
            break;
          }
        } else if (result.status === 'no_jobs') {
          allDone = true;
          break;
        }

        if (result.pendingCount === 0) {
          allDone = true;
          break;
        }
      }

      // Refresh progress every batch
      if (mountedRef.current && !allDone) {
        pollScanStatus();
      }
    }

    processingRef.current = false;
    if (mountedRef.current) {
      setProcessingStatus(null);
      loadData();
    }
  }, [loadData, processOne, pollScanStatus]);

  useEffect(() => {
    mountedRef.current = true;
    processingRef.current = false; // Reset on mount to avoid stale ref from previous instance
    scanIdRef.current = null;
    loadData();
    return () => { mountedRef.current = false; };
  }, [loadData]);

  // When active scan detected, start processing
  useEffect(() => {
    if (!loading && data?.active_scan && !processingRef.current) {
      processJobsLoop();
    }
  }, [loading, data?.active_scan, processJobsLoop]);

  // Poll: fast during scan (3s for status, 10s for data), slow otherwise (60s)
  useEffect(() => {
    if (loading) return;

    const isActive = !!data?.active_scan || processingRef.current;

    if (isActive) {
      const statusInterval = setInterval(pollScanStatus, 3000);
      const dataInterval = setInterval(() => {
        loadData();
        // Use ref to check active scan to avoid stale closure
        if (dataRef.current?.active_scan && !processingRef.current) {
          processJobsLoop();
        }
      }, 10000);
      return () => { clearInterval(statusInterval); clearInterval(dataInterval); };
    } else {
      const interval = setInterval(loadData, 60000);
      return () => clearInterval(interval);
    }
  }, [loading, data?.active_scan, loadData, processJobsLoop, pollScanStatus]);

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

  if (!data || (data.kpi.total_results === 0 && !data.active_scan && !processingStatus)) {
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

      {/* Scan Progress - Fixed height, no layout shift */}
      {(activeScan || processingStatus) && (
        <div className="rounded-2xl bg-white border border-accent/20 shadow-sm overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center animate-progress-pulse">
                <Loader2 className="h-4 w-4 text-accent animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">
                    Scan in corso
                  </span>
                  <span className="text-sm font-bold text-accent tabular-nums">
                    {activeScan ? `${activeScan.completed_tasks}/${activeScan.total_tasks}` : ''} ({scanProgress}%)
                  </span>
                </div>
                {processingStatus && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{processingStatus}</p>
                )}
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
                ) : processedKeywords.length > 0 ? (
                  processedKeywords.map((pk, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs">
                      {pk.status === 'ok'
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-positive shrink-0" />
                        : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      }
                      <span className="font-medium text-primary">{pk.keyword}</span>
                      <span className="text-muted-foreground text-[10px] bg-[#f0f2f5] px-1.5 py-0.5 rounded">
                        {pk.source === 'google_organic' ? 'Web' : 'News'}
                      </span>
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

      {processingError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">{processingError}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SentimentChart data={data.sentiment_distribution} />
        <DomainBarChart data={data.top_domains} />
      </div>

      <ThemeBubbleChart data={themes} />

      {data.publication_timeline && data.publication_timeline.length > 0 && (
        <PublicationTimeline data={data.publication_timeline} />
      )}
    </div>
  );
}
