#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env.compose"
POSTGRES_SERVICE="${FORGEGATE_POSTGRES_SERVICE:-postgres}"
DEFAULT_OUTPUT_DIR="${FORGEGATE_BACKUP_OUTPUT_DIR:-$ROOT_DIR/.forgegate/backups}"

log() { printf "[forgegate-backup] %s\n" "$*" >&2; }
fail() { printf "[forgegate-backup][ERROR] %s\n" "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' not found."
}

ensure_compose_ready() {
  docker compose -f "$COMPOSE_FILE" up -d "$POSTGRES_SERVICE" >/dev/null
  for _ in {1..40}; do
    if docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" pg_isready -U "$FORGEGATE_PG_USER" -d "$FORGEGATE_PG_DB" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  fail "Postgres service '$POSTGRES_SERVICE' did not become ready in time."
}

require_cmd docker
require_cmd python3

if ! docker compose version >/dev/null 2>&1; then
  fail "Docker Compose plugin is required (docker compose ...)."
fi

[[ -f "$ENV_FILE" ]] || fail "Missing $ENV_FILE"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${FORGEGATE_PG_USER:?FORGEGATE_PG_USER must be set in .env.compose}"
: "${FORGEGATE_PG_DB:?FORGEGATE_PG_DB must be set in .env.compose}"

TIMESTAMP="${FORGEGATE_BACKUP_TIMESTAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
BACKUP_PATH="${1:-$DEFAULT_OUTPUT_DIR/forgegate-${TIMESTAMP}.dump}"
BACKUP_PATH="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$BACKUP_PATH")"
MANIFEST_PATH="${FORGEGATE_BACKUP_MANIFEST_PATH:-${BACKUP_PATH}.json}"
MANIFEST_PATH="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$MANIFEST_PATH")"

mkdir -p "$(dirname "$BACKUP_PATH")"
mkdir -p "$(dirname "$MANIFEST_PATH")"

log "Ensuring postgres service is running..."
ensure_compose_ready

log "Writing PostgreSQL backup to $BACKUP_PATH"
docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  pg_dump -U "$FORGEGATE_PG_USER" -d "$FORGEGATE_PG_DB" -F c >"$BACKUP_PATH"

[[ -s "$BACKUP_PATH" ]] || fail "Backup file $BACKUP_PATH is empty."

CHECKSUM=""
if command -v sha256sum >/dev/null 2>&1; then
  CHECKSUM="$(sha256sum "$BACKUP_PATH" | awk '{print $1}')"
fi

python3 - "$BACKUP_PATH" "$MANIFEST_PATH" "$FORGEGATE_PG_DB" "$CHECKSUM" <<'PY'
import json
import os
import sys
from datetime import datetime, UTC
from pathlib import Path

backup_path = Path(sys.argv[1])
manifest_path = Path(sys.argv[2])
database = sys.argv[3]
checksum = sys.argv[4]

payload = {
    "status": "ok",
    "backup_path": str(backup_path),
    "manifest_path": str(manifest_path),
    "database": database,
    "byte_size": backup_path.stat().st_size,
    "checksum_sha256": checksum or None,
    "created_at": datetime.now(UTC).isoformat(),
}
manifest_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print(json.dumps(payload, indent=2))
PY
