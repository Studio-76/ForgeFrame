#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"
FORGEFRAME_NULL_DEVICE="$(forgeframe_null_device)"

bash "$ROOT_DIR/scripts/forgeframe-acme.sh"

if forgeframe_command_exists systemctl; then
  systemctl try-restart forgeframe-public.service >"$FORGEFRAME_NULL_DEVICE" 2>&1 || true
fi
