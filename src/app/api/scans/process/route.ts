import { NextResponse } from 'next/server';
import { processOneJob } from '@/lib/worker/process-jobs';

/**
 * Browser-driven fallback: processes one job per call.
 * Called by processJobsLoop in the dashboard when a scan is active.
 * Server-side /api/scans/[id]/run is the primary processor, but this
 * ensures scans complete even if fire-and-forget fails (e.g. on Vercel).
 */
export async function POST() {
  try {
    const result = await processOneJob();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ status: 'error', error: message, pendingCount: 0 }, { status: 500 });
  }
}
