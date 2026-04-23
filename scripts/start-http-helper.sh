#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"

ENV_FILE="$(forgeframe_default_env_file "$ROOT_DIR")"
if [[ -f "$ENV_FILE" ]]; then
  forgeframe_load_env_file "$ENV_FILE"
fi

PYTHON_BIN="${FORGEFRAME_PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
    PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  else
    printf '[forgeframe-http-helper][ERROR] python3 is required.\n' >&2
    exit 1
  fi
fi

exec "$PYTHON_BIN" "$ROOT_DIR/scripts/serve-acme-http.py"
