#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "$ROOT_DIR/scripts/forgeframe-acme.sh"

if command -v systemctl >/dev/null 2>&1; then
  systemctl try-restart forgeframe-public.service >/dev/null 2>&1 || true
fi
