# PassoPasso

App fitness (PWA) per l'**Agent Coding Hackathon Solovera**, challenge 02 "Fitness Planning for Newbies".
Tagline: *"Da zero a dove vuoi arrivare."*

## Hackathon: vincoli
- Deadline: **domenica 2026-10-04 alle 15:00**. Dopo non sono ammesse modifiche sostanziali.
- Serve una **Working Demo** raggiungibile da un link pubblico. Le slide non bastano.
- Da consegnare: nome, descrizione, challenge, link, istruzioni per la demo, eventuale Dockerfile, **video pitch** (problema, soluzione, come funziona, demo, tecnologie e AI agents usati).
- Voto in peer review: Funzionalità 30%, Tecnica & IA 30%, Impatto 20%, Pitch 20%.

## Prodotto
- Target: il principiante è la porta d'ingresso (pitch centrato su di lui), ma l'app cresce con l'utente fino al livello intermedio.
- **Percorso progressivo in 5 livelli** in circa 12 settimane. Si passa di livello per prontezza, non per calendario, e il percorso non si azzera mai.
  1. Attivazione (cammina)
  2. Fondamenta (passo svelto)
  3. Costruzione (corsetta)
  4. Slancio (corsa)
  5. Autonomia (sprint)
- **L'icona dell'app evolve con il livello**: l'omino passa dal camminare allo sprint. Vedi `brand/icons/level-1..5.svg`.
- Motore adattivo con l'AI:
  - onboarding a conversazione;
  - check-in prima di ogni seduta (tempo, energia, mappa del corpo per i dolori) che rigenera la seduta;
  - una seduta saltata riorganizza la settimana e porta una seduta di ripartenza con bonus;
  - feedback dopo la seduta (facile / giusto / duro) che regola l'intensità.
- Sicurezza: catalogo di esercizi verificati (l'AI non li inventa). Con sintomi da "bandiera rossa" niente allenamento e consiglio di sentire un medico.
- Alimentazione senza calorie: un'abitudine a settimana più foto del piatto con feedback qualitativo dell'AI.
- Motivazione: punteggio di costanza invece della streak, vittorie che non dipendono dalla bilancia, tono mai colpevolizzante.
- Effetto wow (opzionale): controllo della forma con la fotocamera (MediaPipe) sullo squat.

## Stack
- PWA: React + Vite + Tailwind, mobile-first, installabile.
- Backend Node. LLM: Claude chiamato dal server (Agent SDK o `claude -p` con l'auth del server), output JSON strutturato.
- Dati: SQLite.
- Deploy: Docker sul server Contabo, con un tunnel Cloudflare già esistente su `passopasso.andreavallieri.com` (public hostname da aggiungere nella dashboard di Cloudflare).

## Brand
- Palette: `#2C6975` petrolio, `#68B2A0` verde acqua, `#CDE0C9` salvia, `#E0ECDE` salvia chiaro, `#FFFFFF`. Sfumature verticali dal colore scuro a quello chiaro.
- Icone: quadrato arrotondato con sfumatura e pittogramma bianco; arti posteriori traslucidi; scie di velocità dal livello 3 in poi.
- Font: Archivo (titoli e logotipo, corsivo extrabold), Plus Jakarta Sans (testi).
- Tono: dare del tu, frasi brevi, mai colpa ("Capita. Riprendiamo da qui, con calma.").

## Repository
- GitHub: https://github.com/ratioessentials/passopasso (branch `main`, remote SSH `git@github.com:ratioessentials/passopasso.git`)
- Link pubblico della demo: https://passopasso.andreavallieri.com

## Struttura
- `app/web/`: PWA (React + Vite + Tailwind), porta di sviluppo 5180
- `app/server/`: API Node + SQLite + Claude, porta 3210
- `content/`: catalogo esercizi, programma dei livelli, abitudini, bandiere rosse, testi (dati verificati)
- `deploy/`, `Dockerfile`, `docker-compose.yml`: deploy sul server Contabo
- `brand/`: icone, favicon, scheda del brand (`brand.html`, generata da `gen_icons.py` + `build_page.py`)
- `docs/ricerca.md`: pain point e dati con le fonti, da usare nel pitch
- `docs/api.md`, `docs/schema.md`: **contratto condiviso** tra le chat (si modifica solo dalla chat di regia)
- `docs/agenti/`: squadra di 5 chat in parallelo, prompt, regole git, richieste e stato
- `pitch/`: script e materiali del video
