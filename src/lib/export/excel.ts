import ExcelJS from 'exceljs';
import { SerpResultWithAnalysis } from '@/types/database';

interface TrendSummary {
  theme: string;
  total_occurrences: number;
  avg_sentiment: number;
  first_seen: string;
  last_seen: string;
  trend_direction: 'emerging' | 'stable' | 'declining' | 'new';
}

interface CompetitorSummary {
  domain: string;
  total_mentions: number;
  keywords: string[];
  avg_position: number;
  dominant_themes: string[];
  avg_sentiment: number;
}

interface ExportResult extends SerpResultWithAnalysis {
  scan_completed_at?: string | null;
}

interface ExportData {
  results: ExportResult[];
  trends: TrendSummary[];
  competitors: CompetitorSummary[];
  kpi?: { total_results: number; unique_domains: number; competitor_mentions: number; avg_sentiment: number };
  aiBriefing?: string | null;
  projectCompetitors?: string[];
  entities?: { name: string; type: string; count: number; avg_sentiment: number }[];
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF001437' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  color: { argb: 'FFFFFFFF' },
  bold: true,
  size: 11,
};

function applyHeaderStyle(sheet: ExcelJS.Worksheet): void {
  sheet.getRow(1).font = HEADER_FONT;
  sheet.getRow(1).fill = HEADER_FILL;
}

function setAutoFilter(sheet: ExcelJS.Worksheet, columnCount: number): void {
  const lastColumnLetter = String.fromCharCode(64 + Math.min(columnCount, 26));
  sheet.autoFilter = { from: 'A1', to: `${lastColumnLetter}1` };
}

function applyAutoWidth(sheet: ExcelJS.Worksheet): void {
  sheet.columns.forEach(col => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, cell => {
      const len = String(cell.value || '').length;
      if (len > maxLen) maxLen = Math.min(len, 60);
    });
    col.width = maxLen + 2;
  });
}

