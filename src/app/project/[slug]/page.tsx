'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { KPICards } from '@/components/dashboard/kpi-cards';
import { SentimentChart } from '@/components/dashboard/sentiment-chart';
import { DomainBarChart } from '@/components/dashboard/domain-bar-chart';
import { ThemeBubbleChart } from '@/components/dashboard/theme-bubble-chart';
import { BarChart3, Loader2 } from 'lucide-react';

interface DashboardData {
  kpi: { total_results: number; unique_domains: number; competitor_mentions: number; avg_sentiment: number };
  delta: { total_results: number; unique_domains: number; competitor_mentions: number; avg_sentiment: number };
  sentiment_distribution: { date: string; positive: number; negative: number; neutral: number; mixed: number }[];
  top_domains: { domain: string; count: number; is_competitor: boolean }[];
  scan_dates: string[];
  active_scan: { total_tasks: number; completed_tasks: number } | null;
}

export default function ProjectDashboard() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [themes, setThemes] = useState<{ name: string; count: number; sentiment: string; sentiment_score: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingRef = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const [dashRes, tagsRes] = await Promise.all([
        fetch(`/api/projects/${slug}/dashboard`),
        fetch(`/api/projects/${slug}/tags`),
      ]);

      if (dashRes.ok) setData(await dashRes.json());
      if (tagsRes.ok) {
        const tags = await tagsRes.json();
        setThemes(
          tags.map((t: { name: string; count: number }) => ({
            name: t.name,
            count: t.count,
            sentiment: 'neutral',
            sentiment_score: 0,
          }))
        );
      }
    } catch {
      // Network error, will retry on next poll
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // Trigger worker processing from browser when scan is active.
  // Browser HTTP requests stay alive (unlike serverless fire-and-forget),
  // so this reliably keeps the worker running.
  const triggerProcessing = useCallback(async () => {
    if (processingRef.current) return; // Already running
    processingRef.current = true;
    try {
      await fetch('/api/scans/process', { method: 'POST' });
    } catch {
      // Will retry on next poll
    } finally {
      processingRef.current = false;
      // Refresh data after worker batch completes
      loadData();
    }
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When active scan is detected, trigger processing from browser
  useEffect(() => {
    if (!loading && data?.active_scan && !processingRef.current) {
      triggerProcessing();
    }
  }, [loading, data?.active_scan, triggerProcessing]);

  // Poll every 10s when scan is active, every 30s otherwise
  useEffect(() => {
    if (loading) return;

    const pollInterval = data?.active_scan ? 10000 : 30000;

    intervalRef.current = setInterval(() => {
      loadData();
    }, pollInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loading, data?.active_scan, loadData]);

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

  if (!data || (data.kpi.total_results === 0 && !data.active_scan)) {
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
