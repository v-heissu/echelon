'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  History,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
} from 'lucide-react';

interface ScanData {
  id: string;
  status: string;
  trigger_type: string;
  started_at: string | null;
  completed_at: string | null;
  total_tasks: number;
  completed_tasks: number;
  date_from: string | null;
  date_to: string | null;
  result_count: number;
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return <Badge variant="positive">Completata</Badge>;
    case 'running':
      return <Badge variant="mixed">In corso</Badge>;
    case 'failed':
      return <Badge variant="negative">Fallita</Badge>;
    default:
      return <Badge variant="neutral">In attesa</Badge>;
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-positive" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-gold animate-spin" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '—';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const ms = e - s;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

export default function ScansPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [scans, setScans] = useState<ScanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  async function loadScans() {
    const res = await fetch(`/api/projects/${slug}/scans`);
    if (res.ok) {
      const data = await res.json();
      setScans(data.scans || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadScans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Only non-running scans are selectable
  const selectableScans = useMemo(
    () => scans.filter((s) => s.status !== 'running'),
    [scans]
  );

  const allSelected =
    selectableScans.length > 0 && selectableScans.every((s) => selected.has(s.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableScans.map((s) => s.id)));
    }
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;

    const count = selected.size;
    const confirmed = window.confirm(
      `Eliminare ${count} scansion${count === 1 ? 'e' : 'i'}? Tutti i risultati e le analisi associate verranno cancellati permanentemente.`
    );
    if (!confirmed) return;

    setDeleting(true);
    const ids = Array.from(selected);
    let failed = 0;

    for (const id of ids) {
      try {
        const res = await fetch(`/api/scans/${id}`, { method: 'DELETE' });
        if (!res.ok) failed++;
      } catch {
        failed++;
      }
    }

    setSelected(new Set());
    setDeleting(false);
    await loadScans();

    if (failed > 0) {
      alert(`${failed} scansion${failed === 1 ? 'e' : 'i'} non sono state eliminate. Potrebbe mancare il permesso.`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <div className="h-8 w-48 rounded-lg animate-shimmer" />
        <div className="h-96 rounded-xl animate-shimmer" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Scansioni</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Storico delle scansioni del progetto
          </p>
        </div>
        {selected.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-xl"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Elimina {selected.size} selezionat{selected.size === 1 ? 'a' : 'e'}
          </Button>
        )}
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <History className="w-4 h-4 text-accent" />
            </div>
            <h3 className="font-semibold text-primary">Tutte le Scansioni</h3>
            <span className="text-xs text-muted-foreground">({scans.length})</span>
          </div>

          {scans.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nessuna scansione trovata. Avvia una scan dal pannello admin.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-border cursor-pointer"
                      title="Seleziona tutte"
                    />
                  </TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data Inizio</TableHead>
                  <TableHead>Data Fine</TableHead>
                  <TableHead>Durata</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Risultati</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.map((scan) => {
                  const isRunning = scan.status === 'running';
                  const isSelected = selected.has(scan.id);

                  return (
                    <TableRow
                      key={scan.id}
                      className={isSelected ? 'bg-destructive/5' : ''}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(scan.id)}
                          disabled={isRunning}
                          className="rounded border-border cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {statusIcon(scan.status)}
                          {statusBadge(scan.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatDate(scan.started_at)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatDate(scan.completed_at)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm tabular-nums">
                          {formatDuration(scan.started_at, scan.completed_at)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm tabular-nums">
                          {scan.completed_tasks}/{scan.total_tasks}
                        </span>
                        {scan.total_tasks > 0 && scan.completed_tasks < scan.total_tasks && scan.status !== 'running' && (
                          <span title="Task incompleti">
                            <AlertTriangle className="inline h-3 w-3 text-orange ml-1" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm tabular-nums">{scan.result_count}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground capitalize">
                          {scan.trigger_type || 'manual'}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
