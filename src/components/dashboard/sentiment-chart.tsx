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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribuzione Sentiment</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#B2B8C3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="positive"
              stackId="1"
              stroke="#2D6A4F"
              fill="#2D6A4F"
              fillOpacity={0.8}
              name="Positivo"
            />
            <Area
              type="monotone"
              dataKey="neutral"
              stackId="1"
              stroke="#008996"
              fill="#008996"
              fillOpacity={0.8}
              name="Neutro"
            />
            <Area
              type="monotone"
              dataKey="mixed"
              stackId="1"
              stroke="#FFC76D"
              fill="#FFC76D"
              fillOpacity={0.8}
              name="Misto"
            />
            <Area
              type="monotone"
              dataKey="negative"
              stackId="1"
              stroke="#D64641"
              fill="#D64641"
              fillOpacity={0.8}
              name="Negativo"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
