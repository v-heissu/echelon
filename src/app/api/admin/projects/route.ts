import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: projects, error } = await supabase
    .from('projects')
    .select('*, scans(id, status, completed_at)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const slug = slugify(body.name);

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      slug,
      name: body.name,
      industry: body.industry || '',
      keywords: body.keywords || [],
      competitors: body.competitors || [],
      sources: body.sources || ['google_organic', 'google_news'],
      schedule: body.schedule || 'manual',
      schedule_day: body.schedule_day || 1,
      language: body.language || 'it',
      location_code: body.location_code || 2380,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(project, { status: 201 });
}
