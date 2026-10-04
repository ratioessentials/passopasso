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
Con esperienza "corro regolarmente" (o simili) l'AI fa 3 domande in più (km a settimana, corsa più lunga, ritmo comodo o "non lo so") e compila `runner`; il server colloca al livello 4 (< 20 km/sett.) o 5 (≥ 20). L'obiettivo decide `track`: correre → `corsa`; forza, tono, "sentirmi più forte" → `forza`; schiena, postura, rigidità, "lavoro seduto" → `mobilita`; in dubbio → `corsa`. Età < 16 → `{ done: true, minor: true }` con messaggio che invita a usare l'app con un adulto e nessun piano; 16-17 → livelli massimo 3. Il primo messaggio dell'assistente lo mostra il client in modo fisso (`copy.json` → `onboarding.hello`) e non richiede chiamate. L'onboarding si chiude in circa 6 domande.

### `POST /api/onboarding/profile`
La **scheda** compilata nel form prima della conversazione (chi sei + salute PAR-Q+). Il server la salva come profilo parziale; la conversazione che segue completa obiettivo e preferenze.
```json
// richiesta: i campi "chi sei" e "health" di Profile (schema.md)
{ "name": "Giulia", "age": 34, "sex": "f", "heightCm": 168, "weightKg": 74, "job": "seduto", "sleepHours": 6.5, "health": { ... } }
// risposta
{ "ok": true, "caution": false, "cautionMessage": null | "Hai segnalato un problema al cuore: prima di iniziare ti consigliamo di parlarne con il tuo medico. Nel frattempo ti proponiamo solo camminata e mobilità." }
```
`POST /api/onboarding/message` riceve quindi un profilo già parziale: la conversazione non richiede nome né dati fisici e si chiude in 4-5 domande (obiettivo, esperienza, giorni e minuti, attrezzatura, dolori, momento). Il profilo può essere aggiornato in seguito dal coach (`POST /api/coach/message`) e da `PATCH /api/me/profile` (stessi campi della scheda).

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

