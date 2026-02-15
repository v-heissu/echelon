'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
  BarChart,
  Bar,
} from 'recharts';
import { Tag as TagIcon, ArrowLeft, ExternalLink, Sparkles, Users, Search } from 'lucide-react';
import { truncate } from '@/lib/utils';

interface TagDetail {
  name: string;
  slug: string;
  count: number;
  last_seen_at: string;
}

interface TagResult {
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
  scan_id: string;
}

interface DensityPoint {
  date: string;
  density: number;
  count: number;
}

interface RelatedEntity {
  name: string;
  type: string;
  count: number;
}

interface KeywordDist {
  keyword: string;
  count: number;
}

function sentimentVariant(sentiment: string): 'positive' | 'negative' | 'neutral' | 'mixed' {
  if (sentiment === 'positive') return 'positive';
  if (sentiment === 'negative') return 'negative';
  if (sentiment === 'mixed') return 'mixed';
  return 'neutral';
}

function sentimentLabel(sentiment: string): string {
  switch (sentiment) {
    case 'positive': return 'Positivo';
    case 'negative': return 'Negativo';
    case 'mixed': return 'Misto';
    default: return 'Neutro';
  }
}

function sourceLabel(source: string): string {
  return source === 'google_news' ? 'News' : 'Web';
}

function sourceVariant(source: string): 'mixed' | 'neutral' {
  return source === 'google_news' ? 'mixed' : 'neutral';
}

function avgSentimentFromResults(results: TagResult[]): string {
  if (results.length === 0) return 'neutral';
  const avg = results.reduce((sum, r) => sum + r.sentiment_score, 0) / results.length;
  if (avg > 0.2) return 'positive';
  if (avg < -0.2) return 'negative';
  if (avg !== 0) return 'mixed';
  return 'neutral';
}

