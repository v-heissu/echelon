import { createAdminClient } from '@/lib/supabase/admin';
import { DataForSEOClient } from '@/lib/dataforseo/client';
import { extractContent } from '@/lib/extraction/content';
import { GeminiClient } from '@/lib/gemini/client';
import { extractDomain } from '@/lib/utils';

export interface ProcessResult {
  status: 'processed' | 'no_jobs' | 'error';
  jobId?: string;
  keyword?: string;
  source?: string;
  error?: string;
  pendingCount: number;
}

/**
 * Process ONE job from the queue and return the result.
 * Designed for browser-triggered cascade: the frontend calls this repeatedly.
 */
export async function processOneJob(): Promise<ProcessResult> {
  const supabase = createAdminClient();

  // 1. Find the oldest pending job
  const { data: pendingJob, error: findError } = await supabase
    .from('job_queue')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (findError || !pendingJob) {
    // Check how many pending jobs remain
    const { count } = await supabase
      .from('job_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Also check and complete any scans that are done
    await checkAndCompleteScans(supabase);

    return { status: 'no_jobs', pendingCount: count || 0 };
  }

  // 2. Claim the job (optimistic lock)
  const { data: job, error: claimError } = await supabase
    .from('job_queue')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', pendingJob.id)
    .eq('status', 'pending')
    .select()
    .single();

  if (claimError || !job) {
    // Already claimed by another worker, count remaining
    const { count } = await supabase
      .from('job_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    return { status: 'no_jobs', pendingCount: count || 0 };
  }

  try {
    // 3. Fetch project settings
    const { data: scan } = await supabase
      .from('scans')
      .select('project_id')
      .eq('id', job.scan_id)
      .single();

    if (!scan) throw new Error(`Scan ${job.scan_id} not found`);

    const { data: proj } = await supabase
      .from('projects')
      .select('industry, competitors, language, location_code')
      .eq('id', scan.project_id)
      .single();

    const industry = (proj?.industry as string) || '';
    const competitors = (proj?.competitors as string[]) || [];
    const language = (proj?.language as string) || 'it';
    const locationCode = (proj?.location_code as number) || 2380;

    // 4. Fetch SERP data
    const dataforseo = new DataForSEOClient();
    const serpItems = await dataforseo.fetchSERP(
      job.keyword,
      job.source,
      language,
      locationCode,
      30
    );

    // 5. Extract content only for top 10 URLs (speed optimization)
    const CONCURRENCY = 5;
    const TOP_EXTRACT = 10;
    const excerpts: (string | null)[] = new Array(serpItems.length).fill(null);

    const toExtract = serpItems.slice(0, TOP_EXTRACT);
    for (let i = 0; i < toExtract.length; i += CONCURRENCY) {
      const batch = toExtract.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((item) => extractContent(item.url))
      );
      results.forEach((result, idx) => {
        excerpts[i + idx] = result.status === 'fulfilled' ? result.value : null;
      });
    }

    // 6. Save SERP results
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
      fetched_at: item.published_at || new Date().toISOString(),
    }));

    const { data: savedResults, error: insertError } = await supabase
      .from('serp_results')
      .insert(serpData)
      .select();

    if (insertError) throw new Error(`SERP insert failed: ${insertError.message}`);

    // 7. AI Analysis with Gemini
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

        // Auto-discover competitors: mark results identified by AI as competitors
        const discoveredCompetitors = analysis.discovered_competitors || [];
        if (discoveredCompetitors.length > 0) {
          for (const result of savedResults) {
            const domain = result.domain || extractDomain(result.url);
            const aiResult = analysis.results.find((a) => a.position === result.position);
            const isAiCompetitor = aiResult?.is_competitor || discoveredCompetitors.some(
              (c: string) => domain.includes(c)
            );
            if (isAiCompetitor && !result.is_competitor) {
              await supabase
                .from('serp_results')
                .update({ is_competitor: true })
                .eq('id', result.id);
            }
          }
        }

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

        if (scan.project_id) {
          await updateTags(supabase, scan.project_id, analysis.results);
        }
      } catch (aiError) {
        console.error('AI analysis failed, continuing without:', aiError);
      }
    }

    // 8. Mark job as completed
    await supabase
      .from('job_queue')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', job.id);

    await supabase.rpc('increment_scan_progress', { scan_uuid: job.scan_id });

    // Check and complete scans
    await checkAndCompleteScans(supabase);

    // Count remaining pending jobs
    const { count } = await supabase
      .from('job_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    return {
      status: 'processed',
      jobId: job.id,
      keyword: job.keyword,
      source: job.source,
      pendingCount: count || 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Job ${job.id} failed:`, errorMessage);

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

      await supabase.rpc('increment_scan_progress', { scan_uuid: job.scan_id });
    }

    await checkAndCompleteScans(supabase);

    const { count } = await supabase
      .from('job_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    return {
      status: 'error',
      jobId: job.id,
      keyword: job.keyword,
      source: job.source,
      error: errorMessage,
      pendingCount: count || 0,
    };
  }
}

async function updateTags(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  results: { themes: { name: string; confidence: number }[]; sentiment?: string; sentiment_score?: number }[]
) {
  const themeMap = new Map<string, { count: number; sentimentSum: number; sentimentCount: number }>();

  for (const result of results) {
    if (!result.themes || !Array.isArray(result.themes)) continue;
    for (const theme of result.themes) {
      if (!theme.name) continue;
      const name = theme.name.toLowerCase().trim();
      if (!name) continue;
      const existing = themeMap.get(name) || { count: 0, sentimentSum: 0, sentimentCount: 0 };
      existing.count++;
      if (result.sentiment_score !== undefined) {
        existing.sentimentSum += result.sentiment_score;
        existing.sentimentCount++;
      }
      themeMap.set(name, existing);
    }
  }

  if (themeMap.size === 0) {
    console.log('[updateTags] No themes found in results');
    return;
  }

  console.log('[updateTags] Updating', themeMap.size, 'tags for project', projectId);

  const entries = Array.from(themeMap.entries());
  for (const [name, data] of entries) {
    const slug = name.replace(/\s+/g, '-').replace(/[^\w-]/g, '');

    // Use maybeSingle() to avoid error when no row matches
    const { data: existing, error: lookupError } = await supabase
      .from('tags')
      .select('id, count')
      .eq('project_id', projectId)
      .eq('slug', slug)
      .maybeSingle();

    if (lookupError) {
      console.error('[updateTags] Lookup error for', name, ':', lookupError.message);
      continue;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('tags')
        .update({
          count: existing.count + data.count,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (updateError) {
        console.error('[updateTags] Update error for', name, ':', updateError.message);
      }
    } else {
      const { error: insertError } = await supabase.from('tags').insert({
        project_id: projectId,
        name,
        slug,
        count: data.count,
        last_seen_at: new Date().toISOString(),
      });
      if (insertError) {
        console.error('[updateTags] Insert error for', name, ':', insertError.message);
      }
    }
  }
}

async function checkAndCompleteScans(supabase: ReturnType<typeof createAdminClient>) {
  const { data: runningScans } = await supabase
    .from('scans')
    .select('id, total_tasks, completed_tasks')
    .eq('status', 'running');

  if (!runningScans) return;

  for (const scan of runningScans) {
    if (scan.total_tasks > 0 && scan.completed_tasks >= scan.total_tasks) {
      await supabase
        .from('scans')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', scan.id);
    }
  }
}
