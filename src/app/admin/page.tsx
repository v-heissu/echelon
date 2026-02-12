export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { FolderOpen, Users, Activity, AlertCircle } from 'lucide-react';

export default async function AdminDashboard() {
  // Middleware already verified admin access; use admin client to bypass RLS
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
    <div>
      <h1 className="text-2xl font-bold text-primary mb-6">Dashboard Admin</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Progetti</p>
                <p className="text-3xl font-bold text-primary">{projectCount || 0}</p>
              </div>
              <FolderOpen className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Utenti</p>
                <p className="text-3xl font-bold text-primary">{userCount || 0}</p>
              </div>
              <Users className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scan Recenti</p>
                <p className="text-3xl font-bold text-primary">{recentScans?.length || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-teal" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Job Falliti</p>
                <p className="text-3xl font-bold text-destructive">{failedJobs?.length || 0}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scan Recenti</CardTitle>
          </CardHeader>
          <CardContent>
            {recentScans && recentScans.length > 0 ? (
              <div className="space-y-3">
                {recentScans.map((scan) => {
                  const project = scan.projects as { name: string; slug: string } | null;
                  return (
                    <div
                      key={scan.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div>
                        <Link
                          href={`/project/${project?.slug}`}
                          className="font-medium text-accent hover:underline"
                        >
                          {project?.name || 'Unknown'}
                        </Link>
                        <p className="text-xs text-muted-foreground">
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
              <p className="text-sm text-muted-foreground">Nessuna scan recente</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Job Falliti</CardTitle>
          </CardHeader>
          <CardContent>
            {failedJobs && failedJobs.length > 0 ? (
              <div className="space-y-3">
                {failedJobs.map((job) => {
                  const scanProject = job.scans as { projects: { name: string } } | null;
                  return (
                    <div key={job.id} className="py-2 border-b last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{job.keyword}</span>
                        <Badge variant="negative">{job.source}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
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
              <p className="text-sm text-muted-foreground">Nessun job fallito</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
