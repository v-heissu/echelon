'use client';

import { Card, CardContent } from '@/components/ui/card';
import { sentimentColor } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface ThemeBubble {
  name: string;
  count: number;
  sentiment: string;
  sentiment_score: number;
}

interface ThemeBubbleChartProps {
  data: ThemeBubble[];
}

export function ThemeBubbleChart({ data }: ThemeBubbleChartProps) {
  if (data.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-gold" />
            </div>
            <h3 className="font-semibold text-primary">Temi per Frequenza e Sentiment</h3>
          </div>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessun dato disponibile
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-gold" />
          </div>
          <h3 className="font-semibold text-primary">Temi per Frequenza e Sentiment</h3>
        </div>
        <div className="flex flex-wrap gap-3 justify-center py-4">
          {data.slice(0, 20).map((theme) => {
            const size = 44 + (theme.count / maxCount) * 76;
            const color = sentimentColor(theme.sentiment);

            return (
              <div
                key={theme.name}
                className="rounded-full flex items-center justify-center text-white text-xs font-medium cursor-default transition-all duration-200 hover:scale-110 hover:shadow-lg"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: color,
                  opacity: 0.75 + (theme.count / maxCount) * 0.25,
                }}
                title={`${theme.name}: ${theme.count} occorrenze, sentiment: ${theme.sentiment_score.toFixed(2)}`}
              >
                <span className="truncate px-1 text-center leading-tight" style={{ fontSize: Math.max(9, size / 8) }}>
                  {theme.name}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-5 justify-center mt-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-positive inline-block" />
            Positivo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-teal inline-block" />
            Neutro
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-gold inline-block" />
            Misto
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-destructive inline-block" />
            Negativo
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
