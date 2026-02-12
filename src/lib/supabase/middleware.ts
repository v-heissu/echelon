import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

function createMiddlewareAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Redirect unauthenticated users to login
  if (!user && !pathname.startsWith('/login') && !pathname.startsWith('/api/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Use admin client for profile lookups to avoid RLS/JWT propagation issues
  const admin = createMiddlewareAdmin();

  // Redirect authenticated users away from login (only if profile exists)
  if (user && pathname.startsWith('/login')) {
    const { data: profile } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile) {
      const url = request.nextUrl.clone();
      url.pathname = profile.role === 'admin' ? '/admin' : '/';
      return NextResponse.redirect(url);
    }
  }

  // Protect admin routes
  if (user && pathname.startsWith('/admin')) {
    const { data: profile } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  // Protect project routes - check project_users membership
  if (user && pathname.startsWith('/project/')) {
    const slug = pathname.split('/')[2];
    if (slug) {
      const { data: profile } = await admin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        const { data: project } = await admin
          .from('projects')
          .select('id')
          .eq('slug', slug)
          .single();

        if (project) {
          const { data: membership } = await admin
            .from('project_users')
            .select('user_id')
            .eq('project_id', project.id)
            .eq('user_id', user.id)
            .single();

          if (!membership) {
            const url = request.nextUrl.clone();
            url.pathname = '/';
            return NextResponse.redirect(url);
          }
        }
      }
    }
  }

  return supabaseResponse;
}
