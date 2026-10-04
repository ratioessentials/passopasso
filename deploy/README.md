# Deploy di PassoPasso

Demo pubblica: **https://passopasso.andreavallieri.com**

```
Internet → Cloudflare → tunnel (cloudflared sul server) → http://127.0.0.1:3210 → container "passopasso"
                                                                                    ├─ /api/*  (Fastify + SQLite + Claude)
                                                                                    └─ /*      (PWA, app/web/dist)
```

## Deploy con un comando

```bash
cd /root/progetti/passopasso
cp .env.example .env   # solo la prima volta, poi riempi i segreti
deploy/deploy.sh
```

`deploy/deploy.sh` fa: `git pull` (se l'albero è pulito) → spegne il placeholder se c'è → `docker compose up -d --build` → aspetta l'healthcheck → smoke test su `/api/health`, `/` e `/api/widget/demo`. Esce con codice ≠ 0 se qualcosa non risponde.

Opzioni:
- `SKIP_PULL=1 deploy/deploy.sh`: non fa `git pull` (utile quando altre chat hanno modifiche non committate).
- `BASE_URL=https://passopasso.andreavallieri.com deploy/deploy.sh`: smoke test anche sul dominio pubblico.

Comandi utili:

```bash
docker compose logs -f passopasso      # log del server
docker compose ps                      # stato e healthcheck
docker compose down                    # spegne (i dati restano nel volume)
```

## Docker

- `Dockerfile` multi-stage: `web-build` (Vite → `app/web/dist`), `server-build` (TypeScript → `app/server/dist`), immagine finale `node:22-slim` con solo le dipendenze di produzione, `content/` e la CLI `claude` (serve all'Agent SDK).
- `docker-compose.yml`: servizio `passopasso`, `env_file: .env`, volume `passopasso-data` montato su `/data` (`DATA_DIR`, il database SQLite), porta `127.0.0.1:3210:3210` (solo locale: dall'esterno si passa dal tunnel), `restart: unless-stopped`, healthcheck su `/api/health`.

### Variabili d'ambiente (`.env`)

Vedi `.env.example` nella radice. Per l'AI basta **una** delle due:
- `ANTHROPIC_API_KEY`: chiave API classica;
- `CLAUDE_CODE_OAUTH_TOKEN`: token dell'abbonamento, si genera sul server con `claude setup-token`.

Senza nessuna delle due il server parte lo stesso e usa le risposte di riserva (fixture), così la demo non si rompe mai.

## Cloudflare Tunnel

**Stato: configurato il 2026-10-04.** Route `passopasso.andreavallieri.com` → `http://127.0.0.1:3210` sul tunnel **`dev-server`** (ID `989fe717-…`), accanto a `productivity.andreavallieri.com`. Il tunnel `passopasso` che compare nella dashboard è vuoto e senza connettore: non è usato.

Sul server il tunnel gira come servizio systemd (`cloudflared.service`, `tunnel run --token-file /etc/cloudflared/token`). È un tunnel **gestito da remoto**: le route stanno nella dashboard di Cloudflare, non in un file locale. Non serve toccare nulla sul server.

**Passaggi (una volta sola, dalla dashboard):**
1. Vai su https://one.dash.cloudflare.com → **Networks → Tunnels** (in alcune versioni: *Access → Tunnels*).
2. Apri il tunnel che gira su questo server (`dev-server`, IP di origine 164.68.107.194).
3. Scheda **Percorsi applicazioni pubblicate** (*Public Hostname*) → **Aggiungi**:
   - **Subdomain**: `passopasso`
   - **Domain**: `andreavallieri.com`
   - **Path**: vuoto
   - **Service → Type**: `HTTP`
   - **Service → URL**: `127.0.0.1:3210`
4. **Save hostname**. Cloudflare crea da solo il record DNS CNAME. Le route degli altri siti non cambiano.

> Usa `127.0.0.1:3210` e **non** `localhost:3210`: sul server `localhost` viene risolto prima in IPv6 (`[::1]`), mentre il container ascolta solo su `127.0.0.1`.

Verifica:

```bash
curl -s https://passopasso.andreavallieri.com/api/health
```

## Placeholder

`deploy/placeholder/` contiene una pagina statica "In arrivo" con un mini server Node (risponde anche a `/api/health`). Serve per avere il dominio online prima che l'app sia pronta:

```bash
docker compose -f deploy/placeholder/docker-compose.yml -p passopasso-placeholder up -d
```

`deploy/deploy.sh` lo spegne in automatico prima di avviare l'app vera.

## PWA: icone e manifest (per la chat 1)

Le icone PNG sono in `app/web/public/pwa/` (generate da `brand/icons/level-1.svg` e `brand/favicon.svg`):

| File | Uso |
|---|---|
| `icon-192.png`, `icon-512.png` | icona normale (angoli arrotondati trasparenti) |
| `icon-maskable-512.png` | Android adattiva: sfondo pieno, pittogramma nella zona sicura (72%) |
| `apple-touch-icon.png` | iOS 180×180, sfondo pieno (gli angoli li arrotonda iOS) |
| `favicon-32.png` | favicon PNG di riserva |

In `app/web/vite.config.ts`, dentro `VitePWA({ ... })`:

```ts
includeAssets: ['icons/*.svg', 'pwa/*.png'],
manifest: {
  // ...resto invariato
  icons: [
    { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/pwa/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/level-1.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ],
},
```

In `app/web/index.html`, nel `<head>` (sostituisce l'`apple-touch-icon` SVG, che iOS non supporta):

```html
<link rel="icon" type="image/svg+xml" href="/icons/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/pwa/favicon-32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/pwa/apple-touch-icon.png" />
```

Rigenerare le icone: `deploy/gen-pwa-icons.mjs` (serve `sharp`: `SHARP_DIR=<cartella con sharp installato> node deploy/gen-pwa-icons.mjs`).