### `POST /api/coach/message`
Chat libera con il coach **dopo** l'onboarding (aggiornamenti su salute, lavoro, tempo, obiettivi). Stateless come l'onboarding: il client manda la cronologia (ultimi 20 messaggi). Il server passa all'AI anche profilo, livello, settimana e, se collegato, gli spazi liberi del calendario.
```json
// richiesta
{ "messages": [ { "role": "user", "content": "Questa settimana lavoro di sera e ho il ginocchio un po' gonfio" } ] }
// risposta
{
  "reply": "Capito. Sposto le sedute al mattino e per questa settimana tolgo gli esercizi sulle ginocchia.",
  "quickReplies": ["Va bene", "Preferisco la pausa pranzo"],
  "applied": [ "Momento preferito: mattina", "Da tenere d'occhio: ginocchia", "Settimana riorganizzata" ],   // cosa è cambiato davvero, in parole; [] se niente
  "redFlag": null | { /* RedFlag, se il messaggio descrive un sintomo da bandiera rossa: l'AI non viene chiamata per il piano */ }
}
```
Le modifiche possibili (decise dall'AI, applicate dal server con validazione zod): `limitations`, `daysPerWeek`, `minutesPerSession`, `preferredTime`, `equipment`, `goal`, ripianificazione della settimana. Il controllo delle bandiere rosse sul testo è deterministico (parole chiave di `red_flags.json`) e avviene prima dell'AI.

### `POST /api/calendar/connect`
Collega un calendario tramite il suo **link iCal** (Google Calendar: Impostazioni → il calendario → "Indirizzo segreto in formato iCal"; Apple/Outlook: link di condivisione pubblica .ics).
```json
// richiesta
{ "icsUrl": "https://calendar.google.com/calendar/ical/.../basic.ics" }
// risposta
{ "ok": true, "eventsNext7Days": 14, "freeSlots": [ { "date": "2026-10-05", "start": "07:00", "end": "08:30" }, ... ], "suggestion": "Vedo spazio lunedì, mercoledì e venerdì mattina: sposto lì le sedute?" }
```
Il server salva l'URL nel profilo (`calendarUrl`), lo rilegge a ogni pianificazione (cache 15 min) e cerca spazi liberi di almeno `minutesPerSession + 15` tra le 6:30 e le 22:00. `DELETE /api/calendar` scollega. Gli eventi non vengono salvati né mandati all'AI per intero: solo gli spazi liberi.

### Alimentazione 2.0
- `POST /api/food/profile` → salva `profile.food` (mini-onboarding, 5 domande) e risponde `{ "habit": { /* Habit scelta dall'AI per questa persona */ }, "why": "Bevi già abbastanza: partiamo dalla colazione, che salti spesso." }`.
- `GET /api/food/today` → `{ "habit": {...}, "doneDays": 3, "training": null | { "sessionAt": "19:00", "before": "Uno spuntino leggero verso le 17.", "after": "Cena normale, con una fonte di proteine." } }` (consigli di tempistica da `content/fuel.json`, scelti in base a orario, tipo di seduta e percorso; mai quantità).
- `POST /api/meals/photo` risponde in più con `"plate": { "veggies": 0.5, "protein": 0.25, "grains": 0.25 }` (stima qualitativa delle tre parti, 0-1, per il disegno del piatto) e salva la foto solo come valutazione (non l'immagine).
- `GET /api/food/recap` → `{ "photos": 5, "strengths": ["Tanta verdura"], "gaps": ["Colazioni senza proteine"], "nextHabit": { /* Habit */ }, "why": "..." }` (riepilogo degli ultimi 7 giorni; l'abitudine della settimana dopo nasce da qui).

### Test di prontezza
- `GET /api/level/test` → `{ "tests": [ { "id": "sit_to_stand_30s", "title": "Alzati e siediti per 30 secondi", "instructions": [...], "unit": "ripetizioni", "target": 12 }, { "id": "marcia_1min", "title": "Marcia sul posto 1 minuto", "unit": "sforzo", "target": 5 } ] }` (target in base a età, sesso e percorso, da `content/tests.json`).
- `POST /api/level/test` `{ "results": { "sit_to_stand_30s": 14, "marcia_1min": 4 } }` → `{ "passed": true, "message": "...", "levelUp": {...} | null }`. Il passaggio di livello richiede `readiness` **e** test superato (o saltato con un "Non oggi", che rimanda di una settimana).

### I miei dati
- `GET /api/me/export` → JSON completo dell'utente (profilo, sedute, feedback, vittorie, valutazioni dei piatti). Header `Content-Disposition: attachment`.
- `DELETE /api/me` → cancella tutto, subito, senza conferma lato server (la conferma è nell'app). → `204`.
- `GET /api/week.ics` → la settimana pianificata in formato iCalendar (una voce per seduta, 30 min, con il link all'app), per aggiungerla a Google/Apple Calendar.

### Perché funziona
- `GET /api/science` → `[ { "id": "ripartenza", "claim": "Premiare chi riprende funziona più di premiare chi non salta mai", "source": "Milkman et al., Nature 2021", "url": "...", "inApp": "La seduta di ripartenza con bonus" }, ... ]` da `content/science.json`.

### Salute e wearable (Health Bridge)
Modello unificato dei dati del corpo. Ogni sorgente (Comando rapido di Apple Salute, Strava, in futuro Health Connect, Garmin, Fitbit, Oura) scrive nello stesso formato; il server calcola una baseline personale a 14 giorni e la **prontezza del giorno**.
- `GET /api/health/token` → `{ "token": "ht_…" }` token personale per le sorgenti che inviano dati (Comando rapido). Rigenerabile.
- `POST /api/health/ingest` (header `X-Health-Token`, CORS aperto) 
  ```json
  { "source": "apple_health", "date": "2026-10-04", "steps": 6400, "restingHr": 58, "hrv": 42, "sleepMinutes": 340, "activeMinutes": 25,
    "workouts": [ { "type": "run", "start": "2026-10-04T07:10:00+02:00", "minutes": 32, "distanceKm": 5.1, "avgHr": 148 } ] }
  ```
  → `{ "ok": true, "readiness": { ... } }`. Campi tutti opzionali; un invio per giorno sovrascrive (upsert per sorgente+data). Gli allenamenti importati diventano sedute `done` con `kind: "importata"` se nello stesso giorno c'è una seduta pianificata di tipo compatibile, altrimenti attività extra.
- `GET /api/health/summary` →
  ```json
  { "sources": [ { "id": "apple_health", "connected": true, "lastSync": "2026-10-04T08:02:00+02:00" }, { "id": "strava", "connected": false }, { "id": "health_connect", "connected": false, "comingSoon": true }, ... ],
    "today": { "steps": 6400, "restingHr": 58, "hrv": 42, "sleepMinutes": 340 },
    "baseline": { "restingHr": 54, "hrv": 48, "sleepMinutes": 410 },
    "readiness": { "score": 62, "level": "media", "signals": [ "Sonno 5h40 (meno del solito)", "Battito a riposo +7%" ], "suggestion": "Oggi ti propongo una seduta leggera.", "suggestedEnergy": 2, "restAdvised": false } }
  ```
  Regole deterministiche (`content/readiness.json`): sonno < 6 h, battito a riposo > +8% sulla baseline, HRV < −15% → segnali; 3 giorni consecutivi con 2+ segnali → `restAdvised` e il coach consiglia riposo e, se c'è febbre o malessere, il medico. `suggestedEnergy` precompila il check-in. Passi ≥ 7000 in un giorno senza seduta ai livelli 1-2 → contano come "giorno attivo" per la costanza (max 2 a settimana).
- Strava (OAuth vero): `GET /api/connect/strava` → redirect a Strava; `GET /api/connect/strava/callback` → salva i token, importa gli ultimi 30 giorni, `302` all'app `/coach?connected=strava`; `DELETE /api/connect/strava`. Variabili `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`. Sync alla chiamata di `/api/health/summary` se l'ultima è più vecchia di 30 minuti.
- Le sedute di corsa importate aggiornano `runner.kmPerWeek` (media 4 settimane) e il volume della settimana dopo (regola del 10% sui km reali).

### Notifiche push (Web Push, funziona su Android e su iPhone con l'app installata, iOS 16.4+)
- `GET /api/push/vapid` → `{ "publicKey": "…" }`
- `POST /api/push/subscribe` `{ "subscription": { /* PushSubscription */ }, "reminderMinutesBefore": 60 }` → `{ "ok": true }`; `DELETE /api/push/subscribe`.
- Il server manda: promemoria gentile prima della seduta ("Tra un'ora c'è la tua seduta: 20 minuti, come stai?"), la mattina dopo una seduta saltata ("Capita. Oggi c'è una ripartenza da 15 minuti, se ti va"), e quando la prontezza consiglia riposo. Mai più di una al giorno, mai di sera tardi, testi da `copy.json`. `POST /api/push/test` manda subito una notifica di prova.

### Piani (solo schermata, nessun pagamento nella demo)
- `GET /api/plans` → da `content/plans.json`: Free (livelli 1-2, coach 5 messaggi/sett., foto 3/sett.), Plus (tutto: percorsi, coach illimitato, calendario, salute e wearable, test) con prezzo indicativo, e le **promesse anti-dark-pattern**: niente prova che si rinnova a tradimento, cancellazione in un tocco, prezzo visibile prima, i dati restano tuoi anche se smetti. Nella demo tutto è sbloccato (`"demo": true`).

### Trasparenza dell'AI
- `GET /api/sessions/:id/explain` →
  ```json
  { "inputs": { "minutes": 15, "energy": 2, "pain": ["ginocchia"], "readiness": "media", "impactAllowed": false, "caution": false },
    "candidates": 31, "excluded": [ { "exerciseId": "squat_libero", "reason": "coinvolge le ginocchia" }, { "exerciseId": "jumping_jack", "reason": "impatto non consentito" } ],
    "checks": [ { "id": "no_pain_zones", "label": "Nessun esercizio sulle zone doloranti", "passed": true }, ... ],   // 7 invarianti
    "ai": { "model": "claude-sonnet-5-5", "latencyMs": 9800, "validFirstTry": true, "repaired": false, "fallback": false } }
  ```
- `GET /api/ai/stats` → `{ "generations": 212, "validFirstTry": 0.96, "repaired": 0.03, "fallback": 0.01, "invariantViolationsBeforeValidation": 0.07, "invariantViolationsShown": 0, "p50LatencyMs": 9100 }` (dalla tabella `ai_calls`).

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
4b. **Taratura sulla persona**: con `impactAllowed = false` niente esercizi `impact: true` (salti, corsa, scatti → sostituiti con camminata veloce o step); con `caution = true` solo camminata, mobilità e respirazione finché l'utente conferma il parere medico dal coach; età ≥ 65 o sonno < 6 h → intensità iniziale 0.9; BMI e sesso entrano nel prompt come contesto per i dosaggi, mai nei testi mostrati.
5. Se l'AI fallisce o va oltre i 25 secondi → **seduta di riserva** costruita a regole da `sessionTemplate`.
6. Feedback: `facile` → intensità +0.1; `giusto` → invariata; `duro` → −0.1 (limiti 0.7-1.3).
7b. **Invarianti** (`src/engine/invariants.ts`), verificati su OGNI seduta prima di salvarla, AI o riserva: (1) nessun esercizio con `zones` ∩ `pain`; (2) durata entro ±10% dei minuti disponibili; (3) riscaldamento e defaticamento presenti; (4) dosaggi entro i limiti del catalogo; (5) nessun `impact` se `impactAllowed = false`; (6) `reason` senza numeri sul peso/BMI e senza colpa (lista di parole vietate); (7) nessuna seduta se bandiera rossa. Una violazione → correzione automatica se possibile (rimozione dell'esercizio), altrimenti seduta di riserva. Tutto loggato in `ai_calls`.
7. Costanza: sedute fatte / sedute pianificate negli ultimi 28 giorni, più i `bonusPoints` delle ripartenze completate (massimo 100). Una seduta saltata e poi recuperata non pesa.
