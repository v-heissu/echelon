'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Tag as TagType } from '@/types/database';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { Tag, Trophy, RefreshCw, TrendingUp, TrendingDown, Minus, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface SparklinePoint {
  scan_id: string;
  count: number;
  date: string;
}

interface TagsResponse {
  tags: (TagType & { scan_count?: number })[];
  scans: { id: string; completed_at: string; started_at: string }[];
  sparklines: Record<string, SparklinePoint[]>;
}

const ITEMS_PER_PAGE = 25;

function MiniSparkline({ data }: { data: SparklinePoint[] }) {
  if (!data || data.length < 2) return null;

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const width = 80;
  const height = 24;
  const padding = 2;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * usableWidth;
    const y = padding + usableHeight - (d.count / maxCount) * usableHeight;
    return `${x},${y}`;
  }).join(' ');

  const trend = data[data.length - 1].count - data[0].count;
  const color = trend > 0 ? '#2D6A4F' : trend < 0 ? '#D64641' : '#008996';

  return (
    <div className="flex items-center gap-1.5">
      <svg width={width} height={height} className="shrink-0">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {trend > 0 && <TrendingUp className="h-3 w-3 text-positive" />}
      {trend < 0 && <TrendingDown className="h-3 w-3 text-destructive" />}
      {trend === 0 && <Minus className="h-3 w-3 text-teal" />}
    </div>
  );
}

// Treemap color assignment
function getTreemapColor(index: number): string {
  if (index < 5) return '#007AC5'; // accent — top 5
  if (index < 15) return '#008996'; // teal — 6-15
  return '#B2B8C3'; // muted — 16-25
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TreemapContent(props: any) {
  const { x, y, width, height, name, index } = props;
  const color = getTreemapColor(index);
  const showLabel = width > 60 && height > 30;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke="#fff"
        strokeWidth={2}
        rx={4}
        className="cursor-pointer transition-opacity hover:opacity-80"
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={Math.min(12, width / 8)}
          fontWeight={500}
        >
          {name.length > width / 7 ? name.slice(0, Math.floor(width / 7)) + '…' : name}
        </text>
      )}
    </g>
  );
}

