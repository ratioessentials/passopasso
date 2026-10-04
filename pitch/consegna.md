# Testi per la consegna

Da copiare nel modulo dell'hackathon.

---

## Nome
PassoPasso

## Challenge
02 — Fitness Planning for Newbies

## Tagline
Da zero a dove vuoi arrivare.

## Descrizione breve (circa 300 caratteri)
Un coach fitness con l'AI che porta chi parte da zero dalla camminata alla corsa in 5 livelli. Ogni seduta si adatta a tempo, energia e dolori; il coach cambia il piano quando cambia la tua vita; una seduta saltata non azzera niente. Sicuro: esercizi verificati e bandiere rosse.

## Descrizione lunga
Il 70% delle persone abbandona un'app fitness entro 100 giorni (JMIR 2024). Chi parte da zero trova piani rigidi, streak che si azzerano al primo giorno saltato, chatbot che danno piani generici senza fare domande e diete basate sul conteggio delle calorie.

Il brief lo dice: "Starting a fitness journey can be overwhelming without guidance". PassoPasso parte da qui: con "Prova 5 minuti adesso" fai la prima seduta senza rispondere a nessuna domanda, guidato da una voce e da un omino animato. Nelle prime settimane l'app spiega cosa aspettarti e le parole difficili.

È una PWA che accompagna il principiante in un percorso di 5 livelli in circa 12 settimane: Attivazione, Fondamenta, Costruzione, Slancio, Autonomia. Dalla camminata allo sprint. Si sale di livello quando sei pronto, non quando lo dice il calendario, e il percorso non si azzera mai. Anche l'icona dell'app cresce con te.

Tre percorsi sugli stessi livelli: corsa, forza e mobilità. Chi corre già parte dal livello 4 o 5 con una settimana da podista e sedute a segmenti.

Il piano si adatta grazie a Claude:
- **La tua scheda:** età, corpo, sonno, lavoro e screening di salute PAR-Q+. Il peso serve solo a tarare il carico, mai come obiettivo.
- **Onboarding a conversazione:** 4-5 domande in chat al posto di un modulo lungo.
- **Check-in prima di ogni seduta** (tempo, energia, mappa del corpo): la seduta si rigenera e l'AI spiega perché.
- **Coach sempre disponibile:** gli scrivi cosa è cambiato e il piano si aggiorna, dicendoti cosa ha cambiato.
- **Calendario collegato** con un link iCal: le sedute vanno negli spazi liberi.
- **I dati del corpo nel check-in:** sonno e battito da Apple Salute (con un Comando rapido) o da Strava diventano la prontezza del giorno. "Hai dormito poco: oggi leggero."
- **Il tuo perché:** prima di saltare una seduta, l'app ti ricorda con le tue parole perché hai iniziato e ti propone 10 minuti invece di niente.
- **Un coach che ti scrive da solo**, nei momenti giusti e non a calendario: dopo una ripartenza, un record, qualche giorno di assenza.
- **Seduta saltata?** La settimana si riorganizza e arriva una ripartenza con 10 punti di bonus, perché premiare chi riprende funziona meglio che punire chi si ferma (Milkman, Nature 2021).
- **Feedback dopo la seduta** (facile / giusto / duro) che regola l'intensità.
- **Test di prontezza** (sit-to-stand 30 s e marcia di 1 minuto) per salire di livello.
- **Omino animato** per ogni esercizio e controllo della forma con la fotocamera sullo squat.

Un'AI che non allucina: il codice calcola lo spazio delle soluzioni sicure (bandiere rosse prima dell'AI, filtri su livello, dolori, impatto e attrezzatura), Claude sceglie e spiega dentro quello spazio, e il codice ricontrolla ogni seduta con 7 invarianti prima di mostrarla. Ogni seduta ha il suo foglio "Perché questa seduta" con il badge "verificata 7/7". Costanza, prontezza e passaggi di livello non passano dall'AI. Per i sintomi urgenti l'app indica il 112. Il catalogo ha 79 esercizi verificati.

Niente calorie: un percorso alimentare in tre fasi (prima togli, poi aggiungi, poi impari come mangi), un'abitudine alla volta scelta per te, consigli su quando mangiare rispetto alla seduta e la foto del piatto con il piatto in tre parti. Niente colpa: punteggio di costanza al posto della streak, vittorie che non dipendono dalla bilancia, widget sul telefono, promemoria push gentili (mai più di uno al giorno). Niente account né pubblicità: esporti o cancelli i tuoi dati in un tocco.

