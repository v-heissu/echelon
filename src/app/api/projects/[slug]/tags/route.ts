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
  const { searchParams } = new URL(request.url);
  const scanId = searchParams.get('scan_id');

  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('slug', params.slug)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Get completed scans for the filter dropdown
  const { data: scans } = await admin
    .from('scans')
    .select('id, completed_at, started_at')
    .eq('project_id', project.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(20);

  // Get tags with optional scan filter
  let tags;
  if (scanId) {
    // When filtering by scan, get tags that have tag_scans entries for this scan
    const { data: tagScans } = await admin
      .from('tag_scans')
      .select('tag_id, count, tags!inner(id, project_id, name, slug, count, last_seen_at)')
      .eq('scan_id', scanId)
      .eq('tags.project_id', project.id)
      .order('count', { ascending: false });

    tags = (tagScans || []).map((ts) => {
      const tag = Array.isArray(ts.tags) ? ts.tags[0] : ts.tags;
      return {
        ...tag,
        scan_count: ts.count,
      };
    });
  } else {
    const { data, error } = await admin
      .from('tags')
      .select('*')
      .eq('project_id', project.id)
      .order('count', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If tags table is empty, rebuild from ai_analysis data
    if (!data || data.length === 0) {
      const rebuilt = await rebuildTagsFromAnalysis(admin, project.id);
      return NextResponse.json({
        tags: rebuilt,
        scans: scans || [],
        sparklines: {},
      });
    }
    tags = data;
  }

  // Get sparkline data: tag_scans for all tags in this project across last N scans
  const sparklines: Record<string, { scan_id: string; count: number; date: string }[]> = {};
  const scanIds = (scans || []).map((s) => s.id);

  if (tags && tags.length > 0 && scanIds.length > 0) {
    const tagIds = tags.map((t: { id: string }) => t.id);
    const { data: allTagScans } = await admin
      .from('tag_scans')
      .select('tag_id, scan_id, count')
      .in('tag_id', tagIds)
      .in('scan_id', scanIds);

    // Build a scan_id -> date map
    const scanDateMap = new Map<string, string>();
    (scans || []).forEach((s) => {
      scanDateMap.set(s.id, s.completed_at || s.started_at);
    });

    if (allTagScans) {
      for (const ts of allTagScans) {
        if (!sparklines[ts.tag_id]) sparklines[ts.tag_id] = [];
        sparklines[ts.tag_id].push({
          scan_id: ts.scan_id,
          count: ts.count,
          date: scanDateMap.get(ts.scan_id) || '',
        });
      }
      // Sort each sparkline by date ascending
      for (const tagId of Object.keys(sparklines)) {
        sparklines[tagId].sort((a, b) => a.date.localeCompare(b.date));
      }
    }
  }

  return NextResponse.json({
    tags: tags || [],
    scans: scans || [],
    sparklines,
  });
}

export async function POST(
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

  // Rebuild from analysis data (deletes existing tags internally)
  const rebuilt = await rebuildTagsFromAnalysis(admin, project.id);
  return NextResponse.json({ tags: rebuilt, rebuilt: true });
}

function normalizeTagSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rebuildTagsFromAnalysis(admin: any, projectId: string) {
  // First get all scan IDs for this project
  const { data: scans, error: scansError } = await admin
    .from('scans')
    .select('id')
    .eq('project_id', projectId)
    .in('status', ['completed', 'running']);

  if (scansError) {
    console.error('[rebuildTags] Error fetching scans:', scansError.message);
    return [];
  }
  if (!scans || scans.length === 0) {
    console.log('[rebuildTags] No scans found for project', projectId);
    return [];
  }

  const scanIds = scans.map((s: { id: string }) => s.id);
  console.log('[rebuildTags] Found', scanIds.length, 'scans, fetching ai_analysis...');

  // Get serp_results for these scans with their ai_analysis
  const { data: results, error: resultsError } = await admin
    .from('serp_results')
    .select('ai_analysis(themes, sentiment_score)')
    .in('scan_id', scanIds);

  if (resultsError) {
    console.error('[rebuildTags] Error fetching serp_results:', resultsError.message);
    return [];
  }
  if (!results || results.length === 0) {
    console.log('[rebuildTags] No serp_results found for scans');
    return [];
  }

  console.log('[rebuildTags] Processing', results.length, 'serp_results');
  const themeMap = new Map<string, number>();
  let analysisCount = 0;

  for (const r of results) {
    const raw = r.ai_analysis;
    const a = Array.isArray(raw) ? raw[0] : raw;
    if (!a?.themes) continue;
    analysisCount++;

    const themes = Array.isArray(a.themes) ? a.themes : [];
    for (const theme of themes) {
      if (!theme.name) continue;
      const name = theme.name.toLowerCase().trim();
      if (!name) continue;
      themeMap.set(name, (themeMap.get(name) || 0) + 1);
    }
  }

  console.log('[rebuildTags]', analysisCount, 'results with analysis,', themeMap.size, 'unique themes');

  if (themeMap.size === 0) return [];

  // Delete existing tags and rebuild (single delete - not redundant)
  await admin.from('tags').delete().eq('project_id', projectId);

  const tagsToInsert = Array.from(themeMap.entries())
    .map(([name, count]) => {
      const slug = normalizeTagSlug(name);
      return slug ? { project_id: projectId, name, slug, count, last_seen_at: new Date().toISOString() } : null;
    })
    .filter(Boolean);

  if (tagsToInsert.length === 0) return [];

  const { data: inserted, error: insertError } = await admin
    .from('tags')
    .insert(tagsToInsert)
    .select();

  if (insertError) {
    console.error('[rebuildTags] Error inserting tags:', insertError.message);
    return tagsToInsert.map((t, i) => ({ id: `rebuilt-${i}`, ...t }));
  }

  console.log('[rebuildTags] Inserted', inserted?.length || 0, 'tags');
  return inserted || tagsToInsert.map((t, i) => ({ id: `rebuilt-${i}`, ...t }));
}
