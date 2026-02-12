import { SerpSource } from '@/types/database';

interface SerpItem {
  position: number;
  url: string;
  title: string;
  description: string;
  domain: string;
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
    depth: number = 20
  ): Promise<SerpItem[]> {
    const endpoint = source === 'google_organic'
      ? '/serp/google/organic/live/advanced'
      : '/serp/google/news/live/advanced';

    const body = [
      {
        keyword,
        language_code: language,
        location_code: locationCode,
        depth,
      },
    ];

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
      }))
      .slice(0, depth);
  }
}
