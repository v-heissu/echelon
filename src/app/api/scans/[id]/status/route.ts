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

  // Get failed jobs count
  const { count: failedCount } = await admin
    .from('job_queue')
    .select('*', { count: 'exact', head: true })
    .eq('scan_id', params.id)
    .eq('status', 'failed');

  return NextResponse.json({
    ...scan,
    progress,
    failed_tasks: failedCount || 0,
  });
}
