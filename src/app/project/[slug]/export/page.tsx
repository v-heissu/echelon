'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Download, FileSpreadsheet, Loader2, Trash2, Calendar, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ScanInfo {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  total_tasks: number;
  completed_tasks: number;
}

export default function ExportPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [scans, setScans] = useState<ScanInfo[]>([]);
  const [selectedScan, setSelectedScan] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadScans();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function loadScans() {
    const supabase = createClient();
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (project) {
      const { data } = await supabase
        .from('scans')
        .select('id, status, started_at, completed_at, total_tasks, completed_tasks')
        .eq('project_id', project.id)
        .order('started_at', { ascending: false })
        .limit(20);
      setScans(data || []);
    }
  }

  async function handleExport() {
    setDownloading(true);

    const exportParams = new URLSearchParams();
    if (selectedScan) exportParams.set('scan_id', selectedScan);

    const res = await fetch(`/api/projects/${slug}/export?${exportParams}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `echelon-${slug}-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      alert('Errore durante il download');
    }

    setDownloading(false);
  }

  async function handleDeleteScan(scanId: string) {
    if (!confirm('Sei sicuro di voler eliminare questa scansione? Tutti i dati associati verranno cancellati.')) return;

    setDeletingId(scanId);
    const res = await fetch(`/api/scans/${scanId}`, { method: 'DELETE' });
    if (res.ok) {
      setScans(scans.filter((s) => s.id !== scanId));
      if (selectedScan === scanId) setSelectedScan('');
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Errore durante la cancellazione');
    }
    setDeletingId(null);
  }

  const completedScans = scans.filter((s) => s.status === 'completed');

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-primary">Export & Scansioni</h1>
        <p className="text-sm text-muted-foreground mt-1">Scarica i dati e gestisci le scansioni</p>
      </div>

      <Card className="max-w-lg border-0 shadow-md overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-accent to-teal" />
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <FileSpreadsheet className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-primary">Export Excel</h3>
              <p className="text-xs text-muted-foreground">Risultati, Trend Summary e Competitor Analysis</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Scan (opzionale)</label>
            <Select
              value={selectedScan}
              onChange={(e) => setSelectedScan(e.target.value)}
            >
              <option value="">Tutti i dati</option>
              {completedScans.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.completed_at ? new Date(s.completed_at).toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  }) : 'In corso'}
                </option>
              ))}
            </Select>
          </div>

          <Button
            variant="accent"
            onClick={handleExport}
            disabled={downloading}
            className="w-full h-11 gap-2 font-semibold"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Download in corso...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Scarica Excel
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Scan management */}
      <Card className="border-0 shadow-md overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-accent" />
            </div>
            <h3 className="font-semibold text-primary">Scansioni</h3>
            <span className="text-xs text-muted-foreground">({scans.length})</span>
          </div>

          {scans.length > 0 ? (
            <div className="space-y-2">
              {scans.map((scan) => (
                <div
                  key={scan.id}
                  className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    {scan.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-positive shrink-0" />}
                    {scan.status === 'running' && <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />}
                    {scan.status === 'failed' && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-primary">
                        {scan.completed_at
                          ? new Date(scan.completed_at).toLocaleDateString('it-IT', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : scan.started_at
                          ? new Date(scan.started_at).toLocaleDateString('it-IT', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Data non disponibile'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {scan.completed_tasks}/{scan.total_tasks} task
                        {scan.status === 'running' && ' (in corso)'}
                        {scan.status === 'failed' && ' (fallita)'}
                      </p>
                    </div>
                  </div>

                  {scan.status !== 'running' && (
                    <button
                      onClick={() => handleDeleteScan(scan.id)}
                      disabled={deletingId === scan.id}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive transition-all"
                      title="Elimina scansione"
                    >
                      {deletingId === scan.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Nessuna scansione disponibile.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
