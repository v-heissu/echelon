'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

interface AiBriefingProps {
  briefing: string | null;
  scanCount: number;
}

export function AiBriefing({ briefing, scanCount }: AiBriefingProps) {
  if (!briefing && scanCount < 2) {
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

  if (!briefing) {
    return null;
  }

  return (
    <Card className="border-0 shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-teal flex items-center justify-center shadow-sm">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <h3 className="font-semibold text-primary text-[15px]">AI Briefing</h3>
        </div>
        <p className="text-sm text-primary/80 leading-relaxed whitespace-pre-line">{briefing}</p>
      </CardContent>
    </Card>
  );
}
