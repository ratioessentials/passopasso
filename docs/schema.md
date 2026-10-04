# Schema dati condivisi

Il contratto vale per tutte le chat. **Non modificarlo da soli**: le richieste di modifica vanno alla chat di regia.
Lingua dei contenuti: italiano. Gli id sono in `snake_case` e non cambiano mai.

## Zone del corpo (`BodyZone`)
Sono usate nella mappa dei dolori del check-in e nel catalogo degli esercizi.

```
collo | spalle | schiena_alta | schiena_bassa | petto | braccia | polsi | anche | ginocchia | caviglie
```

## Exercise (`content/exercises.json`: array)
```json
{
  "id": "squat_sedia",
  "name": "Squat alla sedia",
  "category": "forza",              // riscaldamento | cardio | forza | mobilita | defaticamento
  "minLevel": 1,                    // 1-5
  "zones": ["ginocchia", "anche"],  // zone sollecitate: se l'utente ha dolore lì, l'esercizio è escluso
  "equipment": [],                  // [] = corpo libero; altrimenti "sedia" | "muro" | "tappetino" | "scalino" | "elastico" | "manubri"
  "prescription": { "type": "reps", "default": 8 },   // type: reps | seconds
  "instructions": ["Siediti sul bordo della sedia", "Alzati spingendo coi talloni", "Torna giù piano"],
  "commonMistakes": ["Ginocchia che cadono verso l'interno"],
  "impact": false,                  // true per salti, corsa, scatti (esclusi se impactAllowed = false)
  "regression": "squat_sedia_assistito",   // id oppure null
  "progression": "squat_libero",           // id oppure null
  "formCheck": false,                      // true solo per gli esercizi supportati da MediaPipe (squat)
  "motion": "squat"                        // archetipo di movimento per l'omino animato (vedi sotto); null se nessuno
}
```

### Archetipi di movimento (`motion`)
L'omino del brand viene animato in SVG per questi movimenti; ogni esercizio ne indica uno (o `null` → pittogramma fermo).
```
marcia | camminata_veloce | corsetta | corsa | scatto | squat | affondo | ponte | plank | flessioni_muro |
polpacci | rotazioni_braccia | rotazioni_anche | allungamento | respirazione | jumping_jack | step
```

## Percorsi (`content/program.json` → `tracks{}`)
Tre percorsi con gli stessi 5 livelli e le stesse icone; cambiano verbo, obiettivo e `sessionTemplate` per livello:
- `corsa` (cammina → sprint; livelli 4-5 con sedute di corsa a segmenti),
- `forza` (dalla sedia al corpo libero avanzato, con elastici e manubri se ci sono),
- `mobilita` (schiena, anche e postura per chi lavora seduto; dolce ma progressivo).
`levels[]` resta la struttura base; `tracks.<track>.levels[n]` sovrascrive `verb`, `goal`, `sessionTemplate`, `readiness`.

## Livello (`content/program.json` → `levels[]`)
```json
{
  "n": 1,
  "name": "Attivazione",
  "verb": "Cammina",
  "goal": "Muoversi 3 volte a settimana senza fatica eccessiva",
  "weeks": [2, 3],                           // durata indicativa min-max
  "sessionsPerWeek": 3,
  "sessionTemplate": {                       // struttura base di una seduta
    "minutes": 20,
    "blocks": [
      { "category": "riscaldamento", "count": 2 },
      { "category": "cardio", "count": 1, "seconds": 600 },
      { "category": "forza", "count": 2 },
      { "category": "defaticamento", "count": 1 }
    ]
  },
  "readiness": {                             // condizioni per proporre il livello successivo
    "minSessions": 6,
    "minConsistency": 60,
    "maxHardFeedbackLast3": 1
  }
}
```
`program.json` contiene anche `restartSession` (la seduta di ripartenza: un `sessionTemplate` più leggero con `bonusPoints`).

