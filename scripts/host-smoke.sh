#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"

ENV_FILE="$(forgeframe_default_env_file "$ROOT_DIR")"
AUTH_FILE="${FORGEFRAME_HOST_SMOKE_AUTH_FILE:-/tmp/forgeframe-host-smoke-login.json}"
AUTH_HEADER_FILE="${FORGEFRAME_HOST_SMOKE_AUTH_HEADER_FILE:-/tmp/forgeframe-host-smoke-auth-header.txt}"

log() { printf '[forgeframe-host-smoke] %s\n' "$*" >&2; }
fail() { printf '[forgeframe-host-smoke][ERROR] %s\n' "$*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v python3 >/dev/null 2>&1 || fail "python3 is required."
[[ -f "$ENV_FILE" ]] || fail "Missing environment file: $ENV_FILE"

forgeframe_load_env_file "$ENV_FILE" || fail "Unable to load $ENV_FILE"

BASE_URL="${FORGEFRAME_SMOKE_BASE_URL:-http://127.0.0.1:${FORGEFRAME_PORT:-8080}}"
HEALTH_URL="${BASE_URL}/health"

for _ in {1..30}; do
  if curl -sf "$HEALTH_URL" >/dev/null; then
    break
  fi
  sleep 2
done
curl -sf "$HEALTH_URL" >/dev/null || fail "Health endpoint did not become ready at $HEALTH_URL"

forgeframe_login_and_rotate_bootstrap_admin_if_required \
  "$BASE_URL" \
  "$ENV_FILE" \
  "$AUTH_FILE" \
  "$AUTH_HEADER_FILE" || fail "Bootstrap admin login failed against $BASE_URL"

curl -sf "${BASE_URL}/admin/providers/bootstrap/readiness" \
  -H "$(cat "$AUTH_HEADER_FILE")" \
  | python3 -m json.tool
