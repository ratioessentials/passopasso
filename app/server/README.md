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

**Per il Dockerfile (chat 4):** nessuna CLI `claude` da installare: il Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`, in `dependencies`) porta con sé l'eseguibile. `better-sqlite3` è nativo: fai `npm ci` nella stessa immagine base dell'esecuzione (es. `node:22-slim`; se manca il binario precompilato servono `python3 make g++`). In produzione copia `dist/`, `node_modules/`, `fixtures/`, `package.json`, e passa `CONTENT_DIR=/app/content`, `WEB_DIST=/app/app/web/dist`, `DATA_DIR=/data`.

## Struttura
- `src/ai/claude.ts`: `askJson(system, user, zodSchema)` e `askVision(...)`. Schema JSON nel prompt, validazione zod, un tentativo di correzione, timeout. Ogni errore → il motore usa le regole.
- `src/ai/prompts/`: prompt in italiano (tono, onboarding, seduta, piatto).
- `src/engine/builder.ts`: filtro esercizi (livello, attrezzatura, dolori + regressioni), seduta a regole da `sessionTemplate`, generazione AI con verifica degli id.
- `src/engine/store.ts`: sedute, pianificazione della settimana, costanza, prontezza, abitudini, vittorie (`content/wins.json` → `rule`).
- `src/engine/actions.ts`: check-in (bandiere rosse prima di tutto), skip con ripartenza, complete, cambio di livello.
- `src/engine/onboarding.ts`: conversazione con Claude e copione di riserva.
- `src/engine/seed.ts`: profilo e prima settimana dopo l'onboarding, utente demo `demo`.

## Regole del motore (sicurezza)
1. Bandiere rosse → `blocked`, senza chiamare l'AI.
2. L'AI vede solo gli esercizi già filtrati e risponde con id: quelli sconosciuti vengono scartati, i dosaggi riportati nei limiti, riscaldamento e defaticamento garantiti. Con meno di 3 esercizi validi → seduta a regole.
3. Zone doloranti → esercizio escluso, si risale la catena `regression`. Le `limitations` del profilo fanno solo preferire alternative.
4. Testi brevi: `reason` di una frase (max 20 parole nel prompt, 160 caratteri tagliati dal server), dosaggi arrotondati, note di max 6 parole.
5. Foto del piatto: frasi con numeri, calorie, peso o diete vengono scartate.

## Note sul contratto
- `GET /api/levels` risponde `{ "levels": [...], "current": 2 }` (un array JSON non può avere la chiave `current`).
- `GET /api/health` aggiunge `model` e `content` (da dove arrivano i contenuti).
- In più: `POST /api/demo/reset` riporta l'utente demo allo stato iniziale (utile prima di registrare il video).

## Utente demo
`demo` (Giulia): circa 3 settimane di storico, livello 1 → 2, due sedute dimenticate, una saltata e recuperata con la ripartenza (+10), un check-in con le ginocchia doloranti, abitudine in corso con 3 giorni segnati. **Completando la seduta di oggi parte la proposta di passare al livello 3**: è il momento wow della demo. Lo storico è relativo alla data di oggi e si rigenera ogni giorno.
