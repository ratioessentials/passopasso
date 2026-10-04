# Demo dal vivo: scaletta e trucchi

Tutto quello che c'è nel video è nell'app pubblica: https://passopasso.andreavallieri.com. Browser desktop a schermo intero (la cornice dell'iPhone compare da 1024px in su).

## Prima di cominciare
1. Apri **https://passopasso.andreavallieri.com/benvenuto?reset** → "Prova con l'utente demo": Giulia torna allo stato iniziale (livello 2, settimana con una seduta saltata e una ripartenza, inbox del coach, perché personale).
2. Per il corridore: **https://passopasso.andreavallieri.com/benvenuto?user=demo-runner** → "Prova con l'utente demo" (Luca, 43 anni, livello 4, settimana da podista con il lungo la domenica).
3. Se una pagina non si apre o resta vecchia: scheda privata (il service worker della PWA tiene in cache).

## Percorso consigliato (10-12 minuti)
| # | Dove | Cosa mostrare | Cosa dire |
|---|---|---|---|
| 1 | `/benvenuto` → **Prova 5 minuti adesso** | Player con omino animato, timer, altoparlante (voce) | "Si comincia senza compilare niente" |
| 2 | X in alto → **Costruisci il mio percorso** | La scheda: età, corpo, sonno, lavoro, la frase sul peso; poi i 7 interruttori PAR-Q+ | "Vuole sapere chi sei, come un professionista" |
| 3 | Avanti → chat | Due o tre scambi (risposte rapide), poi "perché conta per te" | "Una domanda che le altre app non fanno" |
| 4 | `?reset` → demo Giulia → Home | Card "Come stai oggi" (sonno corto, battito alto), anello della costanza | "I dati del corpo entrano nel check-in" |
| 5 | **Inizia** → check-in | 15 minuti, energia già suggerita, tocca le **ginocchia** sulla mappa → **Prepara la mia seduta** | "Si rigenera in pochi secondi e ti dice perché" |
| 6 | Sotto la spiegazione → **Come l'ha costruita →** | Esercizi esclusi col motivo, i 7 controlli, "Verificata 7/7", riga tecnica | "Il codice decide lo spazio sicuro; non inventa" |
| 7 | Indietro → check-in → **Oggi hai qualche sintomo insolito?** → dolore al petto → Prepara | Schermata di blocco con il 112 | "Qui nessuna seduta viene generata" |
| 8 | Home → Inizia la seduta → player → **Salta esercizio** fino alla fine → feedback **Giusto** | Risultato con costanza e proposta **Facciamo il test, 2 minuti** | "Facile, giusta o dura: la prossima si regola" |
| 9 | Test → **Via, 30 secondi** → tocca il cerchio → **Ho finito prima** → metti **17** con il + → Conferma → test 2 → Via → Ho finito prima → sforzo **4** → Conferma | "Test superato" → **Passa al livello 3** → animazione dell'omino che corre | "Il livello lo guadagni: la soglia è 16 alzate per la sua età" |
| 10 | `?reset` → Settimana → **Oggi non ce la faccio** | Il suo perché in corsivo + **10 minuti invece di niente?** | "Prima di saltare ti ricorda perché hai iniziato" |
| 11 | **Oggi salto davvero** → Non ho tempo | "Capita. Riprendiamo da qui, con calma", ripartenza **+10 bonus**, settimana riorganizzata | "Premiare chi riprende: studio su 60.000 persone" |
| 12 | Tab **Coach** | Inbox con "Ti scrivo perché…", chip delle modifiche; prova a scrivere "ho il ginocchio gonfio" | "Ti scrive quando c'è un motivo, non a calendario" |
| 13 | Coach → **Salute e dispositivi** | Sorgenti: Apple Salute (Comando rapido, reale), Strava/Garmin/Fitbit/Oura (**Collega**: simulato), grafico sonno e battito | Di' chiaramente cosa è simulato |
| 14 | Coach → **I miei dati** / **Il tuo piano** | Esporta, settimana nel calendario (.ics), cancella tutto; Free/Plus senza dark pattern | "Niente account, niente pubblicità" |
| 15 | Tab **Cibo** → **Il tuo percorso alimentare** | Tre fasi, "sei qui", tappa saltata con motivo; foto del piatto (anche una foto dal computer) → piatto in tre parti | "Prima togli, poi aggiungi, poi impari. Mai calorie" |
| 16 | `?user=demo-runner` → Percorso / Settimana / Oggi | Percorso Corsa livello 4, lungo la domenica, player a segmenti con l'omino che corre | "E se sono già allenato?" |
| 17 | `/scienza`, `/widget` | Ogni scelta con la fonte; i widget iPhone | "Perché funziona" |

## Cosa è reale e cosa è simulato (da dire se chiedono)
- **Reale**: tutto il motore (AI con catalogo chiuso, invarianti, riserva), onboarding, check-in, coach, foto del piatto (vision), test, calendario via link iCal, Apple Salute via Comando rapido, Web Push, export/cancellazione.
- **Simulato nella demo**: il collegamento alle sorgenti cloud (Strava, Garmin, Fitbit, Oura, Health Connect) carica 14 giorni di dati plausibili; nell'app nativa diventano OAuth e HealthKit/Health Connect.
- **Non c'è ancora**: login e pagamenti (schermata Piani senza acquisto), notifiche native.

## Se l'AI è lenta o giù
Le sedute escono comunque (riserva a regole) e il resto non dipende dall'AI. Con `AI_MODE=off` nel `.env` l'app gira tutta a regole.
