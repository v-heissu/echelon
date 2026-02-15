import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: project, error } = await admin
    .from('projects')
    .select('*, project_users(user_id, role, users(id, email, display_name))')
    .eq('slug', params.slug)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  return NextResponse.json(project);
}

export async function PUT(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();

  // Build update object, only including fields that were sent
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.industry !== undefined) updateData.industry = body.industry;
  if (body.keywords !== undefined) updateData.keywords = body.keywords;
  if (body.competitors !== undefined) updateData.competitors = body.competitors;
  if (body.sources !== undefined) updateData.sources = body.sources;
  if (body.schedule !== undefined) updateData.schedule = body.schedule;
  if (body.schedule_day !== undefined) updateData.schedule_day = body.schedule_day;
  if (body.language !== undefined) updateData.language = body.language;
  if (body.location_code !== undefined) updateData.location_code = body.location_code;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;
  if (body.project_context !== undefined) updateData.project_context = body.project_context || null;

  const { data: project, error } = await admin
    .from('projects')
    .update(updateData)
    .eq('slug', params.slug)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Use RPC function to bypass PostgREST schema cache for alert_keywords
  if (body.alert_keywords !== undefined) {
    const alertKw = Array.isArray(body.alert_keywords) ? body.alert_keywords.slice(0, 15) : [];
    console.log('[PUT] Saving alert_keywords via RPC for', params.slug, ':', JSON.stringify(alertKw));
    const { data: rpcResult, error: akError } = await admin.rpc('set_project_alert_keywords', {
      p_slug: params.slug,
      p_keywords: alertKw,
    });
    if (akError) {
      console.error('[PUT] alert_keywords RPC failed:', akError.message);
      return NextResponse.json({ error: 'alert_keywords: ' + akError.message }, { status: 500 });
    }
    console.log('[PUT] RPC result:', JSON.stringify(rpcResult));
    project.alert_keywords = alertKw;
  }

  return NextResponse.json(project);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await admin.from('projects').delete().eq('slug', params.slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: 'Deleted' });
}
