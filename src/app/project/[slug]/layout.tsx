export const dynamic = 'force-dynamic';

import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProjectSidebar } from '@/components/layout/project-sidebar';
import { Footer } from '@/components/layout/footer';
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

  // Use admin client for DB queries to avoid RLS/JWT propagation issues
  const admin = createAdminClient();

  const { data: project } = await admin
    .from('projects')
    .select('name')
    .eq('slug', params.slug)
    .single();

  const { data: profile } = await admin
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
      <div className="flex-1 content-bg overflow-auto flex flex-col">
        <main className="flex-1 p-8">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
