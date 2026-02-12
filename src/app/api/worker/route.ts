import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DataForSEOClient } from '@/lib/dataforseo/client';
import { extractContent } from '@/lib/extraction/content';
import { GeminiClient } from '@/lib/gemini/client';
import { extractDomain } from '@/lib/utils';

export const maxDuration = 60;

export async function POST(request: Request) {
  const { secret } = await request.json();

  if (secret !== process.env.WORKER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Optimistic lock: grab one pending task
  const { data: job, error: jobError } = await supabase
    .from('job_queue')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .select('*, scans(project_id, projects(industry, competitors, language, location_code))')
    .single();

  if (jobError || !job) {
    // No more tasks — check if scan is complete
    await checkAndCompleteScans(supabase);
    return NextResponse.json({ message: 'No pending tasks' });
  }

  try {
    const project = (job.scans as Record<string, unknown>)?.projects as Record<string, unknown>;
    const industry = (project?.industry as string) || '';
    const competitors = (project?.competitors as string[]) || [];
    const language = (project?.language as string) || 'it';
    const locationCode = (project?.location_code as number) || 2380;

    // 1. Fetch SERP data
    const dataforseo = new DataForSEOClient();
    const serpItems = await dataforseo.fetchSERP(
      job.keyword,
      job.source,
      language,
      locationCode,
      20
    );

    // 2. Extract content for each URL (parallel with concurrency limit)
    const CONCURRENCY = 5;
    const excerpts: (string | null)[] = new Array(serpItems.length).fill(null);

    for (let i = 0; i < serpItems.length; i += CONCURRENCY) {
      const batch = serpItems.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((item) => extractContent(item.url))
      );
      results.forEach((result, idx) => {
        excerpts[i + idx] = result.status === 'fulfilled' ? result.value : null;
      });
    }

    // 3. Save SERP results
    const serpData = serpItems.map((item, idx) => ({
      scan_id: job.scan_id,
      keyword: job.keyword,
      source: job.source,
      position: item.position,
      url: item.url,
      title: item.title,
      snippet: item.description,
      domain: item.domain || extractDomain(item.url),
      is_competitor: competitors.some(
        (c: string) => (item.domain || extractDomain(item.url)).includes(c)
      ),
      excerpt: excerpts[idx] || item.description,
    }));

    const { data: savedResults, error: insertError } = await supabase
      .from('serp_results')
      .insert(serpData)
      .select();

    if (insertError) throw insertError;

    // 4. AI Analysis with Gemini
    if (savedResults && savedResults.length > 0) {
      const gemini = new GeminiClient();
      const analysisInput = savedResults.map((r) => ({
        position: r.position,
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        excerpt: r.excerpt,
      }));

      try {
        const analysis = await gemini.analyzeSerpResults(job.keyword, industry, analysisInput);

        // Save AI analysis
        const analysisData = savedResults.map((r) => {
          const aiResult = analysis.results.find((a) => a.position === r.position);
          return {
            serp_result_id: r.id,
            themes: aiResult?.themes || [],
            sentiment: aiResult?.sentiment || 'neutral',
            sentiment_score: aiResult?.sentiment_score || 0,
            entities: aiResult?.entities || [],
            summary: aiResult?.summary || '',
            language_detected: language,
          };
        });

        await supabase.from('ai_analysis').insert(analysisData);

        // Update tags
        const scanProject = await supabase
          .from('scans')
          .select('project_id')
          .eq('id', job.scan_id)
          .single();

        if (scanProject.data) {
          await updateTags(supabase, scanProject.data.project_id, analysis.results);
        }
      } catch (aiError) {
        console.error('AI analysis failed, continuing without analysis:', aiError);
      }
    }

    // 5. Mark job as completed
    await supabase
      .from('job_queue')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', job.id);

    // Update scan progress
    await supabase.rpc('increment_scan_progress', { scan_uuid: job.scan_id });

    // 6. Trigger next task (non-blocking)
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(request.url).origin
      : 'http://localhost:3000';

    fetch(`${baseUrl}/api/worker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.WORKER_SECRET }),
    }).catch(() => {}); // Fire and forget

    return NextResponse.json({ message: 'Task completed', job_id: job.id });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Retry or mark as failed
    if (job.retry_count < 3) {
      await supabase
        .from('job_queue')
        .update({
          status: 'pending',
          retry_count: job.retry_count + 1,
          error_message: errorMessage,
        })
        .eq('id', job.id);
    } else {
      await supabase
        .from('job_queue')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      // Still increment progress to not block scan
      await supabase.rpc('increment_scan_progress', { scan_uuid: job.scan_id });
    }

    // Trigger next task even on failure
    const baseUrl = new URL(request.url).origin;
    fetch(`${baseUrl}/api/worker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.WORKER_SECRET }),
    }).catch(() => {});

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

async function updateTags(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  results: { themes: { name: string; confidence: number }[] }[]
) {
  const themeMap = new Map<string, number>();

  for (const result of results) {
    for (const theme of result.themes) {
      const name = theme.name.toLowerCase().trim();
      themeMap.set(name, (themeMap.get(name) || 0) + 1);
    }
  }

  const entries = Array.from(themeMap.entries());
  for (const [name, count] of entries) {
    const slug = name.replace(/\s+/g, '-').replace(/[^\w-]/g, '');

    const { data: existing } = await supabase
      .from('tags')
      .select('id, count')
      .eq('project_id', projectId)
      .eq('slug', slug)
      .single();

    if (existing) {
      await supabase
        .from('tags')
        .update({
          count: existing.count + count,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('tags').insert({
        project_id: projectId,
        name,
        slug,
        count,
        last_seen_at: new Date().toISOString(),
      });
    }
  }
}

async function checkAndCompleteScans(supabase: ReturnType<typeof createAdminClient>) {
  // Find running scans where all tasks are done
  const { data: runningScans } = await supabase
    .from('scans')
    .select('id, total_tasks, completed_tasks')
    .eq('status', 'running');

  if (!runningScans) return;

  for (const scan of runningScans) {
    if (scan.completed_tasks >= scan.total_tasks) {
      await supabase
        .from('scans')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', scan.id);
    }
  }
}
