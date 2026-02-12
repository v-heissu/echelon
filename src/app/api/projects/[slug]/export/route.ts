import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { generateExcel } from '@/lib/export/excel';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const scanId = searchParams.get('scan_id');

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, competitors')
    .eq('slug', params.slug)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Get results
  let query = supabase
    .from('serp_results')
    .select('*, ai_analysis(*), scans!inner(project_id, completed_at)')
    .eq('scans.project_id', project.id)
    .order('position', { ascending: true });

  if (scanId) {
    query = query.eq('scan_id', scanId);
  }

  const { data: results } = await query;

  // Map to expected format
  const mappedResults = (results || []).map((r) => ({
    ...r,
    ai_analysis: Array.isArray(r.ai_analysis) ? r.ai_analysis[0] || null : r.ai_analysis,
  }));

  // Generate trend summaries
  const themeMap = new Map<string, {
    count: number;
    sentimentSum: number;
    firstSeen: string;
    lastSeen: string;
  }>();

  mappedResults.forEach((r) => {
    const analysis = r.ai_analysis;
    if (!analysis?.themes) return;
    const date = r.fetched_at || '';
    (analysis.themes as { name: string }[]).forEach((t) => {
      const existing = themeMap.get(t.name) || {
        count: 0,
        sentimentSum: 0,
        firstSeen: date,
        lastSeen: date,
      };
      existing.count++;
      existing.sentimentSum += analysis.sentiment_score || 0;
      if (date < existing.firstSeen) existing.firstSeen = date;
      if (date > existing.lastSeen) existing.lastSeen = date;
      themeMap.set(t.name, existing);
    });
  });

  const trends = Array.from(themeMap.entries()).map(([theme, data]) => ({
    theme,
    total_occurrences: data.count,
    avg_sentiment: data.count > 0 ? Number((data.sentimentSum / data.count).toFixed(2)) : 0,
    first_seen: data.firstSeen ? new Date(data.firstSeen).toLocaleDateString('it-IT') : '',
    last_seen: data.lastSeen ? new Date(data.lastSeen).toLocaleDateString('it-IT') : '',
    trend_direction: 'stable' as const,
  }));

  // Generate competitor summaries
  const compResults = mappedResults.filter((r) => r.is_competitor);

  const compMap = new Map<string, {
    mentions: number;
    keywords: Set<string>;
    positions: number[];
    themes: Map<string, number>;
    sentimentSum: number;
  }>();

  compResults.forEach((r) => {
    const existing = compMap.get(r.domain) || {
      mentions: 0,
      keywords: new Set<string>(),
      positions: [],
      themes: new Map<string, number>(),
      sentimentSum: 0,
    };
    existing.mentions++;
    existing.keywords.add(r.keyword);
    existing.positions.push(r.position);
    const analysis = r.ai_analysis;
    if (analysis) {
      existing.sentimentSum += analysis.sentiment_score || 0;
      (analysis.themes as { name: string }[] || []).forEach((t) => {
        existing.themes.set(t.name, (existing.themes.get(t.name) || 0) + 1);
      });
    }
    compMap.set(r.domain, existing);
  });

  const competitorSummaries = Array.from(compMap.entries()).map(([domain, data]) => ({
    domain,
    total_mentions: data.mentions,
    keywords: Array.from(data.keywords),
    avg_position: data.positions.length > 0
      ? Number((data.positions.reduce((a, b) => a + b, 0) / data.positions.length).toFixed(1))
      : 0,
    dominant_themes: Array.from(data.themes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name),
    avg_sentiment: data.mentions > 0
      ? Number((data.sentimentSum / data.mentions).toFixed(2))
      : 0,
  }));

  const buffer = await generateExcel(mappedResults, trends, competitorSummaries);

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="echelon-${params.slug}-${new Date().toISOString().split('T')[0]}.xlsx"`,
    },
  });
}
