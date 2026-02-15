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

export interface TagGroupInput {
  name: string;
  slug: string;
  count: number;
}

export interface TagGroup {
  canonical: string;
  duplicates: string[];
}

export interface RelevanceInput {
  id: string;
  title: string;
  url: string;
  snippet: string;
  summary: string;
  themes: { name: string }[];
}

export interface RelevanceResult {
  id: string;
  is_off_topic: boolean;
  reason: string | null;
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

  async evaluateRelevance(
    projectContext: {
      name: string;
      industry: string;
      keywords: string[];
      competitors: string[];
      project_context: string | null;
    },
    results: RelevanceInput[]
  ): Promise<RelevanceResult[]> {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    const contextBlock = projectContext.project_context
      ? `\nCONTESTO PROGETTO: ${projectContext.project_context}`
      : '';

    const prompt = `Sei un analista di intelligence competitiva. Il tuo compito è identificare risultati SERP OFF-TOPIC rispetto al progetto monitorato.

PROGETTO: ${projectContext.name}
SETTORE: ${projectContext.industry}
KEYWORD MONITORATE: ${JSON.stringify(projectContext.keywords)}
COMPETITOR NOTI: ${JSON.stringify(projectContext.competitors)}${contextBlock}

Per OGNI risultato, valuta se è PERTINENTE al progetto oppure OFF-TOPIC.
Un risultato è OFF-TOPIC se:
- NON riguarda il brand, l'azienda, il settore o i competitor del progetto
- Parla di un omonimo in un contesto completamente diverso (es: keyword "Apple" → risultato su mele frutta, non Apple Inc.)
- È spam, contenuto generico non correlato, o un falso positivo della SERP
- Non ha alcuna rilevanza per il monitoraggio della reputazione o della concorrenza del progetto

Un risultato è PERTINENTE se:
- Menziona direttamente il brand, i prodotti o i servizi dell'azienda
- Riguarda il settore di riferimento o i competitor
- Contiene informazioni utili per il monitoraggio della reputazione
- Anche se indirettamente collegato al contesto del progetto

Sii conservativo: in caso di dubbio, il risultato è PERTINENTE (is_off_topic: false).

Rispondi SOLO con JSON valido.
Output format:
{
  "results": [
    { "id": "uuid", "is_off_topic": false, "reason": null },
    { "id": "uuid", "is_off_topic": true, "reason": "Breve spiegazione del perché è off-topic" }
  ]
}

RISULTATI DA VALUTARE:
${JSON.stringify(results, null, 2)}`;

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = JSON.parse(text) as { results: RelevanceResult[] };

        if (!parsed.results || !Array.isArray(parsed.results)) {
          throw new Error('Invalid relevance response structure');
        }

        return parsed.results;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }

    throw new Error('Gemini relevance evaluation failed after retries');
  }

  async findDuplicateTags(
    projectContext: { name: string; industry: string },
    tags: TagGroupInput[]
  ): Promise<TagGroup[]> {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    const prompt = `Sei un analista di dati. Il tuo compito è identificare tag RIDONDANTI o DUPLICATI semantici in una lista di tag usati per classificare risultati SERP.

PROGETTO: ${projectContext.name}
SETTORE: ${projectContext.industry}

Raggruppa i tag che sono semanticamente equivalenti. Esempi di duplicati:
- Singolare/plurale: "regulation" e "regulations"
- Abbreviazioni: "artificial intelligence" e "AI", "machine learning" e "ML"
- Varianti ortografiche: "cyber security", "cybersecurity", "cyber-security"
- Sinonimi stretti nello stesso dominio: "data breach" e "data leak"
- Stessa parola con/senza accenti o caratteri speciali

NON raggruppare tag che sono semplicemente correlati ma distinti (es: "privacy" e "data protection" sono diversi).

Per ogni gruppo, indica:
- "canonical": il nome del tag da tenere (preferisci quello con count più alto, o quello più descrittivo/completo)
- "duplicates": array dei NOMI dei tag duplicati da unire nel canonical (escluso il canonical stesso)

Rispondi SOLO con JSON valido. Se non ci sono duplicati, rispondi con un array vuoto.
Output format:
{
  "groups": [
    { "canonical": "artificial intelligence", "duplicates": ["ai", "a.i."] },
    { "canonical": "cybersecurity", "duplicates": ["cyber security", "cyber-security"] }
  ]
}

TAG DA ANALIZZARE:
${JSON.stringify(tags, null, 2)}`;

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = JSON.parse(text) as { groups: TagGroup[] };

        if (!parsed.groups || !Array.isArray(parsed.groups)) {
          throw new Error('Invalid tag grouping response structure');
        }

        return parsed.groups;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }

    throw new Error('Gemini tag grouping failed after retries');
  }
}
