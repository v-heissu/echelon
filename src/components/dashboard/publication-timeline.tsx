'use client';

import {
  BarChart,
  Bar,
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

export function PublicationTimeline({ data }: PublicationTimelineProps) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
  }));

  const totalArticles = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className="border-0 shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center shadow-sm">
              <Calendar className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-primary text-[15px]">Timeline Pubblicazioni</h3>
              <p className="text-[11px] text-muted-foreground">{totalArticles} articoli per data di pubblicazione</p>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <defs>
              <linearGradient id="gradPub" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#007AC5" stopOpacity={0.9} />
                <stop offset="95%" stopColor="#007AC5" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" strokeOpacity={0.8} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#8b95a5' }}
              axisLine={false}
              tickLine={false}
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
              formatter={(value) => [`${value} articoli`, 'Pubblicazioni']}
            />
            <Bar
              dataKey="count"
              fill="url(#gradPub)"
              radius={[4, 4, 0, 0]}
              name="Articoli"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
