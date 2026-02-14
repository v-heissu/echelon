import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

  const admin = createAdminClient();

  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('slug', params.slug)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Auto-complete any running scans that have all tasks done
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

  // Get all completed scans (including just auto-completed ones)
  let { data: scans } = await admin
    .from('scans')
    .select('id, completed_at, started_at')
    .eq('project_id', project.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true });

  // Also include running scans with data if no completed scans
  if (!scans || scans.length === 0) {
    const { data: runningWithData } = await admin
      .from('scans')
      .select('id, completed_at, started_at')
      .eq('project_id', project.id)
      .eq('status', 'running')
      .order('started_at', { ascending: true });

    if (!runningWithData || runningWithData.length === 0) {
      return NextResponse.json({ trends: [], timeline: [] });
    }
    scans = runningWithData.map(s => ({ ...s, completed_at: s.completed_at || s.started_at }));
  }

  // Calculate theme density per scan
  const scanDensities: { scanId: string; date: string; themes: ThemeDensity[] }[] = [];

  for (const scan of scans) {
    const { data: results } = await admin
      .from('serp_results')
      .select('ai_analysis(themes)')
      .eq('scan_id', scan.id);

    const totalResults = results?.length || 1;
    const themeCounts = new Map<string, number>();

    results?.forEach((r) => {
      const raw = r.ai_analysis;
      const a = Array.isArray(raw) ? raw[0] : raw;
      if (a?.themes) {
        for (const t of a.themes) {
          if (!t.name) continue;
          const name = t.name.toLowerCase().trim();
          themeCounts.set(name, (themeCounts.get(name) || 0) + 1);
        }
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
