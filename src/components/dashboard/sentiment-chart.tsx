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
  PieChart,
  Pie,
  Cell,
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
  onSentimentClick?: (sentiment: string) => void;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#2D6A4F',
  neutral: '#008996',
  mixed: '#FFC76D',
  negative: '#D64641',
};

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'Positivo',
  neutral: 'Neutro',
  mixed: 'Misto',
  negative: 'Negativo',
  Positivo: 'positive',
  Neutro: 'neutral',
  Misto: 'mixed',
  Negativo: 'negative',
};

function SentimentDonut({ data, onSentimentClick }: { data: SentimentData; onSentimentClick?: (s: string) => void }) {
  const total = data.positive + data.neutral + data.mixed + data.negative;
  if (total === 0) return <p className="text-sm text-muted-foreground text-center py-8">Nessun dato disponibile</p>;

  const pieData = [
    { name: 'Positivo', value: data.positive, key: 'positive' },
    { name: 'Neutro', value: data.neutral, key: 'neutral' },
    { name: 'Misto', value: data.mixed, key: 'mixed' },
    { name: 'Negativo', value: data.negative, key: 'negative' },
  ].filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          dataKey="value"
          nameKey="name"
          paddingAngle={2}
          label={({ name, percent }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
          style={{ cursor: onSentimentClick ? 'pointer' : 'default' }}
          onClick={(_: unknown, index: number) => {
            const clicked = pieData[index];
            if (clicked && onSentimentClick) onSentimentClick(clicked.key);
          }}
        >
          {pieData.map((entry) => (
            <Cell key={entry.key} fill={SENTIMENT_COLORS[entry.key]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: '12px',
            border: 'none',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            fontSize: '12px',
            padding: '12px',
          }}
          formatter={(value) => [Number(value), 'Conteggio']}
        />
        <Legend
          wrapperStyle={{ fontSize: '11px', paddingTop: '8px', cursor: onSentimentClick ? 'pointer' : 'default' }}
          formatter={(value: string) => value}
          onClick={(e: { value?: string }) => {
            const key = e.value ? SENTIMENT_LABELS[e.value] : undefined;
            if (key && onSentimentClick) onSentimentClick(key);
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function formatSentimentLabel(dateStr: string, spanDays: number): string {
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

function SentimentArea({ data, onSentimentClick }: { data: SentimentData[]; onSentimentClick?: (s: string) => void }) {
  const dates = data.filter(d => d.date).map(d => new Date(d.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const spanDays = Math.max(1, Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24)));

  const chartData = data.map((d) => ({
    ...d,
    date: d.date ? formatSentimentLabel(d.date, spanDays) : '',
  }));

  return (
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
        <Legend
          wrapperStyle={{ fontSize: '11px', paddingTop: '8px', cursor: onSentimentClick ? 'pointer' : 'default' }}
          onClick={(e: { value?: string }) => {
            const key = e.value ? SENTIMENT_LABELS[e.value] : undefined;
            if (key && onSentimentClick) onSentimentClick(key);
          }}
        />
        <Area type="monotone" dataKey="positive" stackId="1" stroke="#2D6A4F" fill="url(#gradPositive)" strokeWidth={2} name="Positivo" />
        <Area type="monotone" dataKey="neutral" stackId="1" stroke="#008996" fill="url(#gradNeutral)" strokeWidth={2} name="Neutro" />
        <Area type="monotone" dataKey="mixed" stackId="1" stroke="#FFC76D" fill="url(#gradMixed)" strokeWidth={2} name="Misto" />
        <Area type="monotone" dataKey="negative" stackId="1" stroke="#D64641" fill="url(#gradNegative)" strokeWidth={2} name="Negativo" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SentimentChart({ data, onSentimentClick }: SentimentChartProps) {
  const useDonut = data.length < 3;

  return (
    <Card className="border-0 shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal to-teal-light flex items-center justify-center shadow-sm">
            <Activity className="w-4.5 h-4.5 text-white" />
          </div>
          <h3 className="font-semibold text-primary text-[15px]">Distribuzione Sentiment</h3>
        </div>
        {useDonut && data.length > 0 ? (
          <SentimentDonut data={data[data.length - 1]} onSentimentClick={onSentimentClick} />
        ) : data.length > 0 ? (
          <SentimentArea data={data} onSentimentClick={onSentimentClick} />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Nessun dato disponibile</p>
        )}
      </CardContent>
    </Card>
  );
}
