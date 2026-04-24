#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"
FORGEFRAME_NULL_DEVICE="$(forgeframe_null_device)"

log() {
  printf "[forgeframe-startup] %s\n" "$*" >&2
}

fail() {
  printf "[forgeframe-startup][ERROR] %s\n" "$*" >&2
  exit 1
}

ENV_FILE="$(forgeframe_default_env_file "$ROOT_DIR")"
if [[ -f "$ENV_FILE" ]]; then
  forgeframe_load_env_file "$ENV_FILE" || fail "Unable to load $ENV_FILE"
  log "Loaded environment from $ENV_FILE"
fi

PYTHON_BIN="${FORGEFRAME_PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
    PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
  elif forgeframe_command_exists python3; then
    PYTHON_BIN="$(command -v python3)"
  elif forgeframe_command_exists python; then
    PYTHON_BIN="$(command -v python)"
  else
    fail "Neither FORGEFRAME_PYTHON_BIN nor a local python interpreter is available."
  fi
fi

MIGRATION_ATTEMPTS="${FORGEFRAME_STARTUP_MIGRATION_ATTEMPTS:-10}"
MIGRATION_DELAY_SECONDS="${FORGEFRAME_STARTUP_MIGRATION_DELAY_SECONDS:-2}"
DEFAULT_HOST="${FORGEFRAME_HOST:-127.0.0.1}"
DEFAULT_PORT="${FORGEFRAME_PORT:-8080}"

if [[ "${FORGEFRAME_LIMITED_STDLIB_RUNTIME:-0}" == "1" ]]; then
  log "Starting limited stdlib runtime because FORGEFRAME_LIMITED_STDLIB_RUNTIME=1"
  exec "$PYTHON_BIN" "$ROOT_DIR/scripts/serve-limited-forgeframe.py"
fi

for ((attempt = 1; attempt <= MIGRATION_ATTEMPTS; attempt++)); do
  if migration_report="$("$PYTHON_BIN" "$ROOT_DIR/scripts/apply-storage-migrations.py" 2>&1)"; then
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

exec "$PYTHON_BIN" -m uvicorn app.main:app \
  --app-dir "$ROOT_DIR/backend" \
  --host "$DEFAULT_HOST" \
  --port "$DEFAULT_PORT"
