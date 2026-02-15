import { NextResponse } from 'next/server';
import { runTagNormalizerAll } from '@/lib/agents/tag-normalizer';

export const maxDuration = 300;

/**
 * GET /api/cron/tag-normalizer
 * Periodic: run the tag-normalizer agent for all active projects
 * that haven't been normalized in the last 7 days (168h).
 * Protected by CRON_SECRET bearer token.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await runTagNormalizerAll(168);

    const summary = {
      projects_processed: results.length,
      total_tags: results.reduce((sum, r) => sum + r.total_tags, 0),
      total_groups: results.reduce((sum, r) => sum + r.groups_found, 0),
      total_merged: results.reduce((sum, r) => sum + r.tags_merged, 0),
      total_remaining: results.reduce((sum, r) => sum + r.tags_remaining, 0),
      errors: results.flatMap((r) => r.errors),
      details: results.map((r) => ({
        project: r.project_slug,
        tags: r.total_tags,
        groups: r.groups_found,
        merged: r.tags_merged,
        remaining: r.tags_remaining,
      })),
    };

    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
