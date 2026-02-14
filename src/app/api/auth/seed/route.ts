import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const { secret } = await request.json();

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Admin env vars not set' }, { status: 500 });
  }

  const supabase = createAdminClient();

  // Check if profile already exists
  const { data: existingUsers } = await supabase
    .from('users')
    .select('id, role')
    .eq('email', adminEmail)
    .limit(1);

  if (existingUsers && existingUsers.length > 0) {
    const userId = existingUsers[0].id;

    // Always sync password with env var
    await supabase.auth.admin.updateUserById(userId, {
      password: adminPassword,
      email_confirm: true,
    });

    // Profile exists but might not be admin (e.g. trigger created it as client)
    if (existingUsers[0].role !== 'admin') {
      await supabase
        .from('users')
        .update({ role: 'admin', display_name: 'Admin' })
        .eq('id', userId);
      return NextResponse.json({ message: 'Existing user promoted to admin and password synced', id: userId });
    }

    return NextResponse.json({ message: 'Admin already exists, password synced' });
  }

  // Create auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { display_name: 'Admin' },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // The trigger may or may not have fired yet. Use upsert with retries to ensure
  // the profile exists and is promoted to admin.
  let profileOk = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: authUser.user.id,
        email: adminEmail,
        display_name: 'Admin',
        role: 'admin',
      }, { onConflict: 'id' });

    if (!upsertError) {
      profileOk = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
  }

  if (!profileOk) {
    return NextResponse.json({ error: 'Profilo admin non creato dopo i tentativi' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Admin user created', id: authUser.user.id });
}
