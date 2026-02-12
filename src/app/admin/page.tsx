export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { FolderOpen, Users, Activity, AlertCircle, ArrowRight } from 'lucide-react';

export default async function AdminDashboard() {
  const supabase = createAdminClient();

  const [
    { count: projectCount },
    { count: userCount },
    { data: recentScans },
    { data: failedJobs },
  ] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase
      .from('scans')
      .select('*, projects(name, slug)')
      .order('started_at', { ascending: false })
      .limit(5),
    supabase
      .from('job_queue')
      .select('*, scans(projects(name))')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary">Dashboard Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">Panoramica generale della piattaforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Progetti</p>
                <p className="text-3xl font-bold text-primary mt-1">{projectCount || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <FolderOpen className="h-6 w-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Utenti</p>
                <p className="text-3xl font-bold text-primary mt-1">{userCount || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scan Recenti</p>
                <p className="text-3xl font-bold text-primary mt-1">{recentScans?.length || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-teal/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-teal" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Falliti</p>
                <p className="text-3xl font-bold text-destructive mt-1">{failedJobs?.length || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-md">
          <div className="p-5 pb-0 flex items-center justify-between">
            <h3 className="font-semibold text-primary">Scan Recenti</h3>
            <Link href="/admin/jobs" className="text-xs text-accent hover:underline flex items-center gap-1">
              Vedi tutti <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <CardContent className="p-5">
            {recentScans && recentScans.length > 0 ? (
              <div className="space-y-1">
                {recentScans.map((scan) => {
                  const project = scan.projects as { name: string; slug: string } | null;
                  return (
                    <div
                      key={scan.id}
                      className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <Link
                          href={`/project/${project?.slug}`}
                          className="font-medium text-sm text-accent hover:underline"
                        >
                          {project?.name || 'Unknown'}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {scan.trigger_type} — {scan.completed_tasks}/{scan.total_tasks} task
                        </p>
                      </div>
                      <Badge
                        variant={
                          scan.status === 'completed'
                            ? 'positive'
                            : scan.status === 'failed'
                            ? 'negative'
                            : scan.status === 'running'
                            ? 'mixed'
                            : 'neutral'
                        }
                      >
                        {scan.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Nessuna scan recente</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <div className="p-5 pb-0 flex items-center justify-between">
            <h3 className="font-semibold text-primary">Job Falliti</h3>
            <Link href="/admin/jobs" className="text-xs text-accent hover:underline flex items-center gap-1">
              Vedi tutti <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <CardContent className="p-5">
            {failedJobs && failedJobs.length > 0 ? (
              <div className="space-y-1">
                {failedJobs.map((job) => {
                  const scanProject = job.scans as { projects: { name: string } } | null;
                  return (
                    <div key={job.id} className="py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{job.keyword}</span>
                        <Badge variant="negative">{job.source}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {scanProject?.projects?.name} — Tentativi: {job.retry_count}/3
                      </p>
                      {job.error_message && (
                        <p className="text-xs text-destructive mt-1 truncate">
                          {job.error_message}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-10 h-10 rounded-xl bg-positive/10 flex items-center justify-center mx-auto mb-2">
                  <Activity className="h-5 w-5 text-positive" />
                </div>
                <p className="text-sm text-muted-foreground">Nessun job fallito</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
