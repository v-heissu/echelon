# Architettura di Sistema

## Panoramica

Echelon e una piattaforma SaaS di monitoraggio SERP e news con analisi AI. L'architettura segue il pattern di Next.js 14 App Router con API Routes server-side, database Supabase con Row-Level Security e una pipeline asincrona di elaborazione basata su coda di job.

```
┌─────────────────────────────────────────────────────────┐
│                        FRONTEND                         │
│  Next.js 14 App Router + React 18 + Tailwind CSS        │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Admin    │  │  Progetto    │  │  Login            │  │
│  │  Dashboard│  │  Dashboard   │  │  (Supabase Auth)  │  │
│  └──────────┘  └──────────────┘  └──────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ API Routes
┌───────────────────────▼─────────────────────────────────┐
│                      BACKEND                             │
│  Next.js API Routes (30 endpoint)                        │
│  ┌────────────┐  ┌────────────┐  ┌───────────────────┐  │
│  │  Admin API  │  │  Data API  │  │  Cron / Worker    │  │
│  │  (CRUD)     │  │  (Query)   │  │  (Pipeline)       │  │
│  └────────────┘  └────────────┘  └───────────────────┘  │
└────┬──────────────────┬──────────────────┬──────────────┘
     │                  │                  │
┌────▼────┐  ┌──────────▼────────┐  ┌─────▼──────────────┐
│Supabase │  │  DataForSEO API   │  │  Google Gemini     │
│PostgreSQL│  │  (SERP + News)    │  │  2.0 Flash (AI)    │
│+ Auth    │  └───────────────────┘  └────────────────────┘
└──────────┘
```

## Schema Database

### Tabelle Principali

#### `users`
Utenti della piattaforma, collegati a Supabase Auth.

| Colonna | Tipo | Note |
|---------|------|------|
| id | UUID (PK) | Riferimento a `auth.users` |
| email | TEXT | Email dell'utente |
| display_name | TEXT | Nome visualizzato |
| role | `user_role` | `admin` o `client` |
| created_at | TIMESTAMPTZ | Data creazione |

#### `projects`
Progetti di monitoraggio. Ogni progetto traccia un set di keyword su fonti configurabili.

| Colonna | Tipo | Note |
|---------|------|------|
| id | UUID (PK) | |
| slug | TEXT (UNIQUE) | URL-friendly identifier |
| name | TEXT | Nome del progetto |
| industry | TEXT | Settore industriale |
| keywords | JSONB | Array di keyword da monitorare |
| competitors | JSONB | Array di domini competitor |
| sources | JSONB | `["google_organic", "google_news"]` |
| schedule | `schedule_type` | `weekly`, `monthly`, `manual` |
| schedule_day | INT | Giorno della settimana (0-6) o del mese (1-31) |
| language | TEXT | Codice lingua (default: `it`) |
| location_code | INT | Codice localita DataForSEO (default: `2380` = Italia) |
| alert_keywords | JSONB | Keyword per alert prioritari |
| context | TEXT | Contesto semantico per il filtro AI |
| is_active | BOOLEAN | Progetto attivo/disattivo |

#### `project_users`
Associazione utente-progetto con ruoli.

| Colonna | Tipo | Note |
|---------|------|------|
| project_id | UUID (PK) | FK a `projects` |
| user_id | UUID (PK) | FK a `users` |
| role | `project_role` | `viewer` o `editor` |

#### `scans`
Esecuzioni di scansione. Ogni scan raccoglie risultati per tutte le keyword del progetto.

| Colonna | Tipo | Note |
|---------|------|------|
| id | UUID (PK) | |
| project_id | UUID | FK a `projects` |
| trigger_type | TEXT | `manual` o `scheduled` |
| status | `scan_status` | `pending`, `running`, `completed`, `failed` |
| total_tasks | INT | Numero totale di job (keyword x fonti) |
| completed_tasks | INT | Job completati (per progress bar) |
| date_from | TIMESTAMPTZ | Inizio range incrementale |
| date_to | TIMESTAMPTZ | Fine range incrementale |
| ai_briefing | TEXT | Briefing esecutivo generato dall'AI |
| started_at / completed_at | TIMESTAMPTZ | Timestamp esecuzione |

#### `serp_results`
Singoli risultati SERP raccolti da DataForSEO.

