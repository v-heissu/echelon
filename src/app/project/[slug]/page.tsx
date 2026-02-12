'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { KPICards } from '@/components/dashboard/kpi-cards';
import { SentimentChart } from '@/components/dashboard/sentiment-chart';
import { DomainBarChart } from '@/components/dashboard/domain-bar-chart';
import { ThemeBubbleChart } from '@/components/dashboard/theme-bubble-chart';

interface DashboardData {
  kpi: { total_results: number; unique_domains: number; competitor_mentions: number; avg_sentiment: number };
  delta: { total_results: number; unique_domains: number; competitor_mentions: number; avg_sentiment: number };
  sentiment_distribution: { date: string; positive: number; negative: number; neutral: number; mixed: number }[];
  top_domains: { domain: string; count: number; is_competitor: boolean }[];
  scan_dates: string[];
}

export default function ProjectDashboard() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [themes, setThemes] = useState<{ name: string; count: number; sentiment: string; sentiment_score: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
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
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-80 bg-white rounded-lg animate-pulse" />
          <div className="h-80 bg-white rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nessun dato disponibile. Avvia una scan per iniziare.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Dashboard</h1>

      <KPICards kpi={data.kpi} delta={data.delta} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SentimentChart data={data.sentiment_distribution} />
        <DomainBarChart data={data.top_domains} />
      </div>

      <ThemeBubbleChart data={themes} />
    </div>
  );
}
