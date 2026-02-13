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

  // Post-filter by sentiment and tag if needed
  let filtered = results || [];

  if (sentiment) {
    filtered = filtered.filter((r) => {
      const analysis = r.ai_analysis as unknown as { sentiment: string }[];
      return analysis?.[0]?.sentiment === sentiment;
    });
  }

  if (tag) {
    filtered = filtered.filter((r) => {
      const analysis = r.ai_analysis as unknown as { themes: { name: string }[] }[];
      return analysis?.[0]?.themes?.some((t) => t.name?.toLowerCase() === tag.toLowerCase());
    });
  }

  return NextResponse.json({
    results: filtered,
    total: count || 0,
    page,
    limit,
  });
}
