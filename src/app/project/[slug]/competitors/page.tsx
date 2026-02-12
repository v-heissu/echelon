'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResultsTable } from '@/components/dashboard/results-table';
import { SerpResultWithAnalysis } from '@/types/database';

export default function CompetitorsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [results, setResults] = useState<SerpResultWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="h-64 bg-white rounded-lg animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Vista Competitor</h1>

      {competitorStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitorStats.map((comp) => (
            <Card key={comp.domain}>
              <CardContent className="p-5">
                <h3 className="font-medium text-sm text-orange truncate">{comp.domain}</h3>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xl font-bold text-primary">{comp.count}</p>
                    <p className="text-xs text-muted-foreground">Menzioni</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-primary">{comp.keywords}</p>
                    <p className="text-xs text-muted-foreground">Keywords</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-primary">{comp.avgPosition.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Pos. Media</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risultati Competitor</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ResultsTable results={results} />
        </CardContent>
      </Card>

      {results.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Nessun competitor trovato. Configura i competitor nel progetto.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
