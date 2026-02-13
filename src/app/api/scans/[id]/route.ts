import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: scan } = await admin
    .from('scans')
    .select('id, project_id, status')
    .eq('id', params.id)
    .single();

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  if (scan.status === 'running') {
    return NextResponse.json({ error: 'Cannot delete a running scan' }, { status: 400 });
  }

  // Delete in order: ai_analysis → serp_results → job_queue → scan
  const { data: serpResults } = await admin
    .from('serp_results')
    .select('id')
    .eq('scan_id', scan.id);

  const serpIds = serpResults?.map((r: { id: string }) => r.id) || [];

  if (serpIds.length > 0) {
    await admin.from('ai_analysis').delete().in('serp_result_id', serpIds);
  }

  await admin.from('serp_results').delete().eq('scan_id', scan.id);
  await admin.from('job_queue').delete().eq('scan_id', scan.id);
  await admin.from('scans').delete().eq('id', scan.id);

  // Clear project tags cache (will be rebuilt on next request)
  await admin.from('tags').delete().eq('project_id', scan.project_id);

  return NextResponse.json({ success: true });
}
