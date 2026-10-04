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

PassoPasso è una PWA che accompagna il principiante in un percorso di 5 livelli in circa 12 settimane: Attivazione, Fondamenta, Costruzione, Slancio, Autonomia. Dalla camminata allo sprint. Si sale di livello quando sei pronto, non quando lo dice il calendario, e il percorso non si azzera mai. Anche l'icona dell'app cresce con te.

Tre percorsi sugli stessi livelli: corsa, forza e mobilità. Chi corre già parte dal livello 4 o 5 con una settimana da podista e sedute a segmenti.

Il piano si adatta grazie a Claude:
- **La tua scheda:** età, corpo, sonno, lavoro e screening di salute PAR-Q+. Il peso serve solo a tarare il carico, mai come obiettivo.
- **Onboarding a conversazione:** 4-5 domande in chat al posto di un modulo lungo.
- **Check-in prima di ogni seduta** (tempo, energia, mappa del corpo): la seduta si rigenera e l'AI spiega perché.
- **Coach sempre disponibile:** gli scrivi cosa è cambiato e il piano si aggiorna, dicendoti cosa ha cambiato.
- **Calendario collegato** con un link iCal: le sedute vanno negli spazi liberi.
- **I dati del corpo nel check-in:** sonno e battito da Apple Salute (con un Comando rapido) o da Strava diventano la prontezza del giorno. "Hai dormito poco: oggi leggero."
- **Seduta saltata?** La settimana si riorganizza e arriva una ripartenza con 10 punti di bonus, perché premiare chi riprende funziona meglio che punire chi si ferma (Milkman, Nature 2021).
- **Feedback dopo la seduta** (facile / giusto / duro) che regola l'intensità.
- **Test di prontezza** (sit-to-stand 30 s e marcia di 1 minuto) per salire di livello.
- **Omino animato** per ogni esercizio e controllo della forma con la fotocamera sullo squat.

Sicurezza prima di tutto: le bandiere rosse si controllano con regole fisse prima dell'AI, e per i sintomi urgenti l'app indica il 112. L'AI sceglie solo da un catalogo di 60 esercizi verificati, e ogni risposta è JSON validato. Se l'AI non risponde, il motore costruisce la seduta a regole.

Niente calorie: un'abitudine a settimana scelta per te, consigli su quando mangiare rispetto alla seduta e la foto del piatto con il piatto in tre parti. Niente colpa: punteggio di costanza al posto della streak, vittorie che non dipendono dalla bilancia, widget sul telefono, promemoria push gentili (mai più di uno al giorno). Niente account né pubblicità: esporti o cancelli i tuoi dati in un tocco.

Oggi è una PWA, così la provi da un link. Il prodotto è un'app nativa sullo stesso backend e contratto, con login, abbonamento Free/Plus senza dark pattern, push native e HealthKit/Health Connect.

L'abbiamo costruita con 5 sessioni di Claude Code in parallelo, più una di regia che custodisce il contratto API.

## Link alla demo
https://passopasso.andreavallieri.com

## Repository
https://github.com/ratioessentials/passopasso

## Istruzioni per la demo
Non serve registrarsi. Meglio dal telefono; su desktop l'app compare dentro una cornice iPhone.

1. Apri il link e tocca **"Prova con l'utente demo"** (Giulia, livello 2, tre settimane di storico).
2. Inizia la seduta di oggi: nel check-in scegli 15 minuti e tocca le ginocchia sulla mappa del corpo. Leggi perché la seduta è cambiata.
3. Completa la seduta e dai un feedback: ti viene proposto il livello 3.
4. Apri il **Coach** e scrivi come va la tua settimana (es. "questa settimana lavoro di sera"): guarda cosa cambia nel piano.
5. Carica la foto di un piatto nella sezione **Cibo**.
6. Guarda la card **"Come stai oggi"** in home: arriva dai dati di sonno e battito. In Coach → "Salute e dispositivi" trovi le sorgenti e il grafico di 14 giorni.
7. Sei già allenato? Prova l'utente `demo-runner` (Luca, 25 km a settimana).
8. Vuoi partire da zero? Apri il link in una finestra in incognito e fai l'onboarding.

Il demo torna da solo allo stato iniziale dopo 30 minuti senza modifiche. Puoi installare l'app con "Aggiungi a schermata Home".

