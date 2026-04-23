#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"

log() {
  printf "[forgeframe-public] %s\n" "$*" >&2
}

fail() {
  printf "[forgeframe-public][ERROR] %s\n" "$*" >&2
  exit 1
}

ENV_FILE="$(forgeframe_default_env_file "$ROOT_DIR")"
if [[ -f "$ENV_FILE" ]]; then
  forgeframe_load_env_file "$ENV_FILE" || fail "Unable to load $ENV_FILE"
fi

[[ "${FORGEFRAME_PUBLIC_TLS_MODE:-disabled}" != "disabled" ]] || fail "FORGEFRAME_PUBLIC_TLS_MODE must not be disabled for the public HTTPS listener."
[[ -n "${FORGEFRAME_PUBLIC_TLS_CERT_PATH:-}" ]] || fail "FORGEFRAME_PUBLIC_TLS_CERT_PATH must be set."
[[ -n "${FORGEFRAME_PUBLIC_TLS_KEY_PATH:-}" ]] || fail "FORGEFRAME_PUBLIC_TLS_KEY_PATH must be set."
[[ -f "${FORGEFRAME_PUBLIC_TLS_CERT_PATH}" ]] || fail "Missing certificate file ${FORGEFRAME_PUBLIC_TLS_CERT_PATH}"
[[ -f "${FORGEFRAME_PUBLIC_TLS_KEY_PATH}" ]] || fail "Missing key file ${FORGEFRAME_PUBLIC_TLS_KEY_PATH}"

PYTHON_BIN="${FORGEFRAME_PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
    PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  else
    fail "python3 is required."
  fi
fi

log "Starting ForgeFrame public listener on ${FORGEFRAME_PUBLIC_HTTPS_HOST:-0.0.0.0}:${FORGEFRAME_PUBLIC_HTTPS_PORT:-443}"
exec "$PYTHON_BIN" -m uvicorn app.main:app \
  --app-dir "$ROOT_DIR/backend" \
  --host "${FORGEFRAME_PUBLIC_HTTPS_HOST:-0.0.0.0}" \
  --port "${FORGEFRAME_PUBLIC_HTTPS_PORT:-443}" \
  --ssl-certfile "${FORGEFRAME_PUBLIC_TLS_CERT_PATH}" \
  --ssl-keyfile "${FORGEFRAME_PUBLIC_TLS_KEY_PATH}"
