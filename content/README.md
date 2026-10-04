# Contenuti verificati

Dati su cui si basa l'app. L'AI sceglie **solo** da qui. Formati come in [docs/schema.md](../docs/schema.md). Fonti in [FONTI.md](FONTI.md).

Controllo (da eseguire prima di ogni push):
```bash
node content/validate.mjs
```

| File | Contenuto |
|---|---|
| `exercises.json` | 60 esercizi (riscaldamento 9, cardio 13, forza 22, mobilità 7, defaticamento 9) |
| `program.json` | 5 livelli, `restartSession`, durata indicativa totale `totalWeeks` |
| `habits.json` | 12 abitudini alimentari, una per settimana (`week` 1-12) |
| `red_flags.json` | 9 bandiere rosse (`urgent: true` → il client mostra il pulsante del 112) |
| `wins.json` | 19 vittorie non legate alla bilancia, con `rule` calcolabile |
| `copy.json` | microtesti dell'app (segnaposto tra graffe: `{name}`, `{level}`, `{verb}`, `{points}`) |

## Note per il backend (chat 2)
- **Esercizi disponibili a un livello**: `minLevel <= livello`. La categoria cardio copre camminata, passo svelto, cammina-corri, corsa e scatti: scegli quello col `minLevel` più alto disponibile (vedi `cardioGuide` del livello) e usa `regression` se l'utente segnala "duro" o poca energia.
- **Dolori**: escludi gli esercizi che hanno in `zones` una delle zone doloranti. Per ogni livello e categoria resta almeno un'alternativa qualunque sia la zona (per il cardio con gambe doloranti c'è `boxe_sul_posto`, solo spalle e braccia).
- **Attrezzatura**: `equipment` vuoto = corpo libero. Il **muro** c'è in ogni casa: consiglio di considerarlo sempre disponibile anche se il profilo non lo elenca.
- **Prescrizione**: `prescription.default` è il valore base (ripetizioni o secondi), da moltiplicare per `intensity`. Nei blocchi cardio di `sessionTemplate`, `seconds` sostituisce il default.
- **Catene**: `regression` e `progression` puntano a id esistenti e sono simmetriche; la regressione ha `minLevel` uguale o più basso.
- **`formCheck: true`**: solo sulla famiglia degli squat (`alzate_sedia_mani`, `squat_sedia`, `squat_libero`, `squat_pausa`, `squat_salto`).
- **Livello 5**: `readiness` è `null` (ultimo livello).
- **Ripartenza**: `restartSession` ha un suo `sessionTemplate` (15 minuti), `intensity` 0.8 e `bonusPoints` 10. Usa esercizi del livello attuale preferendo le regressioni.
- **Bandiere rosse**: controllo deterministico, nessuna chiamata all'AI.
- **`motion`** (esercizi): archetipo dell'omino animato (elenco in `docs/schema.md`), `null` se nessuno calza → pittogramma fermo. Tutti i 17 archetipi sono usati almeno una volta.
- **`keywords`** (bandiere rosse, per il coach): espressioni in minuscolo da cercare come **sottostringhe** nel testo dell'utente, dopo averlo messo in minuscolo e con gli apostrofi tipografici (’) normalizzati in '. Sono volutamente specifiche ("fiato corto a riposo", non "fiato corto"; "ho preso una storta", non "gonfio"), così "dopo la corsa ho il fiato corto" o "ho il ginocchio un po' gonfio" non bloccano: vanno all'AI, che aggiorna le `limitations`. `validate.mjs` controlla una lista di frasi innocue che non devono far scattare il blocco.
- **Calendario**: Apple dà link `webcal://`: conviene accettarli sostituendo lo schema con `https://`.
- **Testi del Coach e del calendario**: chiavi `coach.*` e `calendar.*` in `copy.json` (segnaposto `{name}`, `{events}`).

## Tipi di condizione delle vittorie (`wins.json` → `rule`)
Ogni vittoria ha `condition` (testo per l'utente) e `rule` (per il calcolo). Si assegna una volta sola, quando la regola diventa vera.

| `rule.type` | `value` | Vera quando… |
|---|---|---|
| `sessions_done` | numero | le sedute completate (`status: done`, incluse le ripartenze) sono almeno `value` |
| `minutes_total` | numero | la somma dei `minutes` delle sedute completate è almeno `value` |
| `week_complete` | numero | le settimane in cui sono state fatte tutte le sedute previste sono almeno `value` |
| `restart_done` | — | è stata completata almeno una seduta con `kind: ripartenza` |
| `adapted_session_done` | — | è stata completata una seduta il cui check-in aveva dolori (`pain` non vuoto) o energia ≤ 2 |
| `consistency_at_least` | 0-100 | il punteggio di costanza è almeno `value` |
| `level_reached` | 2-5 | il livello attuale è almeno `value` |
| `habit_week_done` | numero | le settimane di abitudine completate (almeno 4 giorni segnati su 7) sono almeno `value` |
| `meal_photos` | numero | le foto del piatto inviate sono almeno `value` |
| `feedback_count` | numero | le sedute con feedback uguale a `rule.feedback` (`facile` / `giusto` / `duro`) sono almeno `value` |

Icone usate (`icon`): `star`, `flag`, `heart`, `bolt`, `leaf`, `trophy`, `sun`, `sprout`, `shoe`, `clock`, `camera`, `water`, `calendar`, `shield`, `medal`, `smile`.
