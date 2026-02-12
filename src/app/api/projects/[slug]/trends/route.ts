import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

interface ThemeDensity {
  theme: string;
  density: number;
  count: number;
}

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', params.slug)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Get all completed scans
  const { data: scans } = await supabase
    .from('scans')
    .select('id, completed_at')
    .eq('project_id', project.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true });

  if (!scans || scans.length === 0) {
    return NextResponse.json({ trends: [], timeline: [] });
  }

  // Calculate theme density per scan
  const scanDensities: { scanId: string; date: string; themes: ThemeDensity[] }[] = [];

  for (const scan of scans) {
    const { data: results } = await supabase
      .from('serp_results')
      .select('ai_analysis(themes)')
      .eq('scan_id', scan.id);

    const totalResults = results?.length || 1;
    const themeCounts = new Map<string, number>();

    results?.forEach((r) => {
      const analysis = r.ai_analysis as unknown as { themes: { name: string }[] }[];
      if (analysis?.[0]?.themes) {
        analysis[0].themes.forEach((t) => {
          const name = t.name.toLowerCase().trim();
          themeCounts.set(name, (themeCounts.get(name) || 0) + 1);
        });
      }
    });

    const themes: ThemeDensity[] = Array.from(themeCounts.entries()).map(([theme, count]) => ({
      theme,
      density: count / totalResults,
      count,
    }));

    scanDensities.push({
      scanId: scan.id,
      date: scan.completed_at || '',
      themes,
    });
  }

  // Calculate trend direction for each theme
  const allThemes = new Set<string>();
  scanDensities.forEach((sd) => sd.themes.forEach((t) => allThemes.add(t.theme)));

  const trends = Array.from(allThemes).map((theme) => {
    const history = scanDensities.map((sd) => {
      const found = sd.themes.find((t) => t.theme === theme);
      return {
        date: sd.date,
        density: found?.density || 0,
        count: found?.count || 0,
      };
    });

    const currentDensity = history[history.length - 1]?.density || 0;

    // Moving average of last 3 scans (excluding current)
    const previousScans = history.slice(Math.max(0, history.length - 4), history.length - 1);
    const avgDensity = previousScans.length > 0
      ? previousScans.reduce((sum, h) => sum + h.density, 0) / previousScans.length
      : 0;

    let direction: 'emerging' | 'stable' | 'declining' | 'new' = 'stable';
    if (previousScans.every((h) => h.density === 0)) {
      direction = 'new';
    } else if (avgDensity > 0 && currentDensity > avgDensity * 1.5) {
      direction = 'emerging';
    } else if (avgDensity > 0 && currentDensity < avgDensity * 0.5) {
      direction = 'declining';
    }

    return {
      theme,
      direction,
      current_density: currentDensity,
      avg_density: avgDensity,
      history,
      total_count: history.reduce((sum, h) => sum + h.count, 0),
    };
  });

  // Sort by current density descending
  trends.sort((a, b) => b.current_density - a.current_density);

  return NextResponse.json({ trends, scan_dates: scans.map((s) => s.completed_at) });
}
