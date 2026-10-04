# Script del video pitch

Durata: **3:55** (massimo 4:00). Circa 530 parole di voce, ritmo calmo.
Il voto pesa così: Funzionalità 30%, Tecnica & IA 30%, Impatto 20%, Pitch 20%. Per questo la demo prende due minuti e la tecnica 40 secondi.

Come si usa:
- **Voce:** registrala una battuta alla volta, in un file per battuta (`B01.wav`, `B02.wav`…). Così puoi rifare una battuta senza toccare le altre.
- **Schermo:** ogni battuta dice cosa si vede. I ciak della registrazione dello schermo sono in [demo.md](demo.md).
- Tempi a 2,3 parole al secondo. Se una battuta sfora, accelera lo schermo, non la voce.

| Blocco | Battute | Tempo |
|---|---|---|
| Problema | B01-B03 | 0:00-0:30 |
| Soluzione | B04-B06 | 0:30-0:55 |
| Demo | B07-B17 | 0:55-3:02 |
| Tecnologia e AI agents | B18-B20 | 3:02-3:42 |
| Chiusura | B21 | 3:42-3:55 |

---

## Problema

**B01 · 0:00-0:08 · 8 s**
> Pensa a Giulia. Non fa sport da anni. A gennaio scarica un'app fitness.

*Schermo:* sfondo petrolio, testo che compare: "Gennaio". Icona generica di un'app fitness.

**B02 · 0:08-0:18 · 10 s**
> Il piano è pensato per chi è già allenato. Salta una seduta, la streak si azzera, e arriva la notifica che la rimprovera.