export async function generateExcel(data: ExportData): Promise<Buffer> {
  const {
    results,
    trends,
    competitors,
    kpi,
    aiBriefing,
    projectCompetitors,
    entities,
  } = data;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Echelon Web Monitor';

  // ---------------------------------------------------------------------------
  // Sheet 1: Executive Summary
  // ---------------------------------------------------------------------------
  const summarySheet = workbook.addWorksheet('Executive Summary');
  summarySheet.getColumn(1).width = 30;
  summarySheet.getColumn(2).width = 50;

  // Row 1 - Title
  const titleRow = summarySheet.getRow(1);
  titleRow.getCell(1).value = 'ECHELON - Executive Summary';
  titleRow.getCell(1).font = { bold: true, size: 16 };

  // Row 3 - KPI section header
  const kpiHeaderRow = summarySheet.getRow(3);
  kpiHeaderRow.getCell(1).value = 'KPI';
  kpiHeaderRow.getCell(1).font = { bold: true, size: 12 };

  // Rows 4-7 - KPI data
  const kpiData = kpi || { total_results: results.length, unique_domains: 0, competitor_mentions: 0, avg_sentiment: 0 };
  summarySheet.getRow(4).getCell(1).value = 'Risultati Totali';
  summarySheet.getRow(4).getCell(2).value = kpiData.total_results;
  summarySheet.getRow(5).getCell(1).value = 'Domini Unici';
  summarySheet.getRow(5).getCell(2).value = kpiData.unique_domains;
  summarySheet.getRow(6).getCell(1).value = 'Menzioni Competitor';
  summarySheet.getRow(6).getCell(2).value = kpiData.competitor_mentions;
  summarySheet.getRow(7).getCell(1).value = 'Sentiment Medio';
  summarySheet.getRow(7).getCell(2).value = kpiData.avg_sentiment;

  // Row 9 - AI Briefing section (only if available)
  let nextSection = 9;
  if (aiBriefing) {
    const briefingHeaderRow = summarySheet.getRow(nextSection);
    briefingHeaderRow.getCell(1).value = 'AI Briefing';
    briefingHeaderRow.getCell(1).font = { bold: true, size: 12 };

    const briefingRow = summarySheet.getRow(nextSection + 1);
    briefingRow.getCell(1).value = aiBriefing;
    briefingRow.getCell(1).alignment = { wrapText: true, vertical: 'top' };

    nextSection = nextSection + 3; // skip to row 12
  } else {
    nextSection = 12;
  }

  // Top 5 Temi Emergenti section
  const themesHeaderRow = summarySheet.getRow(nextSection);
  themesHeaderRow.getCell(1).value = 'Top 5 Temi Emergenti';
  themesHeaderRow.getCell(1).font = { bold: true, size: 12 };

  const topThemes = [...trends]
    .sort((a, b) => b.total_occurrences - a.total_occurrences)
    .slice(0, 5);

  topThemes.forEach((t, i) => {
    const row = summarySheet.getRow(nextSection + 1 + i);
    row.getCell(1).value = t.theme;
    row.getCell(2).value = t.total_occurrences;
  });

  // Top 5 Competitor section
  const compHeaderRowNum = nextSection + 7; // leave a gap row after themes
  const compHeaderRow = summarySheet.getRow(compHeaderRowNum);
  compHeaderRow.getCell(1).value = 'Top 5 Competitor';
  compHeaderRow.getCell(1).font = { bold: true, size: 12 };

  const topCompetitors = [...competitors]
    .sort((a, b) => b.total_mentions - a.total_mentions)
    .slice(0, 5);

  topCompetitors.forEach((c, i) => {
    const row = summarySheet.getRow(compHeaderRowNum + 1 + i);
    row.getCell(1).value = c.domain;
    row.getCell(2).value = c.total_mentions;
  });

  // ---------------------------------------------------------------------------
  // Sheet 2: Risultati
  // ---------------------------------------------------------------------------
  const resultsSheet = workbook.addWorksheet('Risultati');
  resultsSheet.columns = [
    { header: 'Data Scan', key: 'scan_date', width: 15 },
    { header: 'Data Pubblicazione', key: 'pub_date', width: 15 },
    { header: 'Keyword', key: 'keyword', width: 20 },
    { header: 'Source', key: 'source', width: 15 },
    { header: 'Posizione', key: 'position', width: 10 },
    { header: 'Titolo', key: 'title', width: 40 },
    { header: 'URL', key: 'url', width: 40 },
    { header: 'Dominio', key: 'domain', width: 25 },
    { header: 'Competitor', key: 'is_competitor', width: 12 },
    { header: 'Snippet', key: 'snippet', width: 50 },
    { header: 'Excerpt', key: 'excerpt', width: 50 },
    { header: 'Sentiment', key: 'sentiment', width: 12 },
    { header: 'Score', key: 'sentiment_score', width: 10 },
    { header: 'Temi', key: 'themes', width: 30 },
    { header: 'Entità', key: 'entities', width: 30 },
    { header: 'Sommario AI', key: 'summary', width: 50 },
    { header: 'Alert', key: 'alert', width: 8 },
    { header: 'Motivo Alert', key: 'alert_reason', width: 40 },
  ];

  applyHeaderStyle(resultsSheet);
  setAutoFilter(resultsSheet, 18);

  results.forEach((r) => {
    resultsSheet.addRow({
      scan_date: r.scan_completed_at ? new Date(r.scan_completed_at).toLocaleDateString('it-IT') : '',
      pub_date: r.fetched_at ? new Date(r.fetched_at).toLocaleDateString('it-IT') : '',
      keyword: r.keyword,
      source: r.source,
      position: r.position,
      title: r.title,
      url: r.url,
      domain: r.domain,
      is_competitor: r.is_competitor ? 'Sì' : 'No',
      snippet: r.snippet,
      excerpt: r.excerpt || '',
      sentiment: r.ai_analysis?.sentiment || '',
      sentiment_score: r.ai_analysis?.sentiment_score ?? '',
      themes: r.ai_analysis?.themes?.map((t) => t.name).join(', ') || '',
      entities: r.ai_analysis?.entities?.map((e) => e.name).join(', ') || '',
      summary: r.ai_analysis?.summary || '',
      alert: r.ai_analysis?.is_hi_priority ? 'Sì' : 'No',
      alert_reason: r.ai_analysis?.priority_reason || '',
    });
  });

  applyAutoWidth(resultsSheet);

  // ---------------------------------------------------------------------------
  // Sheet 3: Competitor Analysis (filtered by projectCompetitors)
  // ---------------------------------------------------------------------------
  const compSheet = workbook.addWorksheet('Competitor Analysis');
  compSheet.columns = [
    { header: 'Dominio', key: 'domain', width: 25 },
    { header: 'Menzioni Totali', key: 'mentions', width: 16 },
    { header: 'Keywords Presenti', key: 'keywords', width: 30 },
    { header: 'Posizione Media', key: 'avg_position', width: 16 },
    { header: 'Temi Dominanti', key: 'themes', width: 30 },
    { header: 'Sentiment Medio', key: 'avg_sentiment', width: 16 },
  ];

  applyHeaderStyle(compSheet);
  setAutoFilter(compSheet, 6);

  // Filter competitors: use projectCompetitors if available, otherwise fall back to is_competitor flag
  let filteredCompetitors: CompetitorSummary[];
  if (projectCompetitors && projectCompetitors.length > 0) {
    const competitorDomains = new Set(
      projectCompetitors.map((c) => c.toLowerCase().replace(/^www\./, ''))
    );
    filteredCompetitors = competitors.filter((c) => {
      const normalizedDomain = c.domain.toLowerCase().replace(/^www\./, '');
      return competitorDomains.has(normalizedDomain);
    });
  } else {
    filteredCompetitors = competitors;
  }

  filteredCompetitors.forEach((c) => {
    compSheet.addRow({
      domain: c.domain,
      mentions: c.total_mentions,
      keywords: c.keywords.join(', '),
      avg_position: c.avg_position,
      themes: c.dominant_themes.join(', '),
      avg_sentiment: c.avg_sentiment,
    });
  });

  applyAutoWidth(compSheet);

  // ---------------------------------------------------------------------------
  // Sheet 4: Entita
  // ---------------------------------------------------------------------------
  const entitySheet = workbook.addWorksheet('Entità');
  entitySheet.columns = [
    { header: 'Nome', key: 'name', width: 30 },
    { header: 'Tipo', key: 'type', width: 20 },
    { header: 'Menzioni', key: 'count', width: 14 },
    { header: 'Sentiment Medio', key: 'avg_sentiment', width: 16 },
  ];

  applyHeaderStyle(entitySheet);
  setAutoFilter(entitySheet, 4);

  if (entities && entities.length > 0) {
    entities.forEach((e) => {
      entitySheet.addRow({
        name: e.name,
        type: e.type,
        count: e.count,
        avg_sentiment: e.avg_sentiment,
      });
    });
  }

  applyAutoWidth(entitySheet);

  // ---------------------------------------------------------------------------
  // Sheet 5: Trend Summary (existing, kept as-is)
  // ---------------------------------------------------------------------------
  const trendSheet = workbook.addWorksheet('Trend Summary');
  trendSheet.columns = [
    { header: 'Tema', key: 'theme', width: 25 },
    { header: 'Occorrenze Totali', key: 'total', width: 18 },
    { header: 'Sentiment Medio', key: 'avg_sentiment', width: 16 },
    { header: 'Prima Apparizione', key: 'first_seen', width: 18 },
    { header: 'Ultima Apparizione', key: 'last_seen', width: 18 },
    { header: 'Trend', key: 'trend', width: 12 },
  ];

  applyHeaderStyle(trendSheet);
  setAutoFilter(trendSheet, 6);

  trends.forEach((t) => {
    trendSheet.addRow({
      theme: t.theme,
      total: t.total_occurrences,
      avg_sentiment: t.avg_sentiment,
      first_seen: t.first_seen,
      last_seen: t.last_seen,
      trend: t.trend_direction,
    });
  });

  applyAutoWidth(trendSheet);

  // ---------------------------------------------------------------------------
  // Sheet 6: Alert Prioritari
  // ---------------------------------------------------------------------------
  const alertSheet = workbook.addWorksheet('Alert Prioritari');
  alertSheet.columns = [
    { header: 'Data Scan', key: 'scan_date', width: 15 },
    { header: 'Titolo', key: 'title', width: 40 },
    { header: 'URL', key: 'url', width: 40 },
    { header: 'Dominio', key: 'domain', width: 25 },
    { header: 'Keyword', key: 'keyword', width: 20 },
    { header: 'Motivo Alert', key: 'alert_reason', width: 50 },
    { header: 'Sommario AI', key: 'summary', width: 50 },
  ];

  applyHeaderStyle(alertSheet);
  setAutoFilter(alertSheet, 7);

  // Filter only high-priority results
  const alertResults = results.filter(r => r.ai_analysis?.is_hi_priority);
  alertResults.forEach((r) => {
    alertSheet.addRow({
      scan_date: r.scan_completed_at ? new Date(r.scan_completed_at).toLocaleDateString('it-IT') : '',
      title: r.title,
      url: r.url,
      domain: r.domain,
      keyword: r.keyword,
      alert_reason: r.ai_analysis?.priority_reason || '',
      summary: r.ai_analysis?.summary || '',
    });
  });

  applyAutoWidth(alertSheet);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
