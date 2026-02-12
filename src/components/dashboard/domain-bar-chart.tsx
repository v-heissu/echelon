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
import { Card, CardContent } from '@/components/ui/card';
import { Globe } from 'lucide-react';

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
    <Card className="border-0 shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Globe className="w-4 h-4 text-accent" />
          </div>
          <h3 className="font-semibold text-primary">Top Domini</h3>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#B2B8C3" strokeOpacity={0.5} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis dataKey="domain" type="category" tick={{ fontSize: 10, fill: '#64748b' }} width={120} />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="count" name="Risultati" radius={[0, 6, 6, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.is_competitor ? '#F58B46' : '#007AC5'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 justify-center mt-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-accent inline-block" />
            Organico
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-orange inline-block" />
            Competitor
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
