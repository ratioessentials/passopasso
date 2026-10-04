# Scaletta della demo

Serve per tre cose: registrare il video ([script.md](script.md)), presentare dal vivo e dare ai giurati un percorso da provare.

- Link: https://passopasso.andreavallieri.com
- Dispositivo: telefono, oppure Chrome con DevTools in vista mobile (390×844). Su desktop largo l'app compare dentro una cornice iPhone, con i widget a lato: va bene anche quella.
- Utenti demo:
  - **Giulia, `demo`** (pulsante "Prova con l'utente demo"): percorso corsa, livello 2, circa 3 settimane di storico, il suo perché ("Per giocare con mio figlio senza fiatone"), due messaggi del coach nell'inbox, percorso alimentare alla tappa 4 con una tappa saltata, una seduta saltata e recuperata (+10), 14 giorni di dati di salute (oggi sonno corto e battito alto). **Completando la seduta di oggi, e superando il test, passa al livello 3.**
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
| 4 | Motivazione · il tuo perché e la ripartenza | reset, utente demo | Settimana → seduta di oggi → "Oggi non ce la faccio" → SkipGate (fermati 2 secondi sulla frase) → "Oggi salto davvero" → motivo "tempo" | La frase di Giulia in grande; "10 minuti invece di niente?" in evidenza; poi "Capita. Riprendiamo da qui, con calma." e la ripartenza con +10; anello della costanza |
| 4b | (dal vivo) | reset, utente demo | Come il 4, ma tocca "10 minuti invece di niente?" | Parte la seduta ridotta da 10 minuti; completata, conta come fatta |
| 5 | Motivazione · il coach ti scrive | utente demo | Tab Coach (pallino dei non letti) → apri il messaggio dopo la ripartenza. Se l'inbox è vuota: "Simula un messaggio" in fondo → `ripartenza_fatta` | "Ti scrivo perché…" in piccolo e il messaggio che entra con una molla. Se c'è un'azione ("Sposta il venerdì al sabato"), toccala |
| 6 | Alimentazione | utente demo | Tab Cibo → Percorso alimentare → torna → foto del piatto | Intro "Ora che ti alleni non devi mangiare perfetto…"; tre fasi (Sostituire · Aggiungere · Come mangi); "sei qui" sulla tappa 4; tappa saltata con il motivo; piatto in tre parti che si riempie, senza numeri |
| 7 | E cresce con te (montaggio) | vari | 3-4 secondi ciascuno: Percorso (tre percorsi) · `demo-runner` → player a segmenti · Coach "Questa settimana lavoro di sera" → chip verdi · Collega il calendario → spazi liberi · Comando rapido sull'iPhone · Salute e dispositivi (grafico 14 giorni) · Coach → "Il tuo piano" | Ogni scena leggibile in 3 secondi: entra già sullo stato giusto, niente attese |
| 8 | Chiusura | terminale e browser | `git log --oneline` nella cartella; README su GitHub alla tabella degli agenti; `docs/agenti/richieste.md` | Prefissi `[chat-1]`…`[chat-6]`, `[regia]`; le ondate |

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
| Fame dopo la seduta? | utente demo, a fine seduta | Sotto il feedback, la nota "Avere fame adesso è normale…" |
| E la pizza con gli amici? | qualsiasi | Foto di una pizza o di una torta: "Bella serata", nessun consiglio |
| Widget? | qualsiasi | `/widget` |
| Controllo della forma? | telefono vero | `/formcheck`, due squat davanti alla fotocamera |

## Dal vivo (6 minuti)
1. Incognito: "Prova 5 minuti adesso", lascia sentire la voce per qualche secondo, poi passa all'utente demo.
2. Home: la card "Come stai oggi".
3. Check-in con le ginocchia. Mentre l'AI lavora (circa 10 s) spiega i tre strati: il codice decide lo spazio sicuro, Claude sceglie, il codice ricontrolla.
4. Apri "Perché questa seduta": 7/7.
5. Completa, fai il test, accetta il livello 3.
6. Coach: in cima il messaggio che il coach ha scritto da solo dopo la ripartenza.
7. Coach: "Ho un dolore al petto" → blocco immediato.
8. Cibo: percorso alimentare, poi la foto.
9. Reset e "Oggi non ce la faccio": la frase di Giulia e "10 minuti invece di niente?".

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
5. In alternativa al punto 4 (la seduta di oggi si fa o si salta una volta sola): nella Settimana tocca "Oggi non ce la faccio". Prima di saltare l'app ti ricorda perché hai iniziato e ti propone 10 minuti invece di niente. Il demo torna allo stato iniziale da solo dopo 30 minuti.
6. Apri il Coach: in cima ci sono i messaggi che il coach ti ha scritto da solo. Poi scrivigli come va la tua settimana e guarda cosa cambia nel piano.
7. Nella sezione Cibo apri il percorso alimentare e carica la foto di un piatto.
8. Sei già allenato? Prova l'utente `demo-runner` (Luca, corre 25 km a settimana).
