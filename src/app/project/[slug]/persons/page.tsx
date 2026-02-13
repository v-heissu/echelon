'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Globe, Search } from 'lucide-react';

interface PersonEntity {
  name: string;
  type: string;
  count: number;
  domains: string[];
  keywords: string[];
  avg_sentiment: number;
}

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

export default function PersonsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const [entities, setEntities] = useState<PersonEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/projects/${slug}/entities?type=person`);
      if (res.ok) {
        const data = await res.json();
        setEntities(data.entities || []);
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <div className="h-8 w-36 rounded-lg animate-shimmer" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-36 rounded-xl animate-shimmer" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-primary">Persone</h1>
        <p className="text-sm text-muted-foreground mt-1">{entities.length} persone menzionate negli articoli</p>
      </div>

      {entities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entities.map((entity) => (
            <Card key={entity.name} className="border-0 shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-1 bg-gradient-to-r from-gold to-orange" />
              <CardContent className="p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-gold" />
                  </div>
                  <h3 className="font-semibold text-sm text-primary truncate flex-1">{entity.name}</h3>
                  <Badge variant={sentimentVariant(entity.avg_sentiment)}>
                    {sentimentLabel(entity.avg_sentiment)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-muted/50 text-center">
                    <p className="text-lg font-bold text-primary">{entity.count}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Menzioni</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50 text-center">
                    <p className="text-lg font-bold text-primary">{entity.domains.length}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Fonti</p>
                  </div>
                </div>

                {entity.keywords.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1 mb-1.5">
                      <Search className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Keywords</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {entity.keywords.slice(0, 4).map((kw) => (
                        <span key={kw} className="text-[11px] bg-muted/70 text-muted-foreground px-2 py-0.5 rounded-full">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}

                {entity.domains.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Globe className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Fonti</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {entity.domains.slice(0, 3).map((d) => (
                        <span key={d} className="text-[11px] bg-gold/10 text-gold px-2 py-0.5 rounded-full">{d}</span>
                      ))}
                      {entity.domains.length > 3 && (
                        <span className="text-[11px] text-muted-foreground px-1">+{entity.domains.length - 3}</span>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => router.push(`/project/${slug}/results?keyword=${encodeURIComponent(entity.keywords[0] || entity.name)}`)}
                  className="mt-3 w-full text-xs text-gold hover:text-gold/80 font-medium py-1.5 rounded-lg hover:bg-gold/5 transition-colors"
                >
                  Vedi risultati correlati
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-0 shadow-md">
          <CardContent className="p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-gold" />
            </div>
            <h3 className="text-lg font-semibold text-primary mb-1">Nessuna persona trovata</h3>
            <p className="text-sm text-muted-foreground">Le persone verranno estratte automaticamente dall&apos;analisi AI.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
