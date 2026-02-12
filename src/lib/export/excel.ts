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

export async function generateExcel(
  results: SerpResultWithAnalysis[],
  trends: TrendSummary[],
  competitors: CompetitorSummary[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Echelon Web Monitor';

  // Sheet 1: Results
  const resultsSheet = workbook.addWorksheet('Risultati');
  resultsSheet.columns = [
    { header: 'Data Scan', key: 'date', width: 15 },
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
  ];

  resultsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  resultsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF001437' },
  };

  results.forEach((r) => {
    resultsSheet.addRow({
      date: r.fetched_at ? new Date(r.fetched_at).toLocaleDateString('it-IT') : '',
      keyword: r.keyword,
      source: r.source,
      position: r.position,
      title: r.title,
      url: r.url,
      domain: r.domain,
      is_competitor: r.is_competitor ? 'Si' : 'No',
      snippet: r.snippet,
      excerpt: r.excerpt || '',
      sentiment: r.ai_analysis?.sentiment || '',
      sentiment_score: r.ai_analysis?.sentiment_score ?? '',
      themes: r.ai_analysis?.themes?.map((t) => t.name).join(', ') || '',
      entities: r.ai_analysis?.entities?.map((e) => e.name).join(', ') || '',
      summary: r.ai_analysis?.summary || '',
    });
  });

  // Sheet 2: Trend Summary
  const trendSheet = workbook.addWorksheet('Trend Summary');
  trendSheet.columns = [
    { header: 'Tema', key: 'theme', width: 25 },
    { header: 'Occorrenze Totali', key: 'total', width: 18 },
    { header: 'Sentiment Medio', key: 'avg_sentiment', width: 16 },
    { header: 'Prima Apparizione', key: 'first_seen', width: 18 },
    { header: 'Ultima Apparizione', key: 'last_seen', width: 18 },
    { header: 'Trend', key: 'trend', width: 12 },
  ];

  trendSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  trendSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF001437' },
  };

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

  // Sheet 3: Competitor Analysis
  const compSheet = workbook.addWorksheet('Competitor Analysis');
  compSheet.columns = [
    { header: 'Dominio', key: 'domain', width: 25 },
    { header: 'Menzioni Totali', key: 'mentions', width: 16 },
    { header: 'Keywords Presenti', key: 'keywords', width: 30 },
    { header: 'Posizione Media', key: 'avg_position', width: 16 },
    { header: 'Temi Dominanti', key: 'themes', width: 30 },
    { header: 'Sentiment Medio', key: 'avg_sentiment', width: 16 },
  ];

  compSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  compSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF001437' },
  };

  competitors.forEach((c) => {
    compSheet.addRow({
      domain: c.domain,
      mentions: c.total_mentions,
      keywords: c.keywords.join(', '),
      avg_position: c.avg_position,
      themes: c.dominant_themes.join(', '),
      avg_sentiment: c.avg_sentiment,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
