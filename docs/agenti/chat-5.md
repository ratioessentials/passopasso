# Chat 5: Pitch e consegna

Leggi `docs/agenti/README.md` (regole comuni), `CLAUDE.md`, `docs/ricerca.md`, `docs/api.md` e `docs/agenti/` (come lavora la squadra). Lavori **solo in `pitch/` e `README.md`**.

## Obiettivo
Tutto ciò che serve per la consegna dell'Agent Coding Hackathon Solovera, challenge 02 "Fitness Planning for Newbies". Voto: Funzionalità 30%, Tecnica & IA 30%, Impatto 20%, Pitch 20%.

## Da produrre
1. **`pitch/script.md`**: video di 3-4 minuti con testo parlato e indicazioni su cosa mostrare, minuto per minuto.
   - Problema (circa 30 secondi): una persona reale, i dati di `docs/ricerca.md` con le fonti (70% di abbandono entro 100 giorni, piani rigidi, senso di colpa da streak).
   - Soluzione (circa 30 secondi): "Da zero a dove vuoi arrivare", 5 livelli, l'icona che cresce con te.
   - Come funziona e demo (circa 90 secondi): onboarding a conversazione → check-in con mappa del corpo → seduta rigenerata con la spiegazione dell'AI → seduta saltata, "Capita. Riprendiamo da qui" → passaggio di livello → foto del piatto → widget iPhone.
   - Tecnologia e AI agents (circa 45 secondi): Claude dal server con JSON validato, catalogo verificato (l'AI non inventa esercizi), bandiere rosse deterministiche prima dell'AI, regole di riserva; **sviluppo con 5 chat Claude Code in parallelo più una di regia** e il contratto API condiviso (è un punto forte, mostra `docs/agenti/`).
   - Chiusura (circa 15 secondi).
2. **`pitch/demo.md`**: scaletta della demo dal vivo e della registrazione, con l'utente `demo` e un percorso alternativo se l'AI è lenta (con `AI_MODE=off` le regole di riserva funzionano comunque).
3. **`pitch/consegna.md`**: testi pronti da incollare: nome, descrizione breve (circa 300 caratteri) e lunga, challenge, link (`https://passopasso.andreavallieri.com`, `https://github.com/ratioessentials/passopasso`), istruzioni per la demo, Dockerfile, elenco delle tecnologie e degli AI agents usati.
4. **`README.md`** del repository: cos'è, screenshot (lascia dei segnaposto `pitch/screens/*.png`), funzionalità, architettura (con diagramma mermaid: PWA → API Node → Claude / SQLite / content), avvio locale, deploy con Docker, sicurezza, come è stato costruito con gli agenti, fonti.
5. **`pitch/slides.md`** (opzionale): 6-8 slide di supporto al video in markdown.

Ogni dato deve avere la sua fonte. Niente promesse mediche. Tono del brand.

Verso le 13:00 controlla `docs/agenti/stato.md` e allinea lo script a ciò che esiste davvero nell'app.
