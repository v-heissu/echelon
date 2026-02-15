import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runContextFilterBatch } from '@/lib/agents/context-filter';

export const maxDuration = 60;

/**
 * POST /api/projects/[slug]/filter
 * Browser-driven batch processing: each call processes ONE batch.
 * Off-topic results are hard-deleted.
 * Client calls in a loop until remaining === 0.
 *
 * Body:
 *  - scan_id?: string (optional: limit to a specific scan)
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

  let scanId: string | null = null;
  try {
    const body = await request.json();
    scanId = body.scan_id || null;
  } catch {
    // No body or invalid JSON — that's fine
  }

  try {
    const result = await runContextFilterBatch(project.id, scanId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
