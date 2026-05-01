#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../backend"

PYTHON_BIN=".venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "ForgeFrame backend virtualenv missing. Run: cd backend && python -m venv .venv && .venv/bin/python -m pip install -e '.[dev]'" >&2
  exit 1
fi

# Fail fast before starting uvicorn's reload supervisor. Otherwise the
# reloader parent keeps running while the child exits on invalid settings.
"$PYTHON_BIN" - <<'PY'
import sys

from app.settings.config import Settings


try:
    Settings()
except Exception as exc:
    message = str(exc).strip() or exc.__class__.__name__
    print(
        "ForgeFrame backend failed to start due to invalid configuration.\n"
        f"{message}",
        file=sys.stderr,
    )
    raise SystemExit(1) from None
PY

exec "$PYTHON_BIN" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
