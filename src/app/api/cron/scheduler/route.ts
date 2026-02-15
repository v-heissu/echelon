import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processOneJob } from '@/lib/worker/process-jobs';

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

    // Compute incremental date range
    const dateTo = new Date().toISOString();
    const { data: lastScan } = await supabase
      .from('scans')
      .select('date_to, completed_at')
      .eq('project_id', project.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const dateFrom = lastScan?.date_to || lastScan?.completed_at || null;

    // Create scan with date range
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
        date_from: dateFrom,
        date_to: dateTo,
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
  }

  // Process jobs inline within 280s budget (cron IS awaited by Vercel)
  const startTime = Date.now();
  const MAX_RUNTIME = 280_000;
  let processedCount = 0;
  let errorCount = 0;

  while (Date.now() - startTime < MAX_RUNTIME) {
    try {
      const result = await processOneJob();
      if (result.status === 'no_jobs') break;
      if (result.status === 'processed') processedCount++;
      if (result.status === 'error') errorCount++;
      if (result.pendingCount === 0) break;

      // Rate limiting: 4s delay between Gemini calls (15 RPM free tier)
      await new Promise(resolve => setTimeout(resolve, 4000));
    } catch (err) {
      console.error('[cron] Processing error:', err);
      errorCount++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return NextResponse.json({
    message: `Triggered ${triggeredProjects.length} projects`,
    projects: triggeredProjects,
    processed: processedCount,
    errors: errorCount,
  });
}
