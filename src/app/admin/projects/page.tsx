'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ExternalLink, Play, Search, Calendar, Globe, FolderOpen, Trash2, Loader2, Unlock, Settings } from 'lucide-react';
import { Project } from '@/types/database';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<(Project & { scans: { status: string; completed_at: string }[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanningSlug, setScanningSlug] = useState<string | null>(null);
  const [resettingSlug, setResettingSlug] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data || []);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Poll while a scan is running to update the UI
  useEffect(() => {
    if (!scanningSlug) return;
    const interval = setInterval(loadProjects, 10000);
    return () => clearInterval(interval);
  }, [scanningSlug, loadProjects]);

  async function triggerScan(slug: string) {
    setScanningSlug(slug);
    try {
      const res = await fetch('/api/scans/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_slug: slug }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Scan avviata! ${data.total_tasks} task in elaborazione server-side. Controlla il progresso dalla dashboard.`);
        loadProjects();
      } else {
        const data = await res.json();
        alert('Errore: ' + data.error);
        setScanningSlug(null);
      }
    } catch {
      alert('Errore di rete. Riprova.');
      setScanningSlug(null);
    }
  }

  async function resetScans(slug: string) {
    if (!confirm('Sbloccare tutte le scan bloccate per questo progetto? I job in stato "processing" da più di 5 minuti saranno resettati a "pending".')) return;
    setResettingSlug(slug);
    try {
      const res = await fetch('/api/scans/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_slug: slug }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Sblocco completato: ${data.reset_jobs} job resettati, ${data.completed_scans} scan completate.`);
      } else {
        const data = await res.json();
        alert('Errore: ' + data.error);
      }
    } catch {
      alert('Errore di rete.');
    } finally {
      setResettingSlug(null);
      loadProjects();
    }
  }

  async function deleteProject(slug: string, name: string) {
    if (!confirm(`Eliminare "${name}"? Tutti i dati (scan, risultati, analisi) saranno persi.`)) return;
    try {
      const res = await fetch(`/api/admin/projects/${slug}`, { method: 'DELETE' });
      if (res.ok) {
        loadProjects();
      } else {
        const data = await res.json();
        alert('Errore eliminazione: ' + data.error);
      }
    } catch {
      alert('Errore di rete durante l\'eliminazione.');
    }
  }

  if (loading) {
    return (
      <div className="animate-fade-in-up space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 rounded-lg animate-shimmer" />
          <div className="h-10 w-40 rounded-lg animate-shimmer" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 rounded-lg animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-primary">Progetti</h1>
          <p className="text-sm text-muted-foreground mt-1">{projects.length} progetti configurati</p>
        </div>
        <Link href="/admin/projects/new">
          <Button variant="accent" className="gap-2 shadow-md shadow-accent/20">
            <Plus className="h-4 w-4" />
            Nuovo Progetto
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((project) => {
          const lastScan = project.scans
            ?.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))[0];
          const keywords = project.keywords as string[];
          const isScanning = scanningSlug === project.slug;
          const isResetting = resettingSlug === project.slug;
          const hasRunningScan = project.scans?.some(s => s.status === 'running');

          return (
            <Card key={project.id} className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-accent to-teal" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-primary">{project.name}</span>
                    <Link
                      href={`/admin/projects/${project.slug}`}
                      className="p-1 rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
                      title="Impostazioni progetto"
                    >
                      <Settings className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(isScanning || hasRunningScan) && (
                      <Badge variant="outline" className="text-accent border-accent/30 gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Scan in corso
                      </Badge>
                    )}
                    <Badge variant={project.is_active ? 'positive' : 'outline'}>
                      {project.is_active ? 'Attivo' : 'Inattivo'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2.5 mb-5">
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Industry</span>
                    <span className="ml-auto font-medium text-primary">{project.industry || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Search className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Keywords</span>
                    <span className="ml-auto font-medium text-primary">{keywords?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Schedule</span>
                    <span className="ml-auto font-medium text-primary capitalize">{project.schedule}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Ultima scan</span>
                    <span className="ml-auto font-medium text-primary">
                      {lastScan?.completed_at
                        ? new Date(lastScan.completed_at).toLocaleDateString('it-IT')
                        : '—'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link href={`/project/${project.slug}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Apri
                    </Button>
                  </Link>
                  <Button
                    variant="accent"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => triggerScan(project.slug)}
                    disabled={isScanning}
                  >
                    {isScanning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    {isScanning ? 'In corso...' : 'Scan'}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-orange"
                    onClick={() => resetScans(project.slug)}
                    disabled={isResetting}
                    title="Sblocca scan bloccate"
                  >
                    {isResetting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteProject(project.slug, project.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {projects.length === 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="h-8 w-8 text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-primary mb-1">Nessun progetto</h3>
            <p className="text-sm text-muted-foreground">Crea il primo progetto per iniziare il monitoraggio.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
