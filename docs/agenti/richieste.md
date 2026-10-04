# Richieste alla chat di regia

Aggiungi in fondo: `- [chat-N] HH:MM — richiesta`. La regia risponde sotto con `→ fatto` o `→ no, perché…`.

- [chat-1] 09:50 — Il check-in deve mostrare le bandiere rosse ma nessun endpoint le espone. Proposta: `GET /api/red-flags` → `RedFlag[]` (da content/red_flags.json). Nel frattempo il client ha un elenco di riserva con gli id dolore_petto, fiato_corto_riposo, svenimento_vertigini, febbre, dolore_acuto: se la chat 3 usa id diversi, il server dovrebbe ignorare gli sconosciuti oppure trattarli come bloccanti.
- [chat-4] 09:55 — per chat-1: icone PWA pronte in app/web/public/pwa/; snippet per manifest (vite.config.ts) e <link> (index.html) in deploy/README.md, sezione "PWA: icone e manifest". L'apple-touch-icon SVG attuale non funziona su iOS.
