'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { sentimentColor } from '@/lib/utils';

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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Temi per Frequenza e Sentiment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessun dato disponibile
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Temi per Frequenza e Sentiment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 justify-center py-4">
          {data.slice(0, 20).map((theme) => {
            const size = 40 + (theme.count / maxCount) * 80;
            const color = sentimentColor(theme.sentiment);

            return (
              <div
                key={theme.name}
                className="rounded-full flex items-center justify-center text-white text-xs font-medium cursor-default transition-transform hover:scale-110"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: color,
                  opacity: 0.7 + (theme.count / maxCount) * 0.3,
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

        <div className="flex gap-4 justify-center mt-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-positive inline-block" />
            Positivo
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-teal inline-block" />
            Neutro
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-gold inline-block" />
            Misto
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-destructive inline-block" />
            Negativo
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
