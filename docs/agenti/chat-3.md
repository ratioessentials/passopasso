# Chat 3: Contenuti e sicurezza

Leggi `docs/agenti/README.md` (regole comuni), `CLAUDE.md`, `docs/schema.md` e `docs/ricerca.md`. Lavori **solo in `content/`**.

## Obiettivo
I dati verificati su cui si basa tutto: l'AI può scegliere **solo** da qui. Qualità e sicurezza prima della quantità. **Pubblica presto** (prima versione di `exercises.json` e `program.json` entro 45 minuti, con commit e push), poi migliora: il backend (chat 2) li aspetta.

## File da produrre (JSON validi, esattamente secondo `docs/schema.md`)
1. **`exercises.json`**: 45-60 esercizi a corpo libero o con sedia, muro, tappetino o scalino, adatti dai principianti fino al livello intermedio. Devono coprire tutte le categorie (riscaldamento, cardio con camminata, passo svelto, corsetta, corsa e scatti, forza, mobilità, defaticamento). Per ogni esercizio: zone sollecitate corrette (servono a escluderlo in caso di dolore), istruzioni in 3-4 passi brevi, errori comuni, catene di `regression` e `progression` coerenti (gli id devono esistere). `formCheck: true` solo sugli squat.
2. **`program.json`**: i 5 livelli (1 Attivazione/Cammina, 2 Fondamenta/Passo svelto, 3 Costruzione/Corsetta, 4 Slancio/Corsa, 5 Autonomia/Sprint) in circa 12 settimane complessive, con `sessionTemplate`, `readiness` e `restartSession` (più leggera, `bonusPoints: 10`). Progressione da principiante, sul modello "cammina-corri" alternato.
3. **`habits.json`**: 12 abitudini alimentari, una per settimana, senza calorie né numeri sul peso, dalle più facili alle più impegnative, ognuna con `photoPrompt`.
4. **`red_flags.json`**: 6-10 sintomi che bloccano l'allenamento (dolore o oppressione al petto, svenimento o capogiri forti, fiato corto a riposo, palpitazioni irregolari, dolore acuto o gonfiore articolare dopo un trauma, febbre, ecc.), con un messaggio calmo, il consiglio di sentire un medico e il 112 per quelli urgenti.
5. **`wins.json`**: 15-20 vittorie non legate alla bilancia, ognuna con `condition` descrittiva e una condizione calcolabile (per esempio `{ "type": "sessions_done", "value": 5 }`, `{ "type": "restart_done" }`, `{ "type": "level_reached", "value": 2 }`, `{ "type": "habit_week_done" }`, `{ "type": "minutes_total", "value": 100 }`). Documenta i tipi di condizione in fondo a `content/README.md`.
6. **`copy.json`**: microtesti dell'app (onboarding.hello, stati di caricamento divertenti ma gentili, messaggi di skip, ripartenza, blocco, passaggio di livello, feedback, stati vuoti). Tono: dai del tu, frasi brevi, mai colpa.
7. **`FONTI.md`**: linee guida usate (ACSM, OMS 2020 sull'attività fisica, PAR-Q+ per le bandiere rosse) con i link.

## Controlli
Scrivi `content/validate.mjs` (Node senza dipendenze) che verifica: JSON valido, campi obbligatori, id unici, `regression`/`progression` esistenti, zone ed enum validi, ogni livello con abbastanza esercizi per categoria. Eseguilo prima di ogni push.

## Fatto quando
`node content/validate.mjs` passa e c'è un breve `content/README.md` per la chat 2.
