import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runContextFilterBatch, resetFilterEvaluations } from '@/lib/agents/context-filter';

export const maxDuration = 60;

/**
 * POST /api/projects/[slug]/filter
 * Browser-driven batch processing: each call processes ONE batch.
 * Client calls in a loop until remaining === 0.
 *
 * Body:
 *  - force?: boolean  (on first call: reset all previous evaluations)
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
  let force = false;
  try {
    const body = await request.json();
    scanId = body.scan_id || null;
    force = body.force === true;
  } catch {
    // No body or invalid JSON — that's fine
  }

  try {
    // If force, reset first (idempotent, only resets rows that have evaluations)
    if (force) {
      await resetFilterEvaluations(project.id, scanId);
    }

    // Process one batch
    const result = await runContextFilterBatch(project.id, scanId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
