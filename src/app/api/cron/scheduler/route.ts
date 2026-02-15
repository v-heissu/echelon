import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 300;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0-6
  const dayOfMonth = now.getDate(); // 1-31

  // Get active projects with matching schedule
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .eq('is_active', true)
    .neq('schedule', 'manual');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!projects || projects.length === 0) {
    return NextResponse.json({ message: 'No scheduled projects' });
  }

  const triggeredProjects: string[] = [];
  const baseUrl = new URL(request.url).origin;

  for (const project of projects) {
    let shouldRun = false;

    if (project.schedule === 'weekly' && project.schedule_day === dayOfWeek) {
      shouldRun = true;
    } else if (project.schedule === 'monthly' && project.schedule_day === dayOfMonth) {
      shouldRun = true;
    }

    if (!shouldRun) continue;

    const keywords = project.keywords as string[];
    const sources = project.sources as string[];

    if (!keywords.length || !sources.length) continue;

    // Create scan
    const totalTasks = keywords.length * sources.length;
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({
        project_id: project.id,
        trigger_type: 'scheduled',
        status: 'running',
        started_at: new Date().toISOString(),
        total_tasks: totalTasks,
        completed_tasks: 0,
      })
      .select()
      .single();

    if (scanError || !scan) continue;

    // Create job queue entries
    const jobs = keywords.flatMap((keyword: string) =>
      sources.map((source: string) => ({
        scan_id: scan.id,
        keyword,
        source,
        status: 'pending' as const,
      }))
    );

    await supabase.from('job_queue').insert(jobs);
    triggeredProjects.push(project.slug);

    // Fire-and-forget processing for this scan
    fetch(`${baseUrl}/api/scans/${scan.id}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    }).catch((err) => {
      console.error(`[cron] Fire-and-forget failed for scan ${scan.id}:`, err);
    });
  }

  return NextResponse.json({
    message: `Triggered ${triggeredProjects.length} projects`,
    projects: triggeredProjects,
  });
}
