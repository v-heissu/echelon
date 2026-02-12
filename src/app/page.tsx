export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') {
    redirect('/admin');
  }

  // Client user: redirect to first assigned project
  const { data: membership } = await supabase
    .from('project_users')
    .select('project_id, projects(slug)')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (membership?.projects) {
    const proj = membership.projects as unknown as { slug: string };
    redirect(`/project/${proj.slug}`);
  }

  if (!profile) {
    // User authenticated but no profile in public.users — sign out to break the loop
    await supabase.auth.signOut();
    redirect('/login?error=no_profile');
  }

  // Client user with no assigned projects — sign out with informative error
  await supabase.auth.signOut();
  redirect('/login?error=no_profile');
}
