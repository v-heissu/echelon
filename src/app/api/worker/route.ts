import { NextResponse } from 'next/server';
import { processOneJob } from '@/lib/worker/process-jobs';

export const maxDuration = 60;

export async function POST(request: Request) {
  const { secret } = await request.json();

  if (secret !== process.env.WORKER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Process jobs in a loop until timeout or queue empty
  const startTime = Date.now();
  const MAX_RUNTIME = 50000;
  let processedCount = 0;

  while (Date.now() - startTime < MAX_RUNTIME) {
    const result = await processOneJob();
    if (result.status === 'no_jobs') break;
    if (result.status === 'processed') processedCount++;
    if (result.pendingCount === 0) break;
  }

  return NextResponse.json({ message: `Processed ${processedCount} jobs`, processedCount });
}
