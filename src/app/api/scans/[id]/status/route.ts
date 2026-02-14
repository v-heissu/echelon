import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: scan, error } = await admin
    .from('scans')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const progress = scan.total_tasks > 0
    ? Math.round((scan.completed_tasks / scan.total_tasks) * 100)
    : 0;

  // Get job details for accordion - include retry_count and timing for full context
  const { data: jobs } = await admin
    .from('job_queue')
    .select('id, keyword, source, status, started_at, completed_at, error_message, retry_count, created_at')
    .eq('scan_id', params.id)
    .order('created_at', { ascending: true });

  const jobsWithDuration = (jobs || []).map((j) => ({
    ...j,
    duration_ms: j.started_at && j.completed_at
      ? new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()
      : null,
  }));

  const failedCount = jobsWithDuration.filter(j => j.status === 'failed').length;
  const pendingCount = jobsWithDuration.filter(j => j.status === 'pending').length;
  const processingCount = jobsWithDuration.filter(j => j.status === 'processing').length;
  const completedCount = jobsWithDuration.filter(j => j.status === 'completed').length;

  return NextResponse.json({
    ...scan,
    progress,
    failed_tasks: failedCount,
    pending_tasks: pendingCount,
    processing_tasks: processingCount,
    completed_count: completedCount,
    jobs: jobsWithDuration,
  });
}
