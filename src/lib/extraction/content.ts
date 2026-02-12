import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
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

    // Try Readability first
    const readabilityResult = tryReadability(html, url);
    if (readabilityResult) {
      return readabilityResult.slice(0, MAX_EXCERPT_LENGTH);
    }

    // Fallback to Cheerio
    const cheerioResult = tryCheerio(html);
    if (cheerioResult) {
      return cheerioResult.slice(0, MAX_EXCERPT_LENGTH);
    }

    return null;
  } catch {
    return null;
  }
}

function tryReadability(html: string, url: string): string | null {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    return article?.textContent?.trim() || null;
  } catch {
    return null;
  }
}

function tryCheerio(html: string): string | null {
  try {
    const $ = cheerio.load(html);

    // Get meta description
    const metaDesc =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '';

    // Get first 3 paragraphs
    const paragraphs: string[] = [];
    $('article p, main p, .content p, p').each((i, el) => {
      if (paragraphs.length < 3) {
        const text = $(el).text().trim();
        if (text.length > 50) {
          paragraphs.push(text);
        }
      }
    });

    const combined = [metaDesc, ...paragraphs].filter(Boolean).join('\n\n');
    return combined || null;
  } catch {
    return null;
  }
}
