'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Activity } from 'lucide-react';

interface SentimentData {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
}

interface SentimentChartProps {
  data: SentimentData[];
}

export function SentimentChart({ data }: SentimentChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    date: d.date ? new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '',
  }));

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-teal" />
          </div>
          <h3 className="font-semibold text-primary">Distribuzione Sentiment</h3>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#B2B8C3" strokeOpacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                fontSize: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Area type="monotone" dataKey="positive" stackId="1" stroke="#2D6A4F" fill="#2D6A4F" fillOpacity={0.8} name="Positivo" />
            <Area type="monotone" dataKey="neutral" stackId="1" stroke="#008996" fill="#008996" fillOpacity={0.8} name="Neutro" />
            <Area type="monotone" dataKey="mixed" stackId="1" stroke="#FFC76D" fill="#FFC76D" fillOpacity={0.8} name="Misto" />
            <Area type="monotone" dataKey="negative" stackId="1" stroke="#D64641" fill="#D64641" fillOpacity={0.8} name="Negativo" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
