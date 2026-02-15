'use client';

import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
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
  onThemeClick?: (theme: string) => void;
}

function scoreToColor(sentiment: string, score: number): string {
  if (score > 0.3) return '#2D6A4F';
  if (score > 0.1) return '#33A1AB';
  if (score < -0.3) return '#D64641';
  if (score < -0.1) return '#F58B46';
  return sentimentColor(sentiment);
}

interface TreemapContentProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  count?: number;
  color?: string;
}

interface TooltipPayloadEntry {
  payload?: {
    name?: string;
    count?: number;
    sentiment?: string;
    sentiment_score?: number;
  };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  const score = item.sentiment_score ?? 0;

  return (
    <div
      style={{
        borderRadius: '12px',
        border: 'none',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        fontSize: '12px',
        padding: '12px',
        backgroundColor: '#fff',
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: 4, color: '#1a1a2e' }}>{item.name}</p>
      <p style={{ color: '#6b7280' }}>Occorrenze: <strong>{item.count}</strong></p>
      <p style={{ color: '#6b7280' }}>
        Sentiment: <strong style={{ color: scoreToColor(item.sentiment || 'neutral', score) }}>
          {item.sentiment}
        </strong>{' '}
        ({score >= 0 ? '+' : ''}{score.toFixed(2)})
      </p>
    </div>
  );
}

export function ThemeTreemap({ data, onThemeClick }: ThemeBubbleChartProps) {
  // Define treemap content inside to capture onThemeClick via closure
  function TreemapContent({ x, y, width, height, name, count, color }: TreemapContentProps) {
    if (width < 4 || height < 4) return null;

    const fontSize = Math.max(10, Math.min(14, width / 8));
    const showCount = height > 30 && width > 40;

    return (
      <g
        onClick={() => name && onThemeClick?.(name)}
        style={{ cursor: onThemeClick ? 'pointer' : 'default' }}
      >
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={6}
          ry={6}
          style={{
            fill: color || '#33A1AB',
            stroke: '#fff',
            strokeWidth: 2,
            opacity: 0.9,
          }}
        />
        {width > 30 && height > 20 && (
          <text
            x={x + width / 2}
            y={y + height / 2 + (showCount ? -6 : 0)}
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fontSize,
              fill: '#fff',
              fontWeight: 600,
              pointerEvents: 'none',
            }}
          >
            {name && name.length > width / 8 ? name.slice(0, Math.floor(width / 8)) + '\u2026' : name}
          </text>
        )}
        {showCount && (
          <text
            x={x + width / 2}
            y={y + height / 2 + fontSize - 2}
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fontSize: fontSize - 2,
              fill: 'rgba(255,255,255,0.85)',
              fontWeight: 400,
              pointerEvents: 'none',
            }}
          >
            {count}
          </text>
        )}
      </g>
    );
  }

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

  const top20 = data
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const treemapData = top20.map((theme) => ({
    name: theme.name,
    size: theme.count,
    count: theme.count,
    sentiment: theme.sentiment,
    sentiment_score: theme.sentiment_score,
    color: scoreToColor(theme.sentiment, theme.sentiment_score ?? 0),
  }));

  return (
    <Card className="border-0 shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold to-orange flex items-center justify-center shadow-sm">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <h3 className="font-semibold text-primary text-[15px]">Temi per Frequenza e Sentiment</h3>
        </div>

        <ResponsiveContainer width="100%" height={360}>
          <Treemap
            data={treemapData}
            dataKey="size"
            nameKey="name"
            content={<TreemapContent x={0} y={0} width={0} height={0} />}
          >
            <Tooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>

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
