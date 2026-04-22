#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env.compose"
POSTGRES_SERVICE="${FORGEGATE_POSTGRES_SERVICE:-postgres}"
REPORT_PATH="${FORGEGATE_BACKUP_RESTORE_REPORT_PATH:-/tmp/forgegate-backup-restore-smoke.json}"
RESTORE_DB="${FORGEGATE_RESTORE_SMOKE_DB:-forgegate_restore_smoke}"
KEEP_RESTORE_DB="${FORGEGATE_RESTORE_SMOKE_KEEP_DB:-0}"

log() { printf "[forgegate-backup-restore-smoke] %s\n" "$*" >&2; }
fail() { printf "[forgegate-backup-restore-smoke][ERROR] %s\n" "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' not found."
}

psql_query() {
  local db="$1"
  local sql="$2"
  docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
    psql -v ON_ERROR_STOP=1 -U "$FORGEGATE_PG_USER" -d "$db" -Atqc "$sql"
}

collect_table_counts() {
  local db="$1"
  local out_file="$2"
  mapfile -t tables < <(psql_query "$db" "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")
  : >"$out_file"
  for table in "${tables[@]}"; do
    [[ -n "$table" ]] || continue
    local count
    count="$(psql_query "$db" "SELECT count(*) FROM public.\"$table\";")"
    printf '%s\t%s\n' "$table" "$count" >>"$out_file"
  done
}

cleanup() {
  if [[ "${KEEP_RESTORE_DB}" != "1" && -n "${RESTORE_DB:-}" ]]; then
    docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
      psql -v ON_ERROR_STOP=1 -U "$FORGEGATE_PG_USER" -d postgres <<SQL >/dev/null 2>&1 || true
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$RESTORE_DB' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "$RESTORE_DB";
SQL
  fi
}

trap cleanup EXIT

require_cmd docker
require_cmd diff
require_cmd mktemp
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

TMP_DIR="$(mktemp -d /tmp/forgegate-backup-restore-smoke.XXXXXX)"
BACKUP_PATH="$TMP_DIR/forgegate-smoke.dump"
ORIGINAL_COUNTS="$TMP_DIR/original-counts.tsv"
RESTORED_COUNTS="$TMP_DIR/restored-counts.tsv"
DIFF_PATH="$TMP_DIR/row-counts.diff"

mkdir -p "$(dirname "$REPORT_PATH")"

log "Ensuring compose services are running for backup/restore validation..."
docker compose -f "$COMPOSE_FILE" up -d postgres forgegate >/dev/null

log "Creating source backup..."
BACKUP_JSON="$("$ROOT_DIR/scripts/backup-forgegate.sh" "$BACKUP_PATH")"
printf '%s\n' "$BACKUP_JSON" >"$TMP_DIR/backup.json"

log "Restoring backup into disposable database $RESTORE_DB"
RESTORE_JSON="$(
  FORGEGATE_RESTORE_DROP_EXISTING=1 \
  FORGEGATE_RESTORE_DB_NAME="$RESTORE_DB" \
  "$ROOT_DIR/scripts/restore-forgegate.sh" "$BACKUP_PATH" "$RESTORE_DB"
)"
printf '%s\n' "$RESTORE_JSON" >"$TMP_DIR/restore.json"

log "Collecting row counts from source and restored databases..."
collect_table_counts "$FORGEGATE_PG_DB" "$ORIGINAL_COUNTS"
collect_table_counts "$RESTORE_DB" "$RESTORED_COUNTS"

if ! diff -u "$ORIGINAL_COUNTS" "$RESTORED_COUNTS" >"$DIFF_PATH"; then
  fail "Backup/restore validation failed. Row counts differ; see $DIFF_PATH"
fi

SOURCE_DATABASE_NAME="$(psql_query "$FORGEGATE_PG_DB" "SELECT current_database();")"
SOURCE_CLUSTER_SYSTEM_IDENTIFIER="$(psql_query "$FORGEGATE_PG_DB" "SELECT system_identifier::text FROM pg_control_system();")"

python3 - "$REPORT_PATH" "$BACKUP_PATH" "$RESTORE_DB" "$ORIGINAL_COUNTS" "$RESTORED_COUNTS" "$SOURCE_DATABASE_NAME" "$SOURCE_CLUSTER_SYSTEM_IDENTIFIER" <<'PY'
import json
import sys
from datetime import datetime, UTC
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

log "Backup/restore smoke report saved to $REPORT_PATH"
