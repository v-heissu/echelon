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
  const type = searchParams.get('type'); // brand | person | competitor | null (all)
  const scanId = searchParams.get('scan_id');

  // ── Competitor type: aggregate from serp_results where is_competitor=true ──
  if (type === 'competitor') {
    return await handleCompetitorType(admin, project.id, scanId);
  }

  // ── Brand / Person / All types: aggregate from ai_analysis entities ──
  let results;

  if (scanId) {
    const { data } = await admin
      .from('serp_results')
      .select('keyword, domain, url, ai_analysis(entities, sentiment, sentiment_score)')
      .eq('scan_id', scanId)
      .limit(10000);
    results = data;
  } else {
    const { data: scans } = await admin
      .from('scans')
      .select('id')
      .eq('project_id', project.id)
      .in('status', ['completed', 'running']);

    if (!scans || scans.length === 0) {
      // If no type specified, return grouped empty
      if (!type) {
        return NextResponse.json({ brand: [], person: [] });
      }
      return NextResponse.json({ entities: [] });
    }

    const scanIds = scans.map((s: { id: string }) => s.id);
    const { data } = await admin
      .from('serp_results')
      .select('keyword, domain, url, ai_analysis(entities, sentiment, sentiment_score)')
      .in('scan_id', scanIds)
      .limit(10000);
    results = data;
  }

  if (!results || results.length === 0) {
    if (!type) {
      return NextResponse.json({ brand: [], person: [] });
    }
    return NextResponse.json({ entities: [] });
  }

  // When no type is specified, aggregate ALL entity types and return grouped
  if (!type) {
    return handleAllTypes(results);
  }

  // Single type (brand or person)
  const entities = aggregateEntities(results, type);
  return NextResponse.json({ entities });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface SerpRow {
  keyword: string;
  domain: string;
  url: string;
  ai_analysis: { entities?: { name: string; type: string }[]; sentiment?: string; sentiment_score?: number } | { entities?: { name: string; type: string }[]; sentiment?: string; sentiment_score?: number }[] | null;
}

function aggregateEntities(results: SerpRow[], filterType: string) {
  const entityMap = new Map<string, {
    displayName: string;
    count: number;
    domains: Set<string>;
    keywords: Set<string>;
    sentimentSum: number;
    sentimentCount: number;
  }>();

  for (const r of results) {
    const raw = r.ai_analysis;
    const a = Array.isArray(raw) ? raw[0] : raw;
    if (!a?.entities) continue;

    for (const entity of a.entities) {
      if (!entity.name || entity.type !== filterType) continue;
      const originalName = entity.name.trim();
      const key = originalName.toLowerCase();
      if (!key) continue;

      const existing = entityMap.get(key) || {
        displayName: originalName,
        count: 0,
        domains: new Set<string>(),
        keywords: new Set<string>(),
        sentimentSum: 0,
        sentimentCount: 0,
      };
      existing.count++;
      existing.domains.add(r.domain);
      existing.keywords.add(r.keyword);
      if (a.sentiment_score != null && !isNaN(a.sentiment_score)) {
        existing.sentimentSum += a.sentiment_score;
        existing.sentimentCount++;
      }
      entityMap.set(key, existing);
    }
  }

  return Array.from(entityMap.entries())
    .map(([, data]) => ({
      name: data.displayName,
      type: filterType,
      count: data.count,
      domains: Array.from(data.domains).slice(0, 10),
      keywords: Array.from(data.keywords).slice(0, 10),
      avg_sentiment: data.sentimentCount > 0
        ? Number((data.sentimentSum / data.sentimentCount).toFixed(2))
        : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function handleAllTypes(results: SerpRow[]) {
  const brand = aggregateEntities(results, 'brand');
  const person = aggregateEntities(results, 'person');
  return NextResponse.json({ brand, person });
}

async function handleCompetitorType(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
  scanId: string | null
) {
  let competitorResults;

  if (scanId) {
    const { data } = await admin
      .from('serp_results')
      .select('keyword, domain, position, ai_analysis(sentiment_score)')
      .eq('scan_id', scanId)
      .eq('is_competitor', true);
    competitorResults = data;
  } else {
    const { data: scans } = await admin
      .from('scans')
      .select('id')
      .eq('project_id', projectId)
      .in('status', ['completed', 'running']);

    if (!scans || scans.length === 0) {
      return NextResponse.json({ entities: [] });
    }

    const scanIds = scans.map((s: { id: string }) => s.id);
    const { data } = await admin
      .from('serp_results')
      .select('keyword, domain, position, ai_analysis(sentiment_score)')
      .in('scan_id', scanIds)
      .eq('is_competitor', true);
    competitorResults = data;
  }

  if (!competitorResults || competitorResults.length === 0) {
    return NextResponse.json({ entities: [] });
  }

  const domainMap = new Map<string, {
    count: number;
    keywords: Set<string>;
    positions: number[];
    sentimentSum: number;
    sentimentCount: number;
  }>();

  for (const r of competitorResults) {
    const existing = domainMap.get(r.domain) || {
      count: 0,
      keywords: new Set<string>(),
      positions: [],
      sentimentSum: 0,
      sentimentCount: 0,
    };
    existing.count++;
    existing.keywords.add(r.keyword);
    existing.positions.push(r.position);

    const raw = r.ai_analysis;
    const a = Array.isArray(raw) ? raw[0] : raw;
    if (a?.sentiment_score != null && !isNaN(a.sentiment_score)) {
      existing.sentimentSum += a.sentiment_score;
      existing.sentimentCount++;
    }
    domainMap.set(r.domain, existing);
  }

  const entities = Array.from(domainMap.entries())
    .map(([domain, data]) => ({
      name: domain,
      type: 'competitor' as const,
      count: data.count,
      domains: [domain],
      keywords: Array.from(data.keywords).slice(0, 10),
      avg_sentiment: data.sentimentCount > 0
        ? Number((data.sentimentSum / data.sentimentCount).toFixed(2))
        : 0,
      avg_position: data.positions.length > 0
        ? Number((data.positions.reduce((a, b) => a + b, 0) / data.positions.length).toFixed(1))
        : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ entities });
}
