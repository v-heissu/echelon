'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ResultsTable } from '@/components/dashboard/results-table';
import { SerpResultWithAnalysis } from '@/types/database';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ResultsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const supabase = createClient();

  const [results, setResults] = useState<SerpResultWithAnalysis[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [scans, setScans] = useState<{ id: string; completed_at: string }[]>([]);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [source, setSource] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [selectedScan, setSelectedScan] = useState('');
  const [competitorOnly, setCompetitorOnly] = useState(false);
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
  }, [slug, page, keyword, source, sentiment, selectedScan, competitorOnly, tagFilter]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  useEffect(() => {
    async function loadScans() {
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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-primary">Risultati</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end bg-white p-4 rounded-lg border border-border">
        <div>
          <label className="block text-xs font-medium mb-1">Scan</label>
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
          <label className="block text-xs font-medium mb-1">Keyword</label>
          <Input
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            placeholder="Filtra..."
            className="w-[150px]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Source</label>
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
          <label className="block text-xs font-medium mb-1">Sentiment</label>
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
          <label className="block text-xs font-medium mb-1">Tag</label>
          <Input
            value={tagFilter}
            onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}
            placeholder="Filtra tag..."
            className="w-[130px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={competitorOnly}
            onChange={(e) => { setCompetitorOnly(e.target.checked); setPage(1); }}
            id="comp"
          />
          <label htmlFor="comp" className="text-xs font-medium">Solo Competitor</label>
        </div>
      </div>

      {loading ? (
        <div className="h-64 bg-white rounded-lg animate-pulse" />
      ) : (
        <>
          <ResultsTable
            results={results}
            onTagClick={(tag) => { setTagFilter(tag); setPage(1); }}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {total} risultati — Pagina {page}/{totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
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
