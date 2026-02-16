'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
} from 'recharts';
import { Building2, Award, Users, ArrowLeft, ExternalLink, Sparkles, Tag as TagIcon } from 'lucide-react';
import { truncate, sentimentColor } from '@/lib/utils';

interface EntityDetail {
  name: string;
  type: string;
  count: number;
  avg_sentiment: number;
  keywords: string[];
  domains: string[];
}

interface EntityResult {
  id: string;
  title: string;
  url: string;
  domain: string;
  keyword: string;
  source: string;
  position: number;
  sentiment: string;
  sentiment_score: number;
  summary: string;
  themes: { name: string; confidence?: number }[];
  scan_date: string;
}

interface SentimentPoint {
  date: string;
  score: number;
}

interface RelatedTheme {
  name: string;
  count: number;
}

interface RelatedEntity {
  name: string;
  type: string;
  count: number;
}

function sentimentVariant(score: number): 'positive' | 'negative' | 'neutral' | 'mixed' {
  if (score > 0.2) return 'positive';
  if (score < -0.2) return 'negative';
  if (score !== 0) return 'mixed';
  return 'neutral';
}

function sentimentLabel(score: number): string {
  if (score > 0.2) return 'Positivo';
  if (score < -0.2) return 'Negativo';
  if (score !== 0) return 'Misto';
  return 'Neutro';
}

function sentimentBadgeVariant(sentiment: string): 'positive' | 'negative' | 'neutral' | 'mixed' {
  switch (sentiment) {
    case 'positive': return 'positive';
    case 'negative': return 'negative';
    case 'mixed': return 'mixed';
    default: return 'neutral';
  }
}

function sentimentLabelFromString(sentiment: string): string {
  switch (sentiment) {
    case 'positive': return 'Positivo';
    case 'negative': return 'Negativo';
    case 'mixed': return 'Misto';
    default: return 'Neutro';
  }
}

function typeIcon(type: string) {
  switch (type) {
    case 'brand': return <Award className="w-5 h-5 text-white" />;
    case 'person': return <Users className="w-5 h-5 text-white" />;
    case 'competitor': return <Building2 className="w-5 h-5 text-white" />;
    default: return <Award className="w-5 h-5 text-white" />;
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'brand': return 'Brand';
    case 'person': return 'Persona';
    case 'competitor': return 'Competitor';
    default: return type;
  }
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'google_organic': return 'Web';
    case 'google_news': return 'News';
    default: return source;
  }
}

