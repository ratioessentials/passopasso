# PassoPasso — server (API + motore AI)

Node 22 + TypeScript, Fastify, SQLite (`better-sqlite3`), zod. Implementa [`docs/api.md`](../../docs/api.md) con i tipi di [`docs/schema.md`](../../docs/schema.md).

## Avvio
```bash
cd app/server
npm install
cp .env.example .env      # e inserisci la credenziale AI (vedi sotto)
npm run dev               # sviluppo, porta 3210, ricarica a caldo
npm run smoke             # prova onboarding, check-in (anche bandiera rossa), complete, skip, widget
npm run ai:check          # verifica che l'autenticazione AI funzioni
npm run prompt:lab        # 5 check-in diversi con l'AI: titolo, reason, esercizi, tempi
npm test                  # test unitari (node:test): filtro, invarianti, costanza, prontezza, livello, 10%, bandiere rosse
npm run eval              # laboratorio: 30 scenari × 3 con l'AI accesa → eval/REPORT.md
```
Produzione: `npm run build && npm start` (compila in `dist/`, avvia `node dist/index.js`).
`npm run smoke` accetta un URL: `node scripts/smoke.mjs https://passopasso.andreavallieri.com`. Alla fine riporta il demo allo stato iniziale.

## Variabili d'ambiente
| Variabile | Default | Note |
|---|---|---|
| `PORT` | `3210` | |
| `HOST` | `0.0.0.0` | in Docker lascia il default; fuori da Docker meglio `127.0.0.1` |
| `ANTHROPIC_API_KEY` | — | se presente usa l'SDK Anthropic (Messages API) → `ai: "sdk"` |
| `CLAUDE_CODE_OAUTH_TOKEN` | — | in alternativa: token da `claude setup-token`, usato dal Claude Agent SDK → `ai: "cli"` |
| `AI_MODE` | `auto` | `auto` (sceglie da sé), `off` (solo regole), `sdk`, `cli` |
| `AI_MODEL` | `claude-sonnet-5-5` | |
| `AI_EFFORT` | `low` | sforzo di ragionamento: `low` tiene le risposte sotto i 25 s |
| `AI_TIMEOUT_MS` | `25000` | oltre → seduta/risposta di riserva a regole |
| `CONTENT_DIR` | `../../content` | file mancanti → `fixtures/` |
| `DATA_DIR` | `./data` | contiene `passopasso.db` (va su un volume) |
| `WEB_DIST` | `../web/dist` | se esiste `index.html` serve la PWA con fallback SPA |
| `TZ` | `Europe/Rome` | definisce "oggi" |
| `DEMO_RESET_MINUTES` | `30` | il demo torna allo stato iniziale dopo N minuti senza modifiche |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | generate | Web Push; `npx web-push generate-vapid-keys`. Se mancano il server le genera e le salva nel DB |
| `PUSH_SCHEDULER` | `on` | `off` spegne il cron dei promemoria (ogni minuto) |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | — | OAuth Strava; callback `https://<dominio>/api/connect/strava/callback` (Authorization Callback Domain = il dominio) |

