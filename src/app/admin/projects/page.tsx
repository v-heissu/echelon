'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ExternalLink, Play, Search, Calendar, Globe, FolderOpen } from 'lucide-react';
import { Project } from '@/types/database';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<(Project & { scans: { status: string; completed_at: string }[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const loadProjects = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('projects')
      .select('*, scans(id, status, completed_at)')
      .order('created_at', { ascending: false });
    setProjects((data as typeof projects) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

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

          return (
            <Card key={project.id} className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-accent to-teal" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <Link
                    href={`/admin/projects/${project.slug}`}
                    className="text-base font-semibold text-primary hover:text-accent transition-colors"
                  >
                    {project.name}
                  </Link>
                  <Badge variant={project.is_active ? 'positive' : 'outline'}>
                    {project.is_active ? 'Attivo' : 'Inattivo'}
                  </Badge>
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
                  >
                    <Play className="h-3.5 w-3.5" />
                    Scan
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
