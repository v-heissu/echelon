import * as cheerio from 'cheerio';

const MAX_EXCERPT_LENGTH = 2000;
const FETCH_TIMEOUT = 10000;

export async function extractContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();

    // Extract content using Cheerio (lightweight, Vercel-compatible)
    const result = extractWithCheerio(html);
    if (result) {
      return result.slice(0, MAX_EXCERPT_LENGTH);
    }

    return null;
  } catch {
    return null;
  }
}

function extractWithCheerio(html: string): string | null {
  try {
    const $ = cheerio.load(html);

    // Remove script, style, nav, footer, header, aside elements
    $('script, style, nav, footer, header, aside, .nav, .footer, .header, .sidebar, .ad, .ads, .cookie, .banner').remove();

    // Get meta description
    const metaDesc =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '';

    // Try to find article/main content first
    const contentSelectors = ['article', 'main', '[role="main"]', '.post-content', '.article-content', '.entry-content', '.content'];
    let contentArea = $('body');

    for (const selector of contentSelectors) {
      const el = $(selector);
      if (el.length > 0 && el.text().trim().length > 200) {
        contentArea = el;
        break;
      }
    }

    // Get paragraphs from content area
    const paragraphs: string[] = [];
    contentArea.find('p').each((_i, el) => {
      if (paragraphs.length < 8) {
        const text = $(el).text().trim();
        if (text.length > 40) {
          paragraphs.push(text);
        }
      }
    });

    // If no paragraphs found, try headings + any text
    if (paragraphs.length === 0) {
      contentArea.find('h1, h2, h3, li, td, dd').each((_i, el) => {
        if (paragraphs.length < 5) {
          const text = $(el).text().trim();
          if (text.length > 30) {
            paragraphs.push(text);
          }
        }
      });
    }

    const combined = [metaDesc, ...paragraphs].filter(Boolean).join('\n\n');
    return combined || null;
  } catch {
    return null;
  }
}