## Dockerfile
Sì, nella radice del repository, con `docker-compose.yml`. Avvio: `cp .env.example .env` (inserisci una credenziale Claude, facoltativa) e `docker compose up -d --build`. Senza credenziali l'app funziona con le regole di riserva. Dettagli nel README.

## Tecnologie
- **Frontend:** PWA con React, Vite, Tailwind, Motion. Mobile-first, installabile, Web Push. MediaPipe per il controllo della forma.
- **Backend:** Node 22, TypeScript, Fastify, SQLite (`better-sqlite3`), zod, node-ical, web-push.
- **Health Bridge:** Apple Salute tramite Comando rapido (token personale), Strava con OAuth; prontezza del giorno calcolata con regole fisse sulla media di 14 giorni.
- **AI:** Claude Sonnet 5.5 chiamato dal server con il Claude Agent SDK, output JSON validato con zod e regole di riserva.
- **Deploy:** Docker e Docker Compose su un server Contabo, esposto con un tunnel Cloudflare.

## AI agents usati
- **Claude Code, 6 sessioni:** 5 chat in parallelo sullo stesso repository (frontend, backend e AI, contenuti e QA, deploy, pitch) più una chat di regia. Ognuna ha il suo prompt e le sue cartelle. Si coordinano con un contratto API condiviso (`docs/api.md`), una bacheca delle richieste e uno stato dei lavori (`docs/agenti/`). La chat dei contenuti ha fatto anche il QA con Playwright.
- **Claude dentro il prodotto:** onboarding a conversazione, rigenerazione delle sedute con la spiegazione, coach che modifica il piano, feedback sulle foto dei piatti.

## Domande della giuria (per il Q&A)

| Domanda | Risposta | Dove vederlo |
|---|---|---|
| È solo per chi cammina? | No. Tre percorsi (corsa, forza, mobilità) sugli stessi 5 livelli, scelti dall'obiettivo. | Percorso, onboarding |
| E se sono già allenato? | Con 3 domande da corridore parti dal livello 4 o 5, con una settimana da podista: facile, ripetute, lungo. I km reali da Strava aggiustano il volume. | Utente `demo-runner` (Luca, 43 anni, 25 km a settimana) |
| Come vedo i progressi senza bilancia? | Punteggio di costanza, livelli, test di prontezza (sit-to-stand), minuti e sedute, vittorie. Il peso serve solo a tarare il carico e non viene più mostrato. | Home, Progressi, test di prontezza |
| E l'alimentazione? | Un'abitudine a settimana scelta per te, consigli su quando mangiare rispetto alla seduta, foto del piatto con il piatto in tre parti. Mai calorie: il conteggio fa male a molti [5]. | Tab Cibo |
| Mi serve attrezzatura? | No. Si parte con una sedia e un muro. Elastici e manubri, se li hai, sbloccano 12 esercizi in più. | La tua scheda, Coach |
| Si collega allo smartwatch? | Sì: Apple Salute (con un Comando rapido) e Strava sono attivi oggi. Sonno e battito calcolano la prontezza del giorno e precompilano il check-in. Health Connect, Garmin, Fitbit e Oura arrivano con l'app nativa. | Home → Come stai oggi; Coach → Salute e dispositivi |
| Come guadagnate? | Free e Plus, con promesse precise: niente rinnovi a tradimento, prezzo visibile prima, disdetta in un tocco. | Coach → Il tuo piano |
| Che cosa fate con i miei dati? | Niente account e niente pubblicità. Server in Europa, export in un tocco, cancellazione immediata. Dal calendario leggiamo solo gli spazi liberi. | Coach → I miei dati |
| Si adatta ai miei impegni? | Colleghi il calendario con un link iCal e le sedute vanno negli spazi liberi. La settimana pianificata si aggiunge al tuo calendario. | Coach → Collega il calendario |
| Perché dovrebbe funzionare? | Ogni scelta ha una fonte: ripartenza premiata (Milkman), costanza invece della streak (Lally), PAR-Q+, progressione graduale, niente calorie. | Percorso → Perché funziona |
| E se l'AI sbaglia? | L'AI sceglie solo da un catalogo verificato, le bandiere rosse sono controllate prima da regole fisse e ogni risposta è validata. Se l'AI non risponde, la seduta si fa a regole. | Sezione Sicurezza |
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
