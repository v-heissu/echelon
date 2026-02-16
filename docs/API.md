# Riferimento API

Tutti gli endpoint sono sotto `/api/`. Le risposte sono in formato JSON.

## Autenticazione

| Metodo | Endpoint | Auth | Descrizione |
|--------|----------|------|-------------|
| `POST` | `/api/auth/seed` | CRON_SECRET | Crea l'utente admin iniziale |
| `POST` | `/api/auth/signout` | Sessione | Logout utente |

### `POST /api/auth/seed`
Inizializza l'utente admin. Da eseguire una sola volta al primo deploy.

**Body:**
```json
{ "secret": "your-cron-secret" }
```

**Risposta:** `200` con messaggio di conferma o errore se l'admin esiste gia.

---

## Admin - Progetti

| Metodo | Endpoint | Auth | Descrizione |
|--------|----------|------|-------------|
| `POST` | `/api/admin/projects` | Admin | Crea un nuovo progetto |
| `GET` | `/api/admin/projects/[slug]` | Admin | Dettaglio progetto |
| `PUT` | `/api/admin/projects/[slug]` | Admin | Aggiorna progetto |
| `DELETE` | `/api/admin/projects/[slug]` | Admin | Elimina progetto |
| `POST` | `/api/admin/projects/[slug]/users` | Admin | Assegna utente a progetto |
| `POST` | `/api/admin/projects/autofill` | Admin | Autofill campi progetto via AI |

### `POST /api/admin/projects`
Crea un nuovo progetto di monitoraggio.

**Body:**
```json
{
  "name": "Nome Progetto",
  "industry": "Settore",
  "keywords": ["keyword1", "keyword2"],
  "competitors": ["competitor1.it", "competitor2.com"],
  "sources": ["google_organic", "google_news"],
  "schedule": "weekly",
  "schedule_day": 1,
  "language": "it",
  "location_code": 2380,
  "alert_keywords": ["crisi", "acquisizione"],
  "context": "Descrizione contesto per filtro AI"
}
```

**Risposta:** `201` con oggetto progetto creato (incluso `slug` generato).

### `PUT /api/admin/projects/[slug]`
Aggiorna un progetto esistente. Accetta gli stessi campi del `POST`.

### `DELETE /api/admin/projects/[slug]`
Elimina il progetto e tutti i dati correlati (cascade).

### `POST /api/admin/projects/[slug]/users`
Assegna un utente al progetto.

**Body:**
```json
{
  "user_id": "uuid-utente",
  "role": "viewer"
}
```

`role` accetta: `viewer`, `editor`.

### `POST /api/admin/projects/autofill`
Usa Gemini per suggerire automaticamente i campi del progetto.

**Body:**
```json
{
  "name": "Nome Azienda o Progetto"
}
```

**Risposta:**
```json
{
  "industry": "Settore suggerito",
  "keywords": ["keyword1", "keyword2", "..."],
  "competitors": ["competitor1.it", "..."],
  "schedule": "weekly",
  "schedule_day": 1
}
```

---

## Admin - Utenti

| Metodo | Endpoint | Auth | Descrizione |
|--------|----------|------|-------------|
| `GET` | `/api/admin/users` | Admin | Lista utenti |
| `POST` | `/api/admin/users` | Admin | Crea nuovo utente |

### `POST /api/admin/users`
Crea un nuovo utente sulla piattaforma.

**Body:**
```json
{
  "email": "utente@email.com",
  "password": "password-sicura",
  "display_name": "Nome Utente",
  "role": "client"
}
```

`role` accetta: `admin`, `client`.

---

## Scan

| Metodo | Endpoint | Auth | Descrizione |
|--------|----------|------|-------------|
| `POST` | `/api/scans/trigger` | Admin | Avvia scan manuale |
| `POST` | `/api/scans/process` | Sessione | Processa un job dalla coda |
| `GET` | `/api/scans/[id]/status` | Sessione | Stato progresso scan |
| `POST` | `/api/scans/[id]/stop` | Membro | Interrompe una scan in corso |
| `DELETE` | `/api/scans/[id]` | Membro | Elimina una scan (anche in corso) |
| `POST` | `/api/scans/reset` | Admin | Reset job falliti/bloccati |

### `POST /api/scans/trigger`
Avvia una nuova scansione per un progetto.

**Body:**
```json
{
  "project_slug": "nome-progetto",
  "scan_date": "2025-01-15T00:00:00Z"
}
```

`scan_date` e opzionale (default: ora corrente). Definisce il `date_to` dello scan incrementale.

