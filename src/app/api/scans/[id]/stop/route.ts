import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: scan } = await admin
    .from('scans')
    .select('id, project_id, status')
    .eq('id', params.id)
    .single();

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  // Allow admins or project members
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    const { data: membership } = await admin
      .from('project_users')
      .select('user_id')
      .eq('project_id', scan.project_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (scan.status !== 'running') {
    return NextResponse.json({ error: 'Scan is not running' }, { status: 400 });
  }

  // Cancel all pending and processing jobs
  await admin
    .from('job_queue')
    .update({ status: 'failed', error_message: 'Scan interrotta manualmente', completed_at: new Date().toISOString() })
    .eq('scan_id', scan.id)
    .in('status', ['pending', 'processing']);

  // Mark scan as failed with completed_at
  await admin
    .from('scans')
    .update({ status: 'failed', completed_at: new Date().toISOString() })
    .eq('id', scan.id);

  return NextResponse.json({ success: true, message: 'Scan interrotta' });
}
