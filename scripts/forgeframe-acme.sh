#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"

ENV_FILE="$(forgeframe_default_env_file "$ROOT_DIR")"
if [[ -f "$ENV_FILE" ]]; then
  forgeframe_load_env_file "$ENV_FILE"
fi

log() { printf '[forgeframe-acme] %s\n' "$*" >&2; }
fail() { printf '[forgeframe-acme][ERROR] %s\n' "$*" >&2; exit 1; }

command -v certbot >/dev/null 2>&1 || fail "certbot is required."
: "${FORGEFRAME_PUBLIC_FQDN:?FORGEFRAME_PUBLIC_FQDN must be set}"
: "${FORGEFRAME_PUBLIC_TLS_ACME_EMAIL:?FORGEFRAME_PUBLIC_TLS_ACME_EMAIL must be set}"
: "${FORGEFRAME_PUBLIC_TLS_WEBROOT_PATH:?FORGEFRAME_PUBLIC_TLS_WEBROOT_PATH must be set}"
: "${FORGEFRAME_PUBLIC_TLS_STATE_PATH:?FORGEFRAME_PUBLIC_TLS_STATE_PATH must be set}"
: "${FORGEFRAME_PUBLIC_TLS_CERT_PATH:?FORGEFRAME_PUBLIC_TLS_CERT_PATH must be set}"
: "${FORGEFRAME_PUBLIC_TLS_KEY_PATH:?FORGEFRAME_PUBLIC_TLS_KEY_PATH must be set}"

mkdir -p "${FORGEFRAME_PUBLIC_TLS_WEBROOT_PATH}" "${FORGEFRAME_PUBLIC_TLS_STATE_PATH}" "$(dirname "${FORGEFRAME_PUBLIC_TLS_CERT_PATH}")" "$(dirname "${FORGEFRAME_PUBLIC_TLS_KEY_PATH}")"

if certbot certonly \
  --non-interactive \
  --agree-tos \
  --email "${FORGEFRAME_PUBLIC_TLS_ACME_EMAIL}" \
  --server "${FORGEFRAME_PUBLIC_TLS_ACME_DIRECTORY_URL:-https://acme-v02.api.letsencrypt.org/directory}" \
  --webroot \
  --webroot-path "${FORGEFRAME_PUBLIC_TLS_WEBROOT_PATH}" \
  --domain "${FORGEFRAME_PUBLIC_FQDN}" \
  --keep-until-expiring \
  --config-dir "${FORGEFRAME_PUBLIC_TLS_STATE_PATH}/letsencrypt" \
  --work-dir "${FORGEFRAME_PUBLIC_TLS_STATE_PATH}/work" \
  --logs-dir "${FORGEFRAME_PUBLIC_TLS_STATE_PATH}/logs"; then
  install -m 600 "${FORGEFRAME_PUBLIC_TLS_STATE_PATH}/letsencrypt/live/${FORGEFRAME_PUBLIC_FQDN}/fullchain.pem" "${FORGEFRAME_PUBLIC_TLS_CERT_PATH}"
  install -m 600 "${FORGEFRAME_PUBLIC_TLS_STATE_PATH}/letsencrypt/live/${FORGEFRAME_PUBLIC_FQDN}/privkey.pem" "${FORGEFRAME_PUBLIC_TLS_KEY_PATH}"
  : > "${FORGEFRAME_PUBLIC_TLS_LAST_ERROR_PATH:-${FORGEFRAME_PUBLIC_TLS_STATE_PATH}/last_error.txt}"
  log "Certificate material updated for ${FORGEFRAME_PUBLIC_FQDN}"
else
  mkdir -p "$(dirname "${FORGEFRAME_PUBLIC_TLS_LAST_ERROR_PATH:-${FORGEFRAME_PUBLIC_TLS_STATE_PATH}/last_error.txt}")"
  printf '%s\n' "certbot_failed $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${FORGEFRAME_PUBLIC_TLS_LAST_ERROR_PATH:-${FORGEFRAME_PUBLIC_TLS_STATE_PATH}/last_error.txt}"
  fail "Certificate request or renewal failed."
fi
