'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Tag as TagType } from '@/types/database';
import { Tag, Trophy, RefreshCw } from 'lucide-react';

export default function TagsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);

  const loadTags = useCallback(async () => {
    const res = await fetch(`/api/projects/${slug}/tags`);
    if (res.ok) setTags(await res.json());
  }, [slug]);

  useEffect(() => {
    async function load() {
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
        const data = await res.json();
        setTags(data.tags || []);
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

  const maxCount = Math.max(...tags.map((t) => t.count), 1);

  function handleTagClick(tag: string) {
    router.push(`/project/${slug}/results?tag=${encodeURIComponent(tag)}`);
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Tag Cloud</h1>
          <p className="text-sm text-muted-foreground mt-1">{tags.length} temi identificati</p>
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
                const ratio = tag.count / maxCount;
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
                    <span className="ml-1 text-xs opacity-60">({tag.count})</span>
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
              {tags.slice(0, 20).map((tag, idx) => (
                <div key={tag.id} className="flex items-center gap-3 py-1">
                  <span className="text-xs font-mono text-muted-foreground w-6 text-right">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <button
                        onClick={() => handleTagClick(tag.name)}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        {tag.name}
                      </button>
                      <span className="text-xs text-muted-foreground font-mono">{tag.count}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-accent to-teal rounded-full h-1.5 transition-all duration-500"
                        style={{ width: `${(tag.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