**Risposta:**
```json
{
  "scan_id": "uuid",
  "total_tasks": 6,
  "date_from": "2025-01-08T00:00:00Z",
  "date_to": "2025-01-15T00:00:00Z",
  "message": "Scan incrementale avviato (dal 08/01/2025)"
}
```

### `POST /api/scans/process`
Elabora il prossimo job in coda. Chiamato dal browser per l'elaborazione client-side.

**Risposta:**
```json
{
  "processed": true,
  "job_id": "uuid",
  "keyword": "keyword elaborata",
  "source": "google_organic",
  "results_count": 12,
  "remaining": 5
}
```

Ritorna `{ "processed": false }` se non ci sono job in coda.

### `GET /api/scans/[id]/status`
Restituisce lo stato di avanzamento di uno scan.

**Risposta:**
```json
{
  "id": "uuid",
  "status": "running",
  "total_tasks": 6,
  "completed_tasks": 3,
  "progress": 50
}
```

### `POST /api/scans/[id]/stop`
Interrompe una scansione in corso. Tutti i job pending e in processing vengono marcati come falliti.

**Accesso**: Admin o membro del progetto.

**Risposta:**
```json
{
  "success": true,
  "message": "Scan interrotta"
}
```

Ritorna `400` se la scan non e in stato `running`.

### `DELETE /api/scans/[id]`
Elimina una scansione e tutti i dati associati (risultati SERP, analisi AI, job). Se la scan e in corso, viene prima interrotta automaticamente e poi eliminata.

**Accesso**: Admin o membro del progetto.

**Risposta:**
```json
{
  "success": true
}
```

### `POST /api/scans/reset`
Resetta i job bloccati o falliti, rimettendoli in coda.

---

## Dati Progetto

Tutti gli endpoint sotto `/api/projects/[slug]/` richiedono autenticazione e membership al progetto.

| Metodo | Endpoint | Auth | Descrizione |
|--------|----------|------|-------------|
| `GET` | `/api/projects/[slug]/dashboard` | Membro | Dati dashboard (KPI, grafici, briefing) |
| `GET` | `/api/projects/[slug]/results` | Membro | Risultati SERP con filtri |
| `GET` | `/api/projects/[slug]/tags` | Membro | Lista tag con conteggi |
| `GET` | `/api/projects/[slug]/trends` | Membro | Trend temi nel tempo |
| `GET` | `/api/projects/[slug]/entities` | Membro | Entita estratte |
| `GET` | `/api/projects/[slug]/export` | Membro | Download Excel |
| `POST` | `/api/projects/[slug]/filter` | Admin | Esegue context filter |
| `POST` | `/api/projects/[slug]/normalize-tags` | Admin | Esegue tag normalizer |
| `POST` | `/api/projects/[slug]/regenerate-briefing` | Admin | Rigenera briefing AI |

### `GET /api/projects/[slug]/dashboard`
Restituisce tutti i dati per la dashboard del progetto.

**Risposta:**
```json
{
  "project": { "name": "...", "keywords": [...], "..." },
  "kpis": {
    "total_results": 156,
    "unique_domains": 42,
    "competitor_mentions": 23,
    "avg_sentiment": 0.15
  },
  "latest_scan": {
    "id": "uuid",
    "status": "completed",
    "ai_briefing": "## Panoramica\n...",
    "completed_at": "2025-01-15T12:00:00Z"
  },
  "charts": {
    "domains": [{"domain": "example.com", "count": 12}, "..."],
    "sentiment": {"positive": 45, "negative": 20, "neutral": 80, "mixed": 11},
    "themes": [{"name": "tema1", "count": 34}, "..."],
    "timeline": [{"date": "2025-01-15", "count": 156}, "..."]
  }
}
```

### `GET /api/projects/[slug]/results`
Restituisce i risultati SERP con analisi AI. Supporta filtri via query string.

**Parametri query:**
| Parametro | Tipo | Descrizione |
|-----------|------|-------------|
| `scan_id` | UUID | Filtra per scan specifico |
| `keyword` | string | Filtra per keyword |
| `sentiment` | string | `positive`, `negative`, `neutral`, `mixed` |
| `tag` | string | Filtra per tag/tema |
| `is_priority` | boolean | Solo risultati prioritari |
| `is_competitor` | boolean | Solo domini competitor |
| `page` | number | Pagina (default: 1) |
| `limit` | number | Risultati per pagina (default: 50) |

