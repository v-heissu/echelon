'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, RefreshCw } from 'lucide-react';

interface AiBriefingProps {
  briefing: string | null;
  scanCount: number;
  slug: string;
}

export function AiBriefing({ briefing, scanCount, slug }: AiBriefingProps) {
  const [currentBriefing, setCurrentBriefing] = useState(briefing);
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/projects/${slug}/regenerate-briefing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentBriefing(data.briefing);
      }
    } catch {
      // Silently fail
    } finally {
      setRegenerating(false);
    }
  }

  if (!currentBriefing && scanCount < 2) {
    return (
      <Card className="border-0 shadow-sm rounded-2xl bg-white">
        <CardContent className="p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-teal flex items-center justify-center shadow-sm">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <h3 className="font-semibold text-primary text-[15px]">AI Briefing</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Il briefing AI sarà disponibile dopo il completamento di almeno 2 scan.
            Questo permetterà di confrontare i dati e identificare cambiamenti significativi.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!currentBriefing) {
    return null;
  }

  return (
    <Card className="border-0 shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-teal flex items-center justify-center shadow-sm">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <h3 className="font-semibold text-primary text-[15px] flex-1">AI Briefing</h3>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/5 transition-colors disabled:opacity-50"
            title="Rigenera briefing"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-sm text-primary/80 leading-relaxed whitespace-pre-line">{currentBriefing}</p>
      </CardContent>
    </Card>
  );
}
