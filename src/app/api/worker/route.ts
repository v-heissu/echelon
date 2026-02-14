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
  let remainingJobs = 0;

  while (Date.now() - startTime < MAX_RUNTIME) {
    const result = await processOneJob();
    if (result.status === 'no_jobs') break;
    if (result.status === 'processed') processedCount++;
    remainingJobs = result.pendingCount;
    if (result.pendingCount === 0) break;
  }

  // Self-re-invoke if there are still pending jobs (fire-and-forget)
  if (remainingJobs > 0) {
    const baseUrl = new URL(request.url).origin;
    fetch(`${baseUrl}/api/worker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.WORKER_SECRET }),
    }).catch(() => {});
  }

  return NextResponse.json({ message: `Processed ${processedCount} jobs`, processedCount, remainingJobs });
}
