'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tag } from '@/types/database';

export default function TagsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/projects/${slug}/tags`);
      if (res.ok) setTags(await res.json());
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) {
    return <div className="h-64 bg-white rounded-lg animate-pulse" />;
  }

  const maxCount = Math.max(...tags.map((t) => t.count), 1);

  function handleTagClick(tag: string) {
    router.push(`/project/${slug}/results?tag=${encodeURIComponent(tag)}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Tag Cloud</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Temi del Progetto</CardTitle>
        </CardHeader>
        <CardContent>
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
                    className="px-3 py-1.5 rounded-full bg-teal-light/20 text-teal hover:bg-teal-light/40 transition-colors cursor-pointer border border-teal-light/30"
                    style={{ fontSize, opacity }}
                  >
                    {tag.name}
                    <span className="ml-1 text-xs opacity-60">({tag.count})</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nessun tag disponibile. Avvia una scan con analisi AI.
            </p>
          )}
        </CardContent>
      </Card>

      {tags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Classifica Temi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tags.slice(0, 20).map((tag, idx) => (
                <div key={tag.id} className="flex items-center gap-3">
                  <span className="text-sm font-mono text-muted-foreground w-6 text-right">
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
                      <span className="text-xs text-muted-foreground">{tag.count}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="bg-accent rounded-full h-1.5 transition-all"
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
