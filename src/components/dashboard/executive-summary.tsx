'use client';

import { Card, CardContent } from '@/components/ui/card';
import { FileText, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

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

function sentimentLabel(score: number): { text: string; color: string } {
  if (score >= 0.5) return { text: 'molto positivo', color: 'text-positive' };
  if (score >= 0.15) return { text: 'positivo', color: 'text-positive' };
  if (score >= -0.15) return { text: 'neutro', color: 'text-muted-foreground' };
  if (score >= -0.5) return { text: 'negativo', color: 'text-destructive' };
  return { text: 'molto negativo', color: 'text-destructive' };
}

function DeltaBadge({ value, label, invert }: { value: number; label: string; invert?: boolean }) {
  if (value === 0) return null;
  const positive = invert ? value < 0 : value > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${positive ? 'bg-positive/10 text-positive' : 'bg-destructive/10 text-destructive'}`}>
      {value > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {label} {value > 0 ? '+' : ''}{value}%
    </span>
  );
}

export function ExecutiveSummary({ kpi, delta, themes, topDomains, scanCount }: ExecutiveSummaryProps) {
  if (scanCount < 1 || kpi.total_results === 0) return null;

  const sentiment = sentimentLabel(kpi.avg_sentiment);
  const competitorDomains = topDomains.filter(d => d.is_competitor);
  const topThemes = themes.slice(0, 5);
  const negativeThemes = themes.filter(t => t.sentiment_score < -0.15).slice(0, 3);
  const topOrganic = topDomains.filter(d => !d.is_competitor).slice(0, 3);
  const hasDelta = scanCount >= 2;

  return (
    <Card className="border-0 shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-[#5B5FC7] flex items-center justify-center shadow-sm">
            <FileText className="w-4.5 h-4.5 text-white" />
          </div>
          <h3 className="font-semibold text-primary text-[15px]">Executive Summary</h3>
        </div>

        <div className="text-sm text-primary/85 leading-relaxed space-y-2.5 rounded-xl bg-[#f8f9fb] p-4">
          {/* Main paragraph */}
          <p>
            L&apos;ultima scan ha raccolto <span className="font-semibold text-primary">{kpi.total_results.toLocaleString('it-IT')} risultati</span> da{' '}
            <span className="font-semibold text-primary">{kpi.unique_domains} domini unici</span>.{' '}
            Il sentiment complessivo e <span className={`font-semibold ${sentiment.color}`}>{sentiment.text}</span>{' '}
            (<span className={`font-semibold ${sentiment.color}`}>{kpi.avg_sentiment.toFixed(2)}</span>).
            {kpi.competitor_mentions > 0 && (
              <>{' '}Rilevate <span className="font-semibold text-orange">{kpi.competitor_mentions} menzioni competitor</span>.</>
            )}
          </p>

          {/* Deltas inline */}
          {hasDelta && (delta.total_results !== 0 || delta.unique_domains !== 0 || delta.avg_sentiment !== 0) && (
            <div className="flex flex-wrap gap-2">
              <DeltaBadge value={delta.total_results} label="Risultati" />
              <DeltaBadge value={delta.unique_domains} label="Domini" />
              <DeltaBadge value={delta.competitor_mentions} label="Competitor" />
              {delta.avg_sentiment !== 0 && (
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${delta.avg_sentiment > 0 ? 'bg-positive/10 text-positive' : 'bg-destructive/10 text-destructive'}`}>
                  {delta.avg_sentiment > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  Sentiment {delta.avg_sentiment > 0 ? '+' : ''}{delta.avg_sentiment.toFixed(2)}
                </span>
              )}
            </div>
          )}

          {/* Themes + domains in one flow */}
          {topThemes.length > 0 && (
            <p>
              I temi principali sono{' '}
              {topThemes.map((t, i) => (
                <span key={t.name}>
                  {i > 0 && (i === topThemes.length - 1 ? ' e ' : ', ')}
                  <span className={`font-medium ${t.sentiment_score >= 0.15 ? 'text-positive' : t.sentiment_score <= -0.15 ? 'text-destructive' : 'text-primary'}`}>
                    {t.name}
                  </span>
                </span>
              ))}.
              {negativeThemes.length > 0 && (
                <>{' '}Attenzione ai temi critici: <span className="font-medium text-destructive">{negativeThemes.map(t => t.name).join(', ')}</span>.</>
              )}
            </p>
          )}

          {(topOrganic.length > 0 || competitorDomains.length > 0) && (
            <p>
              {topOrganic.length > 0 && (
                <>
                  I domini piu presenti sono{' '}
                  {topOrganic.map((d, i) => (
                    <span key={d.domain}>
                      {i > 0 && (i === topOrganic.length - 1 ? ' e ' : ', ')}
                      <span className="font-semibold text-accent">{d.domain}</span>
                    </span>
                  ))}.{' '}
                </>
              )}
              {competitorDomains.length > 0 && (
                <>
                  Competitor rilevati:{' '}
                  {competitorDomains.map((d, i) => (
                    <span key={d.domain}>
                      {i > 0 && (i === competitorDomains.length - 1 ? ' e ' : ', ')}
                      <span className="font-semibold text-orange">{d.domain}</span>
                      <span className="text-muted-foreground text-xs"> ({d.count})</span>
                    </span>
                  ))}.
                </>
              )}
            </p>
          )}

          {/* Alert inline */}
          {kpi.alert_count > 0 && (
            <p className="text-destructive font-medium">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
              {kpi.alert_count} alert {kpi.alert_count === 1 ? 'prioritario' : 'prioritari'} da verificare.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
