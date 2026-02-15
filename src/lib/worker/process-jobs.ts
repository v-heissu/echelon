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
 * Server-only: called by /api/scans/trigger and /api/cron/scheduler inline loops.
 * Includes stale job detection to auto-recover from stuck processing states.
 */
export async function processOneJob(): Promise<ProcessResult> {
  const supabase = createAdminClient();

  // 0. Reset stale jobs (processing for > 5 minutes = stuck)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await supabase
    .from('job_queue')
    .update({ status: 'pending', started_at: null, error_message: 'Auto-reset: stale processing' })
    .eq('status', 'processing')
    .lt('started_at', fiveMinAgo);

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
    // 3. Fetch scan (with date range) and project settings
    const { data: scan } = await supabase
      .from('scans')
      .select('project_id, date_from, date_to')
      .eq('id', job.scan_id)
      .single();

    if (!scan) throw new Error(`Scan ${job.scan_id} not found`);

    const { data: proj } = await supabase
      .from('projects')
      .select('industry, competitors, language, location_code, alert_keywords')
      .eq('id', scan.project_id)
      .single();

    const industry = (proj?.industry as string) || '';
    const alertKeywords = Array.isArray(proj?.alert_keywords) ? (proj.alert_keywords as string[]) : [];
    const competitors = (proj?.competitors as string[]) || [];
    const language = (proj?.language as string) || 'it';
    const locationCode = (proj?.location_code as number) || 2380;

    // 4. Fetch SERP data (with date range for incremental scans)
    const dataforseo = new DataForSEOClient();
    const serpItems = await dataforseo.fetchSERP(
      job.keyword,
      job.source,
      language,
      locationCode,
      30,
      scan.date_from,
      scan.date_to,
    );

    // 4b. Deduplicate: remove URLs already seen in previous scans for this project
    const urls = serpItems.map(item => item.url).filter(Boolean);
    let existingUrls = new Set<string>();
    if (urls.length > 0) {
      const { data: existing } = await supabase
        .from('serp_results')
        .select('url, scans!inner(project_id)')
        .eq('scans.project_id', scan.project_id)
        .in('url', urls);
      if (existing) {
        existingUrls = new Set(existing.map((r: { url: string }) => r.url));
      }
    }
    const newSerpItems = serpItems.filter(item => !existingUrls.has(item.url));
    const skippedCount = serpItems.length - newSerpItems.length;
    if (skippedCount > 0) {
      console.log(`[processOneJob] Dedup: skipped ${skippedCount}/${serpItems.length} already-seen URLs for "${job.keyword}"`);
    }

    // If all results were duplicates, mark job as completed and move on
    if (newSerpItems.length === 0) {
      console.log(`[processOneJob] All results for "${job.keyword}" already seen, skipping`);
      await supabase
        .from('job_queue')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', job.id);
      await supabase.rpc('increment_scan_progress', { scan_uuid: job.scan_id });
      await checkAndCompleteScans(supabase);
      const { count } = await supabase
        .from('job_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      return { status: 'processed', jobId: job.id, keyword: job.keyword, source: job.source, pendingCount: count || 0 };
    }

    // 5. Extract content for top 10 URLs (all in parallel for speed)
    const TOP_EXTRACT = 10;
    const excerpts: (string | null)[] = new Array(newSerpItems.length).fill(null);

    const toExtract = newSerpItems.slice(0, TOP_EXTRACT);
    const extractResults = await Promise.allSettled(
      toExtract.map((item) => extractContent(item.url))
    );
    extractResults.forEach((result, idx) => {
      excerpts[idx] = result.status === 'fulfilled' ? result.value : null;
    });

    // 6. Save SERP results (only new, non-duplicate items)
    const serpData = newSerpItems.map((item, idx) => ({
      scan_id: job.scan_id,
      keyword: job.keyword,
      source: job.source,
      position: item.position,
      url: item.url,
      title: item.title,
      snippet: item.description,
      domain: item.domain || extractDomain(item.url),
      is_competitor: competitors.some(
        (c: string) => {
          const normalizedDomain = (item.domain || extractDomain(item.url)).replace(/^www\./, '');
          return normalizedDomain === c.replace(/^www\./, '');
        }
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
        const analysis = await gemini.analyzeSerpResults(job.keyword, industry, analysisInput, alertKeywords);

        // Auto-discover competitors: mark results identified by AI as competitors
        const discoveredCompetitors = analysis.discovered_competitors || [];
        if (discoveredCompetitors.length > 0) {
          for (const result of savedResults) {
            const domain = result.domain || extractDomain(result.url);
            const aiResult = analysis.results.find((a) => a.position === result.position);
            const normalizedDomain = domain.replace(/^www\./, '');
            const isAiCompetitor = aiResult?.is_competitor || discoveredCompetitors.some(
              (c: string) => normalizedDomain === c.replace(/^www\./, '')
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
            themes: (aiResult?.themes || []).map((t: { name?: string; confidence?: number }) => ({
              name: t.name || '',
              confidence: typeof t.confidence === 'number' && !isNaN(t.confidence) ? t.confidence : 0.5,
            })),
            sentiment: aiResult?.sentiment || 'neutral',
            sentiment_score: aiResult?.sentiment_score || 0,
            entities: aiResult?.entities || [],
            summary: aiResult?.summary || '',
            language_detected: language,
            is_hi_priority: aiResult?.is_hi_priority || false,
            priority_reason: aiResult?.priority_reason || null,
          };
        });

        const { error: analysisInsertError } = await supabase.from('ai_analysis').insert(analysisData);
        if (analysisInsertError) {
          console.error('[processOneJob] ai_analysis insert failed:', analysisInsertError.message);
        }

        if (scan.project_id) {
          await updateTags(supabase, scan.project_id, job.scan_id, analysis.results);
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

function normalizeTagSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-{2,}/g, '-')    // collapse multiple hyphens
    .replace(/^-|-$/g, '');    // trim leading/trailing hyphens
}

async function updateTags(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  scanId: string,
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
      if (result.sentiment_score !== undefined && !isNaN(result.sentiment_score)) {
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
    const slug = normalizeTagSlug(name);
    if (!slug) continue;

    // Lookup or create the tag
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

    let tagId: string | null = null;

    if (existing) {
      tagId = existing.id;
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
      const { data: inserted, error: insertError } = await supabase.from('tags').insert({
        project_id: projectId,
        name,
        slug,
        count: data.count,
        last_seen_at: new Date().toISOString(),
      }).select('id').single();

      if (insertError) {
        if (insertError.code === '23505') {
          // Unique constraint violation - race condition, fetch the existing tag
          const { data: raced } = await supabase
            .from('tags')
            .select('id, count')
            .eq('project_id', projectId)
            .eq('slug', slug)
            .maybeSingle();
          if (raced) {
            tagId = raced.id;
            await supabase
              .from('tags')
              .update({
                count: raced.count + data.count,
                last_seen_at: new Date().toISOString(),
              })
              .eq('id', raced.id);
          }
        } else {
          console.error('[updateTags] Insert error for', name, ':', insertError.message);
        }
      } else if (inserted) {
        tagId = inserted.id;
      }
    }

    // Upsert tag_scans record for sparkline data
    if (tagId) {
      const { data: existingTs } = await supabase
        .from('tag_scans')
        .select('id, count')
        .eq('tag_id', tagId)
        .eq('scan_id', scanId)
        .maybeSingle();

      if (existingTs) {
        await supabase
          .from('tag_scans')
          .update({ count: existingTs.count + data.count })
          .eq('id', existingTs.id);
      } else {
        const { error: tsError } = await supabase.from('tag_scans').insert({
          tag_id: tagId,
          scan_id: scanId,
          count: data.count,
        });
        if (tsError && tsError.code !== '23505') {
          console.error('[updateTags] tag_scans insert error for', name, ':', tsError.message);
        }
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

      // Generate AI briefing after scan completion (non-blocking)
      try {
        await generateAiBriefing(supabase, scan.id);
      } catch (briefingError) {
        console.error('[checkAndCompleteScans] AI briefing generation failed:', briefingError);
      }
    }
  }
}

async function generateAiBriefing(supabase: ReturnType<typeof createAdminClient>, scanId: string) {
  // 1. Get the project_id from the scan
  const { data: scan } = await supabase
    .from('scans')
    .select('project_id')
    .eq('id', scanId)
    .single();

  if (!scan?.project_id) {
    console.error('[generateAiBriefing] Scan not found or missing project_id:', scanId);
    return;
  }

  // Fetch project info for context-aware briefing
  const { data: project } = await supabase
    .from('projects')
    .select('name, industry, project_context')
    .eq('id', scan.project_id)
    .single();

  // 2. Get current scan's aggregated data
  const currentStats = await getScanStats(supabase, scanId);

  // 3. Get previous completed scan for comparison
  const { data: previousScans } = await supabase
    .from('scans')
    .select('id')
    .eq('project_id', scan.project_id)
    .eq('status', 'completed')
    .neq('id', scanId)
    .order('completed_at', { ascending: false })
    .limit(1);

  let previousStats = null;
  if (previousScans && previousScans.length > 0) {
    previousStats = await getScanStats(supabase, previousScans[0].id);
  }

  // If there's no previous scan, we can still generate a briefing but it won't have comparison data
  if (!previousStats) {
    console.log('[generateAiBriefing] No previous scan for comparison, skipping briefing for scan:', scanId);
    return;
  }

  // 4. Call Gemini to generate the briefing
  const gemini = new GeminiClient();
  const model = gemini['genAI'].getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.3,
    },
  });

  const projectInfo = project
    ? `PROGETTO: ${project.name}${project.industry ? ` | Settore: ${project.industry}` : ''}${project.project_context ? `\nCONTESTO: ${project.project_context}` : ''}\n\n`
    : '';

  const prompt = `Sei un analista di intelligence competitiva. ${project?.project_context ? 'Tieni conto del contesto e dello scopo del progetto per dare un briefing mirato e rilevante. ' : ''}Confronta questi dati SERP della scan corrente con la scan precedente. In 3-5 frasi in italiano: cosa è cambiato? Quali temi sono emersi o scomparsi? Quali competitor si sono mossi? Il sentiment è migliorato o peggiorato? Sii conciso e actionable.

IMPORTANTE: Ignora i domini onnipresenti e generici (facebook.com, google.com, youtube.com, linkedin.com, twitter.com, x.com, instagram.com, wikipedia.org, reddit.com, amazon.com, tiktok.com). Concentrati solo sui domini rilevanti per il settore e il mercato del progetto.

${projectInfo}DATI:
${JSON.stringify({ current: currentStats, previous: previousStats }, null, 2)}

Rispondi SOLO con il testo del briefing, nessun JSON, nessun markdown.`;

  const result = await model.generateContent(prompt);
  const briefingText = result.response.text().trim();

  // 5. Save the briefing to the scan
  const { error: updateError } = await supabase
    .from('scans')
    .update({ ai_briefing: briefingText })
    .eq('id', scanId);

  if (updateError) {
    console.error('[generateAiBriefing] Failed to save briefing:', updateError.message);
  } else {
    console.log('[generateAiBriefing] Briefing saved for scan:', scanId);
  }
}

async function getScanStats(supabase: ReturnType<typeof createAdminClient>, scanId: string) {
  // Get SERP results with AI analysis
  const { data: results } = await supabase
    .from('serp_results')
    .select('domain, is_competitor, ai_analysis(themes, sentiment, sentiment_score)')
    .eq('scan_id', scanId);

  const totalResults = results?.length || 0;
  const uniqueDomains = new Set(results?.map((r: { domain: string }) => r.domain)).size;
  const competitorMentions = results?.filter((r: { is_competitor: boolean }) => r.is_competitor).length || 0;

  // Sentiment distribution
  const sentimentCounts: Record<string, number> = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  let sentimentSum = 0;
  let sentimentCount = 0;

  // Theme counts
  const themeCounts = new Map<string, number>();

  // Competitor domains
  const competitorDomains = new Set<string>();

  results?.forEach((r: { domain: string; is_competitor: boolean; ai_analysis: unknown }) => {
    const raw = r.ai_analysis;
    const a = Array.isArray(raw) ? raw[0] : raw;

    if (a?.sentiment) {
      const s = a.sentiment as string;
      if (s in sentimentCounts) sentimentCounts[s]++;
    }
    if (a?.sentiment_score != null) {
      sentimentSum += a.sentiment_score;
      sentimentCount++;
    }
    if (a?.themes && Array.isArray(a.themes)) {
      for (const t of a.themes) {
        if (t.name) {
          const name = t.name.toLowerCase().trim();
          themeCounts.set(name, (themeCounts.get(name) || 0) + 1);
        }
      }
    }
    if (r.is_competitor && r.domain) {
      competitorDomains.add(r.domain);
    }
  });

  // Top themes (sorted by count, top 15)
  const topThemes = Array.from(themeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  return {
    total_results: totalResults,
    unique_domains: uniqueDomains,
    competitor_mentions: competitorMentions,
    avg_sentiment: sentimentCount > 0 ? Number((sentimentSum / sentimentCount).toFixed(2)) : 0,
    sentiment_distribution: sentimentCounts,
    top_themes: topThemes,
    competitor_domains: Array.from(competitorDomains),
  };
}
