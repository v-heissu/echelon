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

function scoreToColor(sentiment: string, score: number): string {
  // Use actual sentiment label for color
  const baseColor = sentimentColor(sentiment);
  // If we have a score, blend towards green/red based on magnitude
  if (score > 0.3) return '#2D6A4F'; // Strong positive - green
  if (score > 0.1) return '#33A1AB'; // Mild positive - teal
  if (score < -0.3) return '#D64641'; // Strong negative - red
  if (score < -0.1) return '#F58B46'; // Mild negative - orange
  return baseColor; // Default to label-based color
}

export function ThemeBubbleChart({ data }: ThemeBubbleChartProps) {
  if (data.length === 0) {
    return (
      <Card className="border-0 shadow-sm rounded-2xl bg-white">
        <CardContent className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold to-orange flex items-center justify-center shadow-sm">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <h3 className="font-semibold text-primary text-[15px]">Temi per Frequenza e Sentiment</h3>
          </div>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessun dato disponibile
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <Card className="border-0 shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold to-orange flex items-center justify-center shadow-sm">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <h3 className="font-semibold text-primary text-[15px]">Temi per Frequenza e Sentiment</h3>
        </div>
        <div className="flex flex-wrap gap-3 justify-center py-4">
          {data.slice(0, 25).map((theme) => {
            const ratio = maxCount > 0 ? theme.count / maxCount : 0;
            const size = 48 + ratio * 72;
            const score = theme.sentiment_score ?? 0;
            const color = scoreToColor(theme.sentiment, score);

            return (
              <div
                key={theme.name}
                className="rounded-full flex items-center justify-center text-white text-xs font-medium cursor-default transition-all duration-300 hover:scale-110 hover:shadow-xl hover:z-10 relative"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: color,
                  opacity: 0.8 + ratio * 0.2,
                  boxShadow: `0 2px 8px ${color}40`,
                }}
                title={`${theme.name}: ${theme.count} occorrenze\nSentiment: ${theme.sentiment} (${score >= 0 ? '+' : ''}${score.toFixed(2)})`}
              >
                <span className="truncate px-1.5 text-center leading-tight" style={{ fontSize: Math.max(9, size / 8.5) }}>
                  {theme.name}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-6 justify-center mt-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-positive inline-block shadow-sm" />
            Positivo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-teal inline-block shadow-sm" />
            Neutro
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-gold inline-block shadow-sm" />
            Misto
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-destructive inline-block shadow-sm" />
            Negativo
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
