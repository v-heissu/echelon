import { SerpSource } from '@/types/database';

interface SerpItem {
  position: number;
  url: string;
  title: string;
  description: string;
  domain: string;
  published_at: string | null;
}

/**
 * Build a Google tbs (to-be-searched) date-range parameter.
 * Format: cdr:1,cd_min:MM/DD/YYYY,cd_max:MM/DD/YYYY
 * - If only dateTo is provided → everything up to that date (first scan)
 * - If both → incremental window
 */
function buildDateParam(dateFrom?: string | null, dateTo?: string | null): string | null {
  if (!dateFrom && !dateTo) return null;

  const parts: string[] = ['cdr:1'];

  if (dateFrom) {
    const d = new Date(dateFrom);
    parts.push(`cd_min:${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`);
  }

  if (dateTo) {
    const d = new Date(dateTo);
    parts.push(`cd_max:${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`);
  }

  return parts.join(',');
}

export class DataForSEOClient {
  private login: string;
  private password: string;
  private baseUrl = 'https://api.dataforseo.com/v3';

  constructor() {
    this.login = process.env.DATAFORSEO_LOGIN!;
    this.password = process.env.DATAFORSEO_PASSWORD!;
  }

  private get authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.login}:${this.password}`).toString('base64');
  }

  async fetchSERP(
    keyword: string,
    source: SerpSource,
    language: string,
    locationCode: number,
    depth: number = 30,
    dateFrom?: string | null,
    dateTo?: string | null,
  ): Promise<SerpItem[]> {
    const endpoint = source === 'google_organic'
      ? '/serp/google/organic/live/advanced'
      : '/serp/google/news/live/advanced';

    const dateTbs = buildDateParam(dateFrom, dateTo);
    // For news, also sort by date (sbd:1) so newest come first
    const tbsParts: string[] = [];
    if (dateTbs) tbsParts.push(dateTbs);
    if (source === 'google_news') tbsParts.push('sbd:1');

    const searchParam = tbsParts.length > 0 ? `tbs=${tbsParts.join(',')}` : undefined;

    const requestBody: Record<string, unknown> = {
      keyword,
      language_code: language,
      location_code: locationCode,
      depth,
    };

    if (searchParam) {
      requestBody.search_param = searchParam;
    }

    const body = [requestBody];

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`DataForSEO API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.tasks?.[0]?.result?.[0]?.items) {
      return [];
    }

    const items = data.tasks[0].result[0].items;

    return items
      .filter((item: Record<string, unknown>) => item.type === 'organic' || item.type === 'news_search')
      .map((item: Record<string, unknown>) => ({
        position: item.rank_absolute as number || item.position as number || 0,
        url: item.url as string || '',
        title: item.title as string || '',
        description: item.description as string || item.snippet as string || '',
        domain: item.domain as string || '',
        published_at: (item.timestamp as string) || (item.datetime as string) || null,
      }))
      .slice(0, depth);
  }
}
