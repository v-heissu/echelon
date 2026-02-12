'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DomainData {
  domain: string;
  count: number;
  is_competitor: boolean;
}

interface DomainBarChartProps {
  data: DomainData[];
}

export function DomainBarChart({ data }: DomainBarChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Domini</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#B2B8C3" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis
              dataKey="domain"
              type="category"
              tick={{ fontSize: 11 }}
              width={120}
            />
            <Tooltip />
            <Bar dataKey="count" name="Risultati" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.is_competitor ? '#F58B46' : '#007AC5'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 justify-center mt-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-accent inline-block" />
            Organico
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-orange inline-block" />
            Competitor
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
