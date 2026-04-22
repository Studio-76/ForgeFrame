#!/usr/bin/env bash
set -euo pipefail

log() {
  printf "[forgegate-startup] %s\n" "$*" >&2
}

MIGRATION_ATTEMPTS="${FORGEGATE_STARTUP_MIGRATION_ATTEMPTS:-10}"
MIGRATION_DELAY_SECONDS="${FORGEGATE_STARTUP_MIGRATION_DELAY_SECONDS:-2}"

for ((attempt = 1; attempt <= MIGRATION_ATTEMPTS; attempt++)); do
  if migration_report="$(python /app/scripts/apply-storage-migrations.py 2>&1)"; then
    log "Storage migrations are current."
    printf '%s\n' "$migration_report" >&2
    break
  fi

  printf '%s\n' "$migration_report" >&2
  if (( attempt == MIGRATION_ATTEMPTS )); then
    log "Storage migrations failed after ${MIGRATION_ATTEMPTS} attempts."
    exit 1
  fi

  log "Storage migrations failed on attempt ${attempt}/${MIGRATION_ATTEMPTS}; retrying in ${MIGRATION_DELAY_SECONDS}s."
  sleep "$MIGRATION_DELAY_SECONDS"
done

if [[ "$#" -gt 0 ]]; then
  exec "$@"
fi

exec uvicorn app.main:app \
  --app-dir /app/backend \
  --host "${FORGEGATE_HOST:-0.0.0.0}" \
  --port "${FORGEGATE_PORT:-8000}"
