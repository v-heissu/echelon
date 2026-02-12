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

  // Check if admin already exists
  const { data: existingUsers } = await supabase
    .from('users')
    .select('id')
    .eq('email', adminEmail)
    .limit(1);

  if (existingUsers && existingUsers.length > 0) {
    return NextResponse.json({ message: 'Admin already exists' });
  }

  // Create auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Create user profile
  const { error: profileError } = await supabase.from('users').insert({
    id: authUser.user.id,
    email: adminEmail,
    display_name: 'Admin',
    role: 'admin',
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Admin user created', id: authUser.user.id });
}
