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
    <Card className="border-0 shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center shadow-sm">
            <Globe className="w-4.5 h-4.5 text-white" />
          </div>
          <h3 className="font-semibold text-primary text-[15px]">Top Domini</h3>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" strokeOpacity={0.8} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#8b95a5' }} axisLine={false} tickLine={false} />
            <YAxis dataKey="domain" type="category" tick={{ fontSize: 10, fill: '#8b95a5' }} width={100} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                fontSize: '12px',
                padding: '12px',
              }}
            />
            <Bar dataKey="count" name="Risultati" radius={[0, 8, 8, 0]} barSize={16}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.is_competitor ? '#F58B46' : '#007AC5'} opacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-5 justify-center mt-3 text-[11px] text-muted-foreground">
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
