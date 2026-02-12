import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const result: Record<string, unknown> = {};

  // Step 1: Check session via server client (uses cookies / anon key)
  const supabase = createServerSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  result.step1_getUser = user ? { id: user.id, email: user.email } : null;
  result.step1_error = userError?.message ?? null;

  if (!user) {
    return NextResponse.json({ ...result, conclusion: 'No session — user not authenticated' });
  }

  // Step 2: Query users table via anon client (RLS applies)
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, role, email')
    .eq('id', user.id)
    .single();
  result.step2_profile = profile;
  result.step2_error = profileError?.message ?? null;
  result.step2_errorCode = profileError?.code ?? null;

  // Step 3: Query users table via admin client (bypasses RLS)
  const admin = createAdminClient();
  const { data: adminProfile, error: adminProfileError } = await admin
    .from('users')
    .select('id, role, email')
    .eq('id', user.id)
    .single();
  result.step3_adminProfile = adminProfile;
  result.step3_error = adminProfileError?.message ?? null;

  // Step 4: Check auth.uid() via RPC
  const { data: uidCheck, error: uidError } = await supabase.rpc('auth_uid_check');
  result.step4_authUid = uidCheck;
  result.step4_error = uidError?.message ?? null;

  // Conclusion
  if (!profile && adminProfile) {
    result.conclusion = 'RLS is blocking the query. Profile exists but anon client cannot see it.';
  } else if (!profile && !adminProfile) {
    result.conclusion = 'Profile does not exist in public.users table.';
  } else if (profile) {
    result.conclusion = 'Profile found — login should work. Issue is elsewhere.';
  }

  return NextResponse.json(result);
}
