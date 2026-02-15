import { createAdminClient } from '@/lib/supabase/admin';
import { GeminiClient } from '@/lib/gemini/client';

/**
 * Generate (or regenerate) the AI briefing for a project.
 * Compares the latest completed scan with the previous one.
 *
 * @param projectId - Project UUID
 * @returns The generated briefing text, or null if not enough data
 */
export async function regenerateBriefing(projectId: string): Promise<string | null> {
  const supabase = createAdminClient();

  // 1. Fetch project info
  const { data: project } = await supabase
    .from('projects')
    .select('name, industry, project_context')
    .eq('id', projectId)
    .single();

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // 2. Get last 2 completed scans
  const { data: completedScans } = await supabase
    .from('scans')
    .select('id')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(2);

  if (!completedScans || completedScans.length < 2) {
    console.log('[regenerateBriefing] Not enough scans for comparison');
    return null;
  }

  const currentScanId = completedScans[0].id;
  const previousScanId = completedScans[1].id;

  // 3. Get stats for both scans
  const [currentStats, previousStats] = await Promise.all([
    getScanStats(supabase, currentScanId),
    getScanStats(supabase, previousScanId),
  ]);

  // 4. Call Gemini
  const gemini = new GeminiClient();
  const model = gemini['genAI'].getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { temperature: 0.3 },
  });

  const projectInfo = `PROGETTO: ${project.name}${project.industry ? ` | Settore: ${project.industry}` : ''}${project.project_context ? `\nCONTESTO: ${project.project_context}` : ''}\n\n`;

  const prompt = `Sei un analista di intelligence competitiva. ${project.project_context ? 'Tieni conto del contesto e dello scopo del progetto per dare un briefing mirato e rilevante. ' : ''}Confronta questi dati SERP della scan corrente con la scan precedente. In 3-5 frasi in italiano: cosa è cambiato? Quali temi sono emersi o scomparsi? Quali competitor si sono mossi? Il sentiment è migliorato o peggiorato? Sii conciso e actionable.

${projectInfo}DATI:
${JSON.stringify({ current: currentStats, previous: previousStats }, null, 2)}

Rispondi SOLO con il testo del briefing, nessun JSON, nessun markdown.`;

  const result = await model.generateContent(prompt);
  const briefingText = result.response.text().trim();

  // 5. Save to the latest scan
  const { error: updateError } = await supabase
    .from('scans')
    .update({ ai_briefing: briefingText })
    .eq('id', currentScanId);

  if (updateError) {
    console.error('[regenerateBriefing] Failed to save briefing:', updateError.message);
    throw new Error(`Failed to save briefing: ${updateError.message}`);
  }

  console.log('[regenerateBriefing] Briefing regenerated for project:', projectId);
  return briefingText;
}

/**
 * Regenerate briefing for a specific scan (used by process-jobs after scan completion).
 */
export async function generateBriefingForScan(scanId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: scan } = await supabase
    .from('scans')
    .select('project_id')
    .eq('id', scanId)
    .single();

  if (!scan?.project_id) {
    console.error('[generateBriefingForScan] Scan not found:', scanId);
    return;
  }

  try {
    await regenerateBriefing(scan.project_id);
  } catch (err) {
    console.error('[generateBriefingForScan] Failed:', err);
  }
}

// --- Helpers ---

async function getScanStats(supabase: ReturnType<typeof createAdminClient>, scanId: string) {
  const { data: results } = await supabase
    .from('serp_results')
    .select('domain, is_competitor, ai_analysis(themes, sentiment, sentiment_score)')
    .eq('scan_id', scanId);

  const totalResults = results?.length || 0;
  const uniqueDomains = new Set(results?.map((r: { domain: string }) => r.domain)).size;
  const competitorMentions = results?.filter((r: { is_competitor: boolean }) => r.is_competitor).length || 0;

  const sentimentCounts: Record<string, number> = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  let sentimentSum = 0;
  let sentimentCount = 0;
  const themeCounts = new Map<string, number>();
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
