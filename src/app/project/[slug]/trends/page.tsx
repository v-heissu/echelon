'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Minus,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface TrendData {
  theme: string;
  direction: 'emerging' | 'stable' | 'declining' | 'new';
  current_density: number;
  avg_density: number;
  history: { date: string; density: number; count: number }[];
  total_count: number;
}

const CHART_COLORS = ['#007AC5', '#00A4E6', '#008996', '#F58B46', '#FFC76D', '#D64641', '#2D6A4F', '#33A1AB'];

type DirectionFilter = 'all' | 'emerging' | 'new' | 'declining' | 'stable';
type SortField = 'theme' | 'total_count' | 'direction' | 'current_density' | 'avg_density';
type SortOrder = 'asc' | 'desc';

const ITEMS_PER_PAGE = 50;

const directionIcon = (dir: string) => {
  switch (dir) {
    case 'emerging': return <TrendingUp className="h-4 w-4 text-positive" />;
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

const directionSortOrder: Record<string, number> = {
  emerging: 0,
  new: 1,
  declining: 2,
  stable: 3,
};

export default function TrendsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  // Chart state
  const [visibleThemes, setVisibleThemes] = useState<Set<string>>(new Set());

  // Table state
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [sortField, setSortField] = useState<SortField>('total_count');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);

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

  // Initialize visible themes when trends load (top 5)
  useEffect(() => {
    if (trends.length > 0) {
      const top5 = trends.slice(0, 5).map((t) => t.theme);
      setVisibleThemes(new Set(top5));
    }
  }, [trends]);

  // Derived data
  const nonStableThemes = useMemo(
    () => trends.filter((t) => t.direction !== 'stable'),
    [trends]
  );

  const emergingCount = useMemo(
    () => trends.filter((t) => t.direction === 'emerging').length,
    [trends]
  );
  const decliningCount = useMemo(
    () => trends.filter((t) => t.direction === 'declining').length,
    [trends]
  );
  const newCount = useMemo(
    () => trends.filter((t) => t.direction === 'new').length,
    [trends]
  );

  // Chart data
  const top5 = useMemo(() => trends.slice(0, 5), [trends]);
  const allDates = useMemo(() => {
    const dates = new Set<string>();
    top5.forEach((t) => t.history.forEach((h) => dates.add(h.date)));
    return Array.from(dates).sort();
  }, [top5]);

  const chartData = useMemo(() => {
    return allDates.map((date) => {
      const point: Record<string, unknown> = {
        date: date
          ? new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
          : '',
      };
      top5.forEach((t) => {
        const match = t.history.find((h) => h.date === date);
        point[t.theme] = match ? Number((match.density * 100).toFixed(1)) : 0;
      });
      return point;
    });
  }, [allDates, top5]);

  // Table filtering, sorting, pagination
  const filteredTrends = useMemo(() => {
    let filtered = [...trends];
    if (directionFilter !== 'all') {
      filtered = filtered.filter((t) => t.direction === directionFilter);
    }
    return filtered;
  }, [trends, directionFilter]);

  const sortedTrends = useMemo(() => {
    const sorted = [...filteredTrends];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'theme':
          cmp = a.theme.localeCompare(b.theme);
          break;
        case 'total_count':
          cmp = a.total_count - b.total_count;
          break;
        case 'direction':
          cmp = (directionSortOrder[a.direction] ?? 3) - (directionSortOrder[b.direction] ?? 3);
          break;
        case 'current_density':
          cmp = a.current_density - b.current_density;
          break;
        case 'avg_density':
          cmp = a.avg_density - b.avg_density;
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredTrends, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedTrends.length / ITEMS_PER_PAGE));
  const paginatedTrends = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedTrends.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedTrends, currentPage]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [directionFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleToggleTheme = (theme: string) => {
    setVisibleThemes((prev) => {
      const next = new Set(prev);
      if (next.has(theme)) {
        next.delete(theme);
      } else {
        next.add(theme);
      }
      return next;
    });
  };

  const navigateToTheme = (theme: string) => {
    router.push(`/project/${slug}/tags/${encodeURIComponent(theme)}`);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronUp className="h-3 w-3 text-muted-foreground/30" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-3 w-3 text-primary" />
    ) : (
      <ChevronDown className="h-3 w-3 text-primary" />
    );
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <div className="h-8 w-48 rounded-lg animate-shimmer" />
        <div className="h-96 rounded-xl animate-shimmer" />
      </div>
    );
  }

  const filterTabs: { key: DirectionFilter; label: string }[] = [
    { key: 'all', label: 'Tutti' },
    { key: 'emerging', label: 'Emergenti' },
    { key: 'new', label: 'Nuovi' },
    { key: 'declining', label: 'In Calo' },
    { key: 'stable', label: 'Stabili' },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-primary">Trend Tematici</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Analisi dell&apos;evoluzione dei temi nel tempo
        </p>
      </div>

      {/* Section 1 — Alert Box with quick filters */}
      {nonStableThemes.length > 0 && (
        <Card className="border-0 border-l-4 border-l-orange bg-orange/5 shadow-md rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-orange" />
              <h3 className="font-semibold text-primary">Temi in Movimento</h3>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {emergingCount > 0 && (
                <button
                  onClick={() => setDirectionFilter(directionFilter === 'emerging' ? 'all' : 'emerging')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                    directionFilter === 'emerging'
                      ? 'bg-orange text-white shadow-sm'
                      : 'bg-orange/10 text-orange hover:bg-orange/20'
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  {emergingCount} emergenti
                </button>
              )}
              {decliningCount > 0 && (
                <button
                  onClick={() => setDirectionFilter(directionFilter === 'declining' ? 'all' : 'declining')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                    directionFilter === 'declining'
                      ? 'bg-destructive text-white shadow-sm'
                      : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                  }`}
                >
                  <TrendingDown className="h-3.5 w-3.5" />
                  {decliningCount} in calo
                </button>
              )}
              {newCount > 0 && (
                <button
                  onClick={() => setDirectionFilter(directionFilter === 'new' ? 'all' : 'new')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                    directionFilter === 'new'
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-accent/10 text-accent hover:bg-accent/20'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {newCount} nuovi
                </button>
              )}
              {directionFilter !== 'all' && (
                <button
                  onClick={() => setDirectionFilter('all')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5" />
                  Mostra tutti
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {nonStableThemes
                .filter(t => directionFilter === 'all' || t.direction === directionFilter)
                .map((trend) => (
                <button
                  key={trend.theme}
                  onClick={() => navigateToTheme(trend.theme)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/80 hover:bg-background border border-border/50 transition-colors text-sm cursor-pointer"
                >
                  {directionIcon(trend.direction)}
                  <span className="font-medium">{trend.theme}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 2 — Trend Chart */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <h3 className="font-semibold text-primary">Densit&agrave; Tematica nel Tempo (Top 5)</h3>
          </div>

          {allDates.length < 3 ? (
            <div className="flex items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground max-w-md">
                Servono almeno 3 scan per visualizzare i trend. I dati saranno disponibili dopo
                successive scansioni.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 mb-4">
                {top5.map((t, i) => (
                  <label
                    key={t.theme}
                    className="inline-flex items-center gap-2 text-sm cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={visibleThemes.has(t.theme)}
                      onChange={() => handleToggleTheme(t.theme)}
                      className="rounded border-border"
                    />
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="text-muted-foreground">{t.theme}</span>
                  </label>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#B2B8C3"
                    strokeOpacity={0.5}
                  />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    label={{
                      value: 'Densit\u00e0 %',
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
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  {top5.map((t, i) =>
                    visibleThemes.has(t.theme) ? (
                      <Line
                        key={t.theme}
                        type="monotone"
                        dataKey={t.theme}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    ) : null
                  )}
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </CardContent>
      </Card>

      {/* Section 3 — Theme Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-gold" />
            </div>
            <h3 className="font-semibold text-primary">Tutti i Temi</h3>
            <span className="text-xs text-muted-foreground">({trends.length})</span>
          </div>

          {/* Tabbed Filter */}
          <div className="flex gap-1 mb-4 border-b border-border">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setDirectionFilter(tab.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px cursor-pointer ${
                  directionFilter === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {sortedTrends.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nessun trend disponibile. Avvia almeno una scan.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        onClick={() => handleSort('theme')}
                        className="inline-flex items-center gap-1 cursor-pointer select-none"
                      >
                        Nome
                        <SortIcon field="theme" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('total_count')}
                        className="inline-flex items-center gap-1 cursor-pointer select-none"
                      >
                        Occorrenze
                        <SortIcon field="total_count" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('direction')}
                        className="inline-flex items-center gap-1 cursor-pointer select-none"
                      >
                        Direction
                        <SortIcon field="direction" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('current_density')}
                        className="inline-flex items-center gap-1 cursor-pointer select-none"
                      >
                        Densit&agrave; Attuale
                        <SortIcon field="current_density" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('avg_density')}
                        className="inline-flex items-center gap-1 cursor-pointer select-none"
                      >
                        Densit&agrave; Media
                        <SortIcon field="avg_density" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTrends.map((trend) => (
                    <TableRow
                      key={trend.theme}
                      onClick={() => navigateToTheme(trend.theme)}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <span className="font-medium text-sm">{trend.theme}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{trend.total_count}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {directionIcon(trend.direction)}
                          <Badge
                            variant={
                              trend.direction === 'emerging'
                                ? 'positive'
                                : trend.direction === 'new'
                                ? 'mixed'
                                : trend.direction === 'declining'
                                ? 'negative'
                                : 'neutral'
                            }
                          >
                            {directionLabel(trend.direction)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{(trend.current_density * 100).toFixed(1)}%</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{(trend.avg_density * 100).toFixed(1)}%</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <span className="text-sm text-muted-foreground">
                    Pagina {currentPage} di {totalPages} ({sortedTrends.length} risultati)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
