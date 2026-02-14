import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: users, error } = await admin
    .from('users')
    .select('*, project_users(project_id, role, projects(name, slug))')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(users);
}

function generateSecurePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
  const bytes = crypto.randomBytes(16);
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars[bytes[i] % chars.length];
  }
  // Ensure at least one of each required character type
  return password[0].toUpperCase() + password.slice(1, 14) + '1!';
}

export async function POST(request: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { email, display_name, password } = await request.json();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email non valida' }, { status: 400 });
  }

  // Use provided password or generate a secure one
  const tempPassword = password || generateSecurePassword();

  const resolvedDisplayName = display_name || email.split('@')[0];

  // Create auth user with display_name in metadata so the trigger can use it
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { display_name: resolvedDisplayName },
  });

  if (authError) {
    if (authError.message?.includes('already been registered')) {
      return NextResponse.json({ error: 'Un utente con questa email esiste gia' }, { status: 409 });
    }
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // The trigger on_auth_user_created auto-creates the profile as 'client'.
  // We use upsert to handle the race condition: if the trigger already created
  // the profile, we update it; if not, we insert it.
  const maxRetries = 5;
  let profileOk = false;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { error: upsertError } = await admin.from('users').upsert({
      id: authUser.user.id,
      email,
      display_name: resolvedDisplayName,
      role: 'client',
    }, { onConflict: 'id' });

    if (!upsertError) {
      profileOk = true;
      break;
    }

    // Wait briefly for trigger to complete
    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
  }

  if (!profileOk) {
    console.error('[createUser] Profile creation failed after retries for', email);
    // Auth user was created but profile failed - try to clean up
    await admin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: 'Errore nella creazione del profilo utente' }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: authUser.user.id,
      email,
      display_name: resolvedDisplayName,
      temp_password: tempPassword,
    },
    { status: 201 }
  );
}
