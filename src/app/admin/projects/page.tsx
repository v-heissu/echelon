'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ExternalLink, Play } from 'lucide-react';
import { Project } from '@/types/database';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<(Project & { scans: { status: string; completed_at: string }[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    const { data } = await supabase
      .from('projects')
      .select('*, scans(id, status, completed_at)')
      .order('created_at', { ascending: false });
    setProjects((data as typeof projects) || []);
    setLoading(false);
  }

  async function triggerScan(slug: string) {
    const res = await fetch('/api/scans/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_slug: slug }),
    });
    if (res.ok) {
      alert('Scan avviata!');
      loadProjects();
    } else {
      const data = await res.json();
      alert('Errore: ' + data.error);
    }
  }

  if (loading) {
    return <div className="animate-pulse">Caricamento...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Progetti</h1>
        <Link href="/admin/projects/new">
          <Button variant="accent">
            <Plus className="h-4 w-4 mr-2" />
            Nuovo Progetto
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => {
          const lastScan = project.scans
            ?.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))[0];
          const keywords = project.keywords as string[];

          return (
            <Card key={project.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">
                    <Link
                      href={`/admin/projects/${project.slug}`}
                      className="text-accent hover:underline"
                    >
                      {project.name}
                    </Link>
                  </CardTitle>
                  <Badge variant={project.is_active ? 'positive' : 'outline'}>
                    {project.is_active ? 'Attivo' : 'Inattivo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Industry</span>
                    <span>{project.industry || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Keywords</span>
                    <span>{keywords?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Schedule</span>
                    <span className="capitalize">{project.schedule}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ultima scan</span>
                    <span>
                      {lastScan?.completed_at
                        ? new Date(lastScan.completed_at).toLocaleDateString('it-IT')
                        : '—'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Link href={`/project/${project.slug}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Apri
                    </Button>
                  </Link>
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => triggerScan(project.slug)}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Scan
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {projects.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Nessun progetto. Crea il primo progetto per iniziare.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
