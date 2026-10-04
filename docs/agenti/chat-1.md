# Chat 1: Frontend PWA

Leggi `docs/agenti/README.md` (regole comuni), `CLAUDE.md`, `docs/api.md`, `docs/schema.md` e `brand/` (apri `brand/brand.html` per lo stile). Lavori **solo in `app/web/`**.

## Obiettivo
La PWA mobile-first di PassoPasso: bella, chiara, tono gentile. Durante la demo è la parte che si vede, quindi cura l'aspetto visivo.

## Stack
- Vite + React + TypeScript + Tailwind, `react-router`, `vite-plugin-pwa` (registrazione del service worker; il manifest lo completa la chat 4, tu prepara la configurazione con nome, colori e `start_url`).
- Dev server sulla porta **5180**, con proxy da `/api` a `http://localhost:3210`.
- Build in `app/web/dist` (il server Node la servirà in produzione).
- Tailwind: palette del brand come colori (`petrolio #2C6975`, `acqua #68B2A0`, `salvia #CDE0C9`, `salvia-chiaro #E0ECDE`), font Archivo (titoli, corsivo extrabold) e Plus Jakarta Sans (testi) da Google Fonts. Sfumature verticali dal colore scuro a quello chiaro.
- Copia `brand/icons/level-*.svg` e `brand/favicon.svg` in `app/web/public/icons/` e usa `brand/icons/levels.json` per nomi e verbi dei livelli.

## Client API e mock
- `src/api/client.ts` con funzioni tipizzate per **ogni** endpoint di `docs/api.md` e i tipi di `schema.md` in `src/api/types.ts`.
- Con `VITE_MOCK=1` usa `src/api/mock.ts`: dati finti realistici (utente "Giulia", livello 2, settimana con una seduta saltata) e ritardi simulati. Così lavori senza aspettare il backend.
- `userId` salvato in `localStorage`, header `X-User-Id`. Link "Prova con l'utente demo" che imposta `userId = demo`.

## Schermate (in ordine di priorità)
1. **Benvenuto e onboarding a conversazione**: bolle di chat, risposte rapide (`quickReplies`), indicatore "sta scrivendo…", alla fine animazione "Si parte dal livello N" con l'icona.
2. **Home**: icona del livello con nome e verbo, anello della costanza (0-100, MAI streak), card "Seduta di oggi" con pulsante "Inizia", card abitudine della settimana, ultima vittoria.
3. **Check-in**: minuti disponibili (10/15/20/30), energia (1-5 con faccine o icone), **mappa del corpo SVG cliccabile** (fronte e retro, zone da `schema.md`), caselle delle bandiere rosse ("Oggi hai…?"). Invio → caricamento ("Sto preparando la tua seduta…") → seduta rigenerata con la `reason` dell'AI ben visibile.
4. **Blocco per bandiera rossa**: schermata calma, messaggio, nessun allenamento.
5. **Player della seduta**: un esercizio alla volta, istruzioni, errori comuni, serie e ripetizioni oppure timer, recupero con conto alla rovescia, pulsanti "più facile" (regression) e "salta esercizio".
6. **Feedback**: facile / giusto / duro → schermata di risultato con costanza, nuove vittorie e proposta di passare di livello (`levelUp` → modale "Sei pronto per il livello 3: Corsetta?" → `POST /api/level/accept`).
7. **Settimana**: 7 giorni, azione "Oggi non ce la faccio" → `skip` → messaggio "Capita. Riprendiamo da qui, con calma." e seduta di ripartenza con badge "+bonus".
8. **Percorso**: i 5 livelli in verticale con le icone, quello attuale in evidenza, i successivi in trasparenza.
9. **Progressi**: andamento della costanza (grafico semplice in SVG), minuti totali, vittorie non legate alla bilancia.
10. **Alimentazione**: abitudine della settimana con check giornaliero, foto del piatto (`<input type="file" accept="image/*" capture="environment">`, ridimensionamento a 1024px in canvas, invio in base64) → feedback qualitativo. Mai calorie.

Navigazione: tab bar in basso (Oggi, Settimana, Percorso, Cibo, Progressi).

## Layout desktop (la demo si mostra da desktop)
L'app resta **mobile**. Su desktop (≥1024px) si mostra dentro una **cornice da iPhone**, non con un layout desktop:
- Componente `DesktopShell`: sfondo con la sfumatura del brand (petrolio → salvia); al centro la cornice dell'iPhone **390×844** (angoli arrotondati, bordo scuro, Dynamic Island) con l'app dentro; a sinistra logotipo in Archivo corsivo, tagline "Da zero a dove vuoi arrivare", i 5 livelli con le icone e un **QR code** al link pubblico (`https://passopasso.andreavallieri.com`, libreria `qrcode`) con la scritta "Provala sul tuo telefono"; a destra (≥1280px) anteprima dei widget iPhone (riusa i componenti di `/widget`).
- Sotto i 1024px, o su un telefono vero: niente cornice, l'app a schermo intero. Su iOS rispetta le safe-area (`env(safe-area-inset-*)`).
- **Regole per non rompere la cornice**: nelle schermate dell'app NON usare breakpoint di Tailwind (`sm:`/`md:`/`lg:`), perché si basano sulla finestra e non sulla cornice; usa misure fluide. Lo schermo della cornice ha `transform: translateZ(0)` e `overflow: hidden`, così tab bar, modali e toast `fixed` restano dentro la cornice. Lo scroll avviene dentro lo schermo, non sulla pagina.
- Deve venire bene a 1440×900 e a 1920×1080 (le risoluzioni della registrazione del video).

## Widget iPhone (extra, dopo le schermate 1-7)
Una PWA non può creare widget iOS veri, quindi:
1. Pagina **`/widget`**: una schermata Home di iPhone finta (sfondo, griglia di icone, dock) con i widget di PassoPasso nelle misure iOS: piccolo 2x2, medio 4x2, grande 4x4, più uno circolare per la schermata di blocco. Stile da widget iOS (angoli 22px, padding 16px) con sfumature e font del brand.
   - Piccolo: icona del livello, anello della costanza, prossima seduta.
   - Medio: livello con barra di avanzamento e seduta di oggi con "Inizia".
   - Grande: settimana a pallini (fatta, saltata senza colpa, in programma, riposo), abitudine della settimana, ultima vittoria.
   - Circolare: anello della costanza con il numero del livello.
   Dati da `GET /api/widget/:userId` (con mock). Deve venire bene negli screenshot a 390px di larghezza.
2. Solo se avanza tempo: `app/web/widget/scriptable.js`, uno script per l'app iOS **Scriptable** che legge lo stesso endpoint (URL base configurabile, default `https://passopasso.andreavallieri.com`) e disegna il widget medio vero.

## Lascia libero
`app/web/public/pwa/` e `app/web/src/features/formcheck/` sono della chat 4: prevedi solo un punto di aggancio, cioè un pulsante "Controlla la forma" negli esercizi con `formCheck: true` che porta alla rotta `/formcheck` caricata in modo lazy.

## Fatto quando
`npm run build` passa, con `VITE_MOCK=1` tutto il percorso funziona a 390px, e senza mock le chiamate vanno a `/api`.
