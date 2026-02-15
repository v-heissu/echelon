import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteResultsByTagForProject } from '@/lib/agents/blacklist';

/**
 * GET /api/projects/[slug]/tag-blacklist
 * Returns the list of blacklisted tags for the project.
 */
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

  const { data: blacklist, error } = await admin
    .from('tag_blacklist')
    .select('id, tag_name, created_at')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ blacklist: blacklist || [] });
}

/**
 * POST /api/projects/[slug]/tag-blacklist
 * Adds a tag to the blacklist and deletes all matching results.
 * Body: { tag: string }
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

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  let tag: string;
  try {
    const body = await request.json();
    tag = body.tag?.trim()?.toLowerCase();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!tag) return NextResponse.json({ error: 'Tag name required' }, { status: 400 });

  // 1. Add to blacklist (upsert to handle duplicates)
  const { error: insertError } = await admin
    .from('tag_blacklist')
    .upsert(
      { project_id: project.id, tag_name: tag },
      { onConflict: 'project_id,tag_name' }
    );

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 2. Delete all results with this tag
  const deleted = await deleteResultsByTagForProject(project.id, tag);

  return NextResponse.json({ tag, deleted, blacklisted: true });
}

/**
 * DELETE /api/projects/[slug]/tag-blacklist
 * Removes a tag from the blacklist (does NOT restore deleted results).
 * Body: { tag: string }
 */
export async function DELETE(
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

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  let tag: string;
  try {
    const body = await request.json();
    tag = body.tag?.trim()?.toLowerCase();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!tag) return NextResponse.json({ error: 'Tag name required' }, { status: 400 });

  const { error } = await admin
    .from('tag_blacklist')
    .delete()
    .eq('project_id', project.id)
    .eq('tag_name', tag);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tag, removed: true });
}
