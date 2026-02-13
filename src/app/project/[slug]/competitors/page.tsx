'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ResultsTable } from '@/components/dashboard/results-table';
import { SerpResultWithAnalysis } from '@/types/database';
import { Building2, List, X } from 'lucide-react';

export default function CompetitorsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [results, setResults] = useState<SerpResultWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const loadResults = useCallback(async () => {
    const res = await fetch(`/api/projects/${slug}/results?competitor=true&limit=200`);
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
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  // Group by domain
  const domainMap = new Map<string, { count: number; keywords: Set<string>; positions: number[] }>();
  results.forEach((r) => {
    const existing = domainMap.get(r.domain) || {
      count: 0,
      keywords: new Set<string>(),
      positions: [],
    };
    existing.count++;
    existing.keywords.add(r.keyword);
    existing.positions.push(r.position);
    domainMap.set(r.domain, existing);
  });

  const competitorStats = Array.from(domainMap.entries())
    .map(([domain, data]) => ({
      domain,
      count: data.count,
      keywords: data.keywords.size,
      avgPosition: data.positions.reduce((a, b) => a + b, 0) / data.positions.length,
    }))
    .sort((a, b) => b.count - a.count);

  const filteredResults = selectedDomain
    ? results.filter((r) => r.domain === selectedDomain)
    : results;

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <div className="h-8 w-48 rounded-lg animate-shimmer" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-xl animate-shimmer" />)}
        </div>
        <div className="h-64 rounded-xl animate-shimmer" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-primary">Vista Competitor</h1>
        <p className="text-sm text-muted-foreground mt-1">{competitorStats.length} competitor rilevati</p>
      </div>

      {competitorStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitorStats.map((comp) => (
            <Card
              key={comp.domain}
              className={`border-0 shadow-md overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedDomain === comp.domain ? 'ring-2 ring-orange shadow-lg' : ''
              }`}
              onClick={() => setSelectedDomain(selectedDomain === comp.domain ? null : comp.domain)}
            >
              <div className="h-1 bg-gradient-to-r from-orange to-gold" />
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-md bg-orange/10 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-orange" />
                  </div>
                  <h3 className="font-semibold text-sm text-primary truncate">{comp.domain}</h3>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-xl font-bold text-primary">{comp.count}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Menzioni</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-xl font-bold text-primary">{comp.keywords}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Keywords</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-xl font-bold text-primary">{comp.avgPosition.toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Pos. Media</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-0 shadow-md overflow-hidden">
        <div className="p-5 pb-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange/10 flex items-center justify-center">
              <List className="w-4 h-4 text-orange" />
            </div>
            <h3 className="font-semibold text-primary">
              {selectedDomain ? `Risultati per ${selectedDomain}` : 'Risultati Competitor'}
            </h3>
            {selectedDomain && (
              <button
                onClick={() => setSelectedDomain(null)}
                className="ml-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary bg-muted/60 px-2 py-1 rounded-full transition-colors"
              >
                <X className="w-3 h-3" /> Rimuovi filtro
              </button>
            )}
          </div>
        </div>
        <CardContent className="p-0 mt-3">
          <ResultsTable results={filteredResults} />
        </CardContent>
      </Card>

      {results.length === 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-8 w-8 text-orange" />
            </div>
            <h3 className="text-lg font-semibold text-primary mb-1">Nessun competitor trovato</h3>
            <p className="text-sm text-muted-foreground">Configura i competitor nel progetto per iniziare.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