**Risposta:**
```json
{
  "results": [
    {
      "id": "uuid",
      "keyword": "keyword",
      "source": "google_organic",
      "position": 3,
      "url": "https://example.com/articolo",
      "title": "Titolo articolo",
      "domain": "example.com",
      "is_competitor": false,
      "analysis": {
        "themes": [{"name": "tema1", "confidence": 0.92}],
        "sentiment": "positive",
        "sentiment_score": 0.7,
        "entities": [{"name": "Brand X", "type": "brand", "sentiment": "positive"}],
        "summary": "Riassunto del contenuto...",
        "is_priority": false
      }
    }
  ],
  "total": 156,
  "page": 1,
  "pages": 4
}
```

### `GET /api/projects/[slug]/tags`
Lista dei tag del progetto ordinati per frequenza.

**Risposta:**
```json
{
  "tags": [
    {"id": "uuid", "name": "intelligenza artificiale", "slug": "intelligenza-artificiale", "count": 34, "last_seen_at": "2025-01-15"},
    "..."
  ]
}
```

### `GET /api/projects/[slug]/trends`
Andamento dei temi nel tempo, suddiviso per scan.

**Risposta:**
```json
{
  "trends": [
    {
      "tag_name": "intelligenza artificiale",
      "scans": [
        {"scan_id": "uuid", "date": "2025-01-08", "count": 12, "avg_sentiment": 0.3},
        {"scan_id": "uuid", "date": "2025-01-15", "count": 18, "avg_sentiment": 0.5}
      ]
    }
  ]
}
```

### `GET /api/projects/[slug]/entities`
Entita estratte dall'AI, raggruppate per tipo.

**Risposta:**
```json
{
  "entities": {
    "brand": [{"name": "Brand X", "count": 15, "sentiment": "positive"}],
    "person": [{"name": "Mario Rossi", "count": 8, "sentiment": "neutral"}],
    "product": [...],
    "technology": [...],
    "location": [...]
  }
}
```

### `GET /api/projects/[slug]/export`
Genera e scarica un file Excel con tutti i dati del progetto.

**Risposta:** File `.xlsx` come download diretto.

### `POST /api/projects/[slug]/filter`
Esegue il context filter AI sul progetto. Rimuove risultati non pertinenti.

**Risposta:**
```json
{
  "filtered": 12,
  "remaining": 144,
  "message": "Rimossi 12 risultati fuori contesto"
}
```

### `POST /api/projects/[slug]/normalize-tags`
Esegue la normalizzazione AI dei tag (deduplica sinonimi).

**Risposta:**
```json
{
  "merged": 5,
  "groups": [
    {"canonical": "intelligenza artificiale", "duplicates": ["AI", "IA"]}
  ]
}
```

### `POST /api/projects/[slug]/regenerate-briefing`
Rigenera manualmente il briefing esecutivo AI.

**Risposta:**
```json
{
  "briefing": "## Panoramica\n..."
}
```

---

## Cron

Endpoint protetti da `CRON_SECRET`. Chiamati automaticamente da Vercel cron o manualmente.

| Metodo | Endpoint | Auth | Descrizione |
|--------|----------|------|-------------|
| `GET` | `/api/cron/scheduler` | CRON_SECRET | Trigger scan schedulati + processing |
| `GET` | `/api/cron/context-filter` | CRON_SECRET | Filtra risultati fuori contesto |
| `GET` | `/api/cron/tag-normalizer` | CRON_SECRET | Deduplica tag semantici |

### `GET /api/cron/scheduler`
Eseguito giornalmente alle 06:00 UTC. Verifica quali progetti hanno scan schedulati per oggi e li avvia.

**Logica:**
1. Recupera progetti attivi con schedule != `manual`
2. Verifica se il giorno corrente corrisponde al `schedule_day`
   - `weekly`: confronta con giorno della settimana (0=domenica, 6=sabato)
   - `monthly`: confronta con giorno del mese (1-31)
3. Per ogni match: crea scan + job queue
4. Processa job inline entro 280 secondi

**Header:** `Authorization: Bearer {CRON_SECRET}`

**Risposta:**
```json
{
  "triggered": 3,
  "processed": 18,
  "errors": 0
}
```

### `GET /api/cron/context-filter`
Esegue il filtro contestuale su tutti i progetti attivi.

### `GET /api/cron/tag-normalizer`
Esegue la normalizzazione tag per i progetti che non sono stati normalizzati negli ultimi 7 giorni.

---

## Codici di Errore

| Codice | Significato |
|--------|-------------|
| `200` | Successo |
| `201` | Creato con successo |
| `400` | Parametri mancanti o non validi |
| `401` | Non autenticato |
| `403` | Non autorizzato (ruolo insufficiente) |
| `404` | Risorsa non trovata |
| `500` | Errore interno del server |

Tutte le risposte di errore seguono il formato:
```json
{
  "error": "Descrizione dell'errore"
}
```
