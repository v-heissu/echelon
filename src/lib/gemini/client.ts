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
  is_competitor: boolean;
  is_hi_priority: boolean;
  priority_reason: string | null;
}

interface GeminiResponse {
  results: AnalysisResult[];
  discovered_competitors: string[];
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
    results: AnalysisInput[],
    alertKeywords: string[] = []
  ): Promise<GeminiResponse> {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    const alertBlock = alertKeywords.length > 0
      ? `\n7. is_hi_priority: true se il contenuto menziona o è semanticamente correlato a uno di questi "alert keywords": ${JSON.stringify(alertKeywords)}. Valuta anche sinonimi, riferimenti indiretti, e contesti correlati.
8. priority_reason: se is_hi_priority è true, spiega brevemente (max 1 frase) quale alert keyword è stata riconosciuta e perché. Se false, null.\n`
      : `\n7. is_hi_priority: false (nessun alert keyword configurato)
8. priority_reason: null\n`;

    const prompt = `Sei un analista di intelligence competitiva. Analizza i seguenti risultati SERP e il contenuto estratto dalle pagine.

Per OGNI risultato, fornisci:
1. themes: array di 1-5 temi principali, ognuno con "name" (stringa, lowercase, singolare) e "confidence" (numero da 0.0 a 1.0 che indica la rilevanza del tema)
2. sentiment: positive | negative | neutral | mixed
3. sentiment_score: da -1.0 a 1.0
4. entities: array di entità rilevanti con tipo (brand, person, product, technology, location)
5. summary: riassunto in 1-2 frasi del contenuto
6. is_competitor: true se il dominio sembra appartenere a un competitor nel settore "${industry}", false altrimenti
${alertBlock}
Inoltre, nel campo "discovered_competitors" a livello root, elenca i domini (solo hostname senza www) che identifichi come competitor nel settore.

Rispondi SOLO con JSON valido, nessun testo prima o dopo.
Output format:
{
  "results": [{
    "position": N,
    "themes": [{"name": "tema", "confidence": 0.9}],
    "sentiment": "neutral",
    "sentiment_score": 0.0,
    "entities": [{"name": "Entità", "type": "brand"}],
    "summary": "Riassunto del contenuto...",
    "is_competitor": false,
    "is_hi_priority": false,
    "priority_reason": null
  }],
  "discovered_competitors": ["domain1.com", "domain2.com"]
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
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
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

    const descriptionBlock = input.description
      ? `\nDESCRIZIONE / CONTESTO FORNITO DALL'UTENTE:\n"""${input.description}"""\n\nIMPORTANTE: La descrizione qui sopra è il contesto chiave fornito dall'utente. Usala come base principale per generare keyword, competitor e configurazione. Le keyword e i competitor devono essere strettamente pertinenti al contesto descritto, non solo al nome del progetto.\n`
      : '';

    const prompt = `Sei un esperto di brand intelligence e monitoraggio della reputazione online.
Dato il nome di un progetto/brand e la descrizione del contesto fornita dall'utente, suggerisci i campi per configurare un progetto di monitoraggio SERP.

NOME PROGETTO: ${input.name}
${descriptionBlock}
Genera:
1. "industry": la industry/settore più appropriato (una parola o breve frase, es: "fintech", "automotive", "fashion luxury"). Se la descrizione indica un settore specifico, usalo.
2. "keywords": array di 15-25 keyword strategiche da monitorare nelle SERP. Includi:
   - Il nome del brand/progetto e sue varianti
   - Keyword specifiche derivate dalla descrizione fornita dall'utente
   - Keyword di settore rilevanti al contesto descritto
   - Combinazioni brand + settore
   - Keyword di reputazione (es: "brand recensioni", "brand opinioni")
   - Keyword long-tail relative al brand e al contesto
   - Keyword informazionali legate al settore
3. "competitors": array di 8-15 domini di competitor reali e plausibili nel settore (solo dominio, es: "competitor.com"). Includi competitor diretti, indiretti e brand affini. Se la descrizione menziona competitor specifici, includili.
4. "language": codice lingua più appropriato ("it", "en", "de", "fr", "es"). Se la descrizione è in una lingua specifica, usa quella.
5. "location_code": codice DataForSEO per la location (2380=Italia, 2840=USA, 2826=UK, 2276=Germania, 2250=Francia, 2724=Spagna). Scegli in base al contesto della descrizione.
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
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }

    throw new Error('Gemini autofill failed after retries');
  }
}