| Colonna | Tipo | Note |
|---------|------|------|
| id | UUID (PK) | |
| scan_id | UUID | FK a `scans` |
| keyword | TEXT | Keyword di ricerca |
| source | `serp_source` | `google_organic` o `google_news` |
| position | INT | Posizione nella SERP |
| url | TEXT | URL del risultato |
| title | TEXT | Titolo della pagina |
| snippet | TEXT | Snippet dalla SERP |
| domain | TEXT | Dominio estratto dall'URL |
| is_competitor | BOOLEAN | Dominio marcato come competitor |
| excerpt | TEXT | Contenuto estratto dalla pagina (max 2000 char) |

#### `ai_analysis`
Analisi AI di ogni risultato SERP tramite Gemini.

| Colonna | Tipo | Note |
|---------|------|------|
| id | UUID (PK) | |
| serp_result_id | UUID | FK a `serp_results` |
| themes | JSONB | Array di temi con confidence (`[{"name": "...", "confidence": 0.9}]`) |
| sentiment | `sentiment_type` | `positive`, `negative`, `neutral`, `mixed` |
| sentiment_score | FLOAT | Score da -1.0 (negativo) a +1.0 (positivo) |
| entities | JSONB | Entita estratte (`[{"name": "...", "type": "brand", "sentiment": "positive"}]`) |
| summary | TEXT | Riassunto AI del contenuto |
| language_detected | TEXT | Lingua rilevata |
| is_priority | BOOLEAN | Contiene alert keyword |

#### `tags`
Tag materializzati dai temi dell'analisi AI. Aggregano i conteggi per progetto.

| Colonna | Tipo | Note |
|---------|------|------|
| id | UUID (PK) | |
| project_id | UUID | FK a `projects` |
| name | TEXT | Nome del tag |
| slug | TEXT | Versione URL-friendly |
| count | INT | Numero di occorrenze totali |
| last_seen_at | TIMESTAMPTZ | Ultimo scan in cui e apparso |

#### `tag_scans`
Conteggi tag per singola scansione (per analisi trend).

| Colonna | Tipo | Note |
|---------|------|------|
| tag_id | UUID | FK a `tags` |
| scan_id | UUID | FK a `scans` |
| count | INT | Occorrenze in questo scan |
| avg_sentiment | FLOAT | Sentiment medio per questo tag in questo scan |

#### `job_queue`
Coda di job asincroni per l'elaborazione SERP.

| Colonna | Tipo | Note |
|---------|------|------|
| id | UUID (PK) | |
| scan_id | UUID | FK a `scans` |
| keyword | TEXT | Keyword da cercare |
| source | `serp_source` | Fonte da interrogare |
| status | `job_status` | `pending`, `processing`, `completed`, `failed` |
| retry_count | INT | Tentativi effettuati (max 3) |
| error_message | TEXT | Messaggio errore ultimo tentativo |

#### `tag_blacklist`
Tag da escludere automaticamente dall'analisi.

| Colonna | Tipo | Note |
|---------|------|------|
| id | UUID (PK) | |
| project_id | UUID | FK a `projects` |
| tag_name | TEXT | Nome del tag da escludere |

### Enum

| Enum | Valori |
|------|--------|
| `user_role` | `admin`, `client` |
| `project_role` | `viewer`, `editor` |
| `schedule_type` | `weekly`, `monthly`, `manual` |
| `serp_source` | `google_organic`, `google_news` |
| `scan_status` | `pending`, `running`, `completed`, `failed` |
| `sentiment_type` | `positive`, `negative`, `neutral`, `mixed` |
| `job_status` | `pending`, `processing`, `completed`, `failed` |

### Indici

```sql
idx_serp_results_scan_keyword   ON serp_results(scan_id, keyword)
idx_serp_results_domain         ON serp_results(domain)
idx_serp_results_is_competitor  ON serp_results(is_competitor)
idx_ai_analysis_serp_result     ON ai_analysis(serp_result_id)
idx_ai_analysis_themes          ON ai_analysis USING GIN(themes)   -- Full-text su JSONB
idx_tags_project_slug           ON tags(project_id, slug)
idx_tags_project_count          ON tags(project_id, count DESC)
idx_job_queue_status_created    ON job_queue(status, created_at)
idx_scans_project               ON scans(project_id)
idx_project_users_user          ON project_users(user_id)
```

### Row-Level Security (RLS)

Tutte le tabelle hanno RLS abilitato con le seguenti policy:

