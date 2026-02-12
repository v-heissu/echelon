'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Sparkles, Minus } from 'lucide-react';

interface TrendData {
  theme: string;
  direction: 'emerging' | 'stable' | 'declining' | 'new';
  current_density: number;
  avg_density: number;
  history: { date: string; density: number; count: number }[];
  total_count: number;
}

const CHART_COLORS = ['#007AC5', '#00A4E6', '#008996', '#F58B46', '#FFC76D', '#D64641', '#2D6A4F', '#33A1AB'];

export default function TrendsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/projects/${slug}/trends`);
      if (res.ok) {
        const data = await res.json();
        setTrends(data.trends || []);
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <div className="h-8 w-48 rounded-lg animate-shimmer" />
        <div className="h-96 rounded-xl animate-shimmer" />
      </div>
    );
  }

  const top8 = trends.slice(0, 8);
  const allDates = new Set<string>();
  top8.forEach((t) => t.history.forEach((h) => allDates.add(h.date)));
  const sortedDates = Array.from(allDates).sort();

  const chartData = sortedDates.map((date) => {
    const point: Record<string, unknown> = {
      date: date ? new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '',
    };
    top8.forEach((t) => {
      const match = t.history.find((h) => h.date === date);
      point[t.theme] = match ? Number((match.density * 100).toFixed(1)) : 0;
    });
    return point;
  });

  const directionIcon = (dir: string) => {
    switch (dir) {
      case 'emerging': return <TrendingUp className="h-4 w-4 text-orange" />;
      case 'new': return <Sparkles className="h-4 w-4 text-accent" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-destructive" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const directionLabel = (dir: string) => {
    switch (dir) {
      case 'emerging': return 'Emergente';
      case 'new': return 'Nuovo';
      case 'declining': return 'In calo';
      default: return 'Stabile';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-primary">Trend Tematici</h1>
        <p className="text-sm text-muted-foreground mt-1">Analisi dell&apos;evoluzione dei temi nel tempo</p>
      </div>

      {chartData.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-accent" />
              </div>
              <h3 className="font-semibold text-primary">Densita Tematica nel Tempo (Top 8)</h3>
            </div>
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B2B8C3" strokeOpacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'Densita %', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {top8.map((t, i) => (
                  <Line
                    key={t.theme}
                    type="monotone"
                    dataKey={t.theme}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-gold" />
            </div>
            <h3 className="font-semibold text-primary">Tutti i Temi</h3>
            <span className="text-xs text-muted-foreground">({trends.length})</span>
          </div>
          <div className="space-y-1">
            {trends.map((trend) => (
              <div
                key={trend.theme}
                className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {directionIcon(trend.direction)}
                  <div>
                    <span className="font-medium text-sm">{trend.theme}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {trend.total_count} occorrenze
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    Densita: {(trend.current_density * 100).toFixed(1)}%
                  </span>
                  <Badge
                    variant={
                      trend.direction === 'emerging' || trend.direction === 'new'
                        ? 'mixed'
                        : trend.direction === 'declining'
                        ? 'negative'
                        : 'neutral'
                    }
                  >
                    {directionLabel(trend.direction)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {trends.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nessun trend disponibile. Avvia almeno una scan.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
