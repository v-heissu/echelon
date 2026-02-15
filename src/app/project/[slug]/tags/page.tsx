'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Tag as TagType } from '@/types/database';
import { Tag, Trophy, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <div className="h-8 w-36 rounded-lg animate-shimmer" />
        <div className="h-64 rounded-xl animate-shimmer" />
      </div>
    );
  }

  const displayCount = tags.map(t => t.scan_count ?? t.count);
  const maxCount = Math.max(...displayCount, 1);

  function handleTagClick(tag: string) {
    router.push(`/project/${slug}/results?tag=${encodeURIComponent(tag)}`);
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
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

      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
              <Tag className="w-4 h-4 text-teal" />
            </div>
            <h3 className="font-semibold text-primary">Temi del Progetto</h3>
          </div>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center py-6">
              {tags.map((tag) => {
                const count = tag.scan_count ?? tag.count;
                const ratio = count / maxCount;
                const fontSize = 12 + ratio * 24;
                const opacity = 0.5 + ratio * 0.5;

                return (
                  <button
                    key={tag.id}
                    onClick={() => handleTagClick(tag.name)}
                    className="px-3 py-1.5 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-all duration-200 cursor-pointer border border-accent/15 hover:shadow-sm"
                    style={{ fontSize, opacity }}
                  >
                    {tag.name}
                    <span className="ml-1 text-xs opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>

      {tags.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-gold" />
              </div>
              <h3 className="font-semibold text-primary">Classifica Temi</h3>
              <span className="text-xs text-muted-foreground">(Top 20)</span>
            </div>
            <div className="space-y-2">
              {tags.slice(0, 20).map((tag, idx) => {
                const count = tag.scan_count ?? tag.count;
                return (
                  <div key={tag.id} className="flex items-center gap-3 py-1">
                    <span className="text-xs font-mono text-muted-foreground w-6 text-right">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <button
                          onClick={() => handleTagClick(tag.name)}
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
