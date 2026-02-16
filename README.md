# Echelon - SERP & News Monitoring Platform

Piattaforma di monitoraggio SERP e news con analisi AI. Echelon raccoglie risultati dai motori di ricerca e dalle news, li analizza tramite intelligenza artificiale (Google Gemini) e genera report di competitive intelligence con sentiment analysis, estrazione entita e briefing esecutivi.

## Stack Tecnologico

| Layer | Tecnologia |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS 3.4 |
| **Database** | Supabase (PostgreSQL + Auth + Row-Level Security) |
| **SERP Data** | DataForSEO API (Google Organic + Google News) |
| **AI Analysis** | Google Gemini 2.0 Flash |
| **Grafici** | Recharts 3.7, Nivo (bar, circle-packing, heatmap) |
| **Export** | ExcelJS 4.4 (multi-sheet Excel con formattazione) |
| **Hosting** | Vercel (con cron jobs) |
| **Content Extraction** | Cheerio (parsing HTML) |

## Documentazione

- [Architettura di Sistema](docs/ARCHITECTURE.md) - Schema DB, pipeline, struttura progetto
- [Guida all'Uso](docs/USAGE.md) - Logica operativa e flussi utente
- [Riferimento API](docs/API.md) - Tutti gli endpoint REST

## Quick Start

### Prerequisiti

- Node.js 18+
- Account [Supabase](https://supabase.com) (progetto creato)
- Account [DataForSEO](https://dataforseo.com) (credenziali API)
- [Gemini API Key](https://aistudio.google.com/apikey) (piano gratuito sufficiente)
- Account [Vercel](https://vercel.com) (per il deploy con cron)

### Installazione

```bash
# 1. Clona il repository
git clone <repo-url> echelon
cd echelon

# 2. Installa le dipendenze
npm install

# 3. Configura le variabili d'ambiente
cp .env.example .env.local
# Compila .env.local con le tue credenziali (vedi sezione sotto)

# 4. Esegui le migrazioni SQL
# Esegui tutti i file in supabase/migrations/ (001-013) sul tuo progetto Supabase
# tramite il SQL Editor di Supabase Dashboard

# 5. Crea l'utente admin
curl -X POST http://localhost:3000/api/auth/seed \
  -H "Content-Type: application/json" \
  -d '{"secret": "your-cron-secret"}'

# 6. Avvia in sviluppo
npm run dev
```

### Variabili d'Ambiente

Copia `.env.example` in `.env.local` e configura:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# DataForSEO
DATAFORSEO_LOGIN=your-login
DATAFORSEO_PASSWORD=your-password

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key

# Sicurezza
CRON_SECRET=your-cron-secret          # Protegge gli endpoint cron
WORKER_SECRET=your-worker-secret      # Protegge il worker di processing

# Admin iniziale
ADMIN_EMAIL=admin@echelon.local
ADMIN_PASSWORD=change-me-on-first-login
```

### Script Disponibili

```bash
npm run dev      # Server di sviluppo (http://localhost:3000)
npm run build    # Build di produzione
npm run start    # Avvia il server di produzione
npm run lint     # ESLint con regole Next.js
```

## Struttura del Progetto

```
echelon/
├── src/
│   ├── app/                    # Next.js App Router (pagine + API)
│   │   ├── admin/              # Dashboard amministrativa
│   │   ├── project/[slug]/     # Dashboard progetto cliente
│   │   ├── api/                # 30 endpoint REST
│   │   └── login/              # Autenticazione
│   ├── components/             # Componenti React riutilizzabili
│   │   ├── ui/                 # Componenti base (button, card, input, ...)
│   │   ├── layout/             # Sidebar e footer
│   │   └── dashboard/          # Grafici e visualizzazioni
│   ├── lib/                    # Logica di business
│   │   ├── gemini/             # Client Gemini AI
│   │   ├── dataforseo/         # Client DataForSEO
│   │   ├── agents/             # Agenti AI (briefing, filtro, normalizzazione, blacklist)
│   │   ├── extraction/         # Estrazione contenuti web
│   │   ├── export/             # Generazione Excel
│   │   ├── worker/             # Pipeline elaborazione job
│   │   └── supabase/           # Client database
│   └── types/                  # Tipi TypeScript
├── supabase/
│   └── migrations/             # 13 migrazioni SQL
├── vercel.json                 # Configurazione cron Vercel
└── package.json
```

## Licenza

Progetto privato. Tutti i diritti riservati.
