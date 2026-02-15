'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, BarChart3, Globe, Building2, Activity, AlertTriangle } from 'lucide-react';

interface KPIData {
  total_results: number;
  unique_domains: number;
  competitor_mentions: number;
  avg_sentiment: number;
  alert_count: number;
}

interface KPICardsProps {
  kpi: KPIData;
  delta: KPIData;
}

const cardConfig = [
  { key: 'total_results' as const, label: 'Risultati Totali', icon: BarChart3, gradient: 'from-accent to-accent-light', format: 'number' },
  { key: 'unique_domains' as const, label: 'Domini Unici', icon: Globe, gradient: 'from-teal to-teal-light', format: 'number' },
  { key: 'competitor_mentions' as const, label: 'Menzioni Competitor', icon: Building2, gradient: 'from-orange to-gold', format: 'number' },
  { key: 'avg_sentiment' as const, label: 'Sentiment Medio', icon: Activity, gradient: 'from-positive to-teal', format: 'score' },
  { key: 'alert_count' as const, label: 'Alert Prioritari', icon: AlertTriangle, gradient: 'from-destructive to-orange', format: 'number' },
];

export function KPICards({ kpi, delta }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
      {cardConfig.map((card) => (
        <Card key={card.key} className="border-0 shadow-sm rounded-2xl overflow-hidden bg-white hover:shadow-md transition-shadow duration-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{card.label}</p>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-sm`}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold text-primary tracking-tight">
                {card.format === 'score'
                  ? (kpi[card.key] ?? 0).toFixed(2)
                  : (kpi[card.key] ?? 0).toLocaleString('it-IT')}
              </p>
              <DeltaIndicator value={delta[card.key] ?? 0} isScore={card.format === 'score'} />
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
      <span className="flex items-center text-xs text-muted-foreground gap-0.5">
        <Minus className="h-3 w-3" />
      </span>
    );
  }

  const isPositive = value > 0;
  const color = isPositive ? 'text-positive' : 'text-destructive';
  const bgColor = isPositive ? 'bg-positive/10' : 'bg-destructive/10';
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <span className={`flex items-center text-[11px] font-semibold ${color} gap-0.5 px-2 py-1 rounded-lg ${bgColor}`}>
      <Icon className="h-3 w-3" />
      {isScore ? (value > 0 ? '+' : '') + value.toFixed(2) : `${value > 0 ? '+' : ''}${value}%`}
    </span>
  );
}
