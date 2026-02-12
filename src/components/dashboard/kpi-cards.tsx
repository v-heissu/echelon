'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

export function KPICards({ kpi, delta }: KPICardsProps) {
  const cards = [
    { label: 'Risultati Totali', value: kpi.total_results, delta: delta.total_results, format: 'number' },
    { label: 'Domini Unici', value: kpi.unique_domains, delta: delta.unique_domains, format: 'number' },
    { label: 'Menzioni Competitor', value: kpi.competitor_mentions, delta: delta.competitor_mentions, format: 'number' },
    { label: 'Sentiment Medio', value: kpi.avg_sentiment, delta: delta.avg_sentiment, format: 'score' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">{card.label}</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-primary">
                {card.format === 'score'
                  ? card.value.toFixed(2)
                  : card.value.toLocaleString('it-IT')}
              </p>
              <DeltaIndicator value={card.delta} isScore={card.format === 'score'} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DeltaIndicator({ value, isScore }: { value: number; isScore: boolean }) {
  if (value === 0) {
    return (
      <span className="flex items-center text-xs text-muted-foreground">
        <Minus className="h-3 w-3 mr-0.5" />
        —
      </span>
    );
  }

  const isPositive = value > 0;
  const color = isPositive ? 'text-positive' : 'text-destructive';
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <span className={`flex items-center text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3 mr-0.5" />
      {isScore ? (value > 0 ? '+' : '') + value.toFixed(2) : `${value > 0 ? '+' : ''}${value}%`}
    </span>
  );
}
