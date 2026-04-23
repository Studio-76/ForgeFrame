#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"

ENV_FILE="$(forgeframe_default_env_file "$ROOT_DIR")"
DEFAULT_OUTPUT_DIR="${FORGEFRAME_BACKUP_OUTPUT_DIR:-$ROOT_DIR/.forgeframe/backups}"

log() { printf "[forgeframe-backup] %s\n" "$*" >&2; }
fail() { printf "[forgeframe-backup][ERROR] %s\n" "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' not found."
}

normalize_pg_url() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlsplit, urlunsplit

raw = sys.argv[1].strip()
if not raw:
    raise SystemExit(1)
parts = urlsplit(raw)
scheme = parts.scheme.split("+", 1)[0]
print(urlunsplit((scheme, parts.netloc, parts.path, parts.query, parts.fragment)))
PY
}

require_cmd python3
require_cmd pg_dump
require_cmd psql

[[ -f "$ENV_FILE" ]] || fail "Missing environment file $ENV_FILE"
forgeframe_load_env_file "$ENV_FILE" || fail "Unable to load $ENV_FILE"

RAW_DATABASE_URL="${FORGEFRAME_POSTGRES_TOOL_ACCESS_URL:-${FORGEFRAME_POSTGRES_URL:-${FORGEFRAME_HARNESS_POSTGRES_URL:-}}}"
[[ -n "$RAW_DATABASE_URL" ]] || fail "Set FORGEFRAME_POSTGRES_URL or FORGEFRAME_POSTGRES_TOOL_ACCESS_URL before running backup."
DATABASE_URL="$(normalize_pg_url "$RAW_DATABASE_URL")"

TIMESTAMP="${FORGEFRAME_BACKUP_TIMESTAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
BACKUP_PATH="${1:-$DEFAULT_OUTPUT_DIR/forgeframe-${TIMESTAMP}.dump}"
BACKUP_PATH="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$BACKUP_PATH")"
MANIFEST_PATH="${FORGEFRAME_BACKUP_MANIFEST_PATH:-${BACKUP_PATH}.json}"
MANIFEST_PATH="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$MANIFEST_PATH")"

mkdir -p "$(dirname "$BACKUP_PATH")"
mkdir -p "$(dirname "$MANIFEST_PATH")"

log "Writing PostgreSQL backup to $BACKUP_PATH"
pg_dump --format=custom --file "$BACKUP_PATH" "$DATABASE_URL"
[[ -s "$BACKUP_PATH" ]] || fail "Backup file $BACKUP_PATH is empty."

CHECKSUM=""
if command -v sha256sum >/dev/null 2>&1; then
  CHECKSUM="$(sha256sum "$BACKUP_PATH" | awk '{print $1}')"
fi

SOURCE_DATABASE_NAME="$(psql "$DATABASE_URL" -Atqc 'SELECT current_database();')"
SOURCE_CLUSTER_SYSTEM_IDENTIFIER="$(psql "$DATABASE_URL" -Atqc 'SELECT system_identifier::text FROM pg_control_system();')"

python3 - "$BACKUP_PATH" "$MANIFEST_PATH" "$SOURCE_DATABASE_NAME" "$SOURCE_CLUSTER_SYSTEM_IDENTIFIER" "$CHECKSUM" <<'PY'
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

backup_path = Path(sys.argv[1])
manifest_path = Path(sys.argv[2])
database = sys.argv[3]
cluster_system_identifier = sys.argv[4]
checksum = sys.argv[5]

payload = {
    "status": "ok",
    "backup_path": str(backup_path),
    "manifest_path": str(manifest_path),
    "database": database,
    "cluster_system_identifier": cluster_system_identifier,
    "byte_size": backup_path.stat().st_size,
    "checksum_sha256": checksum or None,
    "created_at": datetime.now(UTC).isoformat(),
}
manifest_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print(json.dumps(payload, indent=2))
PY
