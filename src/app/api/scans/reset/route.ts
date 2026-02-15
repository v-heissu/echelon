import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { project_slug } = await request.json();

  // Get project
  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('slug', project_slug)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Get all running scans for this project
  const { data: runningScans } = await admin
    .from('scans')
    .select('id, total_tasks, completed_tasks')
    .eq('project_id', project.id)
    .eq('status', 'running');

  if (!runningScans || runningScans.length === 0) {
    return NextResponse.json({ message: 'Nessuna scan da sbloccare', reset_jobs: 0, completed_scans: 0 });
  }

  const scanIds = runningScans.map(s => s.id);
  let resetJobs = 0;
  let completedScans = 0;

  // 1. Reset stale processing jobs (processing for > 5 min) back to pending
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: staleJobs } = await admin
    .from('job_queue')
    .update({ status: 'pending', started_at: null, error_message: 'Manual reset: admin sblocco' })
    .in('scan_id', scanIds)
    .eq('status', 'processing')
    .lt('started_at', fiveMinAgo)
    .select('id');

  resetJobs += staleJobs?.length || 0;

  // 2. Also reset any currently processing jobs (regardless of time) if requested
  const { data: currentProcessing } = await admin
    .from('job_queue')
    .update({ status: 'pending', started_at: null, error_message: 'Manual reset: admin sblocco' })
    .in('scan_id', scanIds)
    .eq('status', 'processing')
    .select('id');

  resetJobs += currentProcessing?.length || 0;

  // 3. Check if any scans are actually complete (all jobs done)
  for (const scan of runningScans) {
    const { count: pendingCount } = await admin
      .from('job_queue')
      .select('id', { count: 'exact', head: true })
      .eq('scan_id', scan.id)
      .in('status', ['pending', 'processing']);

    if (pendingCount === 0) {
      // All jobs are done (completed or failed), mark scan as completed
      await admin
        .from('scans')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', scan.id);
      completedScans++;
    }
  }

  return NextResponse.json({
    message: `Reset ${resetJobs} job, completate ${completedScans} scan`,
    reset_jobs: resetJobs,
    completed_scans: completedScans,
    scans_checked: scanIds.length,
  });
}
