# Guida all'Uso

## Concetti Chiave

### Progetto
Un progetto rappresenta un'attivita di monitoraggio. Contiene:
- **Keywords**: le parole chiave da monitorare sui motori di ricerca
- **Competitor**: domini di competitor noti da tracciare
- **Fonti**: Google Organic e/o Google News
- **Schedulazione**: frequenza di scansione automatica (settimanale, mensile, manuale)
- **Alert keywords**: parole chiave che attivano notifiche di priorita
- **Contesto**: descrizione testuale per aiutare l'AI a filtrare risultati fuori contesto

### Scan (Scansione)
Uno scan e un'esecuzione completa di raccolta e analisi dati. Per ogni scan:
- Vengono interrogate tutte le keyword su tutte le fonti configurate
- I risultati sono analizzati dall'AI (temi, sentiment, entita)
- Viene generato un briefing esecutivo comparativo con lo scan precedente
- Gli scan sono **incrementali**: raccolgono solo risultati nuovi rispetto all'ultimo scan

### Tag (Tema)
I tag sono temi estratti dall'AI durante l'analisi di ogni risultato. Rappresentano gli argomenti principali trattati nei contenuti trovati. I tag vengono:
- Creati automaticamente durante l'analisi
- Normalizzati (deduplica sinonimi, plurali, abbreviazioni)
- Utilizzati per filtrare e navigare i risultati
- Tracciati nel tempo per analisi trend

### Entita
L'AI estrae entita nominate dai contenuti, categorizzate in:
- **Brand**: marchi e aziende
- **Persona**: persone citate
- **Prodotto**: prodotti e servizi
- **Tecnologia**: tecnologie menzionate
- **Localita**: luoghi geografici

---

## Ruoli Utente

### Amministratore (`admin`)
Ha accesso completo alla piattaforma:
- Crea e gestisce progetti
- Crea e gestisce utenti
- Assegna utenti ai progetti
- Avvia scan manuali
- Monitora la coda di job
- Accede a tutti i dati di tutti i progetti

### Cliente (`client`)
Ha accesso ai soli progetti assegnati:
- **Viewer**: visualizza dashboard, risultati, grafici, export
- **Editor**: come viewer + puo avviare scan manuali

---

## Flussi Operativi

### 1. Configurazione Iniziale

#### Primo accesso admin
1. Dopo il deploy, eseguire il seed dell'admin: `POST /api/auth/seed`
2. Accedere con le credenziali definite in `ADMIN_EMAIL` / `ADMIN_PASSWORD`
3. Cambiare la password al primo accesso

#### Creare un progetto
1. Accedere a **Admin > Progetti > Nuovo Progetto**
2. Inserire il nome del progetto
3. Usare la funzione **Autofill AI** (opzionale): inserendo il nome dell'azienda, Gemini suggerisce automaticamente industria, keyword, competitor e schedulazione
4. Configurare manualmente o affinare i suggerimenti:
   - **Keywords**: le query di ricerca da monitorare (es. `"nome azienda"`, `"nome prodotto"`, `settore + localita`)
   - **Competitor**: domini dei competitor (es. `competitor1.it`, `competitor2.com`)
   - **Fonti**: selezionare Google Organic e/o Google News
   - **Schedulazione**: `weekly` (giorno settimana), `monthly` (giorno mese), `manual`
   - **Lingua/Localita**: default italiano/Italia
   - **Alert keywords**: parole che attivano priorita alta (es. `"crisi"`, `"acquisizione"`, `"multa"`)
   - **Contesto**: descrizione per il filtro AI (es. `"Azienda XYZ opera nel settore energetico, non confondere con l'omonima azienda tessile"`)
5. Salvare il progetto

#### Creare utenti e assegnarli
1. **Admin > Utenti > Nuovo Utente**: inserire email e password
2. **Admin > Progetti > [Progetto] > Utenti**: aggiungere l'utente con ruolo `viewer` o `editor`

### 2. Esecuzione Scan

#### Scan manuale
1. Dalla dashboard del progetto, cliccare **Avvia Scan**
2. Lo scan crea automaticamente i job (1 per ogni keyword × fonte)
3. Il browser elabora i job uno alla volta con progress bar in tempo reale
4. Per ogni job: fetch SERP → estrazione contenuto → analisi AI
5. Al completamento, viene generato il briefing esecutivo

#### Scan schedulato
- Configurato nel progetto con schedulazione `weekly` o `monthly`
- Il cron Vercel esegue `/api/cron/scheduler` ogni giorno alle 06:00 UTC
- Se il giorno corrente corrisponde al `schedule_day`, lo scan parte automaticamente
- Il cron processa i job inline entro un budget di 280 secondi

#### Interrompere una scan in corso
E possibile interrompere una scansione in qualsiasi momento:
- **Dashboard progetto**: durante l'elaborazione, cliccare **Interrompi** nel banner di progresso
- **Pagina Scansioni**: cliccare **Stop** nella colonna azioni della scan in corso
- **Admin > Jobs**: cliccare **Stop** sulla riga della scansione attiva

L'interruzione:
- Annulla tutti i job non ancora completati (pending e processing)
- Conserva i risultati gia raccolti dai job completati
- Marca la scan come fallita con timestamp di completamento

#### Eliminare una scan
Le scansioni possono essere eliminate in qualsiasi stato, incluse quelle in corso:
- **Pagina Scansioni**: selezionare le scan con le checkbox, poi cliccare **Elimina**
- **Dashboard progetto**: cliccare **Elimina** nel banner di progresso (per scan in corso)
- **Admin > Jobs**: cliccare l'icona cestino sulla riga della scansione

L'eliminazione e permanente e rimuove: risultati SERP, analisi AI, job e la scan stessa. Se la scan e in corso, viene prima interrotta automaticamente.

