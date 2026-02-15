import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processOneJob } from '@/lib/worker/process-jobs';

export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { project_slug } = await request.json();

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

  const totalTasks = keywords.length * sources.length;

  // Create scan
  const { data: scan, error: scanError } = await admin
    .from('scans')
    .insert({
      project_id: project.id,
      trigger_type: 'manual',
      status: 'running',
      started_at: new Date().toISOString(),
      total_tasks: totalTasks,
      completed_tasks: 0,
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
    // Cleanup the scan since jobs failed to insert
    await admin.from('scans').delete().eq('id', scan.id);
    return NextResponse.json({ error: 'Failed to create jobs: ' + jobsError.message }, { status: 500 });
  }

  // Server-only: process ALL jobs inline within the 280s budget
  const startTime = Date.now();
  const MAX_RUNTIME = 280_000;
  let processedCount = 0;

  while (Date.now() - startTime < MAX_RUNTIME) {
    const result = await processOneJob();
    if (result.status === 'no_jobs') break;
    if (result.status === 'processed') processedCount++;
    if (result.pendingCount === 0) break;

    // Rate limiting: 4s delay between Gemini calls (15 RPM free tier)
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  return NextResponse.json({
    scan_id: scan.id,
    total_tasks: totalTasks,
    processed: processedCount,
  }, { status: 201 });
}
