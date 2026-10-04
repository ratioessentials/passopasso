# Chat 4: Deploy e PWA tecnica

Leggi `docs/agenti/README.md` (regole comuni) e `CLAUDE.md`. Lavori **solo in** `deploy/`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `app/web/public/pwa/` e (come extra) `app/web/src/features/formcheck/`.

## Obiettivo
Il link pubblico **https://passopasso.andreavallieri.com** attivo il prima possibile, anche con una pagina provvisoria, e poi un deploy ripetibile con un solo comando.

## 1. Icone PWA
Da `brand/icons/level-1.svg` (icona principale) e `brand/favicon.svg` genera in `app/web/public/pwa/`: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (con margine di sicurezza e sfondo del brand), `apple-touch-icon.png` (180), `favicon-32.png`. Usa `rsvg-convert`, `sharp` o quello che c'è sul server. Scrivi in `deploy/README.md` lo snippet del manifest e i tag `<link>` per la chat 1, e segnalalo in `docs/agenti/richieste.md`.

## 2. Docker
- `Dockerfile` multi-stage: build di `app/web` (Vite) e `app/server` (TypeScript) → immagine finale `node:22-slim` che avvia il server su **3210**, servendo `app/web/dist` e `/api`. Copia anche `content/`.
- Leggi `app/server/README.md` (della chat 2) per le variabili d'ambiente e l'autenticazione AI: `ANTHROPIC_API_KEY` oppure `CLAUDE_CODE_OAUTH_TOKEN`. Se serve la CLI `claude` nell'immagine, installala.
- `docker-compose.yml`: servizio `passopasso`, `env_file: .env`, volume per `DATA_DIR` (SQLite), porta `127.0.0.1:3210:3210`, `restart: unless-stopped`, healthcheck su `/api/health`.
- Finché app/web e app/server non esistono: metti online un placeholder (pagina statica con logo e "In arrivo") così il tunnel si può configurare e verificare subito.

## 3. Cloudflare Tunnel
Il tunnel esiste già sul server. Individua come gira (`cloudflared` come servizio o container, config in `/etc/cloudflared` o `~/.cloudflared`) **senza modificare le route esistenti di altri siti**. Il public hostname `passopasso.andreavallieri.com` → `http://localhost:3210` va aggiunto nella dashboard di Cloudflare: scrivi i passaggi precisi in `deploy/README.md` e chiedi all'utente di farlo. Se il tunnel è gestito da file di configurazione locale, proponi la modifica e chiedi conferma prima di applicarla.

## 4. Script
- `deploy/deploy.sh`: `git pull`, build, `docker compose up -d --build`, attesa dell'healthcheck, smoke test (`/api/health`, `/`, `/api/widget/demo`).
- `.env.example` nella radice (senza segreti) se la chat 2 non l'ha già messo in `app/server/`.

## 5. Extra: controllo della forma sullo squat (solo dopo che il deploy funziona)
In `app/web/src/features/formcheck/`: componente React lazy con **MediaPipe Pose Landmarker** (`@mediapipe/tasks-vision`, modello lite, WASM da CDN jsdelivr) che dalla fotocamera frontale conta le ripetizioni (angolo del ginocchio) e dà 2-3 indicazioni ("scendi un po' di più", "ginocchia in linea con i piedi", "busto più dritto"). Esporta `FormCheck` come default; la chat 1 lo aggancia alla rotta `/formcheck`. Elaborazione solo sul dispositivo, scrivilo nella UI ("Il video non lascia il tuo telefono").

## Fatto quando
`https://passopasso.andreavallieri.com` risponde con l'app, `deploy/deploy.sh` funziona da zero e `deploy/README.md` spiega tutto.
