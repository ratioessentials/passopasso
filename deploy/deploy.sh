#!/usr/bin/env bash
# Deploy di PassoPasso con un solo comando: pull, build, avvio, healthcheck, smoke test.
# Uso: deploy/deploy.sh   (SKIP_PULL=1 per non fare git pull, BASE_URL=https://... per testare anche il dominio)
set -euo pipefail

cd "$(dirname "$0")/.."
LOCAL_URL="http://127.0.0.1:3210"
ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }
info() { printf '\033[36m→\033[0m %s\n' "$*"; }
fail() { printf '\033[31m✗\033[0m %s\n' "$*"; exit 1; }

# 1) Codice aggiornato
if [[ "${SKIP_PULL:-0}" != "1" ]]; then
  if [[ -z "$(git status --porcelain --untracked-files=no)" ]]; then
    info "git pull"
    git pull --rebase --quiet
  else
    info "modifiche locali presenti: salto git pull (deploy di quello che c'è sul disco)"
  fi
fi

# 2) Configurazione
if [[ ! -f .env ]]; then
  cp .env.example .env
  info "creato .env da .env.example (l'AI resta spenta finché non aggiungi una chiave)"
fi

# 3) Il placeholder occupa la 3210: lo spengo
if docker ps -a --format '{{.Names}}' | grep -qx passopasso-placeholder; then
  info "spengo il placeholder"
  docker compose -f deploy/placeholder/docker-compose.yml -p passopasso-placeholder down >/dev/null
fi

# 4) Build e avvio
info "docker compose up -d --build"
docker compose up -d --build

# 5) Attesa dell'healthcheck
info "aspetto che il container sia healthy"
for i in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' passopasso 2>/dev/null || echo missing)"
  [[ "$status" == "healthy" ]] && break
  [[ "$status" == "missing" ]] && fail "container passopasso non trovato"
  sleep 2
done
[[ "$status" == "healthy" ]] || { docker compose logs --tail 50 passopasso; fail "il container non è diventato healthy (stato: $status)"; }
ok "container healthy"

# 6) Smoke test
check() { # url, descrizione, [testo atteso]
  local body code
  body="$(curl -sS -m 15 -w '\n%{http_code}' "$1")" || fail "$2: nessuna risposta da $1"
  code="${body##*$'\n'}"; body="${body%$'\n'*}"
  [[ "$code" == "200" ]] || fail "$2: HTTP $code da $1"
  if [[ -n "${3:-}" && "$body" != *"$3"* ]]; then fail "$2: manca \"$3\" in $1"; fi
  ok "$2 ($1)"
}
smoke() {
  check "$1/api/health" "health"
  check "$1/" "pagina principale" "<div id=\"root\""
  check "$1/api/widget/demo" "widget demo"
}
smoke "$LOCAL_URL"
[[ -n "${BASE_URL:-}" ]] && smoke "$BASE_URL"

ok "deploy completato"
