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

  // Get job details for accordion
  const { data: jobs } = await admin
    .from('job_queue')
    .select('id, keyword, source, status, started_at, completed_at, error_message')
    .eq('scan_id', params.id)
    .order('created_at', { ascending: true });

  const failedCount = jobs?.filter(j => j.status === 'failed').length || 0;

  return NextResponse.json({
    ...scan,
    progress,
    failed_tasks: failedCount,
    jobs: jobs || [],
  });
}
