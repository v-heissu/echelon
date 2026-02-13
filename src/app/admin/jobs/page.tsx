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
import { Clock, Loader2, CheckCircle2, XCircle, Radio, ChevronDown, ChevronUp } from 'lucide-react';

interface ScanInfo {
  id: string;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  started_at: string;
  completed_at: string | null;
  trigger_type: string;
  projects: { name: string; slug: string } | null;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<(JobQueue & { scans: { projects: { name: string } } })[]>([]);
  const [scans, setScans] = useState<ScanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedScan, setExpandedScan] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    async function loadData() {
      const [jobsRes, scansRes] = await Promise.all([
        supabase
          .from('job_queue')
          .select('*, scans(projects(name))')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('scans')
          .select('id, status, total_tasks, completed_tasks, started_at, completed_at, trigger_type, projects(name, slug)')
          .order('started_at', { ascending: false })
          .limit(20),
      ]);
      setJobs((jobsRes.data as typeof jobs) || []);
      setScans((scansRes.data as unknown as ScanInfo[]) || []);
      setLoading(false);
    }
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const statusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'positive' as const;
      case 'failed': return 'negative' as const;
      case 'processing': case 'running': return 'mixed' as const;
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
      <div className="animate-fade-in-up space-y-5">
        <div className="h-8 w-40 rounded-xl animate-shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl animate-shimmer" />
          ))}
        </div>
        <div className="h-96 rounded-2xl animate-shimmer" />
      </div>
    );
  }

  const statCards = [
    { label: 'In Coda', value: stats.pending, icon: Clock, gradient: 'from-teal to-teal-light' },
    { label: 'In Esecuzione', value: stats.processing, icon: Loader2, gradient: 'from-gold to-orange' },
    { label: 'Completati', value: stats.completed, icon: CheckCircle2, gradient: 'from-positive to-teal' },
    { label: 'Falliti', value: stats.failed, icon: XCircle, gradient: 'from-destructive to-orange' },
  ];

  return (
    <div className="animate-fade-in-up space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary tracking-tight">Job Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">Aggiornamento automatico ogni 5 secondi</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm rounded-2xl bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-sm`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scans section */}
      <Card className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="p-5 pb-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-semibold text-primary text-[15px]">Scansioni Recenti</h3>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Progetto</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Avvio</TableHead>
                <TableHead>Fine</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scans.map((scan) => {
                const progress = scan.total_tasks > 0
                  ? Math.round((scan.completed_tasks / scan.total_tasks) * 100) : 0;
                const isExpanded = expandedScan === scan.id;
                const scanJobs = jobs.filter(j => j.scan_id === scan.id);

                return (
                  <>
                    <TableRow key={scan.id} className="hover:bg-[#f8f9fa]">
                      <TableCell>
                        <button
                          onClick={() => setExpandedScan(isExpanded ? null : scan.id)}
                          className="p-1 hover:bg-[#f0f2f5] rounded-lg transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {scan.projects?.name || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(scan.status)}>{scan.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 rounded-full bg-[#f0f2f5] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-accent transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {scan.trigger_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(scan.started_at)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {scan.completed_at ? formatDateTime(scan.completed_at) : '—'}
                      </TableCell>
                    </TableRow>
                    {isExpanded && scanJobs.length > 0 && (
                      <TableRow key={`${scan.id}-expanded`}>
                        <TableCell colSpan={7} className="bg-[#f8f9fa] p-4">
                          <div className="space-y-1 animate-slide-down">
                            {scanJobs.map((job) => (
                              <div key={job.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-white text-xs transition-colors">
                                {job.status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-positive shrink-0" />}
                                {job.status === 'failed' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                                {job.status === 'processing' && <Loader2 className="h-3.5 w-3.5 text-accent animate-spin shrink-0" />}
                                {job.status === 'pending' && <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                <span className="font-medium text-primary">{job.keyword}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {job.source === 'google_organic' ? 'Web' : 'News'}
                                </Badge>
                                <span className="text-muted-foreground ml-auto">{job.retry_count > 0 ? `${job.retry_count}/3 tentativi` : ''}</span>
                                {job.error_message && (
                                  <span className="text-destructive truncate max-w-[200px]">{job.error_message}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Jobs table */}
      <Card className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="p-5 pb-3">
          <h3 className="font-semibold text-primary text-[15px]">Ultimi 100 Job</h3>
        </div>
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
                <TableRow key={job.id} className="hover:bg-[#f8f9fa]">
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
