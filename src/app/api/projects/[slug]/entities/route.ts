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
  const type = searchParams.get('type') || 'brand';
  const scanId = searchParams.get('scan_id');

  let results;

  if (scanId) {
    // Direct scan_id filter
    const { data } = await admin
      .from('serp_results')
      .select('keyword, domain, url, ai_analysis(entities, sentiment, sentiment_score)')
      .eq('scan_id', scanId);
    results = data;
  } else {
    // Get all scan IDs for this project, then filter serp_results
    const { data: scans } = await admin
      .from('scans')
      .select('id')
      .eq('project_id', project.id)
      .in('status', ['completed', 'running']);

    if (!scans || scans.length === 0) {
      return NextResponse.json({ entities: [] });
    }

    const scanIds = scans.map((s: { id: string }) => s.id);
    const { data } = await admin
      .from('serp_results')
      .select('keyword, domain, url, ai_analysis(entities, sentiment, sentiment_score)')
      .in('scan_id', scanIds);
    results = data;
  }

  if (!results || results.length === 0) {
    return NextResponse.json({ entities: [] });
  }

  const entityMap = new Map<string, {
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
      if (!entity.name || entity.type !== type) continue;
      const key = entity.name.trim();
      if (!key) continue;

      const existing = entityMap.get(key) || {
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

  const entities = Array.from(entityMap.entries())
    .map(([name, data]) => ({
      name,
      type,
      count: data.count,
      domains: Array.from(data.domains).slice(0, 10),
      keywords: Array.from(data.keywords).slice(0, 10),
      avg_sentiment: data.sentimentCount > 0
        ? Number((data.sentimentSum / data.sentimentCount).toFixed(2))
        : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ entities });
}
