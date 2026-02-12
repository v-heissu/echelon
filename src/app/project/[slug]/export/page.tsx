'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileSpreadsheet } from 'lucide-react';

export default function ExportPage() {
  const params = useParams();
  const slug = params.slug as string;
  const supabase = createClient();

  const [scans, setScans] = useState<{ id: string; completed_at: string }[]>([]);
  const [selectedScan, setSelectedScan] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function loadScans() {
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('slug', slug)
        .single();

      if (project) {
        const { data } = await supabase
          .from('scans')
          .select('id, completed_at')
          .eq('project_id', project.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(20);
        setScans(data || []);
      }
    }
    loadScans();
  }, [slug]);

  async function handleExport() {
    setDownloading(true);

    const params = new URLSearchParams();
    if (selectedScan) params.set('scan_id', selectedScan);

    const res = await fetch(`/api/projects/${slug}/export?${params}`);
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Export Dati</h1>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-accent" />
            Export Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Genera un file Excel con tre fogli: Risultati, Trend Summary e Competitor Analysis.
          </p>

          <div>
            <label className="block text-sm font-medium mb-1">Scan (opzionale)</label>
            <Select
              value={selectedScan}
              onChange={(e) => setSelectedScan(e.target.value)}
            >
              <option value="">Tutti i dati</option>
              {scans.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.completed_at).toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </option>
              ))}
            </Select>
          </div>

          <Button
            variant="accent"
            onClick={handleExport}
            disabled={downloading}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            {downloading ? 'Download in corso...' : 'Scarica Excel'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