**Per il Dockerfile (chat 4):** nessuna CLI `claude` da installare: il Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`, in `dependencies`) porta con sé l'eseguibile. `better-sqlite3` è nativo: fai `npm ci` nella stessa immagine base dell'esecuzione (es. `node:22-slim`; se manca il binario precompilato servono `python3 make g++`). In produzione copia `dist/`, `node_modules/`, `fixtures/`, `package.json`, e passa `CONTENT_DIR=/app/content`, `WEB_DIST=/app/app/web/dist`, `DATA_DIR=/data`.

## Struttura
- `src/ai/claude.ts`: `askJson(system, user, zodSchema)` e `askVision(...)`. Schema JSON nel prompt, validazione zod, un tentativo di correzione, timeout. Ogni errore → il motore usa le regole.
- `src/ai/prompts/`: prompt in italiano (tono, onboarding, seduta, piatto).
- `src/engine/builder.ts`: filtro esercizi (livello, attrezzatura, dolori + regressioni), seduta a regole da `sessionTemplate`, generazione AI con verifica degli id.
- `src/engine/store.ts`: sedute, pianificazione della settimana, costanza, prontezza, abitudini, vittorie (`content/wins.json` → `rule`).
- `src/engine/actions.ts`: check-in (bandiere rosse prima di tutto), skip con ripartenza, complete, cambio di livello.
- `src/engine/onboarding.ts`: conversazione con Claude e copione di riserva.
- `src/engine/coach.ts`: chat libera con il coach (`POST /api/coach/message`), modifiche al profilo validate e applicate dal server, `applied` in italiano, riserva a regole.
- `src/engine/calendar.ts`: iCal con `node-ical` (download con timeout 8 s, max 5 MB, cache 15 min, ricorrenze espanse, eventi di un giorno intero e "libero" ignorati), spazi liberi 6:30-22:00, proposta dei giorni senza giorni consecutivi.
- `src/engine/redflags.ts`: bandiere rosse nel testo libero, deterministiche (parole chiave di `red_flags.json` più quelle di riserva, gestione semplice delle negazioni: "non ho febbre").
- `src/engine/person.ts`: scheda (PAR-Q+), prudenza e `cautionMessage`, derivati (`bmi`, `impactAllowed`, `cardioCap`), riassunto della persona per i prompt. Il peso non esce mai dalle API (solo nell'export).
- `src/engine/run.ts`: settimana da podista (percorso corsa 4-5): tipi di seduta, lungo la domenica che cresce, scarico, regola del 10% sul volume reale, adattamento dei segmenti al check-in.
- `src/engine/food.ts`: alimentazione 2.0 (abitudine dai `signals`, prima e dopo da `fuel.json`, riepilogo della settimana).
- `src/engine/tests.ts`: test di prontezza (target da `tests.json`), passaggio di livello con test.
- `src/engine/health.ts`: Health Bridge (ingest con token, baseline 14 giorni, prontezza da `readiness.json`, allenamenti importati, giorni attivi dai passi).
- `src/engine/strava.ts`: OAuth Strava e import delle attività. `src/engine/push.ts`: Web Push e scheduler dei promemoria.
- `src/engine/proactive.ts`: coach proattivo (9 trigger deterministici, anti-spam, testo dall'AI con filtro di tono e del genere, testi di riserva da `copy.json` → `trigger.<id>.text`, azione `move_day`, scheduler ogni 15 minuti).
- `src/engine/seed.ts`: profilo e prima settimana dopo l'onboarding, utente demo `demo`.

## Architettura dell'AI (tre strati)
1. **Prima, le regole**: il codice calcola lo spazio delle soluzioni sicure (livello, attrezzatura, dolori, impatto, prudenza, bandiere rosse).
2. **Durante, la scelta vincolata**: Claude sceglie e spiega solo dentro quell'elenco; la risposta è JSON validato da zod (un tentativo di correzione). Il testo della persona entra nei prompt come dati delimitati.
3. **Dopo, i controlli**: 7 invarianti (`src/engine/invariants.ts`) su ogni seduta, AI o riserva; correzione automatica o seduta di riserva; tutto in `ai_calls` (`GET /api/sessions/:id/explain`, `GET /api/ai/stats`). Risultati misurati in [eval/REPORT.md](eval/REPORT.md).

## Regole del motore (sicurezza)
1. Bandiere rosse → `blocked`, senza chiamare l'AI.
2. L'AI vede solo gli esercizi già filtrati e risponde con id: quelli sconosciuti vengono scartati, i dosaggi riportati nei limiti, riscaldamento e defaticamento garantiti. Con meno di 3 esercizi validi → seduta a regole.
3. Zone doloranti → esercizio escluso, si risale la catena `regression`. Le `limitations` del profilo fanno solo preferire alternative.
4. Coach: il testo passa prima dal controllo delle bandiere rosse (se scatta: niente AI, seduta di oggi in pausa). L'AI propone `changes`, il server le valida (zone, attrezzatura, limiti 2-6 giorni e 10-45 minuti) e ripianifica; il livello non si cambia dalla chat. Al modello arrivano solo gli spazi liberi del calendario, mai gli eventi.
5. Testi brevi: `reason` di una frase (max 20 parole nel prompt, 160 caratteri tagliati dal server), dosaggi arrotondati, note di max 6 parole.
6. Foto del piatto: frasi con numeri, calorie, peso o diete vengono scartate.

## Note sul contratto
- `GET /api/levels` risponde `{ "levels": [...], "current": 2 }` (un array JSON non può avere la chiave `current`).
- `GET /api/health` aggiunge `model` e `content` (da dove arrivano i contenuti).
- Calendario: errori con status 422 e `code` tra `bad_url`, `fetch_failed`, `not_ical`, `timeout`, `too_large`. L'URL resta nel profilo come `calendarUrl`. `GET /api/calendar/demo.ics` è un calendario di esempio (settimana di lavoro relativa a oggi) per provare la funzione senza il proprio.
- In più: `POST /api/demo/reset` riporta l'utente demo allo stato iniziale (utile prima di registrare il video).

## Utenti demo
- `demo-runner` (Luca, 43 anni, 25 km a settimana): livello 4 del percorso corsa da tre settimane, settimana da podista con lungo la domenica (oggi), Strava "collegato" in modo simulato e corse importate.
- `demo`: Giulia, vedi sotto. Ha 14 giorni di dati di Apple Salute: oggi sonno corto e battito alto → prontezza media, energia suggerita 2.

### Giulia
`demo` (Giulia): circa 3 settimane di storico, livello 1 → 2, due sedute dimenticate, una saltata e recuperata con la ripartenza (+10), un check-in con le ginocchia doloranti, abitudine in corso con 3 giorni segnati. **Completando la seduta di oggi parte la proposta di passare al livello 3**: è il momento wow della demo. Lo storico è relativo alla data di oggi e si rigenera ogni giorno.