Oggi è una PWA, così la provi da un link. Il prodotto è un'app nativa sullo stesso backend e contratto, con login, abbonamento Free/Plus senza dark pattern, push native e HealthKit/Health Connect.

L'abbiamo costruita con 6 sessioni di Claude Code in parallelo, più una di regia che custodisce il contratto API.

## Link alla demo
https://passopasso.andreavallieri.com

## Repository
https://github.com/ratioessentials/passopasso

## Istruzioni per la demo
Non serve registrarsi. Meglio dal telefono; su desktop l'app compare dentro una cornice iPhone.

1. Apri il link e tocca **"Prova 5 minuti adesso"**: nessuna domanda, solo cinque minuti guidati dalla voce.
2. Poi tocca **"Prova con l'utente demo"** (Giulia, livello 2, tre settimane di storico).
3. Inizia la seduta di oggi: nel check-in scegli 15 minuti e tocca le ginocchia sulla mappa del corpo. Leggi perché la seduta è cambiata.
4. Completa la seduta, dai un feedback e fai il test di 30 secondi: si passa al livello 3. Apri anche "Perché questa seduta" per vedere i 7 controlli.
5. Apri il **Coach** e scrivi come va la tua settimana (es. "questa settimana lavoro di sera"): guarda cosa cambia nel piano.
6. Carica la foto di un piatto nella sezione **Cibo**.
7. Guarda la card **"Come stai oggi"** in home: arriva dai dati di sonno e battito. In Coach → "Salute e dispositivi" trovi le sorgenti e il grafico di 14 giorni.
8. Sei già allenato? Prova l'utente `demo-runner` (Luca, 25 km a settimana).
9. Vuoi partire da zero? Apri il link in una finestra in incognito e fai l'onboarding.

Il demo torna da solo allo stato iniziale dopo 30 minuti senza modifiche. Puoi installare l'app con "Aggiungi a schermata Home".

## Dockerfile
Sì, nella radice del repository, con `docker-compose.yml`. Avvio: `cp .env.example .env` (inserisci una credenziale Claude, facoltativa) e `docker compose up -d --build`. Senza credenziali l'app funziona con le regole di riserva. Dettagli nel README.

