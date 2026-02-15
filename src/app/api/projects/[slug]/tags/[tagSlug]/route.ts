import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string; tagSlug: string } }
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

  // Decode tag slug
  const tagSlug = decodeURIComponent(params.tagSlug);

  // Look up the tag by slug or name
  let { data: tag } = await admin
    .from('tags')
    .select('*')
    .eq('project_id', project.id)
    .eq('slug', tagSlug)
    .maybeSingle();

  if (!tag) {
    // Try matching by name (case insensitive via lowered comparison)
    const { data: tags } = await admin
      .from('tags')
      .select('*')
      .eq('project_id', project.id);

    tag = tags?.find(
      (t: { name: string; slug: string }) =>
        t.name.toLowerCase() === tagSlug.toLowerCase() ||
        t.slug === tagSlug
    ) || null;
  }

  if (!tag) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  }

  // Get all scans for this project
  const { data: scans } = await admin
    .from('scans')
    .select('id, completed_at, started_at')
    .eq('project_id', project.id)
    .in('status', ['completed', 'running'])
    .order('completed_at', { ascending: true });

  if (!scans || scans.length === 0) {
    return NextResponse.json({
      tag: { name: tag.name, slug: tag.slug, count: tag.count, last_seen_at: tag.last_seen_at },
      results: [],
      density_history: [],
      related_entities: [],
      keyword_distribution: [],
    });
  }

  const scanIds = scans.map((s: { id: string }) => s.id);

  // Query serp_results with ai_analysis that contain this tag name in themes
  const { data: allResults } = await admin
    .from('serp_results')
    .select('id, title, url, domain, keyword, source, position, scan_id, ai_analysis(themes, sentiment, sentiment_score, summary, entities)')
    .in('scan_id', scanIds);

  // Filter results where themes array contains this tag name
  const tagName = tag.name.toLowerCase().trim();

  interface AiAnalysisRow {
    themes?: { name: string; confidence?: number }[];
    sentiment?: string;
    sentiment_score?: number;
    summary?: string;
    entities?: { name: string; type: string }[];
  }

  interface SerpRow {
    id: string;
    title: string;
    url: string;
    domain: string;
    keyword: string;
    source: string;
    position: number;
    scan_id: string;
    ai_analysis: AiAnalysisRow | AiAnalysisRow[] | null;
  }

  const matchingResults: {
    id: string;
    title: string;
    url: string;
    domain: string;
    keyword: string;
    source: string;
    position: number;
    sentiment: string;
    sentiment_score: number;
    summary: string;
    scan_id: string;
  }[] = [];

  // Track co-occurring entities
  const entityMap = new Map<string, { type: string; count: number }>();
  // Track keyword distribution
  const keywordMap = new Map<string, number>();
  // Track density per scan
  const scanResultCounts = new Map<string, { total: number; tagged: number }>();

  // Initialize scan counts
  for (const scan of scans) {
    scanResultCounts.set(scan.id, { total: 0, tagged: 0 });
  }

  for (const r of (allResults || []) as SerpRow[]) {
    const raw = r.ai_analysis;
    const a: AiAnalysisRow | null = Array.isArray(raw) ? raw[0] || null : raw;

    // Count total results per scan
    const scanCount = scanResultCounts.get(r.scan_id);
    if (scanCount) {
      scanCount.total++;
    }

    if (!a?.themes) continue;

    const themes = Array.isArray(a.themes) ? a.themes : [];
    const hasTag = themes.some(
      (t) => t.name && t.name.toLowerCase().trim() === tagName
    );

    if (!hasTag) continue;

    // Count tagged results per scan
    if (scanCount) {
      scanCount.tagged++;
    }

    matchingResults.push({
      id: r.id,
      title: r.title,
      url: r.url,
      domain: r.domain,
      keyword: r.keyword,
      source: r.source,
      position: r.position,
      sentiment: a.sentiment || 'neutral',
      sentiment_score: a.sentiment_score ?? 0,
      summary: a.summary || '',
      scan_id: r.scan_id,
    });

    // Collect co-occurring entities
    if (a.entities) {
      for (const entity of a.entities) {
        if (!entity.name || !entity.type) continue;
        const key = `${entity.name}|||${entity.type}`;
        const existing = entityMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          entityMap.set(key, { type: entity.type, count: 1 });
        }
      }
    }

    // Collect keyword distribution
    keywordMap.set(r.keyword, (keywordMap.get(r.keyword) || 0) + 1);
  }

  // Build density history
  const density_history = scans.map((scan: { id: string; completed_at: string; started_at: string }) => {
    const counts = scanResultCounts.get(scan.id) || { total: 0, tagged: 0 };
    const density = counts.total > 0 ? counts.tagged / counts.total : 0;
    return {
      date: scan.completed_at || scan.started_at || '',
      density,
      count: counts.tagged,
    };
  });

  // Build related entities array
  const related_entities = Array.from(entityMap.entries())
    .map(([key, data]) => {
      const [name, type] = key.split('|||');
      return { name, type: type || 'unknown', count: data.count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  // Build keyword distribution array
  const keyword_distribution = Array.from(keywordMap.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    tag: {
      name: tag.name,
      slug: tag.slug,
      count: tag.count,
      last_seen_at: tag.last_seen_at,
    },
    results: matchingResults,
    density_history,
    related_entities,
    keyword_distribution,
  });
}
