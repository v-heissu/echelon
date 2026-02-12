'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export default function JobsPage() {
  const [jobs, setJobs] = useState<(JobQueue & { scans: { projects: { name: string } } })[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  async function loadJobs() {
    const { data } = await supabase
      .from('job_queue')
      .select('*, scans(projects(name))')
      .order('created_at', { ascending: false })
      .limit(100);
    setJobs((data as typeof jobs) || []);
    setLoading(false);
  }

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

  if (loading) return <div className="animate-pulse">Caricamento...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-6">Job Monitor</h1>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-teal">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">In Coda</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gold">{stats.processing}</p>
            <p className="text-xs text-muted-foreground">In Esecuzione</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-positive">{stats.completed}</p>
            <p className="text-xs text-muted-foreground">Completati</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
            <p className="text-xs text-muted-foreground">Falliti</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ultimi 100 Job</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                <TableRow key={job.id}>
                  <TableCell className="font-medium">
                    {job.scans?.projects?.name || '—'}
                  </TableCell>
                  <TableCell>{job.keyword}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {job.source}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                  </TableCell>
                  <TableCell>{job.retry_count}/3</TableCell>
                  <TableCell className="text-xs">
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
