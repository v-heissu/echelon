import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Delete all serp_results (and cascaded ai_analysis) for a project
 * where ai_analysis.themes contains the given tag name.
 *
 * Returns the number of deleted serp_results.
 */
export async function deleteResultsByTagForProject(
  projectId: string,
  tagName: string
): Promise<number> {
  const supabase = createAdminClient();

  // Get all scan IDs for this project
  const { data: scans } = await supabase
    .from('scans')
    .select('id')
    .eq('project_id', projectId);

  if (!scans || scans.length === 0) return 0;

  const scanIds = scans.map((s) => s.id);
  let totalDeleted = 0;

  // Process in scan batches to avoid hitting limits
  for (const scanId of scanIds) {
    const deleted = await deleteResultsByTagForScan(scanId, tagName);
    totalDeleted += deleted;
  }

  // Update tag counts after deletion
  await decrementTagCount(supabase, projectId, tagName);

  return totalDeleted;
}

/**
 * Delete serp_results in a single scan that have the given tag.
 */
async function deleteResultsByTagForScan(
  scanId: string,
  tagName: string
): Promise<number> {
  const supabase = createAdminClient();
  const normalizedTag = tagName.toLowerCase().trim();
  let totalDeleted = 0;
  let hasMore = true;

  while (hasMore) {
    // Fetch a batch of results with their themes
    const { data: results } = await supabase
      .from('serp_results')
      .select('id, ai_analysis(themes)')
      .eq('scan_id', scanId)
      .limit(500);

    if (!results || results.length === 0) {
      hasMore = false;
      break;
    }

    // Filter to those with the matching tag
    const toDelete = results.filter((r) => {
      const raw = r.ai_analysis;
      const a = Array.isArray(raw) ? raw[0] : raw;
      if (!a?.themes || !Array.isArray(a.themes)) return false;
      return a.themes.some(
        (t: { name?: string }) => t.name?.toLowerCase().trim() === normalizedTag
      );
    });

    if (toDelete.length === 0) {
      hasMore = false;
      break;
    }

    const ids = toDelete.map((r) => r.id);

    // Delete ai_analysis first (FK constraint), then serp_results
    await supabase.from('ai_analysis').delete().in('serp_result_id', ids);
    await supabase.from('serp_results').delete().in('id', ids);

    totalDeleted += ids.length;

    // If we got fewer results than the limit, we're done
    if (results.length < 500) {
      hasMore = false;
    }
  }

  return totalDeleted;
}

/**
 * Decrement or remove the tag from the tags table after deleting results.
 */
async function decrementTagCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  tagName: string
): Promise<void> {
  // Simply delete the tag entry — it'll be rebuilt on next tag refresh
  await supabase
    .from('tags')
    .delete()
    .eq('project_id', projectId)
    .eq('name', tagName.toLowerCase().trim());
}

/**
 * Delete specific serp_results by their IDs.
 * Also deletes associated ai_analysis and updates tag counts.
 *
 * Returns the number of deleted results.
 */
export async function deleteResultsByIds(
  projectId: string,
  resultIds: string[]
): Promise<number> {
  if (resultIds.length === 0) return 0;

  const supabase = createAdminClient();
  let totalDeleted = 0;

  // Process in batches of 200
  for (let i = 0; i < resultIds.length; i += 200) {
    const batch = resultIds.slice(i, i + 200);

    // Verify these results belong to the project
    const { data: verified } = await supabase
      .from('serp_results')
      .select('id, scans!inner(project_id)')
      .in('id', batch)
      .eq('scans.project_id', projectId);

    if (!verified || verified.length === 0) continue;

    const validIds = verified.map((r) => r.id);

    // Delete ai_analysis first, then serp_results
    await supabase.from('ai_analysis').delete().in('serp_result_id', validIds);
    await supabase.from('serp_results').delete().in('id', validIds);

    totalDeleted += validIds.length;
  }

  return totalDeleted;
}

/**
 * Apply the tag blacklist to a set of serp_result IDs.
 * Deletes any results whose themes match blacklisted tags.
 *
 * Used after AI analysis during scan processing.
 */
export async function applyBlacklistToResults(
  projectId: string,
  serpResultIds: string[]
): Promise<number> {
  if (serpResultIds.length === 0) return 0;

  const supabase = createAdminClient();

  // Fetch the project's blacklist
  const { data: blacklist } = await supabase
    .from('tag_blacklist')
    .select('tag_name')
    .eq('project_id', projectId);

  if (!blacklist || blacklist.length === 0) return 0;

  const blacklistedTags = new Set(blacklist.map((b) => b.tag_name.toLowerCase().trim()));

  // Fetch the results with their themes
  const { data: results } = await supabase
    .from('serp_results')
    .select('id, ai_analysis(themes)')
    .in('id', serpResultIds);

  if (!results || results.length === 0) return 0;

  // Find results that have any blacklisted tag
  const toDelete = results.filter((r) => {
    const raw = r.ai_analysis;
    const a = Array.isArray(raw) ? raw[0] : raw;
    if (!a?.themes || !Array.isArray(a.themes)) return false;
    return a.themes.some(
      (t: { name?: string }) => t.name && blacklistedTags.has(t.name.toLowerCase().trim())
    );
  });

  if (toDelete.length === 0) return 0;

  const ids = toDelete.map((r) => r.id);

  // Delete ai_analysis first, then serp_results
  await supabase.from('ai_analysis').delete().in('serp_result_id', ids);
  await supabase.from('serp_results').delete().in('id', ids);

  console.log(`[blacklist] Deleted ${ids.length} results matching blacklisted tags for project ${projectId}`);
  return ids.length;
}
