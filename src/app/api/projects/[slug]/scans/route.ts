import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: project, error: projErr } = await admin
    .from('projects')
    .select('id')
    .eq('slug', params.slug)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: projErr?.message || 'Project not found' }, { status: 404 });
  }

  // Verify access
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') {
    const { data: membership } = await admin
      .from('project_users')
      .select('user_id')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: scans, error: scansErr } = await admin
    .from('scans')
    .select('id, status, trigger_type, started_at, completed_at, total_tasks, completed_tasks, date_from, date_to')
    .eq('project_id', project.id)
    .order('started_at', { ascending: false });

  if (scansErr) {
    return NextResponse.json({ error: `DB error: ${scansErr.message}` }, { status: 500 });
  }

  // Get result counts per scan
  const resultCounts = new Map<string, number>();

  for (const scan of scans || []) {
    const { count } = await admin
      .from('serp_results')
      .select('id', { count: 'exact', head: true })
      .eq('scan_id', scan.id);
    resultCounts.set(scan.id, count || 0);
  }

  const enrichedScans = (scans || []).map(s => ({
    ...s,
    result_count: resultCounts.get(s.id) || 0,
  }));

  return NextResponse.json({ scans: enrichedScans });
}
