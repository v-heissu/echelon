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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rebuildTagsFromAnalysis(admin: any, projectId: string) {
  const { data: results } = await admin
    .from('serp_results')
    .select('ai_analysis(themes, sentiment_score), scans!inner(project_id)')
    .eq('scans.project_id', projectId);

  if (!results || results.length === 0) return [];

  const themeMap = new Map<string, number>();

  for (const r of results) {
    const analysis = r.ai_analysis as unknown as { themes: { name: string }[] }[];
    const a = Array.isArray(analysis) ? analysis[0] : analysis;
    if (!a?.themes) continue;

    for (const theme of a.themes) {
      if (!theme.name) continue;
      const name = theme.name.toLowerCase().trim();
      if (!name) continue;
      themeMap.set(name, (themeMap.get(name) || 0) + 1);
    }
  }

  if (themeMap.size === 0) return [];

  const tagsToInsert = Array.from(themeMap.entries()).map(([name, count]) => ({
    project_id: projectId,
    name,
    slug: name.replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
    count,
    last_seen_at: new Date().toISOString(),
  }));

  const { data: inserted } = await admin
    .from('tags')
    .upsert(tagsToInsert, { onConflict: 'project_id,slug' })
    .select();

  return inserted || tagsToInsert.map((t, i) => ({ id: `rebuilt-${i}`, ...t }));
}
