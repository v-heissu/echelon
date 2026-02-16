'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';

interface ScanInfo {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

export default function ExportPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [scans, setScans] = useState<ScanInfo[]>([]);
  const [selectedScan, setSelectedScan] = useState('');
  const [downloading, setDownloading] = useState(false);

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
        .select('id, status, started_at, completed_at')
        .eq('project_id', project.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
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

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-primary">Export Dati</h1>
        <p className="text-sm text-muted-foreground mt-1">Scarica i dati del progetto in formato Excel</p>
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
              <p className="text-xs text-muted-foreground">Risultati, Trend Summary, Competitor Analysis e Alert Prioritari</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Scan (opzionale)</label>
            <Select
              value={selectedScan}
              onChange={(e) => setSelectedScan(e.target.value)}
            >
              <option value="">Tutti i dati</option>
              {scans.map((s) => (
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
    </div>
  );
}
