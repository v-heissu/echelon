'use client';

import { Card, CardContent } from '@/components/ui/card';
import { FileText, TrendingUp, TrendingDown, Minus, Shield, AlertTriangle } from 'lucide-react';

interface KPIData {
  total_results: number;
  unique_domains: number;
  competitor_mentions: number;
  avg_sentiment: number;
  alert_count: number;
}

interface ThemeSentiment {
  name: string;
  count: number;
  sentiment: string;
  sentiment_score: number;
}

interface TopDomain {
  domain: string;
  count: number;
  is_competitor: boolean;
}

interface ExecutiveSummaryProps {
  kpi: KPIData;
  delta: KPIData;
  themes: ThemeSentiment[];
  topDomains: TopDomain[];
  scanCount: number;
}

function sentimentLabel(score: number): { text: string; color: string; bg: string } {
  if (score >= 0.5) return { text: 'molto positivo', color: 'text-positive', bg: 'bg-positive/10' };
  if (score >= 0.15) return { text: 'positivo', color: 'text-positive', bg: 'bg-positive/10' };
  if (score >= -0.15) return { text: 'neutro', color: 'text-muted-foreground', bg: 'bg-muted/50' };
  if (score >= -0.5) return { text: 'negativo', color: 'text-destructive', bg: 'bg-destructive/10' };
  return { text: 'molto negativo', color: 'text-destructive', bg: 'bg-destructive/10' };
}

function deltaIcon(value: number) {
  if (value > 0) return <TrendingUp className="h-3.5 w-3.5 text-positive inline" />;
  if (value < 0) return <TrendingDown className="h-3.5 w-3.5 text-destructive inline" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground inline" />;
}

function deltaText(value: number, isScore = false): string {
  if (value === 0) return 'stabile';
  if (isScore) return `${value > 0 ? '+' : ''}${value.toFixed(2)} rispetto alla scan precedente`;
  return `${value > 0 ? '+' : ''}${value}% rispetto alla scan precedente`;
}

