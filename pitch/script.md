# Script del video pitch

Durata obiettivo: **3:30** (massimo 4:00). Circa 480 parole di voce fuori campo, ritmo calmo.
Il voto pesa: Funzionalità 30%, Tecnica & IA 30%, Impatto 20%, Pitch 20%. Per questo la demo occupa metà del video.

Legenda: **VOCE** = cosa si dice. **SCHERMO** = cosa si vede.

---

## 1. Gancio — 0:00-0:20

**SCHERMO:** sfondo petrolio, compare l'icona livello 1 (omino che cammina). Testo grande: "7 su 10".

**VOCE:**
> Sette persone su dieci abbandonano un'app fitness entro cento giorni.
> Non perché sono pigre. Perché l'app non era fatta per loro.

---

## 2. Problema — 0:20-0:55

**SCHERMO:** tre schede che entrano una dopo l'altra, con la fonte in piccolo.
- "70% abbandona entro 100 giorni" — JMIR 2024, 525.824 utenti
- "ChatGPT come trainer: completo solo al 41%" — TIME
- "73%: il conteggio calorie ha contribuito al disturbo alimentare" — studio su MyFitnessPal

**VOCE:**
> Chi parte da zero trova piani rigidi, pensati per chi è già allenato.
> Salti una seduta e la streak si azzera. L'app ti rimprovera. Ti senti in colpa, e molli.
> Chiedi a un chatbot e ti dà un piano generico, senza farti una sola domanda.
> E per mangiare meglio ti chiedono di contare le calorie, che per molti fa più male che bene.

---

## 3. Soluzione — 0:55-1:20

**SCHERMO:** logotipo PassoPasso, tagline. Poi le 5 icone in fila, da camminata a sprint, che si animano una dopo l'altra.

**VOCE:**
> PassoPasso. Da zero a dove vuoi arrivare.
> Un percorso in cinque livelli, in circa dodici settimane: dalla camminata alla corsa.
> Si sale di livello quando sei pronto, non quando lo dice il calendario. E il percorso non si azzera mai.
> Anche l'icona dell'app cresce con te: l'omino passa dal camminare allo sprint.

---

## 4. Demo — 1:20-3:00

Registrazione dello schermo del telefono (o browser in vista mobile) sull'app pubblicata. Dettaglio dei passaggi in `scaletta-demo.md`.

**4a. Onboarding a conversazione — 1:20-1:40**

**SCHERMO:** chat di onboarding, si risponde a 2-3 domande, compare il piano della settimana.

**VOCE:**
> Niente moduli infiniti. Una conversazione: quanto tempo hai, cosa ti piace, se hai fastidi.
> Da qui l'AI costruisce la tua prima settimana.

**4b. Check-in e mappa del corpo — 1:40-2:05**

**SCHERMO:** check-in prima della seduta. Tempo: 15 minuti. Energia bassa. Si tocca il ginocchio sulla mappa del corpo. La seduta si rigenera: esercizi diversi, più brevi.

**VOCE:**
> Prima di ogni seduta, un check-in. Oggi hai solo quindici minuti, sei stanco e ti fa male il ginocchio.
> La seduta si rigenera al momento. Gli esercizi vengono da un catalogo verificato: l'AI sceglie, non inventa.

**4c. Bandiera rossa — 2:05-2:15**

**SCHERMO:** si segnala "dolore al petto". L'app blocca l'allenamento e consiglia di sentire un medico.

**VOCE:**
> E se segnali un sintomo serio, niente allenamento: ti consigliamo di sentire un medico.

**4d. Seduta saltata e ripartenza — 2:15-2:35**

**SCHERMO:** una seduta segnata come saltata. La settimana si riorganizza, compare la "seduta di ripartenza" con il bonus. Messaggio: "Capita. Riprendiamo da qui, con calma."

**VOCE:**
> Hai saltato una seduta? Capita. La settimana si riorganizza da sola, e chi riparte prende un bonus.
> Lo dice la ricerca: premiare chi riprende funziona meglio che punire chi si ferma.

**4e. Feedback e costanza — 2:35-2:45**

**SCHERMO:** fine seduta, si tocca "duro". Poi la home con il punteggio di costanza e una vittoria non legata alla bilancia.

**VOCE:**
> Dopo la seduta dici com'è andata: facile, giusto o duro. L'intensità si regola.
> Al posto della streak, un punteggio di costanza. E vittorie che non dipendono dalla bilancia.

**4f. Alimentazione senza calorie — 2:45-3:00**

**SCHERMO:** abitudine della settimana ("una porzione di verdura a pranzo"). Si carica la foto di un piatto, arriva il feedback qualitativo.

**VOCE:**
> Per l'alimentazione, un'abitudine a settimana. Fotografi il piatto e ricevi un consiglio. Zero calorie da contare.

> *Se il controllo della forma con la fotocamera è pronto, sostituire 4f con 10 secondi di squat con MediaPipe e spostare 4f in una sola frase.*

---

## 5. Tecnologia e AI agents — 3:00-3:20

**SCHERMO:** schema semplice: telefono (PWA) → server Node → Claude (JSON strutturato) + SQLite. Sotto: "Costruita con Claude Code".

**VOCE:**
> Sotto: una PWA in React, installabile, e un server Node con SQLite.
> Claude lavora lato server e restituisce JSON strutturato, sempre validato sul catalogo degli esercizi.
> E l'abbiamo costruita con Claude Code: più agenti in parallelo, uno per l'app, uno per il backend, uno per il pitch.

---

## 6. Chiusura — 3:20-3:30

**SCHERMO:** le 5 icone, poi logotipo e link `passopasso.andreavallieri.com`.

**VOCE:**
> Il principiante è la porta d'ingresso. Ma PassoPasso cresce con te.
> Un passo alla volta. Da zero a dove vuoi arrivare.

---

## Note di produzione
- Registrare la voce a parte, poi montarla sulla registrazione dello schermo: evita i tempi morti delle chiamate all'AI.
- Durante le attese dell'AI, tagliare o accelerare 2x. Non nasconderle del tutto: mostrare un secondo di caricamento rende credibile che è tutto vero.
- Sottotitoli in sovrimpressione: molti guardano i video senza audio.
- Font Archivo corsivo extrabold per i titoli a schermo, Plus Jakarta Sans per le fonti. Colori del brand (`#2C6975`, `#68B2A0`, `#CDE0C9`).
- Prima di registrare, controllare che ogni passaggio della demo esista davvero nell'app: se un pezzo manca, tagliare la sua sezione e redistribuire i secondi, non mostrare mockup spacciandoli per funzionanti.
