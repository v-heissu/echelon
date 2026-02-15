import { NextResponse } from 'next/server';
import { runContextFilterAll } from '@/lib/agents/context-filter';

export const maxDuration = 300;

/**
 * GET /api/cron/context-filter
 * Periodic: run the context-filter agent for all active projects
 * that haven't been filtered in the last 24 hours.
 * Protected by CRON_SECRET bearer token.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await runContextFilterAll();

    const summary = {
      projects_processed: results.length,
      total_evaluated: results.reduce((sum, r) => sum + r.total_evaluated, 0),
      total_off_topic: results.reduce((sum, r) => sum + r.marked_off_topic, 0),
      total_deleted: results.reduce((sum, r) => sum + r.deleted, 0),
      errors: results.flatMap((r) => r.errors),
      details: results.map((r) => ({
        project: r.project_slug,
        evaluated: r.total_evaluated,
        off_topic: r.marked_off_topic,
        deleted: r.deleted,
      })),
    };

    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
