import { NextResponse } from 'next/server';
import { processJobs } from '@/lib/worker/process-jobs';

export const maxDuration = 60;

export async function POST(request: Request) {
  const { secret } = await request.json();

  if (secret !== process.env.WORKER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { processedCount } = await processJobs();

  return NextResponse.json({ message: `Processed ${processedCount} jobs` });
}
