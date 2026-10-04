# PassoPasso

*Da zero a dove vuoi arrivare.*

Coach fitness con l'AI per chi parte da zero. Un percorso in 5 livelli, dalla camminata allo sprint, che si adatta a ogni seduta e non si azzera mai.

Progetto per l'**Agent Coding Hackathon Solovera**, challenge 02 "Fitness Planning for Newbies".

**Demo:** https://passopasso.andreavallieri.com

## Il problema
- Il 70% degli utenti abbandona le app fitness entro 100 giorni ([JMIR 2024](https://www.jmir.org/2024/1/e56897)).
- I piani sono rigidi: non si adattano a sedute saltate, poco tempo o dolori.
- Streak e notifiche colpevolizzano. Il conteggio delle calorie stanca e può fare danni.
- I chatbot generici danno piani completi solo al 41% e non fanno domande ([TIME](https://time.com/6958557/chatgpt-workout-plan/)).

Altri dati e fonti in [docs/ricerca.md](docs/ricerca.md).

## Come funziona
**Percorso in 5 livelli** in circa 12 settimane. Si sale per prontezza, non per calendario. L'icona dell'app evolve con il livello.

| Livello | Nome | Attività |
|---|---|---|
| 1 | Attivazione | cammina |
| 2 | Fondamenta | passo svelto |
| 3 | Costruzione | corsetta |
| 4 | Slancio | corsa |
| 5 | Autonomia | sprint |

**Motore adattivo con Claude**
- Onboarding a conversazione.
- Check-in prima di ogni seduta (tempo, energia, mappa del corpo) che rigenera la seduta.
- Una seduta saltata riorganizza la settimana e porta una seduta di ripartenza con bonus.
- Feedback dopo la seduta (facile / giusto / duro) che regola l'intensità.

**Sicurezza:** esercizi solo da un catalogo verificato, l'AI non li inventa. Con sintomi da bandiera rossa niente allenamento e consiglio di sentire un medico.

**Alimentazione senza calorie:** un'abitudine a settimana e foto del piatto con feedback qualitativo.

**Motivazione:** punteggio di costanza al posto della streak, vittorie che non dipendono dalla bilancia, tono mai colpevolizzante.

## Stack
- PWA: React + Vite + Tailwind, mobile-first, installabile
- Backend: Node.js + SQLite
- AI: Claude chiamato dal server, output JSON strutturato
- Deploy: Docker + tunnel Cloudflare

## Avvio

<!-- TODO: allineare comandi, porta e variabili d'ambiente con quelli reali dell'app -->

Con Docker:

```bash
docker build -t passopasso .
docker run -p 3000:3000 -v passopasso-data:/data passopasso
```

Poi apri http://localhost:3000.

In sviluppo:

```bash
cd app && npm install && npm run dev
```

Il server ha bisogno di accedere a Claude (vedi la documentazione in `app/`).

## Struttura
- `app/`: PWA e server
- `brand/`: icone, favicon, scheda del brand
- `docs/ricerca.md`: pain point e dati con le fonti
- `pitch/`: script del video, scaletta della demo, testi per la consegna

## Costruita con
Claude Code, con più agenti in parallelo sullo stesso repository, ognuno sulla sua area (app, backend, brand, pitch), coordinati da [CLAUDE.md](CLAUDE.md).
