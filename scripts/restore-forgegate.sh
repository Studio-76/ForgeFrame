#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env.compose"
POSTGRES_SERVICE="${FORGEGATE_POSTGRES_SERVICE:-postgres}"

log() { printf "[forgegate-restore] %s\n" "$*" >&2; }
fail() { printf "[forgegate-restore][ERROR] %s\n" "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' not found."
}

ensure_compose_ready() {
  docker compose -f "$COMPOSE_FILE" up -d "$POSTGRES_SERVICE" >/dev/null
  for _ in {1..40}; do
    if docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" pg_isready -U "$FORGEGATE_PG_USER" -d postgres >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  fail "Postgres service '$POSTGRES_SERVICE' did not become ready in time."
}

validate_db_name() {
  [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || fail "Database name '$1' is not a safe PostgreSQL identifier."
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

BACKUP_PATH="${1:-}"
[[ -n "$BACKUP_PATH" ]] || fail "Usage: scripts/restore-forgegate.sh <dump> [target_db]"
BACKUP_PATH="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$BACKUP_PATH")"
[[ -f "$BACKUP_PATH" ]] || fail "Backup file $BACKUP_PATH does not exist."

TARGET_DB="${2:-${FORGEGATE_RESTORE_DB_NAME:-${FORGEGATE_PG_DB}_restored}}"
validate_db_name "$TARGET_DB"

if [[ "$TARGET_DB" == "$FORGEGATE_PG_DB" && "${FORGEGATE_RESTORE_ALLOW_SOURCE_DB_OVERWRITE:-0}" != "1" ]]; then
  fail "Refusing to overwrite source database '$FORGEGATE_PG_DB' without FORGEGATE_RESTORE_ALLOW_SOURCE_DB_OVERWRITE=1."
fi

log "Ensuring postgres service is running..."
ensure_compose_ready

DB_EXISTS="$(
  docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
    psql -U "$FORGEGATE_PG_USER" -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '$TARGET_DB';"
)"

if [[ "$DB_EXISTS" == "1" ]]; then
  if [[ "${FORGEGATE_RESTORE_DROP_EXISTING:-0}" != "1" ]]; then
    fail "Target database '$TARGET_DB' already exists. Re-run with FORGEGATE_RESTORE_DROP_EXISTING=1 to replace it."
  fi
  log "Dropping existing database $TARGET_DB"
  docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
    psql -v ON_ERROR_STOP=1 -U "$FORGEGATE_PG_USER" -d postgres <<SQL >/dev/null
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "$TARGET_DB";
SQL
fi

log "Creating database $TARGET_DB"
docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$FORGEGATE_PG_USER" -d postgres -c "CREATE DATABASE \"$TARGET_DB\";" >/dev/null

log "Restoring $BACKUP_PATH into $TARGET_DB"
docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  pg_restore -U "$FORGEGATE_PG_USER" -d "$TARGET_DB" --clean --if-exists --no-owner --no-privileges -F c <"$BACKUP_PATH"

python3 - "$BACKUP_PATH" "$TARGET_DB" <<'PY'
import json
import sys
from datetime import datetime, UTC
from pathlib import Path

backup_path = Path(sys.argv[1])
target_db = sys.argv[2]

print(
    json.dumps(
        {
            "status": "ok",
            "backup_path": str(backup_path),
            "target_database": target_db,
            "restored_at": datetime.now(UTC).isoformat(),
        },
        indent=2,
    )
)
PY
