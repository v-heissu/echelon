'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  Award,
  Users,
  Search,
  ChevronUp,
  ChevronDown,
  ArrowUpRight,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type EntityType = 'competitor' | 'brand' | 'person';

interface EntityItem {
  name: string;
  type: string;
  count: number;
  domains: string[];
  keywords: string[];
  avg_sentiment: number;
  avg_position?: number;
}

type SortField = 'name' | 'count' | 'avg_sentiment' | 'keywords' | 'domains';
type SortDir = 'asc' | 'desc';

// ── Sentiment helpers ────────────────────────────────────────────────────────

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

// ── Tab configuration ────────────────────────────────────────────────────────

const TABS: { key: EntityType; label: string; icon: typeof Building2 }[] = [
  { key: 'competitor', label: 'Competitor', icon: Building2 },
  { key: 'brand', label: 'Brand', icon: Award },
  { key: 'person', label: 'Persone', icon: Users },
];

// ── Page component ───────────────────────────────────────────────────────────

export default function EntitiesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<EntityType>('competitor');
  const [competitors, setCompetitors] = useState<EntityItem[]>([]);
  const [brands, setBrands] = useState<EntityItem[]>([]);
  const [persons, setPersons] = useState<EntityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [compRes, brandRes, personRes] = await Promise.all([
        fetch(`/api/projects/${slug}/entities?type=competitor`),
        fetch(`/api/projects/${slug}/entities?type=brand`),
        fetch(`/api/projects/${slug}/entities?type=person`),
      ]);

      if (compRes.ok) {
        const data = await compRes.json();
        setCompetitors(data.entities || []);
      }
      if (brandRes.ok) {
        const data = await brandRes.json();
        setBrands(data.entities || []);
      }
      if (personRes.ok) {
        const data = await personRes.json();
        setPersons(data.entities || []);
      }

      setLoading(false);
    }
    load();
  }, [slug]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const dataForTab: Record<EntityType, EntityItem[]> = useMemo(
    () => ({ competitor: competitors, brand: brands, person: persons }),
    [competitors, brands, persons]
  );

  const counts: Record<EntityType, number> = useMemo(
    () => ({
      competitor: competitors.length,
      brand: brands.length,
      person: persons.length,
    }),
    [competitors, brands, persons]
  );

  const currentData = dataForTab[activeTab];

  // ── Filtering + sorting ────────────────────────────────────────────────────

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('desc');
      }
    },
    [sortField]
  );

  const filteredSorted = useMemo(() => {
    let items = currentData;

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.keywords.some((k) => k.toLowerCase().includes(q)) ||
          e.domains.some((d) => d.toLowerCase().includes(q))
      );
    }

    // Sort
    const sorted = [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'count':
          cmp = a.count - b.count;
          break;
        case 'avg_sentiment':
          cmp = a.avg_sentiment - b.avg_sentiment;
          break;
        case 'keywords':
          cmp = a.keywords.length - b.keywords.length;
          break;
        case 'domains':
          cmp = a.domains.length - b.domains.length;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [currentData, search, sortField, sortDir]);

  // ── Sort indicator ─────────────────────────────────────────────────────────

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />;
    }
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-accent" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-accent" />
    );
  }

  function SortableHead({ field, children }: { field: SortField; children: React.ReactNode }) {
    return (
      <TableHead
        className="cursor-pointer select-none hover:text-primary transition-colors"
        onClick={() => handleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          <SortIcon field={field} />
        </span>
      </TableHead>
    );
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="h-8 w-48 rounded-lg animate-shimmer" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-32 rounded-lg animate-shimmer" />
          ))}
        </div>
        <div className="h-96 rounded-xl animate-shimmer" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">Entit&agrave;</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Competitor, brand e persone menzionati nei risultati
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSearch('');
                setSortField('count');
                setSortDir('desc');
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent text-white'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span
                className={`ml-1 text-xs rounded-full px-2 py-0.5 ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {counts[tab.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content card */}
      <Card className="border-0 shadow-md overflow-hidden">
        <CardContent className="p-0">
          {/* Search bar */}
          <div className="p-4 border-b">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca per nome, keyword o dominio..."
                className="pl-9"
              />
            </div>
          </div>

          {filteredSorted.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="name">Nome</SortableHead>
                  <SortableHead field="count">Menzioni</SortableHead>
                  <SortableHead field="avg_sentiment">Sentiment</SortableHead>
                  <SortableHead field="keywords">Keywords</SortableHead>
                  <SortableHead field="domains">
                    {activeTab === 'competitor' ? 'Domini' : 'Fonti'}
                  </SortableHead>
                  <TableHead className="w-10">Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSorted.map((entity) => (
                  <TableRow
                    key={entity.name}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() =>
                      router.push(
                        `/project/${slug}/entities/${encodeURIComponent(entity.name)}`
                      )
                    }
                  >
                    {/* Nome */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-primary">{entity.name}</span>
                        {activeTab === 'competitor' && entity.avg_position != null && (
                          <span className="text-xs text-muted-foreground">
                            pos. {entity.avg_position}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Menzioni */}
                    <TableCell>
                      <span className="font-semibold text-primary">{entity.count}</span>
                    </TableCell>

                    {/* Sentiment */}
                    <TableCell>
                      <Badge variant={sentimentVariant(entity.avg_sentiment)}>
                        {sentimentLabel(entity.avg_sentiment)}
                      </Badge>
                    </TableCell>

                    {/* Keywords chips (max 3) */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {entity.keywords.slice(0, 3).map((kw) => (
                          <span
                            key={kw}
                            className="text-[11px] bg-muted/70 text-muted-foreground px-2 py-0.5 rounded-full"
                          >
                            {kw}
                          </span>
                        ))}
                        {entity.keywords.length > 3 && (
                          <span className="text-[11px] text-muted-foreground px-1">
                            +{entity.keywords.length - 3}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Domini / Fonti chips (max 2) */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {entity.domains.slice(0, 2).map((d) => (
                          <span
                            key={d}
                            className="text-[11px] bg-accent/10 text-accent px-2 py-0.5 rounded-full"
                          >
                            {d}
                          </span>
                        ))}
                        {entity.domains.length > 2 && (
                          <span className="text-[11px] text-muted-foreground px-1">
                            +{entity.domains.length - 2}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Trend arrow placeholder */}
                    <TableCell>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground/40" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                {activeTab === 'competitor' && <Building2 className="h-8 w-8 text-accent" />}
                {activeTab === 'brand' && <Award className="h-8 w-8 text-accent" />}
                {activeTab === 'person' && <Users className="h-8 w-8 text-accent" />}
              </div>
              <h3 className="text-lg font-semibold text-primary mb-1">
                {search.trim()
                  ? 'Nessun risultato trovato'
                  : activeTab === 'competitor'
                    ? 'Nessun competitor trovato'
                    : activeTab === 'brand'
                      ? 'Nessun brand trovato'
                      : 'Nessuna persona trovata'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {search.trim()
                  ? 'Prova con un termine di ricerca diverso.'
                  : activeTab === 'competitor'
                    ? 'I competitor verranno rilevati automaticamente durante le scansioni.'
                    : 'Le entit\u00E0 verranno estratte automaticamente dall\u0027analisi AI.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
