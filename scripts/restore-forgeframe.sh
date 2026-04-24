#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"

ENV_FILE="$(forgeframe_default_env_file "$ROOT_DIR")"

log() { printf "[forgeframe-restore] %s\n" "$*" >&2; }
fail() { printf "[forgeframe-restore][ERROR] %s\n" "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' not found."
}

validate_db_name() {
  [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || fail "Database name '$1' is not a safe PostgreSQL identifier."
}

require_cmd python3
require_cmd psql
require_cmd pg_restore

[[ -f "$ENV_FILE" ]] || fail "Missing environment file $ENV_FILE"
forgeframe_load_env_file "$ENV_FILE" || fail "Unable to load $ENV_FILE"

RAW_DATABASE_URL="${FORGEFRAME_POSTGRES_TOOL_ACCESS_URL:-${FORGEFRAME_POSTGRES_URL:-${FORGEFRAME_HARNESS_POSTGRES_URL:-}}}"
[[ -n "$RAW_DATABASE_URL" ]] || fail "Set FORGEFRAME_POSTGRES_URL or FORGEFRAME_POSTGRES_TOOL_ACCESS_URL before running restore."

BACKUP_PATH="${1:-}"
[[ -n "$BACKUP_PATH" ]] || fail "Usage: scripts/restore-forgeframe.sh <dump> [target_db]"
BACKUP_PATH="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$BACKUP_PATH")"
[[ -f "$BACKUP_PATH" ]] || fail "Backup file $BACKUP_PATH does not exist."

DEFAULT_SOURCE_DB="$(
  python3 - "$RAW_DATABASE_URL" <<'PY'
import sys
from urllib.parse import urlsplit

parts = urlsplit(sys.argv[1].strip())
print(parts.path.lstrip("/") or "forgeframe")
PY
)"

TARGET_DB="${2:-${FORGEFRAME_RESTORE_DB_NAME:-${DEFAULT_SOURCE_DB}_restored}}"
validate_db_name "$TARGET_DB"

if [[ "$TARGET_DB" == "$DEFAULT_SOURCE_DB" && "${FORGEFRAME_RESTORE_ALLOW_SOURCE_DB_OVERWRITE:-0}" != "1" ]]; then
  fail "Refusing to overwrite source database '$DEFAULT_SOURCE_DB' without FORGEFRAME_RESTORE_ALLOW_SOURCE_DB_OVERWRITE=1."
fi

mapfile -t URL_LINES < <(
  python3 - "$RAW_DATABASE_URL" "$TARGET_DB" <<'PY'
import sys
from urllib.parse import urlsplit, urlunsplit

raw_url = sys.argv[1].strip()
target_db = sys.argv[2]
parts = urlsplit(raw_url)
scheme = parts.scheme.split("+", 1)[0]
source_db = parts.path.lstrip("/") or "forgeframe"
admin_url = urlunsplit((scheme, parts.netloc, "/postgres", parts.query, parts.fragment))
target_url = urlunsplit((scheme, parts.netloc, f"/{target_db}", parts.query, parts.fragment))
print(urlunsplit((scheme, parts.netloc, parts.path, parts.query, parts.fragment)))
print(admin_url)
print(target_url)
print(source_db)
PY
)

DATABASE_URL="${URL_LINES[0]}"
ADMIN_DATABASE_URL="${URL_LINES[1]}"
TARGET_DATABASE_URL="${URL_LINES[2]}"

DB_EXISTS="$(psql "$ADMIN_DATABASE_URL" -Atqc "SELECT 1 FROM pg_database WHERE datname = '$TARGET_DB';")"

if [[ "$DB_EXISTS" == "1" ]]; then
  if [[ "${FORGEFRAME_RESTORE_DROP_EXISTING:-0}" != "1" ]]; then
    fail "Target database '$TARGET_DB' already exists. Re-run with FORGEFRAME_RESTORE_DROP_EXISTING=1 to replace it."
  fi
  log "Dropping existing database $TARGET_DB"
  psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL >/dev/null
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "$TARGET_DB";
SQL
fi

log "Creating database $TARGET_DB"
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$TARGET_DB\";" >/dev/null

log "Restoring $BACKUP_PATH into $TARGET_DB"
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$TARGET_DATABASE_URL" "$BACKUP_PATH"

python3 - "$BACKUP_PATH" "$TARGET_DB" "$DEFAULT_SOURCE_DB" <<'PY'
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

backup_path = Path(sys.argv[1])
target_db = sys.argv[2]
source_database = sys.argv[3]

print(
    json.dumps(
        {
            "status": "ok",
            "backup_path": str(backup_path),
            "target_database": target_db,
            "source_database": source_database,
            "restored_at": datetime.now(UTC).isoformat(),
        },
        indent=2,
    )
)
PY