export default function TagsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const [tags, setTags] = useState<(TagType & { scan_count?: number })[]>([]);
  const [scans, setScans] = useState<{ id: string; completed_at: string; started_at: string }[]>([]);
  const [sparklines, setSparklines] = useState<Record<string, SparklinePoint[]>>({});
  const [selectedScan, setSelectedScan] = useState('');
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const loadTags = useCallback(async () => {
    const queryParams = new URLSearchParams();
    if (selectedScan) queryParams.set('scan_id', selectedScan);
    const res = await fetch(`/api/projects/${slug}/tags?${queryParams}`);
    if (res.ok) {
      const data: TagsResponse = await res.json();
      setTags(data.tags || []);
      setScans(data.scans || []);
      setSparklines(data.sparklines || {});
    }
  }, [slug, selectedScan]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await loadTags();
      setLoading(false);
    }
    load();
  }, [loadTags]);

  async function handleRebuild() {
    setRebuilding(true);
    try {
      const res = await fetch(`/api/projects/${slug}/tags`, { method: 'POST' });
      if (res.ok) {
        await loadTags();
      }
    } catch {
      // ignore
    }
    setRebuilding(false);
  }

  // Filtered tags for classifica
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const q = searchQuery.toLowerCase().trim();
    return tags.filter(t => t.name.toLowerCase().includes(q));
  }, [tags, searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredTags.length / ITEMS_PER_PAGE));
  const paginatedTags = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTags.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTags, currentPage]);

  // Reset page on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const displayCount = tags.map(t => t.scan_count ?? t.count);
  const maxCount = Math.max(...displayCount, 1);

  // Treemap data — top 25
  const treemapData = useMemo(() => {
    return tags.slice(0, 25).map(tag => ({
      name: tag.name,
      size: tag.scan_count ?? tag.count,
      slug: tag.slug,
    }));
  }, [tags]);

  function handleTagClick(tagSlug: string) {
    router.push(`/project/${slug}/tags/${encodeURIComponent(tagSlug)}`);
  }

  function handleTagClickByName(tag: TagType & { scan_count?: number }) {
    router.push(`/project/${slug}/tags/${encodeURIComponent(tag.slug)}`);
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <div className="h-8 w-36 rounded-lg animate-shimmer" />
        <div className="h-64 rounded-xl animate-shimmer" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Tag Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">{tags.length} temi identificati</p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <Select
              value={selectedScan}
              onChange={(e) => setSelectedScan(e.target.value)}
              className="w-[180px]"
            >
              <option value="">Tutte le scan</option>
              {scans.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.completed_at || s.started_at).toLocaleDateString('it-IT')}
                </option>
              ))}
            </Select>
          </div>
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rebuilding ? 'animate-spin' : ''}`} />
            {rebuilding ? 'Ricostruzione...' : 'Ricostruisci Tag'}
          </button>
        </div>
      </div>

      {/* Treemap */}
      {tags.length > 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
                <Tag className="w-4 h-4 text-teal" />
              </div>
              <h3 className="font-semibold text-primary">Mappa Temi</h3>
              <span className="text-xs text-muted-foreground">(Top 25)</span>
            </div>
            <ResponsiveContainer width="100%" height={420}>
              <Treemap
                data={treemapData}
                dataKey="size"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={<TreemapContent /> as any}
                onClick={(node) => {
                  if (node && node.slug) {
                    handleTagClick(node.slug as string);
                  }
                }}
              >
                <Tooltip
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    const item = payload[0]?.payload;
                    if (!item) return null;
                    return (
                      <div className="bg-white rounded-lg shadow-lg border border-border/50 px-3 py-2 text-xs">
                        <p className="font-semibold text-primary">{item.name}</p>
                        <p className="text-muted-foreground">{item.size} occorrenze</p>
                      </div>
                    );
                  }}
                />
              </Treemap>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-center mt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#007AC5] inline-block" />
                Top 5
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#008996] inline-block" />
                6-15
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#B2B8C3] inline-block" />
                16-25
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-xl bg-teal/10 flex items-center justify-center mx-auto mb-3">
                <Tag className="h-6 w-6 text-teal" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">Nessun tag disponibile. Avvia una scan con analisi AI.</p>
              <button
                onClick={handleRebuild}
                disabled={rebuilding}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-all duration-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${rebuilding ? 'animate-spin' : ''}`} />
                {rebuilding ? 'Ricostruzione...' : 'Forza ricostruzione da analisi AI'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Classifica Temi */}
      {tags.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-gold" />
                </div>
                <h3 className="font-semibold text-primary">Classifica Temi</h3>
                <span className="text-xs text-muted-foreground">({filteredTags.length})</span>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca tema..."
                  className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent w-[200px]"
                />
              </div>
            </div>
            <div className="space-y-2">
              {paginatedTags.map((tag, idx) => {
                const count = tag.scan_count ?? tag.count;
                const rank = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                return (
                  <div key={tag.id} className="flex items-center gap-3 py-1">
                    <span className="text-xs font-mono text-muted-foreground w-6 text-right">
                      {rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <button
                          onClick={() => handleTagClickByName(tag)}
                          className="text-sm font-medium text-accent hover:underline truncate"
                        >
                          {tag.name}
                        </button>
                        <div className="flex items-center gap-3 shrink-0">
                          {sparklines[tag.id] && sparklines[tag.id].length >= 2 && (
                            <MiniSparkline data={sparklines[tag.id]} />
                          )}
                          <span className="text-xs text-muted-foreground font-mono">{count}</span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-gradient-to-r from-accent to-teal rounded-full h-1.5 transition-all duration-500"
                          style={{ width: `${(count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {paginatedTags.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nessun tema trovato</p>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  Pagina {currentPage} di {totalPages}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
