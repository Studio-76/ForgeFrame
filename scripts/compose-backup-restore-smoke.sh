#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env.compose"
REPORT_PATH="${FORGEFRAME_BACKUP_RESTORE_REPORT_PATH:-/tmp/forgeframe-backup-restore-smoke.json}"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"

log() { printf "[forgeframe-backup-restore-smoke] %s\n" "$*" >&2; }
fail() { printf "[forgeframe-backup-restore-smoke][ERROR] %s\n" "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' not found."
}

require_cmd docker
require_cmd python3

if ! docker compose version >/dev/null 2>&1; then
  fail "Docker Compose plugin is required (docker compose ...)."
fi

[[ -f "$ENV_FILE" ]] || fail "Missing $ENV_FILE"

forgeframe_load_env_file "$ENV_FILE" || fail "Missing $ENV_FILE"

: "${FORGEFRAME_PG_USER:?FORGEFRAME_PG_USER must be set in .env.compose}"
: "${FORGEFRAME_PG_DB:?FORGEFRAME_PG_DB must be set in .env.compose}"

mkdir -p "$(dirname "$REPORT_PATH")"

log "Ensuring compose services are running for backup/restore validation..."
docker compose -f "$COMPOSE_FILE" up -d postgres forgeframe >/dev/null

export FORGEFRAME_POSTGRES_TOOL_ACCESS_URL="postgresql://${FORGEFRAME_PG_USER}:${FORGEFRAME_PG_PASSWORD}@127.0.0.1:${FORGEFRAME_PG_PORT:-5432}/${FORGEFRAME_PG_DB}"
export FORGEFRAME_ENV_FILE="$ENV_FILE"
export FORGEFRAME_BACKUP_RESTORE_REPORT_PATH="$REPORT_PATH"

bash "$ROOT_DIR/scripts/host-backup-restore-smoke.sh"

log "Compose-backed backup/restore smoke reused the host-native recovery path."
