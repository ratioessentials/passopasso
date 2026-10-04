# Script del video pitch

Durata: **3:52** (massimo 4:00). 466 parole di voce, a 2.3 parole al secondo con un secondo di respiro tra le battute.
Il voto pesa così: Funzionalità 30%, Tecnica & IA 30%, Impatto 20%, Pitch 20%. La demo prende circa metà del video.

Come si usa:
- **Voce:** registrala una battuta alla volta, in un file per battuta (`B01.wav`, `B02.wav`…). Così puoi rifare una battuta senza toccare le altre.
- **Schermo:** ogni battuta dice cosa si vede. I ciak della registrazione dello schermo sono in [demo.md](demo.md).
- I tempi sono calcolati dal numero di parole. Se una battuta sfora, accelera lo schermo, non la voce.

| Blocco | Battute | Tempo |
|---|---|---|
| Problema | B01-B03 | 0:00-0:27 |
| Soluzione | B04-B06 | 0:27-0:51 |
| Demo | B07-B15 | 0:51-2:44 |
| Tecnologia e visione | B16-B20 | 2:44-3:41 |
| Chiusura | B21 | 3:41-3:52 |

---

## Problema

**B01 · 0:00-0:07 · 7 s**
> Pensa a Giulia. Non fa sport da anni. A gennaio scarica un'app fitness.

*Schermo:* sfondo petrolio, testo che compare: "Gennaio". Icona generica di un'app fitness.

**B02 · 0:07-0:17 · 10 s**
> Il piano è per chi è già allenato. Salta una seduta, la streak si azzera, e l'app la rimprovera.

*Schermo:* una streak "🔥 12" che diventa "0". Una notifica finta: "Non ti sei allenata ieri!" (mockup, nessuna app reale riconoscibile).

**B03 · 0:17-0:27 · 10 s**
> A marzo l'ha già disinstallata. E non è sola: sette persone su dieci abbandonano un'app fitness entro cento giorni.

*Schermo:* "Marzo". Poi grande: **"70%"** e sotto "abbandona entro 100 giorni". Fonte in piccolo: *JMIR 2024, 525.824 utenti*.

## Soluzione

**B04 · 0:27-0:33 · 6 s**
> Per questo abbiamo fatto PassoPasso. Da zero a dove vuoi arrivare.

*Schermo:* logotipo PassoPasso (Archivo corsivo extrabold) con la tagline.

**B05 · 0:33-0:45 · 12 s**
> Cinque livelli in dodici settimane, su tre percorsi: corsa, forza o mobilità. Si sale quando sei pronto, e il percorso non si azzera mai.

*Schermo:* `pitch/screens/mobile-percorso.png`, oppure le 5 icone in fila (`brand/icons/level-1..5.svg`) con i nomi: Attivazione, Fondamenta, Costruzione, Slancio, Autonomia. Tre etichette: Corsa · Forza · Mobilità.

**B06 · 0:45-0:51 · 6 s**
> Anche l'icona cresce con te: l'omino passa dal camminare allo sprint.

*Schermo:* le 5 icone che si sostituiscono una all'altra al centro, da livello 1 a livello 5.

## Demo

**B07 · 0:51-1:11 · 20 s** — la scheda e l'onboarding
> Prima di tutto PassoPasso vuole sapere chi sei: età, corpo, salute, con lo screening PAR-Q+ usato dai professionisti. Il peso serve solo a tarare il carico: non te lo rinfacceremo mai. Poi poche domande in chat, e la prima settimana è pronta.

*Schermo:* ciak 1. "La tua scheda": Chi sei (età, altezza, peso con la frase "Serve solo per tarare il carico…", lavoro, sonno), poi Salute con gli interruttori PAR-Q+. Poi la chat accelerata e la prima settimana.

**B08 · 1:11-1:25 · 14 s** — i dati del corpo
> Ogni mattina il telefono manda sonno e battito, da Apple Salute o da Strava. Stanotte Giulia ha dormito poco, e la home se ne accorge: oggi si va leggeri.

*Schermo:* ciak 2. Su iPhone, il Comando rapido "PassoPasso Salute" che parte (notifica "Dati inviati"). Stacco sulla home: card "Come stai oggi" con l'anello della prontezza, i segnali "Sonno 5h40 (meno del solito)" e "Battito a riposo +7%", il suggerimento "Oggi ti propongo una seduta leggera".

**B09 · 1:25-1:33 · 8 s** — check-in
> Nel check-in l'energia è già suggerita. Giulia ha quindici minuti, e le ginocchia che fanno male.

*Schermo:* ciak 3. Check-in con l'energia precompilata e la riga "Suggerito dai tuoi dati di sonno e battito: cambia pure". 15 minuti, tocco sulle ginocchia nella mappa del corpo.

**B10 · 1:33-1:48 · 15 s** — seduta rigenerata e omino
> La seduta si rigenera e ti dice perché: niente camminata, oggi marcia in casa. Gli esercizi vengono da un catalogo verificato, con l'omino che mostra il movimento. L'AI sceglie, non inventa.

*Schermo:* il riquadro "Perché questa seduta" con la `reason` dell'AI ben leggibile (zoom se serve). Poi il player con l'omino animato grande sopra le istruzioni.

