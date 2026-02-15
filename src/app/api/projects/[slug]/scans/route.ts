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

  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('slug', params.slug)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

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

  const { data: scans } = await admin
    .from('scans')
    .select('id, status, trigger_type, started_at, completed_at, total_tasks, completed_tasks, date_from, date_to')
    .eq('project_id', project.id)
    .order('started_at', { ascending: false });

  // Get result counts per scan
  const scanIds = (scans || []).map(s => s.id);
  const resultCounts = new Map<string, number>();

  if (scanIds.length > 0) {
    // Count serp_results per scan in batches
    for (const scanId of scanIds) {
      const { count } = await admin
        .from('serp_results')
        .select('id', { count: 'exact', head: true })
        .eq('scan_id', scanId);
      resultCounts.set(scanId, count || 0);
    }
  }

  const enrichedScans = (scans || []).map(s => ({
    ...s,
    result_count: resultCounts.get(s.id) || 0,
  }));

  return NextResponse.json({ scans: enrichedScans });
}