- **Admin**: accesso completo a tutte le tabelle
- **Client**: accesso in sola lettura ai dati dei progetti assegnati
- **Catena di accesso**: `serp_results` -> `scans` -> `project_users` (join-based)
- **Job Queue**: accesso solo admin (i client non vedono la coda)

### Migrazioni

| File | Descrizione |
|------|-------------|
| `001_initial_schema.sql` | Schema completo: tabelle, enum, indici, RLS |
| `002_functions.sql` | Funzioni RPC per helper RLS |
| `003_auto_create_profile.sql` | Trigger: crea profilo utente al signup Auth |
| `004_tags_unique_constraint.sql` | Vincolo unicita tag per progetto |
| `005_alert_particles.sql` | Campo `alert_keywords` su projects |
| `006_tag_scans.sql` | Tabella `tag_scans` per trend temporali |
| `007_alert_keywords_rpc.sql` | Funzione RPC per alert keywords |
| `008_scan_date_range.sql` | Campi `date_from`/`date_to` su scans |
| `009_project_context.sql` | Campo `context` su projects |
| `010_context_filter.sql` | Campo `is_priority` e `context_filtered` su ai_analysis |
| `011_tag_normalizer.sql` | Campo `last_normalize_at` su projects |
| `012_scan_ai_briefing.sql` | Campo `ai_briefing` su scans |
| `013_tag_blacklist.sql` | Tabella `tag_blacklist` |

---

## Pipeline di Elaborazione

### Flusso Completo

```
1. TRIGGER
   │  Utente admin clicca "Avvia Scan" OPPURE cron giornaliero (06:00 UTC)
   ▼
2. CREAZIONE SCAN + JOB
   │  Crea record scan con status='running'
   │  Crea job_queue: 1 job per ogni (keyword × source)
   │  Calcola date range incrementale (dalla fine dell'ultimo scan)
   ▼
3. ELABORAZIONE JOB (asincrona, browser-driven o cron)
   │  Per ogni job in coda:
   │  a) Claim job (lock ottimistico, status='processing')
   │  b) Fetch SERP da DataForSEO (con date range)
   │  c) Deduplicazione URL (skip URL gia visti in scan precedenti)
   │  d) Estrazione contenuto top 10 URL in parallelo (Cheerio, 8s timeout)
   │  e) Analisi AI via Gemini (temi, sentiment, entita, priorita)
   │  f) Auto-discovery competitor (Gemini identifica nuovi domini competitor)
   │  g) Salvataggio serp_results + ai_analysis
   │  h) Creazione/aggiornamento tag dai temi estratti
   │  i) Applicazione blacklist (elimina risultati con tag vietati)
   │  j) Aggiornamento progresso scan (completed_tasks++)
   ▼
4. COMPLETAMENTO SCAN
   │  Quando tutti i job sono completati:
   │  - scan.status = 'completed'
   │  - Generazione briefing esecutivo AI
   ▼
5. POST-PROCESSING (cron o manuale)
   │  a) Context Filter: rimuove risultati fuori contesto (Gemini valuta rilevanza)
   │  b) Tag Normalizer: deduplica tag semanticamente equivalenti
   │  c) Rigenera briefing dopo le modifiche
   ▼
6. VISUALIZZAZIONE
      Dashboard con KPI, grafici, briefing, tabelle filtrabili
```

### Rate Limiting e Resilienza

| Meccanismo | Dettaglio |
|------------|-----------|
| **Gemini Rate Limit** | 4 secondi tra le chiamate (rispetta limite 15 RPM del piano gratuito) |
| **Stale Job Recovery** | Job bloccati in `processing` da >5 minuti vengono resettati automaticamente |
| **Retry** | Fino a 3 tentativi per job falliti, poi marcati come `failed` |
| **Deduplicazione URL** | URL gia presenti in scan precedenti del progetto vengono saltati |
| **Timeout estrazione** | 8 secondi per URL, fallback graceful (null) in caso di timeout |
| **Budget temporale cron** | Il cron scheduler processa job entro 280 secondi (margine da 300s max Vercel) |

### Agenti AI

Echelon utilizza 4 agenti AI specializzati per il post-processing:

#### 1. Briefing Agent (`lib/agents/briefing.ts`)
- **Scopo**: Genera un briefing esecutivo comparativo tra gli ultimi 2 scan
- **Input**: Statistiche degli ultimi 2 scan (risultati, domini, competitor, sentiment, temi)
- **Output**: Testo strutturato in 5 sezioni: Panoramica, Temi chiave, Competitor, Sentiment, Azioni suggerite
- **Filtro**: Ignora domini generici (Facebook, Google, YouTube, Wikipedia, ecc.)
- **Temperatura Gemini**: 0.3 (semi-deterministico per coerenza)

