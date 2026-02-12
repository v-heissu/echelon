'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, BarChart3, Globe, Building2, Activity } from 'lucide-react';

interface KPIData {
  total_results: number;
  unique_domains: number;
  competitor_mentions: number;
  avg_sentiment: number;
}

interface KPICardsProps {
  kpi: KPIData;
  delta: KPIData;
}

const cardConfig = [
  { key: 'total_results' as const, label: 'Risultati Totali', icon: BarChart3, color: 'accent', format: 'number' },
  { key: 'unique_domains' as const, label: 'Domini Unici', icon: Globe, color: 'teal', format: 'number' },
  { key: 'competitor_mentions' as const, label: 'Menzioni Competitor', icon: Building2, color: 'orange', format: 'number' },
  { key: 'avg_sentiment' as const, label: 'Sentiment Medio', icon: Activity, color: 'positive', format: 'score' },
];

const colorMap: Record<string, { bg: string; text: string }> = {
  accent: { bg: 'bg-accent/10', text: 'text-accent' },
  teal: { bg: 'bg-teal/10', text: 'text-teal' },
  orange: { bg: 'bg-orange/10', text: 'text-orange' },
  positive: { bg: 'bg-positive/10', text: 'text-positive' },
};

export function KPICards({ kpi, delta }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cardConfig.map((card) => {
        const c = colorMap[card.color];
        return (
          <Card key={card.key} className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.label}</p>
                <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}>
                  <card.icon className={`h-4.5 w-4.5 ${c.text}`} />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold text-primary">
                  {card.format === 'score'
                    ? kpi[card.key].toFixed(2)
                    : kpi[card.key].toLocaleString('it-IT')}
                </p>
                <DeltaIndicator value={delta[card.key]} isScore={card.format === 'score'} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function DeltaIndicator({ value, isScore }: { value: number; isScore: boolean }) {
  if (value === 0) {
    return (
      <span className="flex items-center text-xs text-muted-foreground gap-0.5">
        <Minus className="h-3 w-3" />
        —
      </span>
    );
  }

  const isPositive = value > 0;
  const color = isPositive ? 'text-positive' : 'text-destructive';
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <span className={`flex items-center text-xs font-medium ${color} gap-0.5 px-1.5 py-0.5 rounded-md ${isPositive ? 'bg-positive/10' : 'bg-destructive/10'}`}>
      <Icon className="h-3 w-3" />
      {isScore ? (value > 0 ? '+' : '') + value.toFixed(2) : `${value > 0 ? '+' : ''}${value}%`}
    </span>
  );
}
