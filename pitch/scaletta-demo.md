# Scaletta della demo

Serve per due cose: registrare la parte demo del video (1:20-3:00) e dare ai giurati un percorso da provare da soli.

Link: https://passopasso.andreavallieri.com
Dispositivo: telefono, oppure browser desktop con DevTools in vista mobile (iPhone 14, 390×844).

## Prima di registrare
- [ ] L'app risponde dal link pubblico (non da localhost).
- [ ] Profilo pulito: finestra in incognito, o dati del sito cancellati.
- [ ] Il server chiama Claude senza errori: fare una prova completa dell'onboarding.
- [ ] Foto di un piatto pronta nella galleria (piatto vario e colorato, si capisce bene).
- [ ] Notifiche del telefono disattivate, batteria e orario puliti nella barra di stato.
- [ ] Registrazione schermo in verticale, 1080p.

## Percorso

| # | Tempo video | Azione | Cosa deve vedersi | Funzione dimostrata |
|---|---|---|---|---|
| 1 | 1:20 | Apri il link. Opzionale: "Aggiungi a schermata Home" e apri dall'icona | Splash con l'icona livello 1 | PWA installabile, icona che evolve |
| 2 | 1:25 | Onboarding: rispondi "Non mi alleno da anni", "20 minuti, 3 volte a settimana", "A volte mi fa male il ginocchio" | L'AI fa domande di seguito, poi mostra la prima settimana | Onboarding a conversazione |
| 3 | 1:40 | Apri la seduta di oggi → check-in. Tempo 15 min, energia bassa, tocca il ginocchio sulla mappa del corpo | La seduta si rigenera: più breve, senza esercizi che caricano il ginocchio | Check-in adattivo, catalogo verificato |
| 4 | 2:05 | Torna al check-in, segnala un sintomo da bandiera rossa (es. dolore al petto) | Nessuna seduta, messaggio che consiglia un medico | Sicurezza |
| 5 | 2:15 | Segna come saltata la seduta di ieri (o usa il comando demo per simularla) | Settimana riorganizzata, seduta di ripartenza con bonus, tono "Capita. Riprendiamo da qui, con calma." | Riorganizzazione senza colpa |
| 6 | 2:35 | Completa una seduta, scegli "duro" | La prossima seduta è più leggera; home con punteggio di costanza e una vittoria non legata al peso | Feedback che regola l'intensità, motivazione |
| 7 | 2:45 | Sezione alimentazione: leggi l'abitudine della settimana, carica la foto del piatto | Feedback qualitativo dell'AI, nessun numero di calorie | Alimentazione senza calorie |
| 8 | (bonus) | Se disponibile: controllo della forma sullo squat con la fotocamera | Scheletro sovrapposto e indicazione sulla forma | Effetto wow (MediaPipe) |
| 9 | (bonus) | Mostra il passaggio di livello | Icona che passa da livello 1 a livello 2 | Percorso progressivo |

## Piano B
- **L'AI è lenta:** in registrazione si taglia. Dal vivo, riempire l'attesa spiegando cosa sta succedendo ("sta rigenerando la seduta sul catalogo").
- **L'AI non risponde:** usare un profilo già preparato con onboarding completato e mostrare dal punto 3 in poi.
- **Una funzione non è pronta:** saltare la riga, non simularla. Aggiornare script e testi di consegna.

## Per i giurati (versione breve, da incollare nelle istruzioni)
1. Apri https://passopasso.andreavallieri.com dal telefono.
2. Fai l'onboarding rispondendo come un principiante vero.
3. Apri la seduta di oggi, fai il check-in e segna un dolore sulla mappa del corpo: la seduta cambia.
4. Segna una seduta come saltata: guarda come si riorganizza la settimana.
5. Completa una seduta e dai un feedback.
6. Carica la foto di un piatto nella sezione alimentazione.
