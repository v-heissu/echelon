import { GoogleGenerativeAI } from '@google/generative-ai';

interface AnalysisInput {
  position: number;
  title: string;
  url: string;
  snippet: string;
  excerpt: string | null;
}

interface AnalysisResult {
  position: number;
  themes: { name: string; confidence: number }[];
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  sentiment_score: number;
  entities: { name: string; type: string }[];
  summary: string;
}

interface GeminiResponse {
  results: AnalysisResult[];
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private modelName = 'gemini-2.0-flash';

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  async analyzeSerpResults(
    keyword: string,
    industry: string,
    results: AnalysisInput[]
  ): Promise<GeminiResponse> {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    const prompt = `Sei un analista di intelligence competitiva. Analizza i seguenti risultati SERP e il contenuto estratto dalle pagine.

Per OGNI risultato, fornisci:
1. themes: array di 1-5 temi principali (normalizzati in lowercase, singolare)
2. sentiment: positive | negative | neutral | mixed
3. sentiment_score: da -1.0 a 1.0
4. entities: array di entità rilevanti con tipo (brand, person, product, technology, location)
5. summary: riassunto in 1-2 frasi del contenuto

Rispondi SOLO con JSON valido, nessun testo prima o dopo.
Output format:
{
  "results": [{
    "position": N,
    "themes": [{"name": "tema", "confidence": 0.9}],
    "sentiment": "neutral",
    "sentiment_score": 0.0,
    "entities": [{"name": "Entità", "type": "brand"}],
    "summary": "Riassunto del contenuto..."
  }]
}

KEYWORD: ${keyword}
INDUSTRY: ${industry}

RISULTATI:
${JSON.stringify(results, null, 2)}`;

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = JSON.parse(text) as GeminiResponse;

        if (!parsed.results || !Array.isArray(parsed.results)) {
          throw new Error('Invalid response structure');
        }

        return parsed;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    throw new Error('Gemini analysis failed after retries');
  }
}
