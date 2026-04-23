#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"

ENV_FILE="${FORGEFRAME_ENV_FILE:-/etc/forgeframe/forgeframe.env}"
SKIP_SYSTEMCTL="${FORGEFRAME_BOOTSTRAP_SKIP_SYSTEMCTL:-0}"
INSTALL_ARGS=()

log() { printf "[forgeframe-bootstrap] %s\n" "$*"; }
fail() { printf "[forgeframe-bootstrap][ERROR] %s\n" "$*" >&2; exit 1; }

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --skip-systemctl)
      SKIP_SYSTEMCTL=1
      shift
      ;;
    --dry-run)
      INSTALL_ARGS+=("--dry-run")
      shift
      ;;
    *)
      INSTALL_ARGS+=("$1")
      shift
      ;;
  esac
done

[[ "$(uname -s)" == "Linux" ]] || fail "The normative bootstrap path is Linux host-native only."
command -v python3 >/dev/null 2>&1 || fail "python3 is required."
command -v curl >/dev/null 2>&1 || fail "curl is required."

if [[ "$SKIP_SYSTEMCTL" == "1" ]]; then
  INSTALL_ARGS+=("--skip-systemctl")
fi
INSTALL_ARGS+=("--env-file" "$ENV_FILE")

"$ROOT_DIR/scripts/install-forgeframe.sh" "${INSTALL_ARGS[@]}"

if printf '%s\n' "${INSTALL_ARGS[@]}" | grep -qx -- '--dry-run'; then
  log "Dry-run bootstrap completed."
  exit 0
fi

forgeframe_load_env_file "$ENV_FILE" || fail "Unable to load $ENV_FILE"

if [[ "$SKIP_SYSTEMCTL" != "1" ]]; then
  command -v systemctl >/dev/null 2>&1 || fail "systemctl is required for the normative bootstrap path."
  systemctl enable --now forgeframe-api.service forgeframe-retention.timer
  log "Enabled and started forgeframe-api.service plus forgeframe-retention.timer"
else
  log "Skipping systemctl enable/start because FORGEFRAME_BOOTSTRAP_SKIP_SYSTEMCTL=1"
fi

log "Running host-native smoke validation..."
bash "$ROOT_DIR/scripts/host-smoke.sh"

log "Bootstrap completed. Local runtime health passed."
log "Release validation remains the final gate and may still fail until public HTTPS and integrated certificates are implemented."
