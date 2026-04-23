#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"

ENV_FILE="$(forgeframe_default_env_file "$ROOT_DIR")"
REPORT_PATH="${FORGEFRAME_BACKUP_RESTORE_REPORT_PATH:-/tmp/forgeframe-backup-restore-smoke.json}"
RESTORE_DB="${FORGEFRAME_RESTORE_SMOKE_DB:-forgeframe_restore_smoke}"
KEEP_RESTORE_DB="${FORGEFRAME_RESTORE_SMOKE_KEEP_DB:-0}"

log() { printf "[forgeframe-host-backup-restore-smoke] %s\n" "$*" >&2; }
fail() { printf "[forgeframe-host-backup-restore-smoke][ERROR] %s\n" "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' not found."
}

require_cmd python3
require_cmd psql
require_cmd diff
require_cmd mktemp

[[ -f "$ENV_FILE" ]] || fail "Missing environment file $ENV_FILE"
forgeframe_load_env_file "$ENV_FILE" || fail "Unable to load $ENV_FILE"

RAW_DATABASE_URL="${FORGEFRAME_POSTGRES_TOOL_ACCESS_URL:-${FORGEFRAME_POSTGRES_URL:-${FORGEFRAME_HARNESS_POSTGRES_URL:-}}}"
[[ -n "$RAW_DATABASE_URL" ]] || fail "Set FORGEFRAME_POSTGRES_URL or FORGEFRAME_POSTGRES_TOOL_ACCESS_URL before running backup/restore smoke."

mapfile -t URL_LINES < <(
  python3 - "$RAW_DATABASE_URL" "$RESTORE_DB" <<'PY'
import sys
from urllib.parse import urlsplit, urlunsplit

raw_url = sys.argv[1].strip()
restore_db = sys.argv[2]
parts = urlsplit(raw_url)
scheme = parts.scheme.split("+", 1)[0]
source_db = parts.path.lstrip("/") or "forgeframe"
source_url = urlunsplit((scheme, parts.netloc, parts.path, parts.query, parts.fragment))
restore_url = urlunsplit((scheme, parts.netloc, f"/{restore_db}", parts.query, parts.fragment))
admin_url = urlunsplit((scheme, parts.netloc, "/postgres", parts.query, parts.fragment))
print(source_url)
print(restore_url)
print(admin_url)
print(source_db)
PY
)

SOURCE_DATABASE_URL="${URL_LINES[0]}"
RESTORE_DATABASE_URL="${URL_LINES[1]}"
ADMIN_DATABASE_URL="${URL_LINES[2]}"
SOURCE_DATABASE_NAME="${URL_LINES[3]}"

psql_query() {
  local database_url="$1"
  local sql="$2"
  psql "$database_url" -v ON_ERROR_STOP=1 -Atqc "$sql"
}

collect_table_counts() {
  local database_url="$1"
  local out_file="$2"
  mapfile -t tables < <(psql_query "$database_url" "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")
  : >"$out_file"
  for table in "${tables[@]}"; do
    [[ -n "$table" ]] || continue
    local count
    count="$(psql_query "$database_url" "SELECT count(*) FROM public.\"$table\";")"
    printf '%s\t%s\n' "$table" "$count" >>"$out_file"
  done
}

cleanup() {
  if [[ "${KEEP_RESTORE_DB}" != "1" && -n "${RESTORE_DB:-}" ]]; then
    psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL >/dev/null 2>&1 || true
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$RESTORE_DB' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "$RESTORE_DB";
SQL
  fi
}

trap cleanup EXIT

TMP_DIR="$(mktemp -d /tmp/forgeframe-host-backup-restore-smoke.XXXXXX)"
BACKUP_PATH="$TMP_DIR/forgeframe-smoke.dump"
ORIGINAL_COUNTS="$TMP_DIR/original-counts.tsv"
RESTORED_COUNTS="$TMP_DIR/restored-counts.tsv"
DIFF_PATH="$TMP_DIR/row-counts.diff"

mkdir -p "$(dirname "$REPORT_PATH")"

log "Creating source backup..."
BACKUP_JSON="$("$ROOT_DIR/scripts/backup-forgeframe.sh" "$BACKUP_PATH")"
printf '%s\n' "$BACKUP_JSON" >"$TMP_DIR/backup.json"

log "Restoring backup into disposable database $RESTORE_DB"
RESTORE_JSON="$(
  FORGEFRAME_RESTORE_DROP_EXISTING=1 \
  FORGEFRAME_RESTORE_DB_NAME="$RESTORE_DB" \
  "$ROOT_DIR/scripts/restore-forgeframe.sh" "$BACKUP_PATH" "$RESTORE_DB"
)"
printf '%s\n' "$RESTORE_JSON" >"$TMP_DIR/restore.json"

log "Collecting row counts from source and restored databases..."
collect_table_counts "$SOURCE_DATABASE_URL" "$ORIGINAL_COUNTS"
collect_table_counts "$RESTORE_DATABASE_URL" "$RESTORED_COUNTS"

if ! diff -u "$ORIGINAL_COUNTS" "$RESTORED_COUNTS" >"$DIFF_PATH"; then
  fail "Backup/restore validation failed. Row counts differ; see $DIFF_PATH"
fi

SOURCE_CLUSTER_SYSTEM_IDENTIFIER="$(psql_query "$SOURCE_DATABASE_URL" 'SELECT system_identifier::text FROM pg_control_system();')"

python3 - "$REPORT_PATH" "$BACKUP_PATH" "$RESTORE_DB" "$ORIGINAL_COUNTS" "$RESTORED_COUNTS" "$SOURCE_DATABASE_NAME" "$SOURCE_CLUSTER_SYSTEM_IDENTIFIER" <<'PY'
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

report_path = Path(sys.argv[1])
backup_path = Path(sys.argv[2])
restore_db = sys.argv[3]
original_counts = Path(sys.argv[4])
restored_counts = Path(sys.argv[5])
source_database = sys.argv[6]
source_cluster_system_identifier = sys.argv[7]

tables_compared = sum(1 for line in original_counts.read_text(encoding="utf-8").splitlines() if line.strip())
payload = {
    "status": "ok",
    "checked_at": datetime.now(UTC).isoformat(),
    "backup_path": str(backup_path),
    "restored_database": restore_db,
    "tables_compared": tables_compared,
    "original_counts_path": str(original_counts),
    "restored_counts_path": str(restored_counts),
    "source_database": source_database,
    "source_cluster_system_identifier": source_cluster_system_identifier,
    "validated_source_databases": [
        {
            "database": source_database,
            "cluster_system_identifier": source_cluster_system_identifier,
        }
    ],
}
report_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print(json.dumps(payload, indent=2))
PY

log "Host-native backup/restore smoke report saved to $REPORT_PATH"
