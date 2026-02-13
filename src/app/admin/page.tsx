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

  const statCards = [
    { label: 'Progetti', value: projectCount || 0, icon: FolderOpen, gradient: 'from-accent to-accent-light', color: 'text-accent' },
    { label: 'Utenti', value: userCount || 0, icon: Users, gradient: 'from-teal to-teal-light', color: 'text-teal' },
    { label: 'Scan Recenti', value: recentScans?.length || 0, icon: Activity, gradient: 'from-positive to-teal', color: 'text-positive' },
    { label: 'Job Falliti', value: failedJobs?.length || 0, icon: AlertCircle, gradient: 'from-destructive to-orange', color: 'text-destructive' },
  ];

  return (
    <div className="animate-fade-in-up max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Panoramica della piattaforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-0 shadow-card rounded-2xl overflow-hidden bg-white hover:shadow-card-hover transition-all duration-300">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-sm`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className={`text-3xl font-bold ${stat.label === 'Job Falliti' ? 'text-destructive' : 'text-primary'} tracking-tight`}>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-card rounded-2xl bg-white hover:shadow-card-hover transition-all duration-300">
          <div className="p-5 pb-0 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-accent" />
              </div>
              <h3 className="font-semibold text-primary text-[15px]">Scan Recenti</h3>
            </div>
            <Link href="/admin/jobs" className="text-xs text-accent hover:text-accent-light font-medium flex items-center gap-1 transition-colors">
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
                      className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <Link
                          href={`/project/${project?.slug}`}
                          className="font-medium text-sm text-primary hover:text-accent transition-colors"
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
              <p className="text-sm text-muted-foreground text-center py-8">Nessuna scan recente</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card rounded-2xl bg-white hover:shadow-card-hover transition-all duration-300">
          <div className="p-5 pb-0 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-destructive" />
              </div>
              <h3 className="font-semibold text-primary text-[15px]">Job Falliti</h3>
            </div>
            <Link href="/admin/jobs" className="text-xs text-accent hover:text-accent-light font-medium flex items-center gap-1 transition-colors">
              Vedi tutti <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <CardContent className="p-5">
            {failedJobs && failedJobs.length > 0 ? (
              <div className="space-y-1">
                {failedJobs.map((job) => {
                  const scanProject = job.scans as { projects: { name: string } } | null;
                  return (
                    <div key={job.id} className="py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors">
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
              <div className="text-center py-8">
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
