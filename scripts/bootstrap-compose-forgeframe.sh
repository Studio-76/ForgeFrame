#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env.compose"
ENV_EXAMPLE="$ROOT_DIR/docker/.env.compose.example"
AUTH_FILE="/tmp/forgeframe-bootstrap-admin-login.json"
AUTH_HEADER_FILE="/tmp/forgeframe-bootstrap-admin-auth-header.txt"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"

log() { printf "[forgeframe-bootstrap-compose] %s\n" "$*"; }
fail() { printf "[forgeframe-bootstrap-compose][ERROR] %s\n" "$*" >&2; exit 1; }

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
  forgeframe_ensure_compose_env_file "$ENV_FILE" "$ENV_EXAMPLE" || fail "Missing $ENV_EXAMPLE for env bootstrap."
  log "Created $ENV_FILE from example."
else
  log "Using existing $ENV_FILE"
fi

GENERATED_ENV_ITEMS="$(forgeframe_prepare_compose_env "$ENV_FILE")" || fail "Failed to prepare secure compose secrets in $ENV_FILE."
if [[ -n "$GENERATED_ENV_ITEMS" ]]; then
  while IFS= read -r item; do
    [[ -n "$item" ]] || continue
    log "Generated $item in $ENV_FILE."
  done <<< "$GENERATED_ENV_ITEMS"
fi

forgeframe_load_env_file "$ENV_FILE" || fail "Missing $ENV_FILE"

: "${FORGEFRAME_PG_USER:?FORGEFRAME_PG_USER must be set in .env.compose}"
: "${FORGEFRAME_PG_PASSWORD:?FORGEFRAME_PG_PASSWORD must be set in .env.compose}"
: "${FORGEFRAME_PG_DB:?FORGEFRAME_PG_DB must be set in .env.compose}"
: "${FORGEFRAME_POSTGRES_URL:?FORGEFRAME_POSTGRES_URL must be set in .env.compose}"
: "${FORGEFRAME_HARNESS_STORAGE_BACKEND:=postgresql}"
: "${FORGEFRAME_CONTROL_PLANE_STORAGE_BACKEND:=postgresql}"
: "${FORGEFRAME_OBSERVABILITY_STORAGE_BACKEND:=postgresql}"
: "${FORGEFRAME_GOVERNANCE_STORAGE_BACKEND:=postgresql}"
: "${FORGEFRAME_HARNESS_POSTGRES_URL:=${FORGEFRAME_POSTGRES_URL}}"
: "${FORGEFRAME_CONTROL_PLANE_POSTGRES_URL:=${FORGEFRAME_POSTGRES_URL}}"
: "${FORGEFRAME_OBSERVABILITY_POSTGRES_URL:=${FORGEFRAME_POSTGRES_URL}}"
: "${FORGEFRAME_GOVERNANCE_POSTGRES_URL:=${FORGEFRAME_POSTGRES_URL}}"
export FORGEFRAME_HARNESS_STORAGE_BACKEND FORGEFRAME_CONTROL_PLANE_STORAGE_BACKEND FORGEFRAME_OBSERVABILITY_STORAGE_BACKEND FORGEFRAME_GOVERNANCE_STORAGE_BACKEND
export FORGEFRAME_HARNESS_POSTGRES_URL FORGEFRAME_CONTROL_PLANE_POSTGRES_URL FORGEFRAME_OBSERVABILITY_POSTGRES_URL FORGEFRAME_GOVERNANCE_POSTGRES_URL

log "Starting postgres first..."
docker compose -f "$COMPOSE_FILE" up -d --build postgres

log "Waiting for postgres health..."
for _ in {1..60}; do
  status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' forgeframe-postgres 2>/dev/null || true)
  [[ "$status" == "healthy" ]] && break
  sleep 2
done
[[ "${status:-}" == "healthy" ]] || fail "Postgres service did not become healthy in time."

log "Applying storage migrations inside the ForgeFrame image..."
docker compose -f "$COMPOSE_FILE" run --rm forgeframe python /app/scripts/apply-storage-migrations.py >/tmp/forgeframe-storage-migrations.json
log "Storage migration report saved to /tmp/forgeframe-storage-migrations.json"

log "Starting ForgeFrame app..."
docker compose -f "$COMPOSE_FILE" up -d --build forgeframe

log "Waiting for ForgeFrame health endpoint..."
for _ in {1..60}; do
  if curl -sf "http://127.0.0.1:${FORGEFRAME_APP_PORT:-8000}/health" >/dev/null; then
    break
  fi
  sleep 2
done
curl -sf "http://127.0.0.1:${FORGEFRAME_APP_PORT:-8000}/health" >/dev/null || fail "ForgeFrame health endpoint is not ready."

log "Running compose smoke workflow (includes runtime/error/health observability validation)..."
bash "$ROOT_DIR/scripts/compose-smoke.sh"

if [[ "${FORGEFRAME_BOOTSTRAP_SKIP_RESTORE_SMOKE:-0}" == "1" ]]; then
  log "Skipping backup/restore smoke because FORGEFRAME_BOOTSTRAP_SKIP_RESTORE_SMOKE=1"
else
  log "Running backup/restore smoke workflow..."
  bash "$ROOT_DIR/scripts/compose-backup-restore-smoke.sh"
fi

forgeframe_login_and_rotate_bootstrap_admin_if_required \
  "http://127.0.0.1:${FORGEFRAME_APP_PORT:-8000}" \
  "$ENV_FILE" \
  "$AUTH_FILE" \
  "$AUTH_HEADER_FILE" || fail "Failed to authenticate and, when required, rotate the bootstrap admin password."
AUTH_TOKEN="$(
  python3 - "$AUTH_FILE" <<'PY'
import json
import sys
from pathlib import Path

print(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))["access_token"])
PY
)"
curl -sf "http://127.0.0.1:${FORGEFRAME_APP_PORT:-8000}/admin/providers/bootstrap/readiness" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  | python3 -m json.tool >/tmp/forgeframe-bootstrap-readiness.json
log "Bootstrap readiness report saved to /tmp/forgeframe-bootstrap-readiness.json"

log "Compose bootstrap completed successfully."
log "Open ForgeFrame app: http://127.0.0.1:${FORGEFRAME_APP_PORT:-8000}/app/"
log "API base: http://127.0.0.1:${FORGEFRAME_APP_PORT:-8000}/v1"