export default function EntityDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const name = params.name as string;
  const type = searchParams.get('type') || 'brand';

  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [results, setResults] = useState<EntityResult[]>([]);
  const [sentimentHistory, setSentimentHistory] = useState<SentimentPoint[]>([]);
  const [relatedThemes, setRelatedThemes] = useState<RelatedTheme[]>([]);
  const [relatedEntities, setRelatedEntities] = useState<RelatedEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(
        `/api/projects/${slug}/entities/${encodeURIComponent(name)}?type=${type}`
      );
      if (res.ok) {
        const data = await res.json();
        setEntity(data.entity || null);
        setResults(data.results || []);
        setSentimentHistory(data.sentiment_history || []);
        setRelatedThemes(data.related_themes || []);
        setRelatedEntities(data.related_entities || []);
      }
      setLoading(false);
    }
    load();
  }, [slug, name, type]);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <div className="h-6 w-32 rounded-lg animate-shimmer" />
        <div className="h-32 rounded-xl animate-shimmer" />
        <div className="h-64 rounded-xl animate-shimmer" />
        <div className="h-48 rounded-xl animate-shimmer" />
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <Link
          href={`/project/${slug}/entities`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna alle entita
        </Link>
        <Card className="border-0 shadow-md">
          <CardContent className="p-16 text-center">
            <h3 className="text-lg font-semibold text-primary mb-1">Entita non trovata</h3>
            <p className="text-sm text-muted-foreground">Nessun dato disponibile per questa entita.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const chartData = sentimentHistory.map((point) => ({
    date: point.date
      ? new Date(point.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
      : '',
    score: point.score,
  }));

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Back button */}
      <Link
        href={`/project/${slug}/entities`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Torna alle entita
      </Link>

      {/* Header */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-accent to-teal" />
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-teal flex items-center justify-center">
              {typeIcon(entity.type)}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-primary">{entity.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{typeLabel(entity.type)}</Badge>
                <Badge variant={sentimentVariant(entity.avg_sentiment)}>
                  {sentimentLabel(entity.avg_sentiment)} ({entity.avg_sentiment})
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {entity.count} menzioni
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Summary — generated from top results */}
      {results.length > 0 && results.some(r => r.summary) && (
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/20 to-orange/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-gold" />
              </div>
              <h3 className="font-semibold text-primary text-sm">Sommario AI</h3>
            </div>
            <div className="space-y-2">
              {results
                .filter(r => r.summary)
                .sort((a, b) => a.position - b.position)
                .slice(0, 5)
                .map((r, i) => (
                  <p key={r.id} className="text-sm text-muted-foreground leading-relaxed">
                    {i === 0 ? (
                      <span className="font-medium text-foreground">{r.summary}</span>
                    ) : (
                      r.summary
                    )}
                  </p>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Results list */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-primary">Articoli correlati ({results.length})</h2>
          {results.length > 0 ? (
            <div className="space-y-3">
              {results.map((result) => (
                <Card key={result.id} className="border-0 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-primary hover:text-accent transition-colors inline-flex items-center gap-1.5"
                        >
                          <span className="truncate">{truncate(result.title, 80)}</span>
                          <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                        </a>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-muted-foreground">{result.domain}</span>
                          <span className="text-xs text-muted-foreground">-</span>
                          <span className="text-xs text-muted-foreground">{result.keyword}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {sourceLabel(result.source)}
                          </Badge>
                          <Badge
                            variant={sentimentBadgeVariant(result.sentiment)}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {sentimentLabelFromString(result.sentiment)}
                          </Badge>
                        </div>
                        {result.summary && (
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                            {truncate(result.summary, 200)}
                          </p>
                        )}
                        {result.themes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {result.themes.slice(0, 5).map((theme) => (
                              <span
                                key={theme.name}
                                className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full"
                              >
                                {theme.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        #{result.position}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-12 text-center">
                <p className="text-sm text-muted-foreground">Nessun articolo trovato per questa entita.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Charts and related */}
        <div className="space-y-4">
          {/* Sentiment over time */}
          {chartData.length > 1 && (
            <Card className="border-0 shadow-md rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <TagIcon className="w-4 h-4 text-accent" />
                  </div>
                  <h3 className="font-semibold text-sm text-primary">Sentiment nel tempo</h3>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#B2B8C3" strokeOpacity={0.5} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      domain={[-1, 1]}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontSize: '12px',
                      }}
                      formatter={(value) => [Number(value).toFixed(2), 'Sentiment']}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke={sentimentColor(sentimentVariant(entity.avg_sentiment))}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Related themes */}
          {relatedThemes.length > 0 && (
            <Card className="border-0 shadow-md rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                    <TagIcon className="w-4 h-4 text-gold" />
                  </div>
                  <h3 className="font-semibold text-sm text-primary">Temi correlati</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {relatedThemes.map((theme) => (
                    <span
                      key={theme.name}
                      className="inline-flex items-center gap-1 text-xs bg-gold/10 text-gold px-2.5 py-1 rounded-full font-medium"
                    >
                      {theme.name}
                      <span className="text-[10px] text-gold/70">{theme.count}</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Related entities */}
          {relatedEntities.length > 0 && (
            <Card className="border-0 shadow-md rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-teal" />
                  </div>
                  <h3 className="font-semibold text-sm text-primary">Entita correlate</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {relatedEntities.map((re) => (
                    <Link
                      key={`${re.name}-${re.type}`}
                      href={`/project/${slug}/entities/${encodeURIComponent(re.name)}?type=${re.type}`}
                      className="inline-flex items-center gap-1 text-xs bg-teal/10 text-teal px-2.5 py-1 rounded-full font-medium hover:bg-teal/20 transition-colors"
                    >
                      {re.type === 'brand' && <Award className="w-3 h-3" />}
                      {re.type === 'person' && <Users className="w-3 h-3" />}
                      {re.type === 'competitor' && <Building2 className="w-3 h-3" />}
                      {re.name}
                      <span className="text-[10px] text-teal/70">{re.count}</span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