export function ExecutiveSummary({ kpi, delta, themes, topDomains, scanCount }: ExecutiveSummaryProps) {
  if (scanCount < 1 || kpi.total_results === 0) return null;

  const sentiment = sentimentLabel(kpi.avg_sentiment);
  const competitorDomains = topDomains.filter(d => d.is_competitor);
  const topThemes = themes.slice(0, 5);
  const negativeThemes = themes.filter(t => t.sentiment_score < -0.15).slice(0, 3);
  const positiveThemes = themes.filter(t => t.sentiment_score > 0.15).slice(0, 3);
  const topOrganic = topDomains.filter(d => !d.is_competitor).slice(0, 3);

  return (
    <Card className="border-0 shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-[#5B5FC7] flex items-center justify-center shadow-sm">
            <FileText className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-primary text-[15px]">Executive Summary</h3>
            <p className="text-[11px] text-muted-foreground">Sintesi testuale della scan corrente</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Overview */}
          <div className="rounded-xl bg-[#f8f9fb] p-4">
            <p className="text-sm text-primary/85 leading-relaxed">
              La scan ha raccolto <span className="font-semibold text-primary">{kpi.total_results.toLocaleString('it-IT')} risultati</span> da{' '}
              <span className="font-semibold text-primary">{kpi.unique_domains} domini unici</span>.{' '}
              {kpi.competitor_mentions > 0 ? (
                <>
                  Tra questi, <span className="font-semibold text-orange">{kpi.competitor_mentions} menzioni competitor</span> rilevate.
                </>
              ) : (
                <span className="text-muted-foreground">Nessuna menzione competitor rilevata.</span>
              )}
            </p>

            {/* Deltas */}
            {scanCount >= 2 && (delta.total_results !== 0 || delta.unique_domains !== 0) && (
              <div className="flex flex-wrap gap-3 mt-3">
                {delta.total_results !== 0 && (
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${delta.total_results > 0 ? 'bg-positive/10 text-positive' : 'bg-destructive/10 text-destructive'}`}>
                    {deltaIcon(delta.total_results)} Risultati: {delta.total_results > 0 ? '+' : ''}{delta.total_results}%
                  </span>
                )}
                {delta.unique_domains !== 0 && (
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${delta.unique_domains > 0 ? 'bg-positive/10 text-positive' : 'bg-destructive/10 text-destructive'}`}>
                    {deltaIcon(delta.unique_domains)} Domini: {delta.unique_domains > 0 ? '+' : ''}{delta.unique_domains}%
                  </span>
                )}
                {delta.competitor_mentions !== 0 && (
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${delta.competitor_mentions > 0 ? 'bg-orange/10 text-orange' : 'bg-positive/10 text-positive'}`}>
                    {deltaIcon(delta.competitor_mentions)} Competitor: {delta.competitor_mentions > 0 ? '+' : ''}{delta.competitor_mentions}%
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Sentiment */}
          <div className="rounded-xl border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2.5 h-2.5 rounded-full ${kpi.avg_sentiment >= 0.15 ? 'bg-positive' : kpi.avg_sentiment <= -0.15 ? 'bg-destructive' : 'bg-muted-foreground'}`} />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sentiment</span>
            </div>
            <p className="text-sm text-primary/85 leading-relaxed">
              Il sentiment medio e <span className={`font-semibold ${sentiment.color}`}>{sentiment.text}</span>{' '}
              con un punteggio di <span className={`font-semibold px-1.5 py-0.5 rounded ${sentiment.bg} ${sentiment.color}`}>{kpi.avg_sentiment.toFixed(2)}</span>.{' '}
              {scanCount >= 2 && delta.avg_sentiment !== 0 && (
                <span className="text-muted-foreground">
                  ({deltaIcon(delta.avg_sentiment)} {deltaText(delta.avg_sentiment, true)})
                </span>
              )}
            </p>
          </div>

          {/* Themes */}
          {topThemes.length > 0 && (
            <div className="rounded-xl border border-border/50 p-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Temi principali</span>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {topThemes.map(t => {
                  const tSent = sentimentLabel(t.sentiment_score);
                  return (
                    <span
                      key={t.name}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${tSent.bg} ${tSent.color} border border-current/10`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${t.sentiment_score >= 0.15 ? 'bg-positive' : t.sentiment_score <= -0.15 ? 'bg-destructive' : 'bg-muted-foreground'}`} />
                      {t.name}
                      <span className="opacity-60">({t.count})</span>
                    </span>
                  );
                })}
              </div>

              {/* Sentiment-specific theme insights */}
              {(positiveThemes.length > 0 || negativeThemes.length > 0) && (
                <div className="mt-3 space-y-1.5">
                  {positiveThemes.length > 0 && (
                    <p className="text-xs text-primary/70 leading-relaxed">
                      <span className="text-positive font-medium">Temi positivi:</span>{' '}
                      {positiveThemes.map(t => t.name).join(', ')}
                    </p>
                  )}
                  {negativeThemes.length > 0 && (
                    <p className="text-xs text-primary/70 leading-relaxed">
                      <span className="text-destructive font-medium">Temi critici:</span>{' '}
                      {negativeThemes.map(t => t.name).join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Competitor & Domain visibility */}
          {(competitorDomains.length > 0 || topOrganic.length > 0) && (
            <div className="rounded-xl border border-border/50 p-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visibilita domini</span>

              {topOrganic.length > 0 && (
                <p className="text-sm text-primary/85 leading-relaxed mt-2">
                  <Shield className="w-3.5 h-3.5 text-accent inline mr-1" />
                  I domini piu visibili sono{' '}
                  {topOrganic.map((d, i) => (
                    <span key={d.domain}>
                      {i > 0 && (i === topOrganic.length - 1 ? ' e ' : ', ')}
                      <span className="font-semibold text-accent">{d.domain}</span>
                      <span className="text-muted-foreground text-xs"> ({d.count})</span>
                    </span>
                  ))}.
                </p>
              )}

              {competitorDomains.length > 0 && (
                <p className="text-sm text-primary/85 leading-relaxed mt-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange inline mr-1" />
                  Competitor presenti:{' '}
                  {competitorDomains.map((d, i) => (
                    <span key={d.domain}>
                      {i > 0 && (i === competitorDomains.length - 1 ? ' e ' : ', ')}
                      <span className="font-semibold text-orange">{d.domain}</span>
                      <span className="text-muted-foreground text-xs"> ({d.count} risultati)</span>
                    </span>
                  ))}.
                </p>
              )}
            </div>
          )}

          {/* Alerts */}
          {kpi.alert_count > 0 && (
            <div className="rounded-xl bg-destructive/5 border border-destructive/15 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-sm font-semibold text-destructive">
                  {kpi.alert_count} {kpi.alert_count === 1 ? 'alert prioritario rilevato' : 'alert prioritari rilevati'}
                </span>
                {scanCount >= 2 && delta.alert_count !== 0 && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${delta.alert_count > 0 ? 'bg-destructive/10 text-destructive' : 'bg-positive/10 text-positive'}`}>
                    {delta.alert_count > 0 ? '+' : ''}{delta.alert_count}%
                  </span>
                )}
              </div>
              <p className="text-xs text-destructive/70 mt-1">
                Risultati che corrispondono alle parole chiave di alert configurate per questo progetto.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
