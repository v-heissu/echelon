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

  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('slug', params.slug)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: tags, error } = await admin
    .from('tags')
    .select('*')
    .eq('project_id', project.id)
    .order('count', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If tags table is empty, rebuild from ai_analysis data
  if (!tags || tags.length === 0) {
    const rebuilt = await rebuildTagsFromAnalysis(admin, project.id);
    return NextResponse.json(rebuilt);
  }

  return NextResponse.json(tags);
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

  // Delete existing tags for this project
  await admin.from('tags').delete().eq('project_id', project.id);

  // Rebuild from analysis data
  const rebuilt = await rebuildTagsFromAnalysis(admin, project.id);
  return NextResponse.json({ tags: rebuilt, rebuilt: true });
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

  // Delete existing tags first to avoid duplicates (no unique constraint on project_id,slug)
  await admin.from('tags').delete().eq('project_id', projectId);

  const tagsToInsert = Array.from(themeMap.entries()).map(([name, count]) => ({
    project_id: projectId,
    name,
    slug: name.replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
    count,
    last_seen_at: new Date().toISOString(),
  }));

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