#### Scan incrementale
- Ogni scan traccia un range temporale (`date_from` → `date_to`)
- Il `date_from` e automaticamente impostato alla fine dell'ultimo scan completato
- DataForSEO filtra i risultati per questo range
- URL gia presenti in scan precedenti vengono saltati (deduplicazione)

### 3. Analisi Risultati

#### Dashboard Progetto
La dashboard principale mostra:

- **KPI**: totale risultati, domini unici, menzioni competitor, score sentiment medio
- **Grafico domini**: top 10 domini per numero di risultati (bar chart)
- **Distribuzione sentiment**: positivo / negativo / neutro / misto (bar chart)
- **Treemap temi**: visualizzazione proporzionale dei tag piu frequenti
- **Timeline**: andamento risultati nel tempo
- **Briefing AI**: sintesi esecutiva generata dall'AI con sezioni:
  - **Panoramica**: riassunto generale del periodo
  - **Temi chiave**: argomenti principali emersi
  - **Competitor**: movimenti e menzioni dei competitor
  - **Sentiment**: analisi del tono generale
  - **Azioni suggerite**: raccomandazioni operative

#### Tabella Risultati
Accessibile da **Risultati** nella sidebar. Ogni risultato mostra:
- Posizione SERP, titolo, URL, dominio
- Keyword e fonte (organic/news)
- Sentiment (con colore: verde/rosso/giallo/grigio)
- Temi estratti (tag cliccabili)
- Flag priorita (se contiene alert keyword)
- Riassunto AI

**Filtri disponibili**:
- Per keyword
- Per sentiment (positivo, negativo, neutro, misto)
- Per tag/tema
- Per priorita
- Per competitor (solo domini competitor)

#### Tag e Temi
Accessibile da **Tag** nella sidebar:
- **Tag cloud**: visualizzazione dei tag per frequenza
- Click su un tag: mostra tutti i risultati con quel tema
- Gestione blacklist: escludere tag non rilevanti

#### Trend
Accessibile da **Trend** nella sidebar:
- Andamento dei temi nel tempo (per scan)
- Sentiment medio per tema per periodo
- Confronto tra scan successivi

#### Entita
Accessibile da **Entita** nella sidebar:
- Lista di brand, persone, prodotti, tecnologie, localita estratte
- Filtro per tipo di entita
- Sentiment associato a ciascuna entita

#### Competitor
Accessibile da **Competitor** nella sidebar:
- Domini competitor configurati + auto-scoperti dall'AI
- Numero di menzioni per competitor
- Sentiment delle menzioni

### 4. Post-Processing

#### Filtro Contestuale
Dopo ogni scan, il context filter puo essere eseguito per rimuovere risultati non pertinenti:
- **Automatico**: via cron (`/api/cron/context-filter`)
- **Manuale**: dalla dashboard del progetto
- L'AI valuta ogni risultato rispetto al contesto del progetto
- I risultati off-topic vengono eliminati permanentemente
- Il briefing viene rigenerato dopo il filtraggio

#### Normalizzazione Tag
Unifica tag duplicati semantici:
- **Automatico**: ogni 7 giorni per i progetti attivi
- **Manuale**: dalla sezione tag del progetto
- Esempio: `"intelligenza artificiale"` e `"AI"` vengono unificati
- I conteggi vengono sommati, i riferimenti aggiornati

#### Blacklist Tag
Per escludere tag non desiderati:
1. Aggiungere il tag alla blacklist del progetto
2. I risultati con quel tag vengono eliminati
3. Nuovi risultati con tag in blacklist vengono eliminati automaticamente durante l'elaborazione

### 5. Export

#### Export Excel
Dalla sezione **Export** del progetto:
- Genera un file Excel multi-foglio:
  - **Risultati**: tutti i risultati SERP con analisi AI
  - **Trend**: andamento temi nel tempo
  - **Competitor**: analisi competitor
  - **Entita**: entita estratte
- Formattazione automatica:
  - Colori sentiment (verde positivo, rosso negativo, giallo misto)
  - KPI di riepilogo
  - Briefing AI incluso
  - Intestazioni formattate

---

## Gestione Operativa

### Monitoraggio Job
L'admin puo monitorare lo stato dei job da **Admin > Jobs**:
- Job in coda (pending)
- Job in elaborazione (processing)
- Job completati (completed)
- Job falliti (failed) con messaggio di errore

### Recovery Job Bloccati
- I job bloccati in `processing` per piu di 5 minuti vengono resettati automaticamente
- E possibile resettare manualmente i job falliti da **Admin > Jobs > Reset**
- I job possono essere ritentati fino a 3 volte prima di essere marcati come falliti

### Rate Limiting Gemini
- Il piano gratuito Gemini permette 15 richieste al minuto
- Echelon rispetta questo limite con un delay di 4 secondi tra le chiamate
- Per volumi maggiori, aggiornare il piano Gemini e ridurre il delay nel codice

### Best Practices

1. **Keywords**: usare keyword specifiche e rilevanti. Combinare il nome brand con varianti (con/senza accenti, abbreviazioni)
2. **Contesto**: compilare il campo contesto del progetto per migliorare il filtro AI, specialmente in caso di omonimi
3. **Alert keywords**: impostare parole chiave per crisi, opportunita, o eventi critici
4. **Blacklist**: dopo i primi scan, aggiungere tag irrilevanti alla blacklist per pulire i risultati futuri
5. **Schedulazione**: usare `weekly` per monitoraggio attivo, `monthly` per analisi periodiche, `manual` per progetti ad-hoc
6. **Competitor**: partire con i competitor noti, l'AI scoprira automaticamente nuovi domini rilevanti
