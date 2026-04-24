#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"

ENV_FILE="${FORGEFRAME_ENV_FILE:-/etc/forgeframe/forgeframe.env}"
SKIP_SYSTEMCTL="${FORGEFRAME_BOOTSTRAP_SKIP_SYSTEMCTL:-0}"
ALLOW_LIMITED_EXCEPTION="${FORGEFRAME_BOOTSTRAP_ALLOW_LIMITED_EXCEPTION:-0}"
INSTALL_ARGS=()
GUIDED=0

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
    --guided)
      GUIDED=1
      INSTALL_ARGS+=("--guided")
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

if [[ "$GUIDED" == "1" && "$SKIP_SYSTEMCTL" != "1" && "$(id -u)" -ne 0 ]]; then
  fail "Guided bootstrap needs root so ForgeFrame can claim ports 80 and 443, install systemd units, and leave the operator UI login-ready."
fi

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

public_contract_errors=()
if [[ "${FORGEFRAME_PUBLIC_TLS_MODE:-}" != "integrated_acme" ]]; then
  public_contract_errors+=("FORGEFRAME_PUBLIC_TLS_MODE must stay integrated_acme for the normative public product path")
fi
if ! forgeframe_has_configured_public_fqdn; then
  public_contract_errors+=("FORGEFRAME_PUBLIC_FQDN must be replaced with the real public host name")
fi
if ! forgeframe_has_configured_public_acme_email; then
  public_contract_errors+=("FORGEFRAME_PUBLIC_TLS_ACME_EMAIL must be replaced with the ACME operator email")
fi

if (( ${#public_contract_errors[@]} > 0 )) && [[ "$ALLOW_LIMITED_EXCEPTION" != "1" ]]; then
  fail "Normative bootstrap path is blocked: ${public_contract_errors[*]}"
fi

if [[ "$SKIP_SYSTEMCTL" != "1" ]]; then
  command -v systemctl >/dev/null 2>&1 || fail "systemctl is required for the normative bootstrap path."
  systemctl enable --now forgeframe-api.service forgeframe-retention.timer
  log "Enabled and started forgeframe-api.service plus forgeframe-retention.timer"
  if (( ${#public_contract_errors[@]} == 0 )); then
    systemctl enable --now forgeframe-http-helper.service
    log "Enabled and started forgeframe-http-helper.service"
    bash "$ROOT_DIR/scripts/renew-certificates.sh"
    systemctl enable --now forgeframe-public.service forgeframe-acme.timer
    log "Enabled and started forgeframe-public.service plus forgeframe-acme.timer"
  else
    log "Continuing in limited exception mode because FORGEFRAME_BOOTSTRAP_ALLOW_LIMITED_EXCEPTION=1: ${public_contract_errors[*]}"
  fi
else
  log "Skipping systemctl enable/start because FORGEFRAME_BOOTSTRAP_SKIP_SYSTEMCTL=1"
fi

log "Running host-native smoke validation..."
if (( ${#public_contract_errors[@]} == 0 )); then
  bash "$ROOT_DIR/scripts/host-smoke.sh"
else
  FORGEFRAME_SMOKE_BASE_URL="${FORGEFRAME_SMOKE_BASE_URL:-http://127.0.0.1:${FORGEFRAME_PORT:-8080}}" \
    bash "$ROOT_DIR/scripts/host-smoke.sh"
fi

if (( ${#public_contract_errors[@]} == 0 )); then
  log "Bootstrap completed on the normative public HTTPS path."
  log "Release validation should now confirm the same-origin root UI, public TLS listener, port-80 helper, and integrated certificate posture."
else
  log "Bootstrap completed in limited exception mode."
  log "Public HTTPS remains intentionally blocked until the FQDN, ACME operator email, certificates, and public services are configured."
fi

forgeframe_load_env_file "$ENV_FILE" || fail "Unable to reload $ENV_FILE after bootstrap."
if (( ${#public_contract_errors[@]} == 0 )); then
  log "Frontend login: https://${FORGEFRAME_PUBLIC_FQDN}/"
else
  log "Frontend login: ${FORGEFRAME_SMOKE_BASE_URL:-http://127.0.0.1:${FORGEFRAME_PORT:-8080}}/"
fi
log "Admin user: ${FORGEFRAME_BOOTSTRAP_ADMIN_USERNAME:-admin}"
log "Admin password: ${FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD}"
log "Environment file: $ENV_FILE"
