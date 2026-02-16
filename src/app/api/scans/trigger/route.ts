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

  const { project_slug, scan_date } = await request.json();

  // Get project
  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('*')
    .eq('slug', project_slug)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const keywords = project.keywords as string[];
  const sources = project.sources as string[];

  if (!keywords.length) {
    return NextResponse.json({ error: 'No keywords configured' }, { status: 400 });
  }

  // Compute incremental date range
  // date_to = scan_date provided by user (or now)
  const dateTo = scan_date ? new Date(scan_date).toISOString() : new Date().toISOString();

  // date_from = date_to of the last completed scan for this project (null if first scan)
  const { data: lastScan } = await admin
    .from('scans')
    .select('date_to, completed_at')
    .eq('project_id', project.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // If there's a previous scan with date_to set, use it as our date_from
  // If previous scan exists but has no date_to (legacy scan), use its completed_at
  // If no previous scan at all, date_from stays null (= from the beginning of time)
  const dateFrom = lastScan?.date_to || lastScan?.completed_at || null;

  const totalTasks = keywords.length * sources.length;

  // Create scan with date range
  const { data: scan, error: scanError } = await admin
    .from('scans')
    .insert({
      project_id: project.id,
      trigger_type: 'manual',
      status: 'running',
      started_at: new Date().toISOString(),
      total_tasks: totalTasks,
      completed_tasks: 0,
      date_from: dateFrom,
      date_to: dateTo,
    })
    .select()
    .single();

  if (scanError || !scan) {
    return NextResponse.json({ error: 'Failed to create scan' }, { status: 500 });
  }

  // Create job queue entries
  const jobs = keywords.flatMap((keyword: string) =>
    sources.map((source: string) => ({
      scan_id: scan.id,
      keyword,
      source,
      status: 'pending' as const,
    }))
  );

  const { error: jobsError } = await admin.from('job_queue').insert(jobs);

  if (jobsError) {
    await admin.from('scans').delete().eq('id', scan.id);
    return NextResponse.json({ error: 'Failed to create jobs: ' + jobsError.message }, { status: 500 });
  }

  // Fire-and-forget: kick off server-side processing (maxDuration 300s)
  // so the scan runs without needing the browser to stay open.
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  fetch(`${baseUrl}/api/scans/${scan.id}/run`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
  }).catch(() => {});

  return NextResponse.json({
    scan_id: scan.id,
    total_tasks: totalTasks,
    date_from: dateFrom,
    date_to: dateTo,
    message: dateFrom
      ? `Scan incrementale: ${new Date(dateFrom).toLocaleDateString('it-IT')} → ${new Date(dateTo).toLocaleDateString('it-IT')}`
      : `Prima scan: tutto fino al ${new Date(dateTo).toLocaleDateString('it-IT')}`,
  }, { status: 201 });
}
