import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processOneJob, type ProcessResult } from '@/lib/worker/process-jobs';

export const maxDuration = 60;

export async function POST() {
  // Authenticate via session (browser call)
  try {
    const supabase = createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: authError?.message || 'No user session' },
        { status: 401 }
      );
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', detail: profileError?.message || 'Not admin' },
        { status: 403 }
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