export default function TagDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const tagSlug = params.tagSlug as string;

  const [tag, setTag] = useState<TagDetail | null>(null);
  const [results, setResults] = useState<TagResult[]>([]);
  const [densityHistory, setDensityHistory] = useState<DensityPoint[]>([]);
  const [relatedEntities, setRelatedEntities] = useState<RelatedEntity[]>([]);
  const [keywordDistribution, setKeywordDistribution] = useState<KeywordDist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/projects/${slug}/tags/${encodeURIComponent(tagSlug)}`);
      if (res.ok) {
        const data = await res.json();
        setTag(data.tag);
        setResults(data.results || []);
        setDensityHistory(data.density_history || []);
        setRelatedEntities(data.related_entities || []);
        setKeywordDistribution(data.keyword_distribution || []);
      }
      setLoading(false);
    }
    load();
  }, [slug, tagSlug]);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <div className="h-6 w-24 rounded-lg animate-shimmer" />
        <div className="h-10 w-64 rounded-lg animate-shimmer" />
        <div className="h-72 rounded-xl animate-shimmer" />
        <div className="h-64 rounded-xl animate-shimmer" />
      </div>
    );
  }

  if (!tag) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <Link
          href={`/project/${slug}/tags`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna ai Tag
        </Link>
        <Card className="border-0 shadow-md">
          <CardContent className="p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <TagIcon className="h-8 w-8 text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-primary mb-1">Tag non trovato</h3>
            <p className="text-sm text-muted-foreground">Il tag richiesto non esiste in questo progetto.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const overallSentiment = avgSentimentFromResults(results);

  // Prepare chart data for density trend
  const chartData = densityHistory.map((d) => ({
    date: d.date
      ? new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
      : '',
    densita: Number((d.density * 100).toFixed(1)),
    conteggio: d.count,
  }));

  // Prepare keyword distribution chart data (top 10)
  const kwChartData = keywordDistribution.slice(0, 10).map((k) => ({
    keyword: truncate(k.keyword, 25),
    conteggio: k.count,
  }));

  // Group entities by type for display
  const entityTypeColors: Record<string, string> = {
    brand: 'bg-accent/10 text-accent',
    person: 'bg-orange/10 text-orange',
    product: 'bg-teal/10 text-teal',
    technology: 'bg-gold/10 text-gold',
    location: 'bg-positive/10 text-positive',
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Back button */}
      <Link
        href={`/project/${slug}/tags`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Torna ai Tag
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-teal flex items-center justify-center">
          <TagIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-primary capitalize">{tag.name}</h1>
            <Badge variant="outline">{tag.count} occorrenze</Badge>
            <Badge variant={sentimentVariant(overallSentiment)}>
              {sentimentLabel(overallSentiment)}
            </Badge>
          </div>
          {tag.last_seen_at && (
            <p className="text-sm text-muted-foreground mt-1">
              Ultimo rilevamento: {new Date(tag.last_seen_at).toLocaleDateString('it-IT', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>

      {/* Density Trend Chart */}
      <Card className="border-0 shadow-md rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-teal/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <h3 className="font-semibold text-primary">Trend Densita</h3>
          </div>
          {chartData.length >= 3 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B2B8C3" strokeOpacity={0.5} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  label={{
                    value: 'Densita %',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 11, fill: '#64748b' },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                  }}
                  formatter={(value, name) => [
                    name === 'densita' ? `${Number(value)}%` : Number(value),
                    name === 'densita' ? 'Densita' : 'Conteggio',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="densita"
                  stroke="#007AC5"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#007AC5' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">
                Servono almeno 3 scan per visualizzare il trend.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {chartData.length === 0
                  ? 'Nessuna scan disponibile.'
                  : `${chartData.length} scan disponibil${chartData.length === 1 ? 'e' : 'i'}.`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two-column layout: Keyword Distribution + Related Entities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Keyword Distribution */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal/20 to-accent/20 flex items-center justify-center">
                <Search className="w-4 h-4 text-teal" />
              </div>
              <h3 className="font-semibold text-primary">Distribuzione Keyword</h3>
              <span className="text-xs text-muted-foreground">({keywordDistribution.length})</span>
            </div>
            {kwChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(200, kwChartData.length * 36)}>
                <BarChart data={kwChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#B2B8C3" strokeOpacity={0.3} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    dataKey="keyword"
                    type="category"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [Number(value), 'Risultati']}
                  />
                  <Bar dataKey="conteggio" fill="#008996" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nessuna distribuzione disponibile.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Related Entities */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange/20 to-gold/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-orange" />
              </div>
              <h3 className="font-semibold text-primary">Entita Correlate</h3>
              <span className="text-xs text-muted-foreground">({relatedEntities.length})</span>
            </div>
            {relatedEntities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {relatedEntities.map((entity) => (
                  <span
                    key={`${entity.name}-${entity.type}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                      entityTypeColors[entity.type] || 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {entity.name}
                    <span className="opacity-60">({entity.count})</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nessuna entita correlata trovata.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Related Articles */}
      <Card className="border-0 shadow-md rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-teal/20 flex items-center justify-center">
              <ExternalLink className="w-4 h-4 text-accent" />
            </div>
            <h3 className="font-semibold text-primary">Articoli Correlati</h3>
            <span className="text-xs text-muted-foreground">({results.length})</span>
          </div>
          {results.length > 0 ? (
            <div className="space-y-3">
              {results.map((result) => (
                <div
                  key={result.id}
                  className="p-4 rounded-xl border border-border/50 hover:border-accent/30 hover:shadow-sm transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-accent hover:underline inline-flex items-center gap-1"
                      >
                        {truncate(result.title, 80)}
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                      <p className="text-xs text-muted-foreground mt-0.5">{result.domain}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={sourceVariant(result.source)}>
                        {sourceLabel(result.source)}
                      </Badge>
                      <Badge variant={sentimentVariant(result.sentiment)}>
                        {sentimentLabel(result.sentiment)}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Search className="w-3 h-3" />
                      {result.keyword}
                    </span>
                    <span>Pos. {result.position}</span>
                  </div>

                  {result.summary && (
                    <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 rounded-lg p-3">
                      {truncate(result.summary, 250)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nessun articolo correlato trovato per questo tag.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
