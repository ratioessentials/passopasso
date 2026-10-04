# Scaletta della demo

Serve per tre cose: registrare il video ([script.md](script.md)), presentare dal vivo e dare ai giurati un percorso da provare.

- Link: https://passopasso.andreavallieri.com
- Dispositivo: telefono, oppure Chrome con DevTools in vista mobile (390×844). Su desktop largo l'app compare dentro una cornice iPhone, con i widget a lato: va bene anche quella.
- Utenti demo:
  - **Giulia, `demo`** (pulsante "Prova con l'utente demo"): percorso corsa, livello 2, circa 3 settimane di storico, una seduta saltata e recuperata (+10), 14 giorni di dati di salute (oggi sonno corto e battito alto). **Completando la seduta di oggi, e superando il test, passa al livello 3.**
  - **Luca, `demo-runner`**: 43 anni, 25 km a settimana, livello 4 del percorso corsa, corse importate da Strava, oggi il lungo.

## Reset del demo
Prima di ogni ciak che parte dallo stato iniziale (riporta allo stato iniziale anche `demo-runner`):

```bash
curl -s -X POST https://passopasso.andreavallieri.com/api/demo/reset
```

Il demo si resetta anche da solo dopo 30 minuti senza modifiche.

## Prima di registrare
- [ ] `curl -s https://passopasso.andreavallieri.com/api/health` risponde con `"ai":"cli"` o `"ai":"sdk"` (non `"off"`).
- [ ] Finestra in incognito, così parti dal benvenuto.
- [ ] Volume del telefono acceso: la guida vocale si deve sentire.
- [ ] Foto di un piatto pronta (vario, colorato, ben illuminato).
- [ ] Calendario: quello di esempio, `https://passopasso.andreavallieri.com/api/calendar/demo.ics`. **Non mostrare mai a schermo un link iCal vero**: è segreto.
- [ ] Comando rapido "PassoPasso Salute" costruito sull'iPhone seguendo `deploy/apple-salute-comando-rapido.md`, con il token dell'utente demo (Coach → Salute e dispositivi → Apple Salute → "Configura").
- [ ] Notifiche spente, registrazione in verticale a 1080p.

## Ciak del video
I ciak sono separati perché alcune azioni si escludono a vicenda: dopo aver completato la seduta di oggi non si può più saltarla, e una bandiera rossa la mette in pausa. Tra un ciak e l'altro fai il reset.

