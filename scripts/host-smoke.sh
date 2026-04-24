#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"
FORGEFRAME_NULL_DEVICE="$(forgeframe_null_device)"

ENV_FILE="$(forgeframe_default_env_file "$ROOT_DIR")"
AUTH_FILE="${FORGEFRAME_HOST_SMOKE_AUTH_FILE:-/tmp/forgeframe-host-smoke-login.json}"
AUTH_HEADER_FILE="${FORGEFRAME_HOST_SMOKE_AUTH_HEADER_FILE:-/tmp/forgeframe-host-smoke-auth-header.txt}"
RUNTIME_KEY_FILE="${FORGEFRAME_HOST_SMOKE_RUNTIME_KEY_FILE:-/tmp/forgeframe-host-smoke-runtime-key.json}"
RUNTIME_AUTH_HEADER_FILE="${FORGEFRAME_HOST_SMOKE_RUNTIME_AUTH_HEADER_FILE:-/tmp/forgeframe-host-smoke-runtime-auth-header.txt}"
RUNTIME_ACCOUNT_FILE="${FORGEFRAME_HOST_SMOKE_RUNTIME_ACCOUNT_FILE:-/tmp/forgeframe-host-smoke-runtime-account.json}"
ROOT_HTML_FILE="${FORGEFRAME_HOST_SMOKE_ROOT_HTML_FILE:-/tmp/forgeframe-host-smoke-root.html}"

log() { printf '[forgeframe-host-smoke] %s\n' "$*" >&2; }
fail() { printf '[forgeframe-host-smoke][ERROR] %s\n' "$*" >&2; exit 1; }

forgeframe_command_exists curl || fail "curl is required."
forgeframe_command_exists python3 || fail "python3 is required."
[[ -f "$ENV_FILE" ]] || fail "Missing environment file: $ENV_FILE"

forgeframe_load_env_file "$ENV_FILE" || fail "Unable to load $ENV_FILE"

resolve_base_url() {
  if [[ -n "${FORGEFRAME_SMOKE_BASE_URL:-}" ]]; then
    printf '%s\n' "$FORGEFRAME_SMOKE_BASE_URL"
    return 0
  fi
  if [[ "${FORGEFRAME_PUBLIC_TLS_MODE:-}" == "integrated_acme" ]] && forgeframe_has_configured_public_fqdn; then
    printf 'https://%s\n' "$FORGEFRAME_PUBLIC_FQDN"
    return 0
  fi
  fail "Normative host smoke requires FORGEFRAME_PUBLIC_TLS_MODE=integrated_acme plus a real FORGEFRAME_PUBLIC_FQDN, or an explicit FORGEFRAME_SMOKE_BASE_URL override."
}

BASE_URL="$(resolve_base_url)"
HEALTH_URL="${BASE_URL}/health"
ROOT_URL="${BASE_URL}/"
MODELS_URL="${BASE_URL}/v1/models"
CURL_ARGS=(-sSfL)
if [[ "${FORGEFRAME_SMOKE_CURL_INSECURE:-0}" == "1" ]]; then
  CURL_ARGS+=(-k)
fi

for _ in {1..30}; do
  if curl "${CURL_ARGS[@]}" "$HEALTH_URL" >"$FORGEFRAME_NULL_DEVICE"; then
    break
  fi
  sleep 2
done
curl "${CURL_ARGS[@]}" "$HEALTH_URL" >"$FORGEFRAME_NULL_DEVICE" || fail "Health endpoint did not become ready at $HEALTH_URL"
curl "${CURL_ARGS[@]}" -o "$ROOT_HTML_FILE" "$ROOT_URL" || fail "Root UI did not respond at $ROOT_URL"
python3 - "$ROOT_HTML_FILE" <<'PY' || fail "Root UI did not return an HTML shell."
from pathlib import Path
import sys

payload = Path(sys.argv[1]).read_text(encoding="utf-8", errors="ignore").lower()
if "<html" not in payload and "<!doctype html" not in payload:
    raise SystemExit(1)
PY

forgeframe_login_and_rotate_bootstrap_admin_if_required \
  "$BASE_URL" \
  "$ENV_FILE" \
  "$AUTH_FILE" \
  "$AUTH_HEADER_FILE" || fail "Bootstrap admin login failed against $BASE_URL"

runtime_account_status="$(
  curl -sS -o "$RUNTIME_ACCOUNT_FILE" -w '%{http_code}' -X POST "${BASE_URL}/admin/accounts/" \
    -H "$(cat "$AUTH_HEADER_FILE")" \
    -H 'Content-Type: application/json' \
    -d '{"label":"Host Smoke Runtime Account","provider_bindings":["forgeframe_baseline"],"notes":"host smoke baseline runtime account"}'
)" || fail "Runtime account issue failed against $BASE_URL"
[[ "$runtime_account_status" == "201" ]] || fail "Runtime account issue failed with HTTP $runtime_account_status"
runtime_account_id="$(
  python3 - "$RUNTIME_ACCOUNT_FILE" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
print(payload["account"]["account_id"])
PY
)" || fail "Runtime account response did not contain an account id."

runtime_key_status="$(
  curl -sS -o "$RUNTIME_KEY_FILE" -w '%{http_code}' -X POST "${BASE_URL}/admin/keys/" \
    -H "$(cat "$AUTH_HEADER_FILE")" \
    -H 'Content-Type: application/json' \
    -d "{\"label\":\"Host Smoke Runtime Key\",\"account_id\":\"${runtime_account_id}\",\"scopes\":[\"models:read\"],\"local_only_policy\":\"prefer_local\"}"
)" || fail "Runtime key issue failed against $BASE_URL"
[[ "$runtime_key_status" == "201" ]] || fail "Runtime key issue failed with HTTP $runtime_key_status"
python3 - "$RUNTIME_KEY_FILE" "$RUNTIME_AUTH_HEADER_FILE" <<'PY' || fail "Runtime key response did not contain a token."
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
Path(sys.argv[2]).write_text(f"Authorization: Bearer {payload['issued']['token']}\n", encoding="utf-8")
PY

curl "${CURL_ARGS[@]}" "$MODELS_URL" -H "$(cat "$RUNTIME_AUTH_HEADER_FILE")" >"$FORGEFRAME_NULL_DEVICE" || fail "Runtime API is not reachable on the same public origin at $MODELS_URL"

curl "${CURL_ARGS[@]}" "${BASE_URL}/admin/providers/bootstrap/readiness" \
  -H "$(cat "$AUTH_HEADER_FILE")" \
  | python3 -m json.tool
