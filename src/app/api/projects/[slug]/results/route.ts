import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  const source = searchParams.get('source');
  const sentiment = searchParams.get('sentiment');
  const tag = searchParams.get('tag');
  const competitor = searchParams.get('competitor');
  const priority = searchParams.get('priority');
  const scanId = searchParams.get('scan_id');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  // Get project
  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('slug', params.slug)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Verify access: admin sees all, clients only assigned projects
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

  // Build query
  let query = admin
    .from('serp_results')
    .select(
      '*, ai_analysis(*), scans!inner(project_id, completed_at)',
      { count: 'exact' }
    )
    .eq('scans.project_id', project.id);

  if (scanId) {
    query = query.eq('scan_id', scanId);
  }
  if (keyword) {
    query = query.eq('keyword', keyword);
  }
  if (source) {
    query = query.eq('source', source);
  }
  if (competitor === 'true') {
    query = query.eq('is_competitor', true);
  }
  if (sentiment) {
    query = query.not('ai_analysis', 'is', null);
  }

  const { data: results, error, count } = await query
    .order('position', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Post-filter by sentiment and tag if needed (ai_analysis may be array or object from Supabase)
  let filtered = results || [];

  if (sentiment) {
    filtered = filtered.filter((r) => {
      const raw = r.ai_analysis;
      const a = Array.isArray(raw) ? raw[0] : raw;
      return a?.sentiment === sentiment;
    });
  }

  if (tag) {
    filtered = filtered.filter((r) => {
      const raw = r.ai_analysis;
      const a = Array.isArray(raw) ? raw[0] : raw;
      const themes = Array.isArray(a?.themes) ? a.themes : [];
      return themes.some((t: { name?: string }) => t.name?.toLowerCase() === tag.toLowerCase());
    });
  }

  if (priority === 'true') {
    filtered = filtered.filter((r) => {
      const raw = r.ai_analysis;
      const a = Array.isArray(raw) ? raw[0] : raw;
      return a?.is_hi_priority === true;
    });
  }

  // Adjust total count when post-filtering (since DB count doesn't reflect post-filters)
  const adjustedTotal = (sentiment || tag || priority) ? filtered.length : (count || 0);

  return NextResponse.json({
    results: filtered,
    total: adjustedTotal,
    page,
    limit,
  });
}
