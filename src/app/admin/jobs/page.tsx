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
import { Clock, Loader2, CheckCircle2, XCircle, Radio, ChevronDown, ChevronUp, Timer, AlertTriangle, Zap, StopCircle, Trash2 } from 'lucide-react';

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

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

function formatJobDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

type JobWithDuration = JobQueue & {
  scans?: { projects?: { name: string } };
  duration_ms?: number | null;
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobWithDuration[]>([]);
  const [scans, setScans] = useState<ScanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedScan, setExpandedScan] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [scanAction, setScanAction] = useState<string | null>(null);

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

      const jobsData = (jobsRes.data || []).map((j) => ({
        ...j,
        duration_ms: j.started_at && j.completed_at
          ? new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()
          : null,
      }));

      setJobs(jobsData as JobWithDuration[]);
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

  const filteredJobs = statusFilter
    ? jobs.filter((j) => j.status === statusFilter)
    : jobs;

  const handleStopScan = async (scanId: string) => {
    if (!window.confirm('Interrompere la scansione in corso? I job non ancora completati verranno annullati.')) return;
    setScanAction(`stop-${scanId}`);
    try {
      await fetch(`/api/scans/${scanId}/stop`, { method: 'POST' });
    } catch { /* network error */ }
    setScanAction(null);
  };

  const handleDeleteScan = async (scanId: string) => {
    if (!window.confirm('Eliminare la scansione? Tutti i risultati e i job verranno cancellati permanentemente.')) return;
    setScanAction(`delete-${scanId}`);
    try {
      await fetch(`/api/scans/${scanId}`, { method: 'DELETE' });
    } catch { /* network error */ }
    setScanAction(null);
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
    { label: 'In Coda', value: stats.pending, icon: Clock, gradient: 'from-teal to-teal-light', filterKey: 'pending' },
    { label: 'In Esecuzione', value: stats.processing, icon: Loader2, gradient: 'from-gold to-orange', filterKey: 'processing' },
    { label: 'Completati', value: stats.completed, icon: CheckCircle2, gradient: 'from-positive to-teal', filterKey: 'completed' },
    { label: 'Falliti', value: stats.failed, icon: XCircle, gradient: 'from-destructive to-orange', filterKey: 'failed' },
  ];

  return (
    <div className="animate-fade-in-up space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary tracking-tight">Job Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">Aggiornamento automatico ogni 5 secondi</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card
            key={stat.label}
            className={`border-0 shadow-sm rounded-2xl bg-white cursor-pointer transition-all ${statusFilter === stat.filterKey ? 'ring-2 ring-accent' : 'hover:shadow-md'}`}
            onClick={() => setStatusFilter(statusFilter === stat.filterKey ? null : stat.filterKey)}
          >
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
                <TableHead>Durata</TableHead>
                <TableHead>Avvio</TableHead>
                <TableHead>Fine</TableHead>
                <TableHead className="w-28">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scans.map((scan) => {
                const progress = scan.total_tasks > 0
                  ? Math.round((scan.completed_tasks / scan.total_tasks) * 100) : 0;
                const isExpanded = expandedScan === scan.id;
                const scanJobs = jobs.filter(j => j.scan_id === scan.id);
                const scanFailed = scanJobs.filter(j => j.status === 'failed').length;
                const scanCompleted = scanJobs.filter(j => j.status === 'completed').length;
                const scanProcessing = scanJobs.filter(j => j.status === 'processing').length;
                const scanPending = scanJobs.filter(j => j.status === 'pending').length;

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
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {scan.completed_tasks}/{scan.total_tasks}
                          </span>
                          {scanFailed > 0 && (
                            <span className="text-xs text-destructive font-medium">
                              ({scanFailed} err)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {scan.trigger_type === 'scheduled' ? 'Pianificato' : 'Manuale'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        <div className="flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          {formatDuration(scan.started_at, scan.completed_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(scan.started_at)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {scan.completed_at ? formatDateTime(scan.completed_at) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {scan.status === 'running' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStopScan(scan.id); }}
                              disabled={scanAction === `stop-${scan.id}`}
                              className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50"
                              title="Interrompi"
                            >
                              {scanAction === `stop-${scan.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StopCircle className="h-3.5 w-3.5" />}
                              Stop
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteScan(scan.id); }}
                            disabled={scanAction === `delete-${scan.id}`}
                            className="inline-flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 font-medium disabled:opacity-50"
                            title="Elimina"
                          >
                            {scanAction === `delete-${scan.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${scan.id}-expanded`}>
                        <TableCell colSpan={9} className="bg-[#f8f9fa] p-4">
                          <div className="space-y-1 animate-slide-down">
                            {/* Summary row */}
                            <div className="flex items-center gap-4 mb-3 text-xs">
                              <span className="flex items-center gap-1 text-positive">
                                <CheckCircle2 className="h-3.5 w-3.5" /> {scanCompleted} completati
                              </span>
                              <span className="flex items-center gap-1 text-accent">
                                <Loader2 className="h-3.5 w-3.5" /> {scanProcessing} in corso
                              </span>
                              <span className="flex items-center gap-1 text-destructive">
                                <XCircle className="h-3.5 w-3.5" /> {scanFailed} falliti
                              </span>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" /> {scanPending} in coda
                              </span>
                            </div>

                            {scanJobs.length > 0 ? scanJobs.map((job) => (
                              <div key={job.id} className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-white text-xs transition-colors">
                                {job.status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-positive shrink-0" />}
                                {job.status === 'failed' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                                {job.status === 'processing' && <Loader2 className="h-3.5 w-3.5 text-accent animate-spin shrink-0" />}
                                {job.status === 'pending' && <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                <span className="font-medium text-primary min-w-[120px]">{job.keyword}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {job.source === 'google_organic' ? 'Web' : 'News'}
                                </Badge>

                                {/* Duration */}
                                {job.duration_ms != null && (
                                  <span className="text-muted-foreground flex items-center gap-0.5">
                                    <Timer className="h-3 w-3" />
                                    {formatJobDuration(job.duration_ms)}
                                  </span>
                                )}
                                {job.status === 'processing' && job.started_at && (
                                  <span className="text-accent flex items-center gap-0.5">
                                    <Zap className="h-3 w-3" />
                                    {formatDuration(job.started_at, null)}
                                  </span>
                                )}

                                {/* Retry indicator */}
                                {job.retry_count > 0 && (
                                  <span className="flex items-center gap-0.5 text-orange-500">
                                    <AlertTriangle className="h-3 w-3" />
                                    {job.retry_count}/3
                                  </span>
                                )}

                                {/* Error */}
                                {job.error_message && (
                                  <span className="text-destructive truncate max-w-[250px] ml-auto" title={job.error_message}>
                                    {job.error_message}
                                  </span>
                                )}
                              </div>
                            )) : (
                              <p className="text-xs text-muted-foreground py-2">Nessun job per questa scansione</p>
                            )}
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
        <div className="p-5 pb-3 flex items-center justify-between">
          <h3 className="font-semibold text-primary text-[15px]">
            Ultimi 100 Job
            {statusFilter && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                (filtro: {statusFilter})
                <button
                  onClick={() => setStatusFilter(null)}
                  className="ml-1 text-accent hover:text-accent/80 underline"
                >
                  rimuovi
                </button>
              </span>
            )}
          </h3>
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
                <TableHead>Durata</TableHead>
                <TableHead>Creato</TableHead>
                <TableHead>Errore</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((job) => (
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
                  <TableCell className="text-sm">
                    {job.retry_count > 0 ? (
                      <span className="flex items-center gap-1 text-orange-500">
                        <AlertTriangle className="h-3 w-3" />
                        {job.retry_count}/3
                      </span>
                    ) : '0/3'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatJobDuration(job.duration_ms ?? null)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(job.created_at)}
                  </TableCell>
                  <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={job.error_message || undefined}>
                    {job.error_message || '—'}
                  </TableCell>
                </TableRow>
              ))}
              {filteredJobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                    Nessun job {statusFilter ? `con stato "${statusFilter}"` : ''}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
