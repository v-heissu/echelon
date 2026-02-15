import { createAdminClient } from '@/lib/supabase/admin';
import { GeminiClient, RelevanceInput } from '@/lib/gemini/client';

export interface ContextFilterResult {
  project_id: string;
  project_slug: string;
  total_evaluated: number;
  marked_off_topic: number;
  marked_on_topic: number;
  errors: string[];
}

const BATCH_SIZE = 20;
const GEMINI_DELAY_MS = 4000; // 15 RPM free tier

/**
 * Run the context-filter agent for a single project.
 * Evaluates unfiltered serp_results + ai_analysis pairs against project context
 * and marks off-topic items.
 *
 * @param projectId - Project UUID
 * @param scanId - Optional: limit to a specific scan. If null, evaluates all unfiltered results.
 */
export async function runContextFilter(
  projectId: string,
  scanId?: string | null
): Promise<ContextFilterResult> {
  const supabase = createAdminClient();

  // 1. Load project context
  const { data: project, error: projError } = await supabase
    .from('projects')
    .select('id, slug, name, industry, keywords, competitors, project_context')
    .eq('id', projectId)
    .single();

  if (projError || !project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const result: ContextFilterResult = {
    project_id: project.id,
    project_slug: project.slug,
    total_evaluated: 0,
    marked_off_topic: 0,
    marked_on_topic: 0,
    errors: [],
  };

  // 2. Fetch results that haven't been evaluated yet (is_off_topic = false AND off_topic_reason IS NULL)
  //    We treat "false + null reason" as "not yet evaluated" vs "false + non-null reason" as "evaluated, on-topic"
  let query = supabase
    .from('ai_analysis')
    .select('id, summary, themes, serp_results!inner(id, title, url, snippet, scan_id, scans!inner(project_id))')
    .eq('serp_results.scans.project_id', projectId)
    .eq('is_off_topic', false)
    .is('off_topic_reason', null);

  if (scanId) {
    query = query.eq('serp_results.scan_id', scanId);
  }

  const { data: analyses, error: fetchError } = await query;

  if (fetchError) {
    throw new Error(`Failed to fetch analyses: ${fetchError.message}`);
  }

  if (!analyses || analyses.length === 0) {
    console.log(`[context-filter] No unfiltered results for project ${project.slug}`);
    return result;
  }

  console.log(`[context-filter] Evaluating ${analyses.length} results for project ${project.slug}`);

  // 3. Build input batches
  type SerpJoin = { title?: string; url?: string; snippet?: string };
  const inputs: (RelevanceInput & { analysisId: string })[] = analyses.map((a: typeof analyses[number]) => {
    const serp: SerpJoin = Array.isArray(a.serp_results) ? a.serp_results[0] : a.serp_results;
    return {
      id: a.id,
      analysisId: a.id,
      title: serp?.title || '',
      url: serp?.url || '',
      snippet: serp?.snippet || '',
      summary: a.summary || '',
      themes: Array.isArray(a.themes) ? (a.themes as { name: string }[]) : [],
    };
  });

  const projectContext = {
    name: project.name,
    industry: project.industry || '',
    keywords: Array.isArray(project.keywords) ? (project.keywords as string[]) : [],
    competitors: Array.isArray(project.competitors) ? (project.competitors as string[]) : [],
    project_context: project.project_context as string | null,
  };

  const gemini = new GeminiClient();

  // 4. Process in batches
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);

    try {
      const evaluations = await gemini.evaluateRelevance(projectContext, batch);

      // 5. Update each result
      for (const evaluation of evaluations) {
        const { error: updateError } = await supabase
          .from('ai_analysis')
          .update({
            is_off_topic: evaluation.is_off_topic,
            off_topic_reason: evaluation.reason || (evaluation.is_off_topic ? 'Off-topic' : 'Pertinente'),
          })
          .eq('id', evaluation.id);

        if (updateError) {
          result.errors.push(`Update failed for ${evaluation.id}: ${updateError.message}`);
          continue;
        }

        result.total_evaluated++;
        if (evaluation.is_off_topic) {
          result.marked_off_topic++;
        } else {
          result.marked_on_topic++;
        }
      }
    } catch (batchError) {
      const msg = batchError instanceof Error ? batchError.message : 'Unknown error';
      console.error(`[context-filter] Batch error at offset ${i}:`, msg);
      result.errors.push(`Batch ${i}-${i + BATCH_SIZE}: ${msg}`);
    }

    // Rate limiting between batches
    if (i + BATCH_SIZE < inputs.length) {
      await new Promise((resolve) => setTimeout(resolve, GEMINI_DELAY_MS));
    }
  }

  // 6. Update project's last_filter_at
  await supabase
    .from('projects')
    .update({ last_filter_at: new Date().toISOString() })
    .eq('id', projectId);

  console.log(
    `[context-filter] Done for ${project.slug}: ${result.total_evaluated} evaluated, ${result.marked_off_topic} off-topic, ${result.marked_on_topic} on-topic`
  );

  return result;
}

/**
 * Run context-filter for ALL active projects that haven't been filtered recently.
 * Used by the cron endpoint.
 *
 * @param maxAgeHours - Only run if last_filter_at is older than this (default: 24h)
 */
export async function runContextFilterAll(maxAgeHours = 24): Promise<ContextFilterResult[]> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

  // Get projects that need filtering: active, and either never filtered or filtered > maxAgeHours ago
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, slug')
    .eq('is_active', true)
    .or(`last_filter_at.is.null,last_filter_at.lt.${cutoff}`);

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }

  if (!projects || projects.length === 0) {
    console.log('[context-filter] No projects need filtering');
    return [];
  }

  console.log(`[context-filter] Running for ${projects.length} projects`);

  const results: ContextFilterResult[] = [];

  for (const project of projects) {
    try {
      const result = await runContextFilter(project.id);
      results.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[context-filter] Failed for project ${project.slug}:`, msg);
      results.push({
        project_id: project.id,
        project_slug: project.slug,
        total_evaluated: 0,
        marked_off_topic: 0,
        marked_on_topic: 0,
        errors: [msg],
      });
    }
  }

  return results;
}
