# Scaletta della demo

Serve per tre cose: registrare la parte demo del video (battute B07-B17 di [script.md](script.md)), presentare dal vivo e dare ai giurati un percorso da provare.

- Link: https://passopasso.andreavallieri.com
- Dispositivo: telefono, oppure Chrome con DevTools in vista mobile (390×844). Su desktop largo l'app compare dentro una cornice iPhone, con i widget a lato: va bene anche quella.
- Utente: **Giulia, l'utente `demo`** (pulsante "Prova con l'utente demo" nel benvenuto). È al livello 2, ha circa 3 settimane di storico, una seduta saltata e recuperata (+10) e un'abitudine in corso. **Completando la seduta di oggi le viene proposto il livello 3.**

## Reset del demo
Prima di ogni ciak che parte dallo stato iniziale:

```bash
curl -s -X POST https://passopasso.andreavallieri.com/api/demo/reset
```

Il demo si resetta anche da solo dopo 30 minuti senza modifiche.

## Prima di registrare
- [ ] `curl -s https://passopasso.andreavallieri.com/api/health` risponde con `"ai":"cli"` o `"ai":"sdk"` (non `"off"`).
- [ ] Finestra in incognito, così parti dal benvenuto.
- [ ] Foto di un piatto pronta (vario, colorato, ben illuminato).
- [ ] Un link iCal di prova con qualche impegno nei prossimi 7 giorni (Google Calendar → Impostazioni → il calendario → "Indirizzo segreto in formato iCal"). **Non mostrare a schermo il link vero**: è segreto. Usa un calendario creato per la demo.
- [ ] Notifiche spente, registrazione in verticale a 1080p.

## Ciak
I ciak sono separati perché alcune azioni si escludono a vicenda: dopo aver completato la seduta di oggi non si può più saltarla, e una bandiera rossa al check-in blocca la seduta. Tra un ciak e l'altro fai il reset.

| Ciak | Battute | Parti da | Azioni | Cosa deve vedersi |
|---|---|---|---|---|
| 1 | B07 | incognito, nuovo utente | Benvenuto → "Inizia" → **La tua scheda**: Chi sei (nome, 34 anni, 168 cm, peso, lavoro seduto, 6,5 h di sonno) → Salute (7 interruttori PAR-Q+, tutti "no") → chat da principiante: "Non faccio sport da anni", "20 minuti, 3 volte", "Ho una sedia e un muro", "A volte le ginocchia" | La frase sul peso ben leggibile; barra di avanzamento; 4-5 domande in chat (3-4 s a risposta), senza richiedere il nome; prima settimana al livello 1 |
| 1b | (dal vivo) | incognito | Nella scheda Salute, accendi "Ti hanno mai detto che hai un problema al cuore?" | Schermata calma con il messaggio di prudenza: solo camminata e mobilità finché non senti il medico |
| 2 | B08-B11 | reset, utente demo | Home → "Inizia" → check-in: 15 minuti, energia bassa, ginocchia sulla mappa → "Prepara la mia seduta" → player → completa → "giusto" → test di prontezza (sit-to-stand 30 s, marcia 1 min) → accetta il livello 3 | `reason` dell'AI in "Perché questa seduta"; marcia in casa al posto della camminata; omino animato nel player; anello della costanza; proposta del livello 3 (Costruzione); icona nuova |
| 3 | B12-B13 | stato dopo il ciak 2 (va bene) | Tab Coach → scrivi "Questa settimana lavoro di sera" → poi "Collega il calendario" → incolla il link iCal → "Sì, sposta" | Risposta del coach con i chip verdi (`applied`); spazi liberi; settimana spostata |
| 4 | B14 | reset, utente demo | Settimana → seduta di oggi → "Oggi non ce la faccio" → motivo "tempo" | "Capita. Riprendiamo da qui, con calma." e la ripartenza con +10 |
| 5 | B15 | qualsiasi | Tab Coach → scrivi "Da ieri ho un dolore al petto" | Blocco senza AI, consiglio di sentire un medico e il 112 |
| 6 | B16 | qualsiasi | Tab Cibo → (se serve, mini-onboarding di 5 domande) → segna l'abitudine di oggi → carica la foto del piatto | Card "Prima e dopo"; piatto in tre parti che si riempie; feedback qualitativo, nessun numero |
| 7 | B17 | qualsiasi | Apri `/widget` | Widget piccolo e grande con livello, costanza e seduta di oggi |
| Q&A | — | utente `demo-runner` (Luca) | Home → seduta di oggi (corsa a segmenti) → player | Settimana da podista con il lungo la domenica; timer grande, barra dei segmenti, "3/6", RPE spiegato |
| Q&A | — | qualsiasi | Coach → I miei dati; Percorso → Perché funziona | Export, settimana nel calendario, cancella tutto; scelte di design con la fonte |
| bonus | B10 alt. | qualsiasi, telefono vero | Apri `/formcheck`, consenti la fotocamera, fai due squat | Scheletro sovrapposto e indicazioni sulla forma |

Bandiera rossa dal check-in, in alternativa al ciak 5: nel check-in, in fondo, "Oggi hai qualche sintomo insolito?" → spunta "Dolore al petto" → schermata di blocco con il 112. Poi reset.

## Dal vivo (5 minuti)
1. Utente demo, check-in con le ginocchia: mentre l'AI lavora (circa 10-15 s) spiega che sceglie solo dal catalogo e che le bandiere rosse sono già state controllate.
2. Leggi ad alta voce la `reason`, apri il player e mostra l'omino.
3. Completa, accetta il livello 3.
4. Coach: "Questa settimana lavoro di sera" → chip verdi.
5. Coach: "Ho un dolore al petto" → blocco immediato (nessuna attesa: non passa dall'AI).
6. Cibo con la foto, poi i widget.

## Piano B
- **L'AI è lenta:** in registrazione si accelera. Dal vivo, riempi l'attesa spiegando cosa succede.
- **L'AI non risponde:** dopo 25 secondi il server costruisce la seduta a regole, quindi la demo va avanti comunque. Lo stesso succede con `AI_MODE=off` nel `.env` del server (poi `deploy/deploy.sh`). La `reason` sarà più generica, il resto identico.
- **Lo stato del demo è strano:** reset (vedi sopra).
- **Una funzione non è online:** salta il ciak e togli la battuta dallo script, non simularla.

## Per i giurati (versione da incollare)
1. Apri https://passopasso.andreavallieri.com dal telefono e tocca "Prova con l'utente demo".
2. Inizia la seduta di oggi: nel check-in scegli 15 minuti e tocca le ginocchia sulla mappa. Leggi perché la seduta è cambiata.
3. Completa la seduta e dai un feedback: ti viene proposto il livello 3.
4. Apri il Coach e scrivi come va la tua settimana: guarda cosa cambia nel piano.
5. Carica la foto di un piatto nella sezione Cibo.
6. Vuoi partire da zero? Apri il link in una finestra in incognito e fai l'onboarding.