**B11 · 1:48-2:01 · 13 s** — feedback, test e livello
> Fine seduta: facile, giusto o duro, e la prossima si regola. Un test di trenta secondi, e Giulia passa al livello tre. L'omino nell'icona inizia a correre.

*Schermo:* feedback "giusto", anello della costanza. Test di prontezza accelerato (timer di 30 s e contatore grande del sit-to-stand). Proposta del livello 3 (Costruzione), "accetta", icona che passa dal livello 2 al 3.

**B12 · 2:01-2:16 · 15 s** — coach e calendario
> Quando la vita cambia, parli col coach. "Questa settimana lavoro di sera." Il piano si sistema e ti dice cosa ha cambiato. Con il calendario collegato, trova anche gli spazi liberi.

*Schermo:* ciak 4. Tab Coach, il messaggio, la risposta con i chip verdi (`applied`), poi il foglio del calendario con gli spazi liberi e "Sì, sposta".

**B13 · 2:16-2:28 · 12 s** — seduta saltata
> Salti una seduta? Capita. La settimana si riorganizza, e chi riparte prende un bonus: premiare chi riprende funziona meglio che punire chi si ferma.

*Schermo:* ciak 5. "Oggi non ce la faccio" → motivo → "Capita. Riprendiamo da qui, con calma." e la ripartenza con **+10**. In sovrimpressione: *Milkman et al., Nature 2021*.

**B14 · 2:28-2:36 · 8 s** — bandiera rossa
> Ma se scrivi "ho un dolore al petto", niente allenamento. Prima la salute: chiama il 112.

*Schermo:* ciak 6. Nel coach, il messaggio sul dolore al petto e la risposta immediata con il 112 e il chip "Seduta di oggi in pausa".

**B15 · 2:36-2:44 · 8 s** — alimentazione
> Per mangiare meglio, un'abitudine a settimana e la foto del piatto: verdura, proteine, cereali. Zero calorie.

*Schermo:* ciak 7. Abitudine della settimana, foto caricata, il piatto in tre parti che si riempie, feedback senza numeri.

## Tecnologia e visione

**B16 · 2:44-2:59 · 15 s**
> Sotto, Claude lavora dal server e risponde in JSON verificato campo per campo. Le bandiere rosse passano prima da regole fisse. E se l'AI è lenta, la seduta si fa a regole.

*Schermo:* il diagramma dell'architettura del README. Si accendono in sequenza: Motore (bandiere rosse, filtri, riserva) → Claude → JSON validato.

**B17 · 2:59-3:13 · 14 s**
> Oggi è una PWA, la provi da un link. Lo stesso backend serve l'app nativa: login, notifiche, e i dati di Apple Salute, Health Connect, Garmin, dentro il check-in.

*Schermo:* a sinistra la PWA nel browser, a destra un iPhone con l'app nativa (mockup dichiarato: "App nativa · in arrivo"); al centro la stessa API. Sotto, i loghi testuali delle sorgenti: Apple Salute · Strava (attivi oggi) · Health Connect · Garmin · Fitbit · Oura (in arrivo).

**B18 · 3:13-3:24 · 11 s**
> Con un abbonamento gentile: piano gratuito vero, prezzo chiaro, disdetta in un tocco. Il contrario di chi ha pagato milioni per le trappole.

*Schermo:* la schermata Piani (Free / Plus) con le promesse anti-dark-pattern in evidenza. Fonte in piccolo: *Noom ha pagato 56 milioni di dollari per una class action sugli abbonamenti, Athletech News*.

**B19 · 3:24-3:30 · 6 s**
> Poi: altre lingue, una community, e fisioterapisti che seguono i pazienti.

*Schermo:* la Roadmap in tre righe.

**B20 · 3:30-3:41 · 11 s**
> E l'abbiamo costruita con Claude Code: cinque agenti in parallelo, più uno di regia che custodisce il contratto. In poche ore.

*Schermo:* `docs/agenti/` (tabella delle chat nel README), poi `git log --oneline` che scorre con i prefissi `[chat-1]`…`[regia]`, poi `docs/agenti/richieste.md` con le ondate.

## Chiusura

**B21 · 3:41-3:52 · 11 s**
> Il principiante è la porta d'ingresso. Ma PassoPasso cresce con te. Un passo alla volta: da zero a dove vuoi arrivare.

*Schermo:* le 5 icone, poi logotipo e `passopasso.andreavallieri.com` con il QR (la colonna sinistra di `pitch/screens/desktop-home.png`).

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
Taglia in quest'ordine:
1. B19 (roadmap): resta nel README e nella consegna.
2. La seconda frase di B12 (calendario).
3. B06 (icona che cresce): l'icona si vede già in B11.

## Prima di registrare
- Controlla in `docs/agenti/stato.md` che ogni funzione citata sia online: scheda, prontezza dai dati di salute, test di prontezza, piatto in tre parti, Piani. Se una manca, togli la sua battuta: niente mockup spacciati per funzioni vere. L'unica eccezione è l'app nativa in B17, che va dichiarata "in arrivo" a schermo.
- Testi a schermo: Archivo corsivo extrabold per i titoli, Plus Jakarta Sans per le fonti. Colori `#2C6975`, `#68B2A0`, `#CDE0C9`.
- Sottotitoli sempre attivi: molti guardano senza audio.
- Le attese dell'AI vanno accelerate, non tagliate del tutto: un secondo di caricamento fa capire che è tutto vero.
