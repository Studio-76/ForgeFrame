#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${FORGEGATE_BACKEND_TEST_VENV:-/tmp/forgegate-backend-test-venv}"
BACKEND_DIR="$ROOT_DIR/backend"

command -v python3 >/dev/null 2>&1 || { echo "python3 is required" >&2; exit 127; }

backend_env_current() {
  [[ -x "$VENV_DIR/bin/python" && -x "$VENV_DIR/bin/pytest" ]] || return 1
  "$VENV_DIR/bin/python" - "$BACKEND_DIR" <<'PY' >/dev/null 2>&1
from importlib.util import find_spec
from pathlib import Path
import sys

expected = Path(sys.argv[1]).resolve()
spec = find_spec("app.main")
if spec is None or spec.origin is None:
    raise SystemExit(1)

origin = Path(spec.origin).resolve()
if expected not in origin.parents:
    raise SystemExit(1)
PY
}

refresh_backend_env() {
  if [[ ! -x "$VENV_DIR/bin/python" ]]; then
    python3 -m venv "$VENV_DIR"
  fi
  "$VENV_DIR/bin/python" -m pip install -e "$BACKEND_DIR[dev]"
}

if ! backend_env_current; then
  echo "Refreshing backend test environment in $VENV_DIR" >&2
  refresh_backend_env
fi

backend_env_current || {
  echo "Backend test environment is still not aligned with $BACKEND_DIR" >&2
  exit 1
}

cd "$ROOT_DIR"
exec "$VENV_DIR/bin/pytest" backend/tests
