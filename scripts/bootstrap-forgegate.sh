#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env.compose"
ENV_EXAMPLE="$ROOT_DIR/docker/.env.compose.example"

log() { printf "[forgegate-bootstrap] %s\n" "$*"; }
fail() { printf "[forgegate-bootstrap][ERROR] %s\n" "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' not found."
}

require_cmd docker
require_cmd curl
require_cmd python

if ! docker compose version >/dev/null 2>&1; then
  fail "Docker Compose plugin is required (docker compose ...)."
fi

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ENV_EXAMPLE" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    log "Created $ENV_FILE from example."
  else
    fail "Missing $ENV_EXAMPLE for env bootstrap."
  fi
else
  log "Using existing $ENV_FILE"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${FORGEGATE_PG_USER:?FORGEGATE_PG_USER must be set in .env.compose}"
: "${FORGEGATE_PG_PASSWORD:?FORGEGATE_PG_PASSWORD must be set in .env.compose}"
: "${FORGEGATE_PG_DB:?FORGEGATE_PG_DB must be set in .env.compose}"
: "${FORGEGATE_POSTGRES_URL:?FORGEGATE_POSTGRES_URL must be set in .env.compose}"

if [[ "${FORGEGATE_PG_PASSWORD}" == "forgegate" ]]; then
  log "WARNING: FORGEGATE_PG_PASSWORD uses default value. Change it before shared environment usage."
fi

log "Starting docker compose stack..."
docker compose -f "$COMPOSE_FILE" up -d --build

log "Waiting for postgres health..."
for _ in {1..60}; do
  status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' forgegate-postgres 2>/dev/null || true)
  [[ "$status" == "healthy" ]] && break
  sleep 2
done
[[ "${status:-}" == "healthy" ]] || fail "Postgres service did not become healthy in time."

log "Waiting for ForgeGate health endpoint..."
for _ in {1..60}; do
  if curl -sf "http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}/health" >/dev/null; then
    break
  fi
  sleep 2
done
curl -sf "http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}/health" >/dev/null || fail "ForgeGate health endpoint is not ready."
curl -sf "http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}/admin/providers/bootstrap/readiness" | python -m json.tool >/tmp/forgegate-bootstrap-readiness.json
log "Bootstrap readiness report saved to /tmp/forgegate-bootstrap-readiness.json"

log "Running compose smoke workflow..."
"$ROOT_DIR/scripts/compose-smoke.sh"

log "Bootstrap completed successfully."
log "Open ForgeGate app: http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}/app/"
log "API base: http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}/v1"
