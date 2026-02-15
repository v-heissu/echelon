import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteResultsByIds } from '@/lib/agents/blacklist';

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
  const entity = searchParams.get('entity');
  const competitor = searchParams.get('competitor');
  const priority = searchParams.get('priority');
  const scanId = searchParams.get('scan_id');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  // Get project with keywords for filter options
  const { data: project } = await admin
    .from('projects')
    .select('id, keywords')
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

  // Use inner join when filtering on ai_analysis columns at DB level
  const needsInnerJoin = !!sentiment || priority === 'true';
  const aiJoin = needsInnerJoin ? 'ai_analysis!inner(*)' : 'ai_analysis(*)';
  const needsPostFilter = !!tag || !!entity;

  // Build query
  let query = admin
    .from('serp_results')
    .select(
      `*, ${aiJoin}, scans!inner(project_id, completed_at)`,
      { count: 'exact' }
    )
    .eq('scans.project_id', project.id);

  if (scanId) query = query.eq('scan_id', scanId);
  if (keyword) query = query.eq('keyword', keyword);
  if (source) query = query.eq('source', source);
  if (competitor === 'true') query = query.eq('is_competitor', true);

  // DB-level filters via inner join
  if (sentiment) query = query.eq('ai_analysis.sentiment', sentiment);
  if (priority === 'true') query = query.eq('ai_analysis.is_hi_priority', true);

  let resultsList;
  let total;

  if (needsPostFilter) {
    // Fetch all for post-filtering, then paginate in-memory
    const { data, error } = await query.order('position', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let filtered = data || [];

    if (tag) {
      filtered = filtered.filter((r) => {
        const raw = r.ai_analysis;
        const a = Array.isArray(raw) ? raw[0] : raw;
        const themes = Array.isArray(a?.themes) ? a.themes : [];
        return themes.some((t: { name?: string }) =>
          t.name?.toLowerCase().includes(tag.toLowerCase())
        );
      });
    }

    if (entity) {
      filtered = filtered.filter((r) => {
        const raw = r.ai_analysis;
        const a = Array.isArray(raw) ? raw[0] : raw;
        const entities = Array.isArray(a?.entities) ? a.entities : [];
        return entities.some((e: { name?: string }) =>
          e.name?.toLowerCase().includes(entity.toLowerCase())
        );
      });
    }

    total = filtered.length;
    resultsList = filtered.slice(offset, offset + limit);
  } else {
    // Standard DB pagination
    const { data, error, count } = await query
      .order('position', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    resultsList = data || [];
    total = count || 0;
  }

  // Get filter options in parallel
  const [scansResult, tagsResult] = await Promise.all([
    admin
      .from('scans')
      .select('id, completed_at, started_at')
      .eq('project_id', project.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(20),
    admin
      .from('tags')
      .select('name, slug, count')
      .eq('project_id', project.id)
      .order('count', { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    results: resultsList,
    total,
    page,
    limit,
    filter_options: {
      keywords: Array.isArray(project.keywords) ? (project.keywords as string[]).sort() : [],
      scans: (scansResult.data || []).map((s) => ({
        id: s.id,
        completed_at: s.completed_at || s.started_at,
      })),
      tags: (tagsResult.data || []).map((t) => t.name as string),
    },
  });
}

/**
 * DELETE /api/projects/[slug]/results
 * Manually delete specific results by ID.
 * Body: { ids: string[] }
 */
export async function DELETE(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('slug', params.slug)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  let ids: string[];
  try {
    const body = await request.json();
    ids = body.ids;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 });
  }

  const deleted = await deleteResultsByIds(project.id, ids);
  return NextResponse.json({ deleted });
}
