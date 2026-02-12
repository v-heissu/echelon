import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const { secret } = await request.json();

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const admin = createAdminClient();

  // 1. Check profile in public.users
  const { data: profile, error: profileErr } = await admin
    .from('users')
    .select('id, email, role, display_name')
    .eq('email', adminEmail!)
    .limit(1);

  // 2. List auth users with this email
  const { data: authList, error: authErr } = await admin.auth.admin.listUsers();
  const authUser = authList?.users?.find((u) => u.email === adminEmail);

  // 3. Try signInWithPassword server-side using anon key
  const anonClient = createClient(supabaseUrl!, anonKey!);
  const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({
    email: adminEmail!,
    password: adminPassword!,
  });

  return NextResponse.json({
    env: {
      adminEmail: adminEmail ? `${adminEmail.substring(0, 3)}***` : null,
      adminPasswordLength: adminPassword?.length ?? 0,
      supabaseUrl: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : null,
    },
    profile: { data: profile, error: profileErr?.message },
    authUser: authUser
      ? {
          id: authUser.id,
          email: authUser.email,
          email_confirmed_at: authUser.email_confirmed_at,
          created_at: authUser.created_at,
          last_sign_in_at: authUser.last_sign_in_at,
        }
      : null,
    authError: authErr?.message,
    signIn: {
      success: !!signIn?.session,
      userId: signIn?.user?.id,
      error: signInErr?.message,
    },
  });
}
