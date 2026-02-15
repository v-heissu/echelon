import { createAdminClient } from '@/lib/supabase/admin';
import { GeminiClient, RelevanceInput } from '@/lib/gemini/client';
import { regenerateBriefing } from '@/lib/agents/briefing';

export interface ContextFilterResult {
  project_id: string;
  project_slug: string;
  total_evaluated: number;
  marked_off_topic: number;
  deleted: number;
  errors: string[];
}

export interface BatchFilterResult extends ContextFilterResult {
  remaining: number;
  status: 'processing' | 'done';
}

const BATCH_SIZE = 50;

/**
 * Process a SINGLE batch of unfiltered results for a project.
 * Off-topic results are hard-deleted (not soft-flagged).
 * Called repeatedly by the browser until remaining === 0.
 */
export async function runContextFilterBatch(
  projectId: string,
  scanId?: string | null
): Promise<BatchFilterResult> {
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

  const result: BatchFilterResult = {
    project_id: project.id,
    project_slug: project.slug,
    total_evaluated: 0,
    marked_off_topic: 0,
    deleted: 0,
    errors: [],
    remaining: 0,
    status: 'done',
  };

  // 2. Fetch one batch of unevaluated results
  // We track which results have been evaluated by checking a marker.
  // Since we no longer have is_off_topic, we use a different approach:
  // We process ALL results and delete off-topic ones.
  // To avoid re-evaluating, we store a temporary marker via RPC or simply
  // process results that haven't been evaluated in this run.
  // Simplest approach: just fetch results ordered by id, process them.
  let query = supabase
    .from('ai_analysis')
    .select('id, summary, themes, serp_results!inner(id, title, url, snippet, scan_id, scans!inner(project_id))')
    .eq('serp_results.scans.project_id', projectId)
    .limit(BATCH_SIZE);

  if (scanId) {
    query = query.eq('serp_results.scan_id', scanId);
  }

  const { data: analyses, error: fetchError } = await query;

  if (fetchError) {
    throw new Error(`Failed to fetch analyses: ${fetchError.message}`);
  }

  if (!analyses || analyses.length === 0) {
    console.log(`[context-filter] No more results to evaluate for project ${project.slug}`);

    // Regenerate briefing
    try {
      await regenerateBriefing(projectId);
      console.log(`[context-filter] Briefing regenerated for ${project.slug}`);
    } catch (briefingError) {
      console.error(`[context-filter] Briefing regeneration failed:`, briefingError);
    }

    return result;
  }

  console.log(`[context-filter] Processing batch of ${analyses.length} results for project ${project.slug}`);

  // 3. Build inputs
  type SerpJoin = { id?: string; title?: string; url?: string; snippet?: string };
  const inputs: (RelevanceInput & { analysisId: string; serpResultId: string })[] = analyses.map((a: typeof analyses[number]) => {
    const serp: SerpJoin = Array.isArray(a.serp_results) ? a.serp_results[0] : a.serp_results;
    return {
      id: a.id,
      analysisId: a.id,
      serpResultId: serp?.id || '',
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

  try {
    const evaluations = await gemini.evaluateRelevance(projectContext, inputs);

    const toDeleteSerpIds: string[] = [];
    const toDeleteAnalysisIds: string[] = [];

    for (const evaluation of evaluations) {
      result.total_evaluated++;
      if (evaluation.is_off_topic) {
        result.marked_off_topic++;
        // Find the corresponding serp_result_id
        const input = inputs.find((i) => i.id === evaluation.id);
        if (input?.serpResultId) {
          toDeleteSerpIds.push(input.serpResultId);
          toDeleteAnalysisIds.push(input.analysisId);
        }
      }
    }

    // Hard delete off-topic results
    if (toDeleteAnalysisIds.length > 0) {
      await supabase.from('ai_analysis').delete().in('id', toDeleteAnalysisIds);
      await supabase.from('serp_results').delete().in('id', toDeleteSerpIds);
      result.deleted = toDeleteSerpIds.length;
      console.log(`[context-filter] Deleted ${result.deleted} off-topic results`);
    }
  } catch (batchError) {
    const msg = batchError instanceof Error ? batchError.message : 'Unknown error';
    console.error(`[context-filter] Batch error:`, msg);
    result.errors.push(msg);
  }

  // 4. Check how many remain (project-scoped)
  let remainQuery = supabase
    .from('ai_analysis')
    .select('id, serp_results!inner(scan_id, scans!inner(project_id))', { count: 'exact', head: true })
    .eq('serp_results.scans.project_id', projectId);

  if (scanId) {
    remainQuery = remainQuery.eq('serp_results.scan_id', scanId);
  }

  const { count: remaining } = await remainQuery;
  result.remaining = remaining || 0;
  result.status = result.remaining > 0 ? 'processing' : 'done';

  console.log(
    `[context-filter] Batch done for ${project.slug}: ${result.total_evaluated} evaluated, ${result.marked_off_topic} off-topic (deleted), ${result.remaining} remaining`
  );

  return result;
}

/**
 * Run the full context-filter agent for a single project (used by cron).
 * Processes ALL batches in sequence.
 */
export async function runContextFilter(
  projectId: string,
  scanId?: string | null
): Promise<ContextFilterResult> {
  const totals: ContextFilterResult = {
    project_id: projectId,
    project_slug: '',
    total_evaluated: 0,
    marked_off_topic: 0,
    deleted: 0,
    errors: [],
  };

  let hasMore = true;
  while (hasMore) {
    const batch = await runContextFilterBatch(projectId, scanId);
    totals.project_slug = batch.project_slug;
    totals.total_evaluated += batch.total_evaluated;
    totals.marked_off_topic += batch.marked_off_topic;
    totals.deleted += batch.deleted;
    totals.errors.push(...batch.errors);

    hasMore = batch.status === 'processing';

    // Rate limit between batches
    if (hasMore) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return totals;
}

/**
 * Run context-filter for ALL active projects that haven't been filtered recently.
 * Used by the cron endpoint.
 */
export async function runContextFilterAll(): Promise<ContextFilterResult[]> {
  const supabase = createAdminClient();

  // For cron, just run for all active projects
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, slug')
    .eq('is_active', true);

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
        deleted: 0,
        errors: [msg],
      });
    }
  }

  return results;
}
