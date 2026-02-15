'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

interface PublicationTimelineProps {
  data: { date: string; count: number }[];
}

function formatTickLabel(dateStr: string, spanDays: number): string {
  const d = new Date(dateStr);
  if (spanDays <= 7) {
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) +
      ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
  if (spanDays <= 90) {
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  }
  if (spanDays <= 365) {
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
}

function formatTooltipDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function PublicationTimeline({ data }: PublicationTimelineProps) {
  if (!data || data.length === 0) return null;

  const dates = data.map(d => new Date(d.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const spanDays = Math.max(1, Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24)));

  const chartData = data.map((d) => ({
    ...d,
    label: formatTickLabel(d.date, spanDays),
  }));

  const totalArticles = data.reduce((sum, d) => sum + d.count, 0);

  const maxTicks = Math.min(chartData.length, 12);
  const tickInterval = chartData.length <= maxTicks ? 0 : Math.ceil(chartData.length / maxTicks) - 1;

  return (
    <Card className="border-0 shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center shadow-sm">
              <Calendar className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-primary text-[15px]">Timeline Scan</h3>
              <p className="text-[11px] text-muted-foreground">
                {data.length} scan &middot; {totalArticles.toLocaleString('it-IT')} risultati totali
              </p>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gradTimeline" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#007AC5" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#007AC5" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" strokeOpacity={0.8} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#8b95a5' }}
              axisLine={false}
              tickLine={false}
              interval={tickInterval}
              angle={chartData.length > 8 ? -35 : 0}
              textAnchor={chartData.length > 8 ? 'end' : 'middle'}
              height={chartData.length > 8 ? 60 : 40}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#8b95a5' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                fontSize: '12px',
                padding: '12px',
              }}
              formatter={(value) => [`${value} risultati`, 'Articoli raccolti']}
              labelFormatter={(_, payload) => {
                if (payload && payload[0]?.payload?.date) {
                  return formatTooltipDate(payload[0].payload.date);
                }
                return '';
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#007AC5"
              strokeWidth={2.5}
              fill="url(#gradTimeline)"
              dot={{ r: 4, fill: '#007AC5', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#007AC5', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
