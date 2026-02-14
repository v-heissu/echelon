import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { slugify } from '@/lib/utils';

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: projects, error } = await admin
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

  const admin = createAdminClient();

  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();

  // Validate required fields
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
    return NextResponse.json({ error: 'Nome progetto richiesto (min 2 caratteri)' }, { status: 400 });
  }
  if (body.name.trim().length > 100) {
    return NextResponse.json({ error: 'Nome progetto troppo lungo (max 100 caratteri)' }, { status: 400 });
  }

  // Validate array limits
  const keywords = Array.isArray(body.keywords) ? body.keywords.slice(0, 10) : [];
  const competitors = Array.isArray(body.competitors) ? body.competitors.slice(0, 20) : [];
  const sources = Array.isArray(body.sources) ? body.sources.filter((s: string) => ['google_organic', 'google_news'].includes(s)) : ['google_organic', 'google_news'];

  if (sources.length === 0) {
    return NextResponse.json({ error: 'Seleziona almeno una fonte (google_organic o google_news)' }, { status: 400 });
  }

  let slug = slugify(body.name);

  // Ensure unique slug by checking for existing ones and appending a suffix
  const { data: existing } = await admin
    .from('projects')
    .select('slug')
    .like('slug', `${slug}%`);

  if (existing && existing.length > 0) {
    const taken = new Set(existing.map((p) => p.slug));
    if (taken.has(slug)) {
      let suffix = 2;
      while (taken.has(`${slug}-${suffix}`)) suffix++;
      slug = `${slug}-${suffix}`;
    }
  }

  const { data: project, error } = await admin
    .from('projects')
    .insert({
      slug,
      name: body.name.trim(),
      industry: body.industry || '',
      keywords,
      competitors,
      sources,
      schedule: body.schedule || 'manual',
      schedule_day: body.schedule_day || 1,
      language: body.language || 'it',
      location_code: body.location_code || 2380,
      alert_keywords: Array.isArray(body.alert_keywords) ? body.alert_keywords.slice(0, 15) : [],
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(project, { status: 201 });
}
