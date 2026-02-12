import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { project_slug } = await request.json();

  const adminClient = createAdminClient();

  // Get project
  const { data: project, error: projectError } = await adminClient
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
  const { data: scan, error: scanError } = await adminClient
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

  await adminClient.from('job_queue').insert(jobs);

  // Trigger worker
  const baseUrl = new URL(request.url).origin;
  fetch(`${baseUrl}/api/worker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.WORKER_SECRET }),
  }).catch(() => {});

  return NextResponse.json({ scan_id: scan.id, total_tasks: totalTasks }, { status: 201 });
}