| Ciak | Battute | Parti da | Azioni | Cosa deve vedersi |
|---|---|---|---|---|
| 1 | Apertura | incognito | Benvenuto → "Prova 5 minuti adesso" → lascia andare il player fino alla fine | Nessuna domanda prima; omino animato; voce che legge e conta ("tre, due, uno"); "Fatto: primi 5 minuti" con la vittoria |
| 2 | Piani · la scheda | dopo il ciak 1: "Vuoi che costruisca il tuo percorso?" | **La tua scheda**: Chi sei (34 anni, 168 cm, peso, lavoro seduto, 6,5 h di sonno) → Salute (7 interruttori PAR-Q+, tutti "no") → chat da principiante: "Non faccio sport da anni", "20 minuti, 3 volte", "Ho una sedia e un muro", "A volte le ginocchia" | La frase sul peso leggibile; barra di avanzamento; 4-5 domande in chat senza richiedere il nome; prima settimana al livello 1; la vittoria della seduta zero è rimasta |
| 3 | Piani · check-in → test | reset, utente demo | Home ("Come stai oggi") → "Inizia" → check-in (energia già suggerita, lasciala) → 15 minuti, ginocchia sulla mappa → "Prepara la mia seduta" → apri "Perché questa seduta" → chiudi → player → completa → "giusto" → test (sit-to-stand 30 s, marcia 1 min) → accetta il livello 3 | Card della prontezza; "Suggerito dai tuoi dati di sonno e battito"; `reason` dell'AI; foglio con esclusi, 7 controlli e badge "Seduta verificata 7/7"; contatore del test; icona che passa al livello 3 |
| 3b | Piani · lampo sul petto | qualsiasi | Tab Coach → "Da ieri ho un dolore al petto" | Risposta immediata (non passa dall'AI) con il 112 e il chip "Seduta di oggi in pausa". Servono solo 2 secondi |
| 4 | Motivazione | reset, utente demo | Settimana → seduta di oggi → "Oggi non ce la faccio" → motivo "tempo" | "Capita. Riprendiamo da qui, con calma." e la ripartenza con +10; anello della costanza |
| 5 | Alimentazione | qualsiasi | Tab Cibo → (se serve, mini-onboarding di 5 domande) → foto del piatto | Abitudine della settimana; piatto in tre parti che si riempie; feedback senza numeri |
| 6 | E cresce con te (montaggio) | vari | 3-4 secondi ciascuno: Percorso (tre percorsi) · `demo-runner` → player a segmenti · Coach "Questa settimana lavoro di sera" → chip verdi · Collega il calendario → spazi liberi · Comando rapido sull'iPhone · Salute e dispositivi (grafico 14 giorni) · Coach → "Il tuo piano" | Ogni scena leggibile in 3 secondi: entra già sullo stato giusto, niente attese |
| 7 | Chiusura | terminale e browser | `git log --oneline` nella cartella; README su GitHub alla tabella degli agenti; `docs/agenti/richieste.md` | Prefissi `[chat-1]`…`[chat-6]`, `[regia]`; le ondate |

**Senza iPhone per il Comando rapido:** manda gli stessi dati con curl (il token è quello mostrato in "Configura"):

```bash
curl -s -X POST https://passopasso.andreavallieri.com/api/health/ingest -H 'Content-Type: application/json' -H 'X-Health-Token: ht_...' -d '{"source":"apple_health","sleepMinutes":340,"restingHr":58,"hrv":40,"steps":3200}'
```

## Per il Q&A
| Domanda | Parti da | Mostra |
|---|---|---|
| E se sono già allenato? | `demo-runner` | Settimana da podista con il lungo la domenica e le corse importate da Strava; player a segmenti con "3/6" e RPE spiegato |
| Progressi senza bilancia? | utente demo | Progressi → "Allora / Adesso" (i numeri salgono) |
| Il principiante si perde? | utente demo, prime 2 settimane | Card "Cosa aspettarti" in home; parole del glossario sottolineate (RPE, serie, recupero): toccale |
| Notifiche? | telefono con l'app installata | Coach → "Promemoria gentile" → "Mandami una prova" |
| Dati? | qualsiasi | Coach → I miei dati: export, settimana nel calendario, cancella tutto |
| Perché funziona? | qualsiasi | Percorso → "Perché funziona", in fondo la card "Come lavora l'AI" con le statistiche dal vivo |
| Widget? | qualsiasi | `/widget` |
| Controllo della forma? | telefono vero | `/formcheck`, due squat davanti alla fotocamera |

## Dal vivo (5 minuti)
1. Incognito: "Prova 5 minuti adesso", lascia sentire la voce per qualche secondo, poi passa all'utente demo.
2. Home: la card "Come stai oggi".
3. Check-in con le ginocchia. Mentre l'AI lavora (circa 10 s) spiega i tre strati: il codice decide lo spazio sicuro, Claude sceglie, il codice ricontrolla.
4. Apri "Perché questa seduta": 7/7.
5. Completa, fai il test, accetta il livello 3.
6. Coach: "Ho un dolore al petto" → blocco immediato.
7. Cibo con la foto.

## Piano B
- **L'AI è lenta:** in registrazione si accelera. Dal vivo, riempi l'attesa spiegando cosa succede.
- **L'AI non risponde:** dopo 25 secondi il server costruisce la seduta a regole, quindi la demo va avanti comunque. Lo stesso succede con `AI_MODE=off`. La `reason` sarà più generica e il foglio dirà "seduta di riserva": anche questo è un buon esempio da mostrare.
- **Lo stato del demo è strano:** reset.
- **Una funzione non è online:** salta il ciak e togli la battuta dallo script, non simularla.

## Per i giurati (versione da incollare)
1. Apri https://passopasso.andreavallieri.com dal telefono. Tocca "Prova 5 minuti adesso": nessuna domanda, solo cinque minuti guidati.
2. Poi tocca "Prova con l'utente demo" (Giulia).
3. Inizia la seduta di oggi: nel check-in scegli 15 minuti e tocca le ginocchia sulla mappa. Leggi perché la seduta è cambiata e apri "Perché questa seduta".
4. Completa la seduta, dai un feedback e fai il test di 30 secondi: si passa al livello 3.
5. Apri il Coach e scrivi come va la tua settimana: guarda cosa cambia nel piano.
6. Carica la foto di un piatto nella sezione Cibo.
7. Sei già allenato? Prova l'utente `demo-runner` (Luca, corre 25 km a settimana).
