import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ProjectAutofillInput {
  name: string;
  description?: string;
}

export interface ProjectAutofillResult {
  industry: string;
  keywords: string[];
  competitors: string[];
  language: string;
  location_code: number;
  sources: string[];
  schedule: string;
}

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

  async suggestProjectFields(input: ProjectAutofillInput): Promise<ProjectAutofillResult> {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      },
    });

    const prompt = `Sei un esperto di brand intelligence e monitoraggio della reputazione online.
Dato il nome di un progetto/brand e un'eventuale descrizione, suggerisci i campi per configurare un progetto di monitoraggio SERP.

NOME PROGETTO: ${input.name}
${input.description ? `DESCRIZIONE: ${input.description}` : ''}

Genera:
1. "industry": la industry/settore più appropriato (una parola o breve frase, es: "fintech", "automotive", "fashion luxury")
2. "keywords": array di 5-10 keyword strategiche da monitorare nelle SERP. Includi:
   - Il nome del brand/progetto e sue varianti
   - Keyword di settore rilevanti
   - Combinazioni brand + settore
   - Keyword di reputazione (es: "brand recensioni", "brand opinioni")
3. "competitors": array di 3-5 domini di competitor reali e plausibili nel settore (solo dominio, es: "competitor.com")
4. "language": codice lingua più appropriato ("it", "en", "de", "fr", "es")
5. "location_code": codice DataForSEO per la location (2380=Italia, 2840=USA, 2826=UK, 2276=Germania, 2250=Francia, 2724=Spagna)
6. "sources": array di fonti SERP consigliate, scegli tra "google_organic" e "google_news"
7. "schedule": frequenza consigliata ("weekly", "monthly", "manual")

Rispondi SOLO con JSON valido.
Output format:
{
  "industry": "settore",
  "keywords": ["keyword1", "keyword2", ...],
  "competitors": ["domain1.com", "domain2.com", ...],
  "language": "it",
  "location_code": 2380,
  "sources": ["google_organic", "google_news"],
  "schedule": "weekly"
}`;

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = JSON.parse(text) as ProjectAutofillResult;

        if (!parsed.industry || !Array.isArray(parsed.keywords)) {
          throw new Error('Invalid autofill response structure');
        }

        return parsed;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    throw new Error('Gemini autofill failed after retries');
  }
}
