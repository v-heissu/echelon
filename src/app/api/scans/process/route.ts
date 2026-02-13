import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processJobs } from '@/lib/worker/process-jobs';

export const maxDuration = 60;

export async function POST() {
  // Authenticate via session (browser call)
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Check if there are pending jobs before starting
  const { data: pendingJob } = await admin
    .from('job_queue')
    .select('id')
    .eq('status', 'pending')
    .limit(1)
    .single();

  if (!pendingJob) {
    return NextResponse.json({ message: 'No pending jobs', processedCount: 0 });
  }

  const { processedCount } = await processJobs();

  return NextResponse.json({ message: `Processed ${processedCount} jobs`, processedCount });
}
