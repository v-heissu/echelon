import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runTagNormalizer } from '@/lib/agents/tag-normalizer';

export const maxDuration = 300;

/**
 * POST /api/projects/[slug]/normalize-tags
 * One-shot: run the tag-normalizer agent for a specific project.
 */
export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('slug', params.slug)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  try {
    const result = await runTagNormalizer(project.id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
