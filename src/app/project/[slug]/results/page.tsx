'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ResultsTable } from '@/components/dashboard/results-table';
import { SerpResultWithAnalysis, Sentiment } from '@/types/database';
import { ChevronLeft, ChevronRight, Filter, LayoutGrid, List, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ResultsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [results, setResults] = useState<SerpResultWithAnalysis[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [scans, setScans] = useState<{ id: string; completed_at: string }[]>([]);
  const [viewMode, setViewMode] = useState<'intelligence' | 'table'>('intelligence');

  // Filters
  const [keyword, setKeyword] = useState('');
  const [source, setSource] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [selectedScan, setSelectedScan] = useState('');
  const [competitorOnly, setCompetitorOnly] = useState(false);
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState('');

  const loadResults = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', '50');
    if (keyword) params.set('keyword', keyword);
    if (source) params.set('source', source);
    if (sentiment) params.set('sentiment', sentiment);
    if (selectedScan) params.set('scan_id', selectedScan);
    if (competitorOnly) params.set('competitor', 'true');
    if (priorityOnly) params.set('priority', 'true');
    if (tagFilter) params.set('tag', tagFilter);

    const res = await fetch(`/api/projects/${slug}/results?${params}`);
    if (res.ok) {
      const data = await res.json();
      setResults(
        data.results.map((r: Record<string, unknown>) => ({
          ...r,
          ai_analysis: Array.isArray(r.ai_analysis)
            ? (r.ai_analysis as unknown[])[0] || null
            : r.ai_analysis,
        }))
      );
      setTotal(data.total);
    }
    setLoading(false);
  }, [slug, page, keyword, source, sentiment, selectedScan, competitorOnly, priorityOnly, tagFilter]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  useEffect(() => {
    async function loadScans() {
      const supabase = createClient();
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('slug', slug)
        .single();

      if (project) {
        const { data } = await supabase
          .from('scans')
          .select('id, completed_at')
          .eq('project_id', project.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(20);
        setScans(data || []);
      }
    }
    loadScans();
  }, [slug]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Risultati</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} risultati trovati</p>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
          <button
            onClick={() => setViewMode('intelligence')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'intelligence' ? 'bg-white shadow-sm text-accent' : 'text-muted-foreground hover:text-primary'}`}
            title="Vista Intelligence"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-accent' : 'text-muted-foreground hover:text-primary'}`}
            title="Vista Tabella"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtri</span>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Scan</label>
              <Select
                value={selectedScan}
                onChange={(e) => { setSelectedScan(e.target.value); setPage(1); }}
                className="w-[180px]"
              >
                <option value="">Tutte le scan</option>
                {scans.map((s) => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.completed_at).toLocaleDateString('it-IT')}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Keyword</label>
              <Input
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                placeholder="Filtra..."
                className="w-[150px]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Source</label>
              <Select
                value={source}
                onChange={(e) => { setSource(e.target.value); setPage(1); }}
                className="w-[140px]"
              >
                <option value="">Tutte</option>
                <option value="google_organic">Web</option>
                <option value="google_news">News</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Sentiment</label>
              <Select
                value={sentiment}
                onChange={(e) => { setSentiment(e.target.value); setPage(1); }}
                className="w-[130px]"
              >
                <option value="">Tutti</option>
                <option value="positive">Positivo</option>
                <option value="negative">Negativo</option>
                <option value="neutral">Neutro</option>
                <option value="mixed">Misto</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tag</label>
              <Input
                value={tagFilter}
                onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}
                placeholder="Filtra tag..."
                className="w-[130px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setCompetitorOnly(!competitorOnly); setPage(1); }}
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${competitorOnly ? 'bg-accent' : 'bg-border'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${competitorOnly ? 'left-4.5' : 'left-0.5'}`} />
              </button>
              <label className="text-xs font-medium text-muted-foreground">Solo Competitor</label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setPriorityOnly(!priorityOnly); setPage(1); }}
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${priorityOnly ? 'bg-destructive' : 'bg-border'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${priorityOnly ? 'left-4.5' : 'left-0.5'}`} />
              </button>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Solo Alert
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="h-64 rounded-xl animate-shimmer" />
      ) : (
        <>
          {viewMode === 'intelligence' ? (
            <div className="space-y-3">
              {results.map((result) => {
                const analysis = result.ai_analysis;
                return (
                  <div
                    key={result.id}
                    className={`bg-white rounded-xl shadow-sm p-4 space-y-2.5 hover:shadow-md transition-shadow ${result.is_competitor ? 'border-l-4 border-l-orange' : 'border border-border/40'}`}
                  >
                    {/* Row 1: Title + domain + position + sentiment + source badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline text-sm font-medium truncate"
                        >
                          {result.title}
                        </a>
                        <span className="text-xs text-muted-foreground">{result.domain}</span>
                        <span className="text-xs bg-muted rounded px-1.5 py-0.5 font-mono text-muted-foreground">
                          #{result.position}
                        </span>
                        {analysis && (
                          <Badge variant={analysis.sentiment as Sentiment}>
                            {analysis.sentiment}
                          </Badge>
                        )}
                        {analysis?.is_hi_priority && (
                          <span className="inline-flex items-center gap-1 text-xs bg-destructive/10 text-destructive rounded-full px-2 py-0.5 font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            Alert
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {result.source === 'google_organic' ? 'Web' : 'News'}
                      </Badge>
                    </div>

                    {/* Priority reason */}
                    {analysis?.is_hi_priority && analysis.priority_reason && (
                      <div className="flex items-start gap-1.5 text-xs text-destructive bg-destructive/5 rounded-lg px-3 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        {analysis.priority_reason}
                      </div>
                    )}

                    {/* Row 2: AI Summary */}
                    {analysis?.summary && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {analysis.summary}
                      </p>
                    )}

                    {/* Row 3: Tag chips + Entity chips */}
                    {((analysis?.themes && analysis.themes.length > 0) || (analysis?.entities && analysis.entities.length > 0)) && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {analysis?.themes?.map((t) => (
                          <span
                            key={t.name}
                            className="text-xs bg-accent/10 text-accent rounded-full px-2 py-0.5 cursor-pointer hover:bg-accent/20 transition-colors font-medium"
                            onClick={() => { setTagFilter(t.name); setPage(1); }}
                          >
                            {t.name}
                          </span>
                        ))}
                        {analysis?.entities?.map((e, i) => (
                          <span
                            key={i}
                            className="text-xs bg-teal/10 text-teal rounded-full px-2 py-0.5"
                          >
                            {e.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {results.length === 0 && (
                <div className="p-12 text-center text-muted-foreground bg-white rounded-xl shadow-sm">
                  Nessun risultato trovato
                </div>
              )}
            </div>
          ) : (
            <ResultsTable
              results={results}
              onTagClick={(tag) => { setTagFilter(tag); setPage(1); }}
            />
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {total} risultati — Pagina {page}/{totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="gap-1"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
