# Chat 2: Backend e motore AI

Leggi `docs/agenti/README.md` (regole comuni), `CLAUDE.md`, `docs/api.md` e `docs/schema.md`. Lavori **solo in `app/server/`**.

## Obiettivo
Il server che implementa **esattamente** `docs/api.md`, con il motore adattivo basato su Claude. È la parte che pesa di più nel punteggio "Tecnica & IA" (30%): l'AI deve essere davvero utile e **sicura**.

## Stack
- Node 22, TypeScript (con `tsx` in sviluppo), Fastify, `better-sqlite3`, `zod`.
- `PORT` default **3210**. In produzione serve anche i file statici di `app/web/dist` (con `@fastify/static` e fallback SPA su `index.html`), percorso configurabile con `WEB_DIST`.
- Contenuti letti da `content/` (percorso con `CONTENT_DIR`, default `../../content` rispetto ad `app/server`). Finché la chat 3 non li ha pubblicati, usa `app/server/fixtures/` con pochi esempi rispettando lo schema, e ricarica i veri appena ci sono.
- DB SQLite in `DATA_DIR` (default `./data`), file `passopasso.db`. Migrazioni semplici all'avvio.

## AI
- Un unico modulo `src/ai/claude.ts` con `askJson<T>(system, user, zodSchema, opts)` e `askVision(...)` per la foto del piatto.
- Autenticazione (da `.env`, vedi `.env.example`): `ANTHROPIC_API_KEY` **oppure** `CLAUDE_CODE_OAUTH_TOKEN` (generato con `claude setup-token`). Scegli l'implementazione più solida: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) o SDK Anthropic se c'è la API key. `AI_MODEL` di default `claude-sonnet-5-5`. `AI_MODE=off` forza le regole senza AI.
- Validazione zod di ogni risposta; un tentativo di correzione se il JSON non è valido; timeout di 25 secondi → seduta di riserva.
- Prompt in `src/ai/prompts/` (file separati, in italiano, con il tono del brand). Ogni prompt di generazione riceve **solo** gli esercizi già filtrati (livello, attrezzatura, zone doloranti) e deve restituire id presi da quella lista.

## Funzioni del motore
1. **Onboarding** stateless: circa 6 domande (nome, obiettivo, esperienza, giorni e minuti, attrezzatura, dolori o limitazioni, momento preferito) → `Profile` → livello di partenza → prima settimana pianificata.
2. **Pianificazione della settimana** da `program.json` (`sessionsPerWeek`, giorni ricavati dal profilo).
3. **Check-in** → bandiere rosse (deterministico, prima di tutto) → filtro degli esercizi → Claude genera la seduta con `reason` → verifica degli id → salvataggio.
4. **Skip** → riorganizza i giorni rimasti senza accumulare carico + seduta di ripartenza con `bonusPoints`.
5. **Complete** → intensità ±0.1, costanza, vittorie (`content/wins.json`), controllo della prontezza (`readiness`) → `levelUp`.
6. **Foto del piatto** → feedback qualitativo (vision), mai calorie, collegato all'abitudine della settimana.
7. **Widget** → `GET /api/widget/:userId` (pubblico, compatto, con header CORS aperti).
8. **Utente demo `demo`**: seed all'avvio (idempotente), livello 2, due settimane di storico realistico (una seduta saltata e recuperata), 2-3 vittorie, abitudine in corso. È quello che si vede nella demo: deve fare bella figura.

## Fatto quando
- `npm run dev` avvia il server; `GET /api/health` risponde.
- `app/server/README.md` spiega le variabili d'ambiente e come avviarlo. **La chat 4 lo legge per il Dockerfile**: tienilo aggiornato.
- Uno script `npm run smoke` (curl o node) prova onboarding, check-in (anche con bandiera rossa), complete, skip e widget sull'utente demo.
- Con `AI_MODE=off` tutto funziona lo stesso grazie alle regole di riserva.
