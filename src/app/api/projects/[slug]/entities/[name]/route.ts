import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: { slug: string; name: string } }
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

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'brand';
  const entityName = decodeURIComponent(params.name);
  const entityNameLower = entityName.toLowerCase();

  // Get all scan IDs for this project
  const { data: scans } = await admin
    .from('scans')
    .select('id, started_at, completed_at')
    .eq('project_id', project.id)
    .in('status', ['completed', 'running']);

  if (!scans || scans.length === 0) {
    return NextResponse.json({
      entity: { name: entityName, type, count: 0, avg_sentiment: 0, keywords: [], domains: [] },
      results: [],
      sentiment_history: [],
      related_themes: [],
      related_entities: [],
    });
  }

  const scanIds = scans.map((s: { id: string }) => s.id);

  // Build a map of scan_id -> scan_date for sentiment history
  const scanDateMap = new Map<string, string>();
  scans.forEach((s) => {
    const scanDate = (s.completed_at || s.started_at || '').substring(0, 10);
    if (scanDate) scanDateMap.set(s.id, scanDate);
  });

  // Fetch all serp_results with ai_analysis for the project scans
  const { data: allResults } = await admin
    .from('serp_results')
    .select('id, title, url, domain, keyword, source, position, is_competitor, scan_id, fetched_at, ai_analysis(entities, sentiment, sentiment_score, summary, themes)')
    .in('scan_id', scanIds)
    .limit(10000);

  if (!allResults || allResults.length === 0) {
    return NextResponse.json({
      entity: { name: entityName, type, count: 0, avg_sentiment: 0, keywords: [], domains: [] },
      results: [],
      sentiment_history: [],
      related_themes: [],
      related_entities: [],
    });
  }

  // Filter results that match this entity
  interface MatchedResult {
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
    themes: { name: string; confidence?: number }[];
    scan_date: string;
    entities: { name: string; type: string }[];
  }

  const matchedResults: MatchedResult[] = [];
  const keywords = new Set<string>();
  const domains = new Set<string>();
  let sentimentSum = 0;
  let sentimentCount = 0;

  // Theme and entity co-occurrence counters
  const themeMap = new Map<string, number>();
  const relatedEntityMap = new Map<string, { type: string; count: number }>();

  // Sentiment history by date
  const sentimentByDate = new Map<string, { scoreSum: number; scoreCount: number }>();

  for (const r of allResults) {
    const raw = r.ai_analysis;
    const a = Array.isArray(raw) ? raw[0] : raw;
    if (!a) continue;

    let matches = false;

    if (type === 'competitor') {
      // For competitor type, match by domain (case-insensitive)
      if (r.domain?.toLowerCase() === entityNameLower) {
        matches = true;
      }
    } else {
      // For brand/person, match by entity name in the entities array (case-insensitive)
      if (a.entities && Array.isArray(a.entities)) {
        for (const entity of a.entities) {
          if (entity.name?.trim().toLowerCase() === entityNameLower && entity.type === type) {
            matches = true;
            break;
          }
        }
      }
    }

    if (!matches) continue;

    const scanDate = scanDateMap.get(r.scan_id) || '';
    const themes = Array.isArray(a.themes) ? a.themes : [];
    const entities = Array.isArray(a.entities) ? a.entities : [];

    matchedResults.push({
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
      themes,
      scan_date: scanDate,
      entities,
    });

    keywords.add(r.keyword);
    domains.add(r.domain);

    if (a.sentiment_score != null && !isNaN(a.sentiment_score)) {
      sentimentSum += a.sentiment_score;
      sentimentCount++;
    }

    // Accumulate sentiment history by date
    if (scanDate && a.sentiment_score != null && !isNaN(a.sentiment_score)) {
      const existing = sentimentByDate.get(scanDate) || { scoreSum: 0, scoreCount: 0 };
      existing.scoreSum += a.sentiment_score;
      existing.scoreCount++;
      sentimentByDate.set(scanDate, existing);
    }

    // Count co-occurring themes
    for (const t of themes) {
      if (t.name) {
        const themeName = t.name.toLowerCase().trim();
        themeMap.set(themeName, (themeMap.get(themeName) || 0) + 1);
      }
    }

    // Count co-occurring entities (excluding self)
    for (const e of entities) {
      if (!e.name) continue;
      const eName = e.name.trim();
      if (eName === entityName) continue;
      const key = `${eName}::${e.type || 'unknown'}`;
      const existing = relatedEntityMap.get(key) || { type: e.type || 'unknown', count: 0 };
      existing.count++;
      relatedEntityMap.set(key, existing);
    }
  }

  // Build entity summary
  const entity = {
    name: entityName,
    type,
    count: matchedResults.length,
    avg_sentiment: sentimentCount > 0
      ? Number((sentimentSum / sentimentCount).toFixed(2))
      : 0,
    keywords: Array.from(keywords).slice(0, 20),
    domains: Array.from(domains).slice(0, 20),
  };

  // Build sentiment history sorted by date
  const sentiment_history = Array.from(sentimentByDate.entries())
    .map(([date, data]) => ({
      date,
      score: Number((data.scoreSum / data.scoreCount).toFixed(2)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Build related themes sorted by count
  const related_themes = Array.from(themeMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  // Build related entities sorted by count
  const related_entities = Array.from(relatedEntityMap.entries())
    .map(([key, data]) => {
      const [name] = key.split('::');
      return { name, type: data.type, count: data.count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  // Sort results by position ascending
  matchedResults.sort((a, b) => a.position - b.position);

  return NextResponse.json({
    entity,
    results: matchedResults,
    sentiment_history,
    related_themes,
    related_entities,
  });
}
