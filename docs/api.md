# API REST

Il contratto vale per frontend (chat 1) e backend (chat 2). **Non modificarlo da soli**: le richieste di modifica vanno alla chat di regia.
I tipi sono definiti in [schema.md](schema.md).

## Convenzioni
- Base: `/api`. JSON in ingresso e in uscita. Server su `PORT` (default **3210**); in sviluppo Vite fa da proxy da `/api` a `http://localhost:3210`.
- **Niente login.** Il client chiama `POST /api/users`, salva `userId` in `localStorage` e lo manda in ogni richiesta con l'header `X-User-Id`.
- Esiste un **utente demo** precompilato con id `demo`: livello 2, due settimane di storico, una seduta saltata, qualche vittoria. Il frontend ha un link "Prova con l'utente demo".
- Errori: `{ "error": { "code": "string", "message": "testo per l'utente, tono del brand" } }` con lo status HTTP adeguato.
- Le chiamate all'AI possono richiedere 5-20 secondi: il client mostra uno stato di caricamento con un microtesto.

## Endpoint

### `GET /api/health`
→ `{ "ok": true, "ai": "sdk" | "cli" | "off" }`

### `POST /api/users`
→ `201 { "userId": "u_ab12cd" }`

### `POST /api/onboarding/message`
Conversazione stateless: il client rimanda tutta la cronologia.
```json
// richiesta
{ "messages": [ { "role": "assistant", "content": "Ciao! Come ti chiami?" }, { "role": "user", "content": "Giulia" } ] }
// risposta
{ "reply": "Piacere Giulia! Quanto ti muovi in una settimana normale?", "done": false, "quickReplies": ["Quasi mai", "Cammino un po'", "Qualche volta"] }
// ultima risposta: il server salva il profilo e genera la prima settimana
{ "reply": "Perfetto, si parte dal livello 1.", "done": true, "profile": { /* Profile */ } }
```
Il primo messaggio dell'assistente lo mostra il client in modo fisso (`copy.json` → `onboarding.hello`) e non richiede chiamate. L'onboarding si chiude in circa 6 domande.

### `GET /api/me`
```json
{
  "profile": { /* Profile */ },
  "level": { "n": 2, "name": "Fondamenta", "verb": "Passo svelto", "progress": 0.4, "ready": false },
  "consistency": 72,          // 0-100, finestra mobile di 28 giorni, calcolato dal server
  "intensity": 1.0,
  "today": { /* Session */ } | null,
  "habit": { /* Habit */, "doneDays": 3 },
  "wins": [ /* Win, le più recenti per prime */ ]
}
```

### `GET /api/week`
→ `{ "weekStart": "2026-09-28", "sessions": [ /* Session */ ] }`

### `GET /api/sessions/:id`
→ `Session`

### `POST /api/sessions/:id/checkin`
Rigenera la seduta in base allo stato del giorno.
```json
// richiesta
{ "minutes": 15, "energy": 2, "pain": ["ginocchia"], "redFlags": [] }   // energy 1-5
// risposta ok
{ "status": "ok", "session": { /* Session rigenerata, con "reason" */ } }
// risposta con bandiera rossa (nessuna chiamata all'AI)
{ "status": "blocked", "redFlag": { /* RedFlag */ } }
```

### `POST /api/sessions/:id/complete`
```json
// richiesta
{ "feedback": "facile" | "giusto" | "duro" }
// risposta
{
  "consistency": 75,
  "intensity": 1.1,
  "newWins": [ /* Win */ ],
  "levelUp": null | { "from": 2, "to": 3, "name": "Costruzione" },   // proposta di passare di livello
  "message": "Bel lavoro. La prossima la alziamo un pelo."
}
```

### `POST /api/sessions/:id/skip`
Riorganizza la settimana e propone una seduta di ripartenza con bonus.
```json
// richiesta
{ "reason": "tempo" | "stanchezza" | "malessere" | "altro" }
// risposta
{ "message": "Capita. Riprendiamo da qui, con calma.", "week": { /* come GET /api/week */ }, "restart": { /* Session con kind "ripartenza" e bonusPoints */ } }
```

### `POST /api/level/accept`
Accetta il passaggio al livello proposto. → `GET /api/me` aggiornato.

### `GET /api/levels`
→ `{ "levels": [ /* Livello da program.json */ ], "current": 2 }` per disegnare il percorso.

### `GET /api/progress`
```json
{
  "consistencyHistory": [ { "week": "2026-09-21", "value": 60 }, ... ],
  "sessionsDone": 9,
  "minutesTotal": 180,
  "wins": [ /* Win */ ],
  "levelHistory": [ { "n": 1, "from": "2026-09-14", "to": "2026-09-28" } ]
}
```

### `POST /api/habit/checkin`
→ `{ "doneDays": 4 }` (una volta al giorno)

### `POST /api/meals/photo`
```json
// richiesta (limite 6 MB; il client ridimensiona a circa 1024px prima dell'invio)
{ "imageBase64": "...", "mimeType": "image/jpeg" }
// risposta: feedback qualitativo, MAI calorie o numeri
{ "positives": ["Tanta verdura colorata"], "suggestion": "Prova ad aggiungere una fonte di proteine.", "habitMatch": true, "tone": "incoraggiante" }
```

### `GET /api/red-flags`
→ `[ /* RedFlag */ ]` da `content/red_flags.json`, per le caselle del check-in. Un id sconosciuto inviato al check-in blocca comunque la seduta, per prudenza.

### `POST /api/demo/reset`
Riporta l'utente `demo` allo stato iniziale (da usare prima di registrare o presentare). Il demo si resetta anche da solo dopo 30 minuti senza modifiche.

### `GET /api/widget/:userId`
Pubblico (serve a Scriptable e alla galleria dei widget). Dati compatti:
```json
{
  "level": { "n": 2, "name": "Fondamenta", "progress": 0.4 },
  "levelIconUrl": "/icons/level-2.svg",
  "consistency": 72,
  "next": { "date": "2026-10-04", "label": "Oggi", "minutes": 20, "title": "Passo svelto e forza" } | null,
  "week": [ { "day": "L", "status": "done" }, { "day": "M", "status": "skipped" }, { "day": "M", "status": "planned" }, ... ],  // 7 elementi: done | skipped | planned | rest
  "habit": { "title": "Un bicchiere d'acqua a ogni pasto", "doneDays": 3 },
  "lastWin": { "title": "Prima settimana completata" } | null
}
```

## Regole del motore (implementate nel server)
1. **Bandiere rosse** → `blocked`, sempre prima dell'AI.
2. L'AI sceglie **solo** esercizi da `content/exercises.json`: gli id della risposta vengono verificati, quelli sconosciuti scartati e sostituiti.
3. Esercizi con `zones` che coincidono con `pain` → esclusi; si usa la `regression` se non coinvolge quelle zone.
4. `exercise.minLevel` ≤ livello dell'utente; `equipment` ⊆ attrezzatura del profilo.
5. Se l'AI fallisce o va oltre i 25 secondi → **seduta di riserva** costruita a regole da `sessionTemplate`.
6. Feedback: `facile` → intensità +0.1; `giusto` → invariata; `duro` → −0.1 (limiti 0.7-1.3).
7. Costanza: sedute fatte / sedute pianificate negli ultimi 28 giorni, più i `bonusPoints` delle ripartenze completate (massimo 100). Una seduta saltata e poi recuperata non pesa.
