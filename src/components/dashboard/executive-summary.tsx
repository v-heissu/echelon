'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';

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
  briefing: string | null;
  slug: string;
}

function sentimentLabel(score: number): { text: string; color: string } {
  if (score >= 0.5) return { text: 'molto positivo', color: 'text-positive' };
  if (score >= 0.15) return { text: 'positivo', color: 'text-positive' };
  if (score >= -0.15) return { text: 'neutro', color: 'text-muted-foreground' };
  if (score >= -0.5) return { text: 'negativo', color: 'text-destructive' };
  return { text: 'molto negativo', color: 'text-destructive' };
}

/**
 * Render text with **bold** markers as styled <strong> elements.
 * Also handles section headers like "**Panoramica** — ..."
 */
function FormattedBriefing({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, i) => {
        const trimmed = paragraph.trim();
        if (!trimmed) return null;

        // Check if this is a section header: starts with **Title** —
        const sectionMatch = trimmed.match(/^\*\*(.+?)\*\*\s*[—–-]\s*/);

        if (sectionMatch) {
          const title = sectionMatch[1];
          const body = trimmed.slice(sectionMatch[0].length);
          return (
            <div key={i}>
              <p className="text-sm leading-relaxed">
                <span className="font-bold text-primary">{title}</span>
                <span className="text-primary/40 mx-1.5">|</span>
                <RichText text={body} />
              </p>
            </div>
          );
        }

        return (
          <p key={i} className="text-sm leading-relaxed">
            <RichText text={trimmed} />
          </p>
        );
      })}
    </div>
  );
}

/** Render inline **bold** markers */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-primary">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
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

export function ExecutiveSummary({ kpi, delta, themes, topDomains, scanCount, briefing, slug }: ExecutiveSummaryProps) {
  const [currentBriefing, setCurrentBriefing] = useState(briefing);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (scanCount < 1 || kpi.total_results === 0) return null;

  const sentiment = sentimentLabel(kpi.avg_sentiment);
  const competitorDomains = topDomains.filter(d => d.is_competitor);
  const topThemes = themes.slice(0, 5);
  const negativeThemes = themes.filter(t => t.sentiment_score < -0.15).slice(0, 3);
  const topOrganic = topDomains.filter(d => !d.is_competitor).slice(0, 3);
  const hasDelta = scanCount >= 2;
  const hasBriefing = !!currentBriefing;

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/regenerate-briefing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentBriefing(data.briefing);
      } else {
        setError(data.error || 'Errore durante la generazione del briefing');
      }
    } catch {
      setError('Errore di rete. Riprova più tardi.');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Card className="border-0 shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${hasBriefing ? 'from-accent to-teal' : 'from-accent to-[#5B5FC7]'} flex items-center justify-center shadow-sm`}>
            {hasBriefing ? <Sparkles className="w-4.5 h-4.5 text-white" /> : <FileText className="w-4.5 h-4.5 text-white" />}
          </div>
          <h3 className="font-semibold text-primary text-[15px] flex-1">Executive Summary</h3>
          {scanCount >= 2 && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/5 transition-colors disabled:opacity-50"
              title={hasBriefing ? 'Rigenera con AI' : 'Genera con AI'}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        <div className="text-sm text-primary/85 leading-relaxed space-y-2.5 rounded-xl bg-[#f8f9fb] p-4">
          {/* AI Briefing (replaces template when available) */}
          {hasBriefing ? (
            <FormattedBriefing text={currentBriefing!} />
          ) : (
            <>
              {/* Template-based summary */}
              <p>
                L&apos;ultima scan ha raccolto <span className="font-semibold text-primary">{kpi.total_results.toLocaleString('it-IT')} risultati</span> da{' '}
                <span className="font-semibold text-primary">{kpi.unique_domains} domini unici</span>.{' '}
                Il sentiment complessivo e <span className={`font-semibold ${sentiment.color}`}>{sentiment.text}</span>{' '}
                (<span className={`font-semibold ${sentiment.color}`}>{kpi.avg_sentiment.toFixed(2)}</span>).
                {kpi.competitor_mentions > 0 && (
                  <>{' '}Rilevate <span className="font-semibold text-orange">{kpi.competitor_mentions} menzioni competitor</span>.</>
                )}
              </p>

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
            </>
          )}

          {/* Deltas (always shown when available) */}
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

          {/* Alert inline */}
          {kpi.alert_count > 0 && (
            <p className="text-destructive font-medium">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
              {kpi.alert_count} alert {kpi.alert_count === 1 ? 'prioritario' : 'prioritari'} da verificare.
            </p>
          )}

          {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
          {regenerating && <p className="text-xs text-muted-foreground">Rigenerazione in corso...</p>}
        </div>
      </CardContent>
    </Card>
  );
}
