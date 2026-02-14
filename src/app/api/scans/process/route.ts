import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { processOneJob, type ProcessResult } from '@/lib/worker/process-jobs';

export const maxDuration = 60;

export async function POST() {
  // Authenticate via session (browser call) - any authenticated user can process queued jobs
  // Security: only admins can START scans (create jobs), processing just executes the queue
  try {
    const supabase = createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: authError?.message || 'No user session' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Auth failed', detail: error instanceof Error ? error.message : 'Unknown auth error' },
      { status: 500 }
    );
  }

  // Process one job
  try {
    const result: ProcessResult = await processOneJob();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown processing error',
        pendingCount: -1,
      },
      { status: 500 }
    );
  }
}
