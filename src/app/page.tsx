export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function Home() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Use admin client for profile lookup to avoid RLS/session propagation issues
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    redirect('/login?error=no_profile');
  }

  if (profile.role === 'admin') {
    redirect('/admin');
  }

  // Client user: redirect to first assigned project
  const { data: membership } = await admin
    .from('project_users')
    .select('project_id, projects(slug)')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (membership?.projects) {
    const proj = membership.projects as unknown as { slug: string };
    redirect(`/project/${proj.slug}`);
  }

  // Client user with no assigned projects
  await supabase.auth.signOut();
  redirect('/login?error=no_profile');
}