*Schermo:* una streak "🔥 12" che diventa "0". Una notifica finta: "Non ti sei allenata ieri!" (mockup, non un'app reale riconoscibile).

**B03 · 0:18-0:30 · 12 s**
> A marzo l'ha già disinstallata. E non è sola: sette persone su dieci abbandonano un'app fitness entro cento giorni.

*Schermo:* "Marzo". Poi grande: **"70%"** e sotto "abbandona entro 100 giorni". Fonte in piccolo: *JMIR 2024, 525.824 utenti*.

## Soluzione

**B04 · 0:30-0:35 · 5 s**
> Per questo abbiamo fatto PassoPasso. Da zero a dove vuoi arrivare.

*Schermo:* logotipo PassoPasso (Archivo corsivo extrabold) con la tagline.

**B05 · 0:35-0:48 · 13 s**
> Cinque livelli in circa dodici settimane, su tre percorsi: corsa, forza o mobilità. Si sale quando sei pronto, non quando lo dice il calendario. E il percorso non si azzera mai.

*Schermo:* `pitch/screens/mobile-percorso.png`, oppure le 5 icone in fila (`brand/icons/level-1..5.svg`) con i nomi: Attivazione, Fondamenta, Costruzione, Slancio, Autonomia.

**B06 · 0:48-0:55 · 7 s**
> Anche l'icona dell'app cresce con te: l'omino passa dal camminare allo sprint.

*Schermo:* le 5 icone che si sostituiscono una all'altra al centro, da livello 1 a livello 5.

## Demo

**B07 · 0:55-1:13 · 18 s** — la scheda e l'onboarding
> Prima di tutto PassoPasso vuole sapere chi sei: età, corpo, salute, con lo screening PAR-Q+ usato dai professionisti. Il peso serve solo a tarare il carico: non te lo rinfacceremo mai. Poi poche domande in chat, e l'AI costruisce la prima settimana.

*Schermo:* ciak 1. "La tua scheda": Chi sei (età, altezza, peso con la frase "Serve solo per tarare il carico…", lavoro, sonno), poi Salute con gli interruttori PAR-Q+. Poi la chat accelerata e la prima settimana.

**B08 · 1:08-1:20 · 12 s** — check-in
> Prima di ogni seduta, un check-in. Oggi Giulia ha quindici minuti, poca energia, e le ginocchia che fanno male.

*Schermo:* ciak 2. Check-in: 15 minuti, energia bassa, tocco sulle ginocchia nella mappa del corpo.

**B09 · 1:20-1:34 · 14 s** — seduta rigenerata
> La seduta si rigenera, e il coach ti dice perché. Niente camminata oggi: al suo posto la marcia in casa. Gli esercizi vengono da un catalogo verificato. L'AI sceglie, non inventa.

*Schermo:* il riquadro "Perché questa seduta" con la `reason` dell'AI ben leggibile (zoom se serve). Poi l'elenco degli esercizi con la marcia sul posto.

**B10 · 1:34-1:42 · 8 s** — omino animato
> E per ogni esercizio, un omino che ti mostra il movimento.

*Schermo:* player con l'omino animato grande sopra le istruzioni (squat o marcia).

> *Alternativa se c'è tempo (+6 s): "E sullo squat, la fotocamera controlla la tua forma." Schermo: `/formcheck` con lo scheletro sovrapposto. In quel caso accorcia B13.*

**B11 · 1:42-1:58 · 16 s** — feedback e livello
> Fine seduta: facile, giusto o duro, e la prossima si regola. Giulia è costante da settimane: un test di trenta secondi, ed è pronta per il livello tre. E l'omino nell'icona inizia a correre.

*Schermo:* feedback "giusto", anello della costanza. Poi il test di prontezza accelerato (timer di 30 s e contatore grande del sit-to-stand), la proposta del livello 3 (Costruzione), tocco su "accetta", icona che passa dal livello 2 al 3.

**B12 · 1:58-2:13 · 15 s** — coach
> Quando la vita cambia, parli col coach. "Questa settimana lavoro di sera." Il piano si sistema da solo, e ti dice cosa ha cambiato.

*Schermo:* ciak 3. Tab Coach, il messaggio scritto, la risposta, i chip verdi sotto: "Settimana riorganizzata" e gli altri `applied`.

**B13 · 2:13-2:23 · 10 s** — calendario
> E se colleghi il calendario, PassoPasso si adatta alla tua agenda: trova gli spazi liberi e ci sposta le sedute.

*Schermo:* foglio "Collega il calendario", link iCal incollato, elenco degli spazi liberi, tocco su "Sì, sposta".

**B14 · 2:23-2:37 · 14 s** — seduta saltata
> Salti una seduta? Capita. La settimana si riorganizza, e chi riparte prende dieci punti di bonus. Perché premiare chi riprende funziona meglio che punire chi si ferma.

*Schermo:* ciak 4. "Oggi non ce la faccio" → motivo → "Capita. Riprendiamo da qui, con calma." e la seduta di ripartenza con **+10**. In sovrimpressione: *Milkman et al., Nature 2021*.

**B15 · 2:37-2:46 · 9 s** — bandiera rossa
> Ma se scrivi "ho un dolore al petto", niente allenamento. Prima la salute: chiama il 112.

*Schermo:* ciak 5. Nel coach, il messaggio sul dolore al petto e la risposta di blocco con il 112.

**B16 · 2:46-2:55 · 9 s** — alimentazione
> Per mangiare meglio, un'abitudine a settimana scelta per te, e la foto del piatto: verdura, proteine, cereali. Zero calorie da contare.

*Schermo:* ciak 6. Abitudine della settimana, foto caricata, il piatto in tre parti che si riempie, feedback dell'AI senza numeri (`pitch/screens/mobile-cibo.png` come riserva).

**B17 · 2:55-3:02 · 7 s** — widget
> E PassoPasso ti aspetta anche sulla schermata del telefono.

*Schermo:* `/widget` oppure `pitch/screens/desktop-widget.png`: widget piccolo e grande con livello, costanza e seduta di oggi.

## Tecnologia e AI agents

**B18 · 3:02-3:14 · 12 s**
> Sotto c'è una PWA in React e un server Node con SQLite. Claude lavora dal server e risponde in JSON, che verifichiamo campo per campo.

*Schermo:* il diagramma dell'architettura del README (PWA → API Node → Claude / SQLite / contenuti).

**B19 · 3:14-3:27 · 13 s**
> Un chatbot da solo non basta. Le bandiere rosse le controllano regole fisse, prima dell'AI. E se l'AI è lenta o sbaglia, il motore costruisce la seduta a regole. La demo non si rompe mai.

*Schermo:* tre righe che compaiono: "Bandiere rosse prima dell'AI" · "Solo esercizi dal catalogo" · "Regole di riserva". Fonte in piccolo: *ChatGPT come trainer: completo solo al 41%, TIME 2024*.

**B20 · 3:27-3:42 · 15 s**
> E l'abbiamo costruita con Claude Code: cinque agenti in parallelo, per frontend, backend, contenuti, deploy e pitch, più uno di regia che custodisce il contratto API. In poche ore.

*Schermo:* la cartella `docs/agenti/` (tabella delle chat nel README), poi `git log --oneline` che scorre con i prefissi `[chat-1]`…`[regia]`, poi `docs/agenti/richieste.md`.

## Chiusura

**B21 · 3:42-3:55 · 13 s**
> Il principiante è la porta d'ingresso. Ma PassoPasso cresce con te. Un passo alla volta: da zero a dove vuoi arrivare.

*Schermo:* le 5 icone, poi logotipo e `passopasso.andreavallieri.com` con il QR (riprendi la colonna sinistra di `pitch/screens/desktop-home.png`).

---

## Q&A dopo il video: risposte in una frase
La tabella completa, con dove mostrarlo nell'app, è in [consegna.md](consegna.md) e nel README.
- **Solo per chi cammina?** No: tre percorsi, corsa, forza e mobilità, sugli stessi 5 livelli.
- **E se sono già allenato?** Parti dal livello 4 o 5 con una settimana da podista. Mostra `demo-runner` (Luca).
- **Progressi senza bilancia?** Costanza, livelli, test di prontezza, minuti e vittorie. Il peso non si rivede mai.
- **Alimentazione?** Un'abitudine a settimana, quando mangiare rispetto alla seduta, il piatto in tre parti. Mai calorie.
- **Attrezzatura?** Basta una sedia. Elastici e manubri sbloccano esercizi in più.
- **Dati?** Niente account, niente pubblicità, export e cancellazione in un tocco. Dal calendario solo gli spazi liberi.
- **Perché funziona?** Ogni scelta ha una fonte: è nella schermata "Perché funziona".
- **E se l'AI sbaglia?** Catalogo verificato, bandiere rosse con regole fisse prima dell'AI, regole di riserva.
- **Minorenni?** Sotto i 16 anni niente piano; a 16-17 al massimo livello 3.

## Se il video è troppo lungo
Taglia in quest'ordine: B17 (widget), poi B13 (calendario) diventa una frase dentro B12: "…e se colleghi il calendario, trova anche gli spazi liberi."

## Prima di registrare
- Coach, calendario e omino animato arrivano con la seconda ondata. Controlla in `docs/agenti/stato.md` che siano online. Se uno manca, togli la sua battuta: niente mockup spacciati per funzioni vere.
- Testi a schermo: Archivo corsivo extrabold per i titoli, Plus Jakarta Sans per le fonti. Colori `#2C6975`, `#68B2A0`, `#CDE0C9`.
- Sottotitoli sempre attivi: molti guardano senza audio.
- Le attese dell'AI vanno accelerate, non tagliate del tutto: un secondo di caricamento fa capire che è tutto vero.
