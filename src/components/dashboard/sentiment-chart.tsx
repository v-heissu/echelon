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
    <Card className="border-0 shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal to-teal-light flex items-center justify-center shadow-sm">
            <Activity className="w-4.5 h-4.5 text-white" />
          </div>
          <h3 className="font-semibold text-primary text-[15px]">Distribuzione Sentiment</h3>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gradPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2D6A4F" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#2D6A4F" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="gradNeutral" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#008996" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#008996" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="gradMixed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFC76D" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#FFC76D" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="gradNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D64641" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#D64641" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" strokeOpacity={0.8} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8b95a5' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#8b95a5' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                fontSize: '12px',
                padding: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
            <Area type="monotone" dataKey="positive" stackId="1" stroke="#2D6A4F" fill="url(#gradPositive)" strokeWidth={2} name="Positivo" />
            <Area type="monotone" dataKey="neutral" stackId="1" stroke="#008996" fill="url(#gradNeutral)" strokeWidth={2} name="Neutro" />
            <Area type="monotone" dataKey="mixed" stackId="1" stroke="#FFC76D" fill="url(#gradMixed)" strokeWidth={2} name="Misto" />
            <Area type="monotone" dataKey="negative" stackId="1" stroke="#D64641" fill="url(#gradNegative)" strokeWidth={2} name="Negativo" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