## Session (generata dal server)
```json
{
  "id": "s_20261004_1",
  "date": "2026-10-04",
  "status": "planned",            // planned | done | skipped | blocked
  "kind": "normale",              // normale | ripartenza
  "level": 1,
  "minutes": 20,
  "intensity": 1.0,               // 0.7-1.3, moltiplica ripetizioni e secondi
  "title": "Camminata e prime basi",
  "reason": "Hai poco tempo e un po' di dolore alle ginocchia: oggi niente squat, più camminata.",  // spiegazione dell'AI, mostrata all'utente
  "items": [
    {
      "exerciseId": "squat_sedia",
      "exercise": { /* Exercise completo, incluso per comodità del client */ },
      "sets": 2,
      "reps": 8,                  // oppure "seconds": 30
      "restSec": 45,
      "note": "Lento in discesa"
    }
  ],
  "bonusPoints": 0,               // > 0 solo per le sedute di ripartenza
  "segments": null | [            // solo sedute di corsa (track corsa, livelli 4-5): timer a segmenti
    { "label": "Facile", "minutes": 10, "motion": "corsetta", "rpe": 3 },
    { "label": "Svelto", "minutes": 1, "motion": "corsa", "rpe": 7, "repeat": 6, "recovery": { "label": "Cammina", "minutes": 1, "motion": "marcia", "rpe": 2 } },
    { "label": "Defaticamento", "minutes": 5, "motion": "marcia", "rpe": 2 }
  ]
}
```

## Habit (`content/habits.json`: array di 12, uno per settimana)
```json
{
  "id": "acqua_pasti",
  "week": 1,
  "title": "Un bicchiere d'acqua a ogni pasto",
  "why": "Bere con regolarità aiuta energia e sazietà.",
  "tips": ["Tieni una bottiglia in vista", "..."],
  "photoPrompt": "Nella foto c'è un bicchiere d'acqua?"   // usato dall'AI nel feedback sulla foto del piatto
}
```

## RedFlag (`content/red_flags.json`: array)
```json
{
  "id": "dolore_petto",
  "label": "Dolore o oppressione al petto",
  "message": "Oggi niente allenamento. Questo sintomo va sentito da un medico prima di riprendere. Se è forte o improvviso chiama il 112.",
  "urgent": true
}
```
Il check-in mostra queste voci come casella "Oggi hai…?". Se ne viene spuntata una, la seduta viene bloccata **senza chiamare l'AI**.

## Win (vittoria non legata alla bilancia)
```json
{ "id": "prima_settimana", "title": "Prima settimana completata", "date": "2026-10-04", "icon": "star" }
```
L'elenco delle vittorie possibili sta in `content/wins.json` (`id`, `title`, `condition` descrittiva).

## Copy (`content/copy.json`)
Un oggetto chiave → testo per i microtesti, per esempio `{ "skip.title": "Capita. Riprendiamo da qui, con calma." }`.
Tono: dai del tu, frasi brevi, mai colpa.

## Profile (scheda + conversazione di onboarding)
```json
{
  "name": "Giulia",
  "age": 34,
  "sex": "f",                       // f | m | altro | non_dico
  "heightCm": 168,
  "weightKg": 74,                   // solo per tarare il carico: MAI mostrato come obiettivo né rimostrato all'utente
  "job": "seduto",                  // seduto | in_piedi | fisico
  "sleepHours": 6.5,
  "health": {                       // screening PAR-Q+ (sì/no)
    "heartCondition": false,        // problema cardiaco o pressione alta diagnosticati
    "chestPain": false,             // dolore al petto a riposo o durante lo sforzo
    "dizziness": false,             // perdite di equilibrio o svenimenti negli ultimi 12 mesi
    "jointIssue": true,             // problema osseo o articolare che potrebbe peggiorare
    "medication": false,            // farmaci per cuore o pressione
    "pregnancy": false,
    "otherCondition": false,
    "notes": "Lieve condromalacia al ginocchio destro"   // condizioni, farmaci, note libere (può essere "")
  },
  "goal": "Riuscire a correre 20 minuti senza fermarmi",
  "experience": "nessuna",          // nessuna | poca | qualche_volta
  "daysPerWeek": 3,
  "minutesPerSession": 20,
  "equipment": ["sedia"],
  "limitations": ["ginocchia"],     // BodyZone da tenere d'occhio
  "preferredTime": "sera",          // mattina | pausa_pranzo | sera
  "calendarUrl": null,
  "track": "corsa",                 // corsa | forza | mobilita (scelto dall'obiettivo nell'onboarding)
  "runner": null | { "kmPerWeek": 25, "longestRunMin": 50, "easyPaceMinKm": 6.0 | null, "runGoal": "10 km" },   // solo se corre già
  "food": null | { "breakfast": true, "veggiesPerDay": 1, "sugaryDrinks": "spesso", "mealsOut": 3, "cooks": "a_volte" },   // mini-onboarding alimentare
  "startLevel": 1,
  "caution": false                  // true se almeno un "sì" nel PAR-Q+ (tranne jointIssue da solo): modalità prudenza
}
```
Derivati dal server (non salvati): `bmi`, `impactAllowed` (false se bmi ≥ 30, jointIssue, età ≥ 65 o caution), `cardioCap` (minuti massimi di cardio continuo all'inizio).
