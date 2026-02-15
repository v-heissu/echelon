import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processOneJob } from '@/lib/worker/process-jobs';

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Auth: only callable via CRON_SECRET (internal fire-and-forget)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scanId = params.id;
  const admin = createAdminClient();

  // Verify scan exists and is running
  const { data: scan } = await admin
    .from('scans')
    .select('id, status, total_tasks')
    .eq('id', scanId)
    .single();

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  if (scan.status !== 'running') {
    return NextResponse.json({ message: 'Scan is not running', status: scan.status });
  }

  console.log(`[run] Starting processing for scan ${scanId} (${scan.total_tasks} tasks)`);

  // Process ALL jobs within the 280s budget
  const startTime = Date.now();
  const MAX_RUNTIME = 280_000;
  let processedCount = 0;
  let errorCount = 0;

  while (Date.now() - startTime < MAX_RUNTIME) {
    try {
      const result = await processOneJob();

      if (result.status === 'no_jobs') {
        console.log(`[run] No more jobs. Processed: ${processedCount}, Errors: ${errorCount}`);
        break;
      }
      if (result.status === 'processed') {
        processedCount++;
        console.log(`[run] Processed job ${result.jobId} (${result.keyword}/${result.source}) — ${processedCount} done, ${result.pendingCount} pending`);
      }
      if (result.status === 'error') {
        errorCount++;
        console.error(`[run] Job ${result.jobId} error: ${result.error}`);
      }
      if (result.pendingCount === 0) {
        console.log(`[run] All jobs done. Processed: ${processedCount}, Errors: ${errorCount}`);
        break;
      }

      // Rate limiting: 4s delay between Gemini calls (15 RPM free tier)
      await new Promise(resolve => setTimeout(resolve, 4000));
    } catch (err) {
      console.error('[run] Unexpected error in processing loop:', err);
      errorCount++;
      // Brief pause before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[run] Finished scan ${scanId} in ${elapsed}s — processed: ${processedCount}, errors: ${errorCount}`);

  return NextResponse.json({
    scan_id: scanId,
    processed: processedCount,
    errors: errorCount,
    elapsed_seconds: elapsed,
  });
}
