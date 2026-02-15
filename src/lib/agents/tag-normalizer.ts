import { createAdminClient } from '@/lib/supabase/admin';
import { GeminiClient, TagGroupInput } from '@/lib/gemini/client';

export interface TagNormalizeResult {
  project_id: string;
  project_slug: string;
  total_tags: number;
  groups_found: number;
  tags_merged: number;
  tags_remaining: number;
  errors: string[];
}

interface TagRecord {
  id: string;
  name: string;
  slug: string;
  count: number;
}

const BATCH_SIZE = 100; // Max tags per Gemini call
const GEMINI_DELAY_MS = 4000;

/**
 * Run the tag-normalizer agent for a single project.
 * Finds semantically duplicate tags, merges them into canonical forms,
 * and updates all references (ai_analysis.themes, tag_scans).
 */
export async function runTagNormalizer(projectId: string): Promise<TagNormalizeResult> {
  const supabase = createAdminClient();

  // 1. Load project context
  const { data: project, error: projError } = await supabase
    .from('projects')
    .select('id, slug, name, industry')
    .eq('id', projectId)
    .single();

  if (projError || !project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const result: TagNormalizeResult = {
    project_id: project.id,
    project_slug: project.slug,
    total_tags: 0,
    groups_found: 0,
    tags_merged: 0,
    tags_remaining: 0,
    errors: [],
  };

  // 2. Fetch all tags for this project
  const { data: rawTags, error: tagsError } = await supabase
    .from('tags')
    .select('id, name, slug, count')
    .eq('project_id', projectId)
    .order('count', { ascending: false });

  if (tagsError) {
    throw new Error(`Failed to fetch tags: ${tagsError.message}`);
  }

  const tags: TagRecord[] = (rawTags || []) as TagRecord[];

  if (tags.length < 2) {
    console.log(`[tag-normalizer] Not enough tags to normalize for project ${project.slug}`);
    result.total_tags = tags.length;
    result.tags_remaining = result.total_tags;
    return result;
  }

  result.total_tags = tags.length;
  console.log(`[tag-normalizer] Analyzing ${tags.length} tags for project ${project.slug}`);

  const gemini = new GeminiClient();
  const allGroups: { canonical: string; duplicates: string[] }[] = [];

  // 3. Process in batches if too many tags
  for (let i = 0; i < tags.length; i += BATCH_SIZE) {
    const batch: TagGroupInput[] = tags.slice(i, i + BATCH_SIZE).map((t: TagRecord) => ({
      name: t.name,
      slug: t.slug,
      count: t.count,
    }));

    try {
      const groups = await gemini.findDuplicateTags(
        { name: project.name, industry: project.industry || '' },
        batch
      );
      allGroups.push(...groups);
    } catch (batchError) {
      const msg = batchError instanceof Error ? batchError.message : 'Unknown error';
      console.error(`[tag-normalizer] Batch error at offset ${i}:`, msg);
      result.errors.push(`Batch ${i}-${i + BATCH_SIZE}: ${msg}`);
    }

    if (i + BATCH_SIZE < tags.length) {
      await new Promise((resolve) => setTimeout(resolve, GEMINI_DELAY_MS));
    }
  }

  if (allGroups.length === 0) {
    console.log(`[tag-normalizer] No duplicate groups found for project ${project.slug}`);
    result.tags_remaining = result.total_tags;
    return result;
  }

  result.groups_found = allGroups.length;
  console.log(`[tag-normalizer] Found ${allGroups.length} duplicate groups, merging...`);

  // 4. Build lookup: tag name → tag record
  const tagByName = new Map<string, TagRecord>(tags.map((t: TagRecord) => [t.name.toLowerCase(), t]));
  const tagBySlug = new Map<string, TagRecord>(tags.map((t: TagRecord) => [t.slug, t]));

  // 5. Merge each group
  for (const group of allGroups) {
    const canonicalName = group.canonical.toLowerCase().trim();
    const canonicalTag = tagByName.get(canonicalName) || tagBySlug.get(canonicalName);

    if (!canonicalTag) {
      result.errors.push(`Canonical tag "${group.canonical}" not found, skipping group`);
      continue;
    }

    const duplicateTags = group.duplicates
      .map((d: string) => {
        const dn = d.toLowerCase().trim();
        return tagByName.get(dn) || tagBySlug.get(dn);
      })
      .filter((t: TagRecord | undefined): t is TagRecord => t !== undefined && t.id !== canonicalTag.id);

    if (duplicateTags.length === 0) continue;

    for (const dupTag of duplicateTags) {
      try {
        // 5a. Reassign tag_scans from duplicate → canonical
        const { data: dupScans } = await supabase
          .from('tag_scans')
          .select('id, scan_id, count')
          .eq('tag_id', dupTag.id);

        if (dupScans && dupScans.length > 0) {
          for (const ds of dupScans) {
            const { data: existingCs } = await supabase
              .from('tag_scans')
              .select('id, count')
              .eq('tag_id', canonicalTag.id)
              .eq('scan_id', ds.scan_id)
              .maybeSingle();

            if (existingCs) {
              await supabase
                .from('tag_scans')
                .update({ count: (existingCs.count as number) + (ds.count as number) })
                .eq('id', existingCs.id);
              await supabase.from('tag_scans').delete().eq('id', ds.id);
            } else {
              await supabase
                .from('tag_scans')
                .update({ tag_id: canonicalTag.id })
                .eq('id', ds.id);
            }
          }
        }

        // 5b. Update ai_analysis.themes: replace duplicate theme name with canonical
        const { data: allAnalyses } = await supabase
          .from('ai_analysis')
          .select('id, themes, serp_results!inner(scan_id, scans!inner(project_id))')
          .eq('serp_results.scans.project_id', projectId);

        if (allAnalyses) {
          for (const analysis of allAnalyses) {
            const themes = analysis.themes as { name: string; confidence: number }[];
            if (!Array.isArray(themes)) continue;

            const dupIndex = themes.findIndex(
              (t: { name: string }) => t.name.toLowerCase().trim() === dupTag.name.toLowerCase().trim()
            );
            if (dupIndex === -1) continue;

            const canonicalExists = themes.some(
              (t: { name: string }) => t.name.toLowerCase().trim() === canonicalTag.name.toLowerCase().trim()
            );

            const updatedThemes = [...themes];
            if (canonicalExists) {
              updatedThemes.splice(dupIndex, 1);
            } else {
              updatedThemes[dupIndex] = {
                ...updatedThemes[dupIndex],
                name: canonicalTag.name,
              };
            }

            await supabase
              .from('ai_analysis')
              .update({ themes: updatedThemes })
              .eq('id', analysis.id);
          }
        }

        // 5c. Sum count into canonical tag
        await supabase
          .from('tags')
          .update({
            count: canonicalTag.count + dupTag.count,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', canonicalTag.id);

        // Update in-memory count for subsequent merges in same group
        canonicalTag.count += dupTag.count;

        // 5d. Delete the duplicate tag
        await supabase.from('tags').delete().eq('id', dupTag.id);

        result.tags_merged++;
        console.log(`[tag-normalizer] Merged "${dupTag.name}" → "${canonicalTag.name}"`);
      } catch (mergeError) {
        const msg = mergeError instanceof Error ? mergeError.message : 'Unknown error';
        result.errors.push(`Merge "${dupTag.name}" → "${canonicalTag.name}": ${msg}`);
        console.error(`[tag-normalizer] Merge error:`, msg);
      }
    }
  }

  // 6. Update project's last_normalize_at
  await supabase
    .from('projects')
    .update({ last_normalize_at: new Date().toISOString() })
    .eq('id', projectId);

  result.tags_remaining = result.total_tags - result.tags_merged;

  console.log(
    `[tag-normalizer] Done for ${project.slug}: ${result.groups_found} groups, ${result.tags_merged} merged, ${result.tags_remaining} remaining`
  );

  return result;
}

/**
 * Run tag-normalizer for ALL active projects that haven't been normalized recently.
 * Used by the cron endpoint.
 */
export async function runTagNormalizerAll(maxAgeHours = 168): Promise<TagNormalizeResult[]> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, slug')
    .eq('is_active', true)
    .or(`last_normalize_at.is.null,last_normalize_at.lt.${cutoff}`);

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }

  if (!projects || projects.length === 0) {
    console.log('[tag-normalizer] No projects need normalization');
    return [];
  }

  console.log(`[tag-normalizer] Running for ${projects.length} projects`);

  const results: TagNormalizeResult[] = [];

  for (const project of projects) {
    try {
      const r = await runTagNormalizer(project.id);
      results.push(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[tag-normalizer] Failed for project ${project.slug}:`, msg);
      results.push({
        project_id: project.id,
        project_slug: project.slug,
        total_tags: 0,
        groups_found: 0,
        tags_merged: 0,
        tags_remaining: 0,
        errors: [msg],
      });
    }
  }

  return results;
}
