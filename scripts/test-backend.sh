#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${FORGEGATE_BACKEND_TEST_VENV:-/tmp/forgegate-backend-test-venv}"

command -v python3 >/dev/null 2>&1 || { echo "python3 is required" >&2; exit 127; }

if [[ ! -x "$VENV_DIR/bin/pytest" ]]; then
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install -e "$ROOT_DIR/backend[dev]"
fi

cd "$ROOT_DIR"
exec "$VENV_DIR/bin/pytest" backend/tests
