'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils';
import { JobQueue } from '@/types/database';
import { Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function JobsPage() {
  const [jobs, setJobs] = useState<(JobQueue & { scans: { projects: { name: string } } })[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const supabase = createClient();
    async function loadJobs() {
      const { data } = await supabase
        .from('job_queue')
        .select('*, scans(projects(name))')
        .order('created_at', { ascending: false })
        .limit(100);
      setJobs((data as typeof jobs) || []);
      setLoading(false);
    }
    loadJobs();
    const interval = setInterval(loadJobs, 10000);
    return () => clearInterval(interval);
  }, []);

  const statusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'positive' as const;
      case 'failed': return 'negative' as const;
      case 'processing': return 'mixed' as const;
      default: return 'neutral' as const;
    }
  };

  const stats = {
    pending: jobs.filter((j) => j.status === 'pending').length,
    processing: jobs.filter((j) => j.status === 'processing').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  };

  if (loading) {
    return (
      <div className="animate-fade-in-up space-y-4">
        <div className="h-8 w-40 rounded-lg animate-shimmer" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-lg animate-shimmer" />
          ))}
        </div>
        <div className="h-96 rounded-lg animate-shimmer" />
      </div>
    );
  }

  const statCards = [
    { label: 'In Coda', value: stats.pending, icon: Clock, color: 'teal' as const },
    { label: 'In Esecuzione', value: stats.processing, icon: Loader2, color: 'gold' as const },
    { label: 'Completati', value: stats.completed, icon: CheckCircle2, color: 'positive' as const },
    { label: 'Falliti', value: stats.failed, icon: XCircle, color: 'destructive' as const },
  ];

  const colorClasses: Record<string, { bg: string; text: string; value: string }> = {
    teal: { bg: 'bg-teal/10', text: 'text-teal', value: 'text-teal' },
    gold: { bg: 'bg-gold/10', text: 'text-gold', value: 'text-gold' },
    positive: { bg: 'bg-positive/10', text: 'text-positive', value: 'text-positive' },
    destructive: { bg: 'bg-destructive/10', text: 'text-destructive', value: 'text-destructive' },
  };

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary">Job Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">Aggiornamento automatico ogni 10 secondi</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {statCards.map((stat) => {
          const c = colorClasses[stat.color];
          return (
            <Card key={stat.label} className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                    <stat.icon className={`h-5 w-5 ${c.text}`} />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${c.value}`}>{stat.value}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-0 shadow-md overflow-hidden">
        <div className="p-5 pb-0">
          <h3 className="font-semibold text-primary">Ultimi 100 Job</h3>
        </div>
        <CardContent className="p-0 mt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Progetto</TableHead>
                <TableHead>Keyword</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tentativi</TableHead>
                <TableHead>Creato</TableHead>
                <TableHead>Errore</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">
                    {job.scans?.projects?.name || '—'}
                  </TableCell>
                  <TableCell className="text-sm">{job.keyword}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {job.source === 'google_organic' ? 'Web' : 'News'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{job.retry_count}/3</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(job.created_at)}
                  </TableCell>
                  <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                    {job.error_message || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