#### 2. Context Filter Agent (`lib/agents/context-filter.ts`)
- **Scopo**: Rimuove risultati fuori contesto (omonimi, argomenti non pertinenti)
- **Funzionamento**: Valuta la rilevanza di ogni risultato rispetto a industria, keyword e contesto del progetto
- **Elaborazione**: Batch di 50 risultati, paginazione con cursore, 2s delay tra batch
- **Azione**: Hard-delete dei risultati off-topic (sia `ai_analysis` che `serp_results`)
- **Post-azione**: Rigenera il briefing dopo il filtraggio

#### 3. Tag Normalizer Agent (`lib/agents/tag-normalizer.ts`)
- **Scopo**: Unifica tag semanticamente duplicati (singolare/plurale, abbreviazioni, sinonimi)
- **Funzionamento**: Gemini identifica gruppi di duplicati tra batch di 100 tag
- **Azione**: Merge conteggi, aggiornamento riferimenti in `ai_analysis.themes`, eliminazione duplicati
- **Schedulazione**: Automatica ogni 7 giorni per progetto, o manuale

#### 4. Blacklist Agent (`lib/agents/blacklist.ts`)
- **Scopo**: Elimina risultati con tag in blacklist
- **Funzionamento**: Confronta i temi di ogni risultato con la `tag_blacklist` del progetto
- **Azione**: Hard-delete dei risultati matchati
- **Modalita**: Per singolo scan, per intero progetto, o per lista specifica di ID

---

## Autenticazione e Autorizzazione

### Flusso Auth

```
Login (email/password)
  → Supabase Auth (sessione in cookie)
  → Verifica ruolo utente (admin/client)
  → Redirect:
     - Admin → /admin
     - Client → /project/{primo-progetto-assegnato}
```

### Ruoli

| Ruolo | Accesso |
|-------|---------|
| **admin** | Tutto: gestione progetti, utenti, scan, visualizzazione dati |
| **client** | Solo progetti assegnati, in base al ruolo progetto |
| **viewer** (progetto) | Visualizzazione dashboard e dati |
| **editor** (progetto) | Visualizzazione + trigger scan manuali |

### Protezione Endpoint

| Tipo | Meccanismo |
|------|-----------|
| **Pagine** | Middleware Next.js con sessione Supabase |
| **API Admin** | Verifica `user.role === 'admin'` |
| **API Progetto** | Verifica membership in `project_users` |
| **Cron** | Header `Authorization: Bearer {CRON_SECRET}` |
| **Worker** | Header con `WORKER_SECRET` |

---

## Estrazione Contenuti

Il modulo `lib/extraction/content.ts` gestisce l'estrazione del contenuto testuale dalle pagine web:

1. **Fetch HTTP** con timeout 8 secondi e User-Agent browser
2. **Parsing HTML** con Cheerio
3. **Rimozione boilerplate**: script, style, nav, footer, header, aside, ads, banner
4. **Priorita contenuto**: `<article>` > `<main>` > `[role="main"]` > `.post-content` > `.article-content`
5. **Estrazione**: Meta description + fino a 8 paragrafi (minimo 40 caratteri ciascuno)
6. **Fallback**: Headings, list items, table data se nessun paragrafo trovato
7. **Limite**: Massimo 2000 caratteri di testo combinato
8. **Errori**: Ritorna `null` in caso di timeout o errori (graceful failure)

---

## Deploy e Operazioni

### Vercel

- **Framework**: Next.js 14 (riconosciuto automaticamente)
- **Cron**: Definito in `vercel.json`, esegue `/api/cron/scheduler` ogni giorno alle 06:00 UTC
- **Max Duration**: 300 secondi per le funzioni serverless (cron utilizza 280s di budget)
- **Environment**: Variabili configurate nel pannello Vercel

### Cron Jobs

| Endpoint | Schedule | Descrizione |
|----------|----------|-------------|
| `/api/cron/scheduler` | `0 6 * * *` (giornaliero) | Triggera scan schedulati e processa job |
| `/api/cron/context-filter` | Manuale o post-scan | Filtra risultati fuori contesto |
| `/api/cron/tag-normalizer` | Settimanale (logica interna) | Deduplica tag per tutti i progetti attivi |
