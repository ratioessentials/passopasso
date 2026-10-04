# Testi per la consegna

Da copiare nel modulo dell'hackathon. Deadline: **domenica 4 ottobre 2026, ore 15:00**.

---

## Nome
PassoPasso

## Challenge
02 — Fitness Planning for Newbies

## Tagline
Da zero a dove vuoi arrivare.

## Descrizione breve (1 frase)
Un coach fitness con l'AI che porta il principiante dalla camminata alla corsa in 5 livelli, adattando ogni seduta a come stai oggi e senza mai farti sentire in colpa.

## Descrizione (lunga)
Il 70% delle persone abbandona un'app fitness entro 100 giorni. Chi parte da zero trova piani rigidi, streak che si azzerano al primo giorno saltato, chatbot che danno piani generici senza fare domande e diete basate sul conteggio delle calorie.

PassoPasso è una PWA che accompagna il principiante in un percorso progressivo di 5 livelli in circa 12 settimane: Attivazione, Fondamenta, Costruzione, Slancio, Autonomia. Dalla camminata allo sprint. Si sale di livello per prontezza, non per calendario, e il percorso non si azzera mai. Anche l'icona dell'app evolve con te.

Il motore adattivo usa Claude:
- **Onboarding a conversazione** invece di un modulo.
- **Check-in prima di ogni seduta** (tempo, energia, mappa del corpo per i dolori) che rigenera la seduta al momento.
- **Seduta saltata?** La settimana si riorganizza e arriva una seduta di ripartenza con bonus. Lo dice la ricerca (Milkman, Nature 2021): premiare chi riprende funziona meglio che punire chi si ferma.
- **Feedback dopo la seduta** (facile / giusto / duro) che regola l'intensità.

Sicurezza prima di tutto: l'AI sceglie solo da un catalogo di esercizi verificati, non li inventa. Con sintomi da bandiera rossa niente allenamento e il consiglio di sentire un medico.

Alimentazione senza calorie: un'abitudine a settimana e la foto del piatto con un feedback qualitativo. Motivazione senza ansia: punteggio di costanza al posto della streak, vittorie che non dipendono dalla bilancia, tono mai colpevolizzante.

Il principiante è la porta d'ingresso, ma l'app cresce con l'utente fino al livello intermedio.

## Link alla demo
https://passopasso.andreavallieri.com

## Repository
<!-- TODO: inserire l'URL del repository se pubblico -->

## Istruzioni per la demo
Apri il link dal telefono (o dal browser in vista mobile). Non serve registrarsi.
<!-- TODO: verificare che non serva login; se serve, indicare credenziali demo -->

1. Fai l'onboarding rispondendo come un principiante vero.
2. Apri la seduta di oggi, fai il check-in e segna un dolore sulla mappa del corpo: la seduta cambia.
3. Prova a segnalare un sintomo serio (es. dolore al petto): l'app non ti fa allenare.
4. Segna una seduta come saltata: guarda come si riorganizza la settimana.
5. Completa una seduta e dai un feedback: la prossima si adatta.
6. Carica la foto di un piatto nella sezione alimentazione.

Puoi installarla come app: dal browser, "Aggiungi a schermata Home".

## Dockerfile
Sì, nel repository. Istruzioni nel `README.md`.

## Tecnologie
- Frontend: PWA con React, Vite, Tailwind. Mobile-first, installabile.
- Backend: Node.js, SQLite.
- AI: Claude chiamato dal server, con output JSON strutturato validato sul catalogo degli esercizi.
- Deploy: Docker su server Contabo, esposto con un tunnel Cloudflare.

## AI agents usati
- **Claude Code** per tutto lo sviluppo: più sessioni in parallelo sullo stesso repository, ognuna con la sua area (app, backend, brand, pitch), coordinate da un `CLAUDE.md` condiviso con specifica e vincoli.
- **Claude** dentro il prodotto: onboarding a conversazione, rigenerazione delle sedute, riorganizzazione della settimana, feedback sulle foto dei piatti.

## Video pitch
<!-- TODO: inserire link al video -->
Script in `pitch/script-video.md`.
