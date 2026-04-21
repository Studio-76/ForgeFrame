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
require_cmd python3

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
: "${FORGEGATE_HARNESS_STORAGE_BACKEND:=postgresql}"
: "${FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND:=postgresql}"
: "${FORGEGATE_OBSERVABILITY_STORAGE_BACKEND:=postgresql}"
: "${FORGEGATE_GOVERNANCE_STORAGE_BACKEND:=postgresql}"
: "${FORGEGATE_HARNESS_POSTGRES_URL:=${FORGEGATE_POSTGRES_URL}}"
: "${FORGEGATE_CONTROL_PLANE_POSTGRES_URL:=${FORGEGATE_POSTGRES_URL}}"
: "${FORGEGATE_OBSERVABILITY_POSTGRES_URL:=${FORGEGATE_POSTGRES_URL}}"
: "${FORGEGATE_GOVERNANCE_POSTGRES_URL:=${FORGEGATE_POSTGRES_URL}}"
export FORGEGATE_HARNESS_STORAGE_BACKEND FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND FORGEGATE_OBSERVABILITY_STORAGE_BACKEND FORGEGATE_GOVERNANCE_STORAGE_BACKEND
export FORGEGATE_HARNESS_POSTGRES_URL FORGEGATE_CONTROL_PLANE_POSTGRES_URL FORGEGATE_OBSERVABILITY_POSTGRES_URL FORGEGATE_GOVERNANCE_POSTGRES_URL

if [[ "${FORGEGATE_PG_PASSWORD}" == "forgegate" ]]; then
  log "WARNING: FORGEGATE_PG_PASSWORD uses default value. Change it before shared environment usage."
fi

log "Starting postgres first..."
docker compose -f "$COMPOSE_FILE" up -d --build postgres

log "Waiting for postgres health..."
for _ in {1..60}; do
  status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' forgegate-postgres 2>/dev/null || true)
  [[ "$status" == "healthy" ]] && break
  sleep 2
done
[[ "${status:-}" == "healthy" ]] || fail "Postgres service did not become healthy in time."

log "Applying storage migrations inside the ForgeGate image..."
docker compose -f "$COMPOSE_FILE" run --rm forgegate python /app/scripts/apply-storage-migrations.py >/tmp/forgegate-storage-migrations.json
log "Storage migration report saved to /tmp/forgegate-storage-migrations.json"

log "Starting ForgeGate app..."
docker compose -f "$COMPOSE_FILE" up -d --build forgegate

log "Waiting for ForgeGate health endpoint..."
for _ in {1..60}; do
  if curl -sf "http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}/health" >/dev/null; then
    break
  fi
  sleep 2
done
curl -sf "http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}/health" >/dev/null || fail "ForgeGate health endpoint is not ready."
AUTH_TOKEN="$(
  curl -sf -X POST "http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}/admin/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${FORGEGATE_BOOTSTRAP_ADMIN_USERNAME:-admin}\",\"password\":\"${FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD:-forgegate-admin}\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])'
)"
curl -sf "http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}/admin/providers/bootstrap/readiness" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  | python3 -m json.tool >/tmp/forgegate-bootstrap-readiness.json
log "Bootstrap readiness report saved to /tmp/forgegate-bootstrap-readiness.json"

log "Running compose smoke workflow..."
bash "$ROOT_DIR/scripts/compose-smoke.sh"

log "Bootstrap completed successfully."
log "Open ForgeGate app: http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}/app/"
log "API base: http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}/v1"