## Tecnologie
- **Frontend:** PWA con React, Vite, Tailwind, Motion. Mobile-first, installabile, Web Push. MediaPipe per il controllo della forma.
- **Backend:** Node 22, TypeScript, Fastify, SQLite (`better-sqlite3`), zod, node-ical, web-push.
- **Health Bridge:** Apple Salute tramite Comando rapido (token personale), Strava con OAuth; prontezza del giorno calcolata con regole fisse sulla media di 14 giorni.
- **AI:** Claude Sonnet 5.5 chiamato dal server con il Claude Agent SDK. Tre strati: regole prima (bandiere rosse, filtri), scelta vincolata durante (JSON con schema, testo dell'utente trattato come dati), 7 invarianti dopo, con correzione o seduta di riserva. Ogni chiamata è registrata; laboratorio di valutazione con 30 scenari × 3 (`npm run eval`) e test unitari sui calcoli deterministici.
- **Deploy:** Docker e Docker Compose su un server Contabo, esposto con un tunnel Cloudflare.

## AI agents usati
- **Claude Code, 7 sessioni:** 6 chat in parallelo sullo stesso repository (frontend, backend e AI, contenuti e QA, deploy, pitch, motivazione e alimentazione) più una chat di regia. Ognuna ha il suo prompt e le sue cartelle. Si coordinano con un contratto API condiviso (`docs/api.md`), una bacheca delle richieste e uno stato dei lavori (`docs/agenti/`). La chat dei contenuti ha fatto anche il QA con Playwright.
- **Claude dentro il prodotto:** onboarding a conversazione, rigenerazione delle sedute con la spiegazione, coach che modifica il piano, feedback sulle foto dei piatti.

## Domande della giuria (per il Q&A)

| Domanda | Risposta | Dove vederlo |
|---|---|---|
| Un principiante non si sente sopraffatto? | Seduta zero senza domande, guida vocale, omino animato, "Cosa aspettarti" nelle prime due settimane, glossario al tocco. | Benvenuto → "Prova 5 minuti adesso" |
| È solo per chi cammina? | No. Tre percorsi (corsa, forza, mobilità) sugli stessi 5 livelli, scelti dall'obiettivo. | Percorso, onboarding |
| E se sono già allenato? | Con 3 domande da corridore parti dal livello 4 o 5, con una settimana da podista: facile, ripetute, lungo. I km reali da Strava aggiustano il volume. | Utente `demo-runner` (Luca, 43 anni, 25 km a settimana) |
| Come mi tenete motivato nelle settimane 3-12? | Il tuo perché rimostrato quando stai per saltare, 10 minuti invece di niente, ripartenza con bonus, un coach che ti scrive nei momenti giusti (non a calendario), costanza invece della streak. | Settimana → "Oggi non ce la faccio"; Coach |
| Come vedo i progressi senza bilancia? | "Allora / Adesso" (alzate in 30 secondi, minuti di cardio di fila, sedute a settimana), costanza, livelli, test di prontezza, vittorie. Il peso serve solo a tarare il carico e non viene più mostrato. | Progressi, test di prontezza |
| E l'alimentazione? | Un percorso in tre fasi: prima togli, poi aggiungi, poi impari come mangi, un'abitudine alla volta e su misura. Consigli su quando mangiare rispetto alla seduta, foto del piatto con il piatto in tre parti. Mai calorie: il conteggio fa male a molti [5]. | Tab Cibo → Percorso alimentare |
| Mi serve attrezzatura? | No. Si parte con una sedia e un muro. Elastici e manubri, se li hai, sbloccano 15 esercizi in più. | La tua scheda, Coach |
| Si collega allo smartwatch? | Sì: Apple Salute (con un Comando rapido) e Strava sono attivi oggi. Sonno e battito calcolano la prontezza del giorno e precompilano il check-in. Health Connect, Garmin, Fitbit e Oura arrivano con l'app nativa. | Home → Come stai oggi; Coach → Salute e dispositivi |
| Come guadagnate? | Free e Plus, con promesse precise: niente rinnovi a tradimento, prezzo visibile prima, disdetta in un tocco. | Coach → Il tuo piano |
| Che cosa fate con i miei dati? | Niente account e niente pubblicità. Server in Europa, export in un tocco, cancellazione immediata. Dal calendario leggiamo solo gli spazi liberi. | Coach → I miei dati |
| Si adatta ai miei impegni? | Colleghi il calendario con un link iCal e le sedute vanno negli spazi liberi. La settimana pianificata si aggiunge al tuo calendario. | Coach → Collega il calendario |
| Perché dovrebbe funzionare? | Ogni scelta ha una fonte: ripartenza premiata (Milkman), costanza invece della streak (Lally), PAR-Q+, progressione graduale, niente calorie. | Percorso → Perché funziona |
| E se l'AI sbaglia? | Il codice calcola lo spazio sicuro, Claude sceglie lì dentro, 7 invarianti ricontrollano ogni seduta prima di mostrarla (correzione o seduta a regole). Costanza, prontezza e livelli non passano dall'AI. | Foglio "Perché questa seduta" (7/7); sezione Architettura dell'AI |
| E i minorenni? | Sotto i 16 anni niente piano: l'app invita a usarla con un adulto. A 16-17 anni massimo livello 3. | Onboarding |

## Visione
Oggi PassoPasso è una PWA, così la giuria la prova da un link senza installare niente. Il prodotto è un'**app nativa (React Native) sullo stesso backend e sullo stesso contratto API**: niente da riscrivere lato server.
- **Login e sincronizzazione** tra dispositivi (oggi non c'è account, per provarla subito).
- **Abbonamento gentile**, Free e Plus, senza dark pattern. Noom ha pagato 56 milioni di dollari per una class action sui suoi abbonamenti: noi facciamo il contrario.
- **Notifiche push native** al posto di Web Push.
- **HealthKit e Health Connect diretti**, poi Garmin, Fitbit e Oura, nello stesso Health Bridge che oggi riceve Apple Salute e Strava: i dati del tuo corpo entrano nel check-in.

## Roadmap
| Oggi, nella demo | Prossimo | Dopo |
|---|---|---|
| PWA, Apple Salute via Comando rapido, Strava, Web Push, schermata dei Piani | App nativa con login, HealthKit e Health Connect, pagamenti | Altre lingue (testi e contenuti sono già separati dal codice) |
| Prontezza del giorno da sonno e battito | Garmin, Fitbit, Oura | Community: piccoli gruppi allo stesso livello, senza classifiche |
| Coach, calendario, test di prontezza | Notifiche native | Per fisioterapisti e medici: seguono i progressi dei loro pazienti (B2B) |

## Video pitch
<!-- TODO: inserire il link al video -->
Script: `pitch/script.md`. Scaletta della registrazione: `pitch/demo.md`.
