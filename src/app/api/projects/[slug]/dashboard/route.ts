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

  // Auto-complete any running scans that have all tasks done (fixes stuck scans)
  const { data: runningScans } = await admin
    .from('scans')
    .select('id, total_tasks, completed_tasks')
    .eq('project_id', project.id)
    .eq('status', 'running');

  if (runningScans) {
    for (const scan of runningScans) {
      if (scan.total_tasks > 0 && scan.completed_tasks >= scan.total_tasks) {
        await admin
          .from('scans')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', scan.id);
      }
    }
  }

  // Check if there's a currently running scan (for progress indicator)
  const { data: activeScan } = await admin
    .from('scans')
    .select('id, total_tasks, completed_tasks, started_at')
    .eq('project_id', project.id)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  // Get last 2 completed scans for delta comparison
  const { data: scans } = await admin
    .from('scans')
    .select('id, completed_at')
    .eq('project_id', project.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(2);

  // If no completed scans, try to show data from a running scan
  let fallbackScanId: string | null = null;
  if ((!scans || scans.length === 0) && !activeScan) {
    // Check for any scan with data (running or otherwise)
    const { data: anyScan } = await admin
      .from('scans')
      .select('id')
      .eq('project_id', project.id)
      .in('status', ['running', 'completed'])
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    if (anyScan) fallbackScanId = anyScan.id;
  }

  // Get total scan count for AI briefing messaging
  const { count: scanCount } = await admin
    .from('scans')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .eq('status', 'completed');

  // Get AI briefing from the latest completed scan
  const { data: latestScanWithBriefing } = await admin
    .from('scans')
    .select('ai_briefing')
    .eq('project_id', project.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const aiBriefing: string | null = latestScanWithBriefing?.ai_briefing || null;

  const emptyResponse = {
    kpi: { total_results: 0, unique_domains: 0, competitor_mentions: 0, avg_sentiment: 0, alert_count: 0 },
    delta: { total_results: 0, unique_domains: 0, competitor_mentions: 0, avg_sentiment: 0, alert_count: 0 },
    sentiment_distribution: [],
    top_domains: [],
    theme_sentiments: [] as { name: string; count: number; sentiment: string; sentiment_score: number }[],
    publication_timeline: [] as { date: string; count: number }[],
    scan_dates: [],
    active_scan: activeScan ? {
      id: activeScan.id,
      total_tasks: activeScan.total_tasks,
      completed_tasks: activeScan.completed_tasks,
    } : null,
    ai_briefing: aiBriefing,
    scan_count: scanCount || 0,
  };

  if ((!scans || scans.length === 0) && !fallbackScanId && !activeScan) {
    return NextResponse.json(emptyResponse);
  }

  // Use fallback scan if no completed scans exist but running scan has data
  if ((!scans || scans.length === 0) && !fallbackScanId && activeScan) {
    fallbackScanId = activeScan.id;
  }

  // Determine which scan to show KPIs for
  const hasCompletedScans = scans && scans.length > 0;
  const currentScanId = hasCompletedScans ? scans[0].id : (fallbackScanId || activeScan?.id);
  const previousScanId = hasCompletedScans && scans.length > 1 ? scans[1].id : null;

  if (!currentScanId) {
    return NextResponse.json(emptyResponse);
  }

  // Current scan KPIs
  const currentKpi = await getScanKPIs(admin, currentScanId);
  const previousKpi = previousScanId ? await getScanKPIs(admin, previousScanId) : null;

  // Sentiment distribution over time (include both completed and running scans with data)
  const { data: allScans } = await admin
    .from('scans')
    .select('id, completed_at, started_at, date_from, date_to, status')
    .eq('project_id', project.id)
    .in('status', ['completed', 'running'])
    .order('started_at', { ascending: true })
    .limit(10);

  const sentimentTimeline = [];
  if (allScans) {
    for (const scan of allScans) {
      const { data: analyses } = await admin
        .from('serp_results')
        .select('ai_analysis(sentiment)')
        .eq('scan_id', scan.id);

      if (!analyses || analyses.length === 0) continue;

      const counts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
      analyses.forEach((r) => {
        const raw = r.ai_analysis;
        const a = Array.isArray(raw) ? raw[0] : raw;
        if (a?.sentiment) {
          const s = a.sentiment as keyof typeof counts;
          if (s in counts) counts[s]++;
        }
      });

      // Use date_to (period end) as the chart date — this is unique per scan.
      // date_from can collide: scan 1 (date_from=null) falls back to date_to
      // which equals scan 2's date_from.
      sentimentTimeline.push({
        date: scan.date_to || scan.date_from || scan.started_at,
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

  // Theme sentiments: compute average sentiment per theme from current scan
  const themeSentiments: { name: string; count: number; sentiment: string; sentiment_score: number }[] = [];
  {
    const { data: themeResults } = await admin
      .from('serp_results')
      .select('ai_analysis!inner(themes, sentiment, sentiment_score)')
      .eq('scan_id', currentScanId);

    if (themeResults) {
      const themeMap = new Map<string, { count: number; scoreSum: number; scoreCount: number; sentiments: Record<string, number> }>();
      themeResults.forEach((r) => {
        const raw = r.ai_analysis;
        const a = Array.isArray(raw) ? raw[0] : raw;
        if (a?.themes) {
          for (const t of a.themes) {
            if (!t.name) continue;
            const name = t.name.toLowerCase().trim();
            const existing = themeMap.get(name) || { count: 0, scoreSum: 0, scoreCount: 0, sentiments: {} };
            existing.count++;
            existing.scoreSum += a.sentiment_score || 0;
            existing.scoreCount++;
            const s = a.sentiment || 'neutral';
            existing.sentiments[s] = (existing.sentiments[s] || 0) + 1;
            themeMap.set(name, existing);
          }
        }
      });

      for (const [name, data] of Array.from(themeMap.entries())) {
        const avgScore = data.scoreCount > 0 ? data.scoreSum / data.scoreCount : 0;
        const dominantSentiment = Object.entries(data.sentiments).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
        themeSentiments.push({
          name,
          count: data.count,
          sentiment: dominantSentiment,
          sentiment_score: Number(avgScore.toFixed(2)),
        });
      }
      themeSentiments.sort((a, b) => b.count - a.count);
    }
  }

  // Publication timeline: one entry per scan (all completed scans, no limit)
  const publicationTimeline: { date: string; count: number; scanId: string }[] = [];
  {
    const { data: timelineScans } = await admin
      .from('scans')
      .select('id, completed_at, started_at, date_from, date_to')
      .eq('project_id', project.id)
      .eq('status', 'completed')
      .order('started_at', { ascending: true });

    if (timelineScans && timelineScans.length > 0) {
      // Use count queries per scan to avoid Supabase default 1000-row limit
      const countPromises = timelineScans.map(async (scan) => {
        const { count } = await admin
          .from('serp_results')
          .select('id', { count: 'exact', head: true })
          .eq('scan_id', scan.id);
        return { scan, count: count || 0 };
      });

      const scanCounts = await Promise.all(countPromises);

      for (const { scan, count } of scanCounts) {
        if (count === 0) continue;
        // Use date_to (period end) as the timeline date — unique per scan.
        // date_from can collide with next scan's date_from when first scan has date_from=null.
        publicationTimeline.push({
          date: scan.date_to || scan.date_from || scan.started_at,
          count,
          scanId: scan.id,
        });
      }

      // Sort by displayed date (not started_at) so timeline is chronological
      publicationTimeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
  }

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
    alert_count: previousKpi
      ? calcDelta(currentKpi.alert_count, previousKpi.alert_count)
      : 0,
  };

  return NextResponse.json({
    kpi: currentKpi,
    delta,
    sentiment_distribution: sentimentTimeline,
    top_domains: topDomains,
    theme_sentiments: themeSentiments.slice(0, 30),
    publication_timeline: publicationTimeline,
    scan_dates: allScans?.map((s) => s.completed_at || s.started_at) || [],
    active_scan: activeScan ? {
      id: activeScan.id,
      total_tasks: activeScan.total_tasks,
      completed_tasks: activeScan.completed_tasks,
    } : null,
    ai_briefing: aiBriefing,
    scan_count: scanCount || 0,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getScanKPIs(client: any, scanId: string) {
  const { data: results } = await client
    .from('serp_results')
    .select('domain, is_competitor, ai_analysis(sentiment_score, is_hi_priority)')
    .eq('scan_id', scanId);

  const totalResults = results?.length || 0;
  const uniqueDomains = new Set(results?.map((r: { domain: string }) => r.domain)).size;
  const competitorMentions = results?.filter((r: { is_competitor: boolean }) => r.is_competitor).length || 0;

  let sentimentSum = 0;
  let sentimentCount = 0;
  let alertCount = 0;
  results?.forEach((r: { ai_analysis: unknown }) => {
    const raw = r.ai_analysis;
    const a = Array.isArray(raw) ? raw[0] : raw;
    if (a?.sentiment_score != null) {
      sentimentSum += a.sentiment_score;
      sentimentCount++;
    }
    if (a?.is_hi_priority) {
      alertCount++;
    }
  });

  return {
    total_results: totalResults,
    unique_domains: uniqueDomains,
    competitor_mentions: competitorMentions,
    avg_sentiment: sentimentCount > 0 ? Number((sentimentSum / sentimentCount).toFixed(2)) : 0,
    alert_count: alertCount,
  };
}

function calcDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}
