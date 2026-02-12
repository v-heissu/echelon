export const dynamic = 'force-dynamic';

import { createServerSupabase } from '@/lib/supabase/server';
import { ProjectSidebar } from '@/components/layout/project-sidebar';
import { redirect } from 'next/navigation';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('slug', params.slug)
    .single();

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  return (
    <div className="flex min-h-screen">
      <ProjectSidebar
        slug={params.slug}
        projectName={project?.name || params.slug}
        isAdmin={profile?.role === 'admin'}
      />
      <main className="flex-1 bg-muted p-6 overflow-auto">{children}</main>
    </div>
  );
}
