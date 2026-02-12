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

  // Get project
  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('slug', params.slug)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Get last 2 completed scans for delta comparison
  const { data: scans } = await admin
    .from('scans')
    .select('id, completed_at')
    .eq('project_id', project.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(2);

  if (!scans || scans.length === 0) {
    return NextResponse.json({
      kpi: { total_results: 0, unique_domains: 0, competitor_mentions: 0, avg_sentiment: 0 },
      delta: { total_results: 0, unique_domains: 0, competitor_mentions: 0, avg_sentiment: 0 },
      sentiment_distribution: [],
      top_domains: [],
      scan_dates: [],
    });
  }

  const currentScanId = scans[0].id;
  const previousScanId = scans.length > 1 ? scans[1].id : null;

  // Current scan KPIs
  const currentKpi = await getScanKPIs(admin, currentScanId);
  const previousKpi = previousScanId ? await getScanKPIs(admin, previousScanId) : null;

  // Sentiment distribution over time
  const { data: allScans } = await admin
    .from('scans')
    .select('id, completed_at')
    .eq('project_id', project.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true })
    .limit(10);

  const sentimentTimeline = [];
  if (allScans) {
    for (const scan of allScans) {
      const { data: analyses } = await admin
        .from('serp_results')
        .select('ai_analysis(sentiment)')
        .eq('scan_id', scan.id);

      const counts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
      analyses?.forEach((r) => {
        const analysis = r.ai_analysis as unknown as { sentiment: string }[] | null;
        if (analysis && analysis[0]) {
          const s = analysis[0].sentiment as keyof typeof counts;
          if (s in counts) counts[s]++;
        }
      });

      sentimentTimeline.push({
        date: scan.completed_at,
        ...counts,
      });
    }
  }

  // Top domains
  const { data: domainResults } = await admin
    .from('serp_results')
    .select('domain, is_competitor')
    .eq('scan_id', currentScanId);

  const domainCounts = new Map<string, { count: number; is_competitor: boolean }>();
  domainResults?.forEach((r) => {
    const existing = domainCounts.get(r.domain) || { count: 0, is_competitor: r.is_competitor };
    existing.count++;
    domainCounts.set(r.domain, existing);
  });

  const topDomains = Array.from(domainCounts.entries())
    .map(([domain, data]) => ({ domain, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Calculate deltas
  const delta = {
    total_results: previousKpi
      ? calcDelta(currentKpi.total_results, previousKpi.total_results)
      : 0,
    unique_domains: previousKpi
      ? calcDelta(currentKpi.unique_domains, previousKpi.unique_domains)
      : 0,
    competitor_mentions: previousKpi
      ? calcDelta(currentKpi.competitor_mentions, previousKpi.competitor_mentions)
      : 0,
    avg_sentiment: previousKpi
      ? Number((currentKpi.avg_sentiment - previousKpi.avg_sentiment).toFixed(2))
      : 0,
  };

  return NextResponse.json({
    kpi: currentKpi,
    delta,
    sentiment_distribution: sentimentTimeline,
    top_domains: topDomains,
    scan_dates: allScans?.map((s) => s.completed_at) || [],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getScanKPIs(client: any, scanId: string) {
  const { data: results } = await client
    .from('serp_results')
    .select('domain, is_competitor, ai_analysis(sentiment_score)')
    .eq('scan_id', scanId);

  const totalResults = results?.length || 0;
  const uniqueDomains = new Set(results?.map((r: { domain: string }) => r.domain)).size;
  const competitorMentions = results?.filter((r: { is_competitor: boolean }) => r.is_competitor).length || 0;

  let sentimentSum = 0;
  let sentimentCount = 0;
  results?.forEach((r: { ai_analysis: unknown }) => {
    const analysis = r.ai_analysis as { sentiment_score: number }[] | null;
    if (analysis && analysis[0]) {
      sentimentSum += analysis[0].sentiment_score;
      sentimentCount++;
    }
  });

  return {
    total_results: totalResults,
    unique_domains: uniqueDomains,
    competitor_mentions: competitorMentions,
    avg_sentiment: sentimentCount > 0 ? Number((sentimentSum / sentimentCount).toFixed(2)) : 0,
  };
}

function calcDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}
