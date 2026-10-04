# Squadra di agenti

Cinque chat lavorano in parallelo nella stessa cartella (`/root/progetti/passopasso`) e sullo stesso repository (`git@github.com:ratioessentials/passopasso.git`, branch `main`).
La **chat di regia** custodisce il contratto ([api.md](../api.md), [schema.md](../schema.md)) e fa l'integrazione finale.

| Chat | Prompt | Cartelle di cui è proprietaria |
|---|---|---|
| 1 Frontend PWA | [chat-1.md](chat-1.md) | `app/web/` |
| 2 Backend e AI | [chat-2.md](chat-2.md) | `app/server/` |
| 3 Contenuti e sicurezza | [chat-3.md](chat-3.md) | `content/` |
| 4 Deploy e PWA tecnica | [chat-4.md](chat-4.md) | `deploy/`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `app/web/public/pwa/`, `app/web/src/features/formcheck/` |
| 5 Pitch e consegna | [chat-5.md](chat-5.md) | `pitch/`, `README.md` |

## Regole comuni (valgono per tutte)
1. Leggi prima `CLAUDE.md`, `docs/api.md` e `docs/schema.md`.
2. **Modifica solo le tue cartelle.** Se ti serve una modifica altrove o al contratto, fermati e scrivi la richiesta in `docs/agenti/richieste.md` (in fondo, con il numero della tua chat); la chat di regia la gestisce.
3. Git: committa spesso e in piccolo, **aggiungendo solo i tuoi percorsi** (`git add <tua-cartella>`, mai `git add -A` o `git add .`). Prima di ogni push: `git pull --rebase --autostash`, poi `git push` (senza `--autostash` il pull fallisce per le modifiche non committate delle altre chat, perché la cartella è condivisa). Messaggi di commit in italiano, preceduti da `[chat-N]`.
4. Non fare `git reset --hard`, `git checkout -- .`, `git stash` o `git clean`: cancelleresti il lavoro delle altre chat.
5. Niente segreti nel repository (`.env` è già in `.gitignore`).
6. Tono di ogni testo per l'utente: dai del tu, frasi brevi, mai colpa.
7. Scadenza: **blocco del codice alle 14:30 di oggi (2026-10-04)**. Meglio una cosa semplice che funziona di una completa a metà.
8. Quando finisci un blocco di lavoro, aggiorna `docs/agenti/stato.md` con una riga: `[chat-N] HH:MM — fatto X, prossimo Y, bloccato da Z`.

## Porte
- Server Node: **3210** (la 8787 è già occupata sul server)
- Vite in sviluppo: **5180**
