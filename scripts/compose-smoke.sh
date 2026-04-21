#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env.compose"
BASE_URL="http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}"
AUTH_FILE="/tmp/forgegate-admin-login.json"
AUTH_HEADER_FILE="/tmp/forgegate-admin-auth-header.txt"

cleanup() {
  if [[ "${1:-}" == "down" ]]; then
    docker compose -f "$COMPOSE_FILE" down -v
  fi
}

trap 'cleanup "${FORGEGATE_SMOKE_DOWN:-}"' EXIT

command -v docker >/dev/null 2>&1 || { echo "docker command is required" >&2; exit 127; }
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

BASE_URL="http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}"

docker compose -f "$COMPOSE_FILE" up -d --build

for _ in {1..40}; do
  if curl -sf "$BASE_URL/health" >/dev/null; then
    break
  fi
  sleep 2
done

curl -sf "$BASE_URL/health" | python3 -m json.tool >/tmp/forgegate-health.json

curl -sf -X POST "$BASE_URL/admin/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${FORGEGATE_BOOTSTRAP_ADMIN_USERNAME:-admin}\",\"password\":\"${FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD:-forgegate-admin}\"}" \
  >"$AUTH_FILE"
python3 - "$AUTH_FILE" "$AUTH_HEADER_FILE" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
Path(sys.argv[2]).write_text(f"Authorization: Bearer {payload['access_token']}\n", encoding="utf-8")
PY
AUTH_HEADER="$(cat "$AUTH_HEADER_FILE")"

curl -sf -X PUT "$BASE_URL/admin/providers/harness/profiles/local_compose" \
  -H "$AUTH_HEADER" \
  -H 'Content-Type: application/json' \
  -d '{
    "provider_key": "local_compose",
    "label": "Local Compose Harness",
    "integration_class": "templated_http",
    "endpoint_base_url": "https://example.invalid/api",
    "auth_scheme": "none",
    "auth_value": "",
    "auth_header": "Authorization",
    "enabled": true,
    "models": ["compose-model"],
    "discovery_enabled": false,
    "stream_mapping": {"enabled": false},
    "capabilities": {"streaming": false, "model_source": "manual"}
  }' >/tmp/forgegate-profile.json

curl -sf -X POST "$BASE_URL/admin/providers/sync" -H "$AUTH_HEADER" -H 'Content-Type: application/json' -d '{"provider": "generic_harness"}' >/tmp/forgegate-sync.json
curl -sf "$BASE_URL/admin/providers/harness/runs?provider_key=local_compose&limit=20" -H "$AUTH_HEADER" >/tmp/forgegate-runs.json
curl -sf "$BASE_URL/admin/providers/harness/snapshot" -H "$AUTH_HEADER" >/tmp/forgegate-snapshot.json
curl -sf "$BASE_URL/admin/providers/beta-targets" -H "$AUTH_HEADER" >/tmp/forgegate-beta-targets.json
curl -sf "$BASE_URL/admin/providers/bootstrap/readiness" -H "$AUTH_HEADER" >/tmp/forgegate-bootstrap-readiness.json
curl -sf "$BASE_URL/admin/providers/oauth-account/operations" -H "$AUTH_HEADER" >/tmp/forgegate-oauth-operations.json

docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "${FORGEGATE_PG_USER:-forgegate}" -d "${FORGEGATE_PG_DB:-forgegate}" -c "SELECT count(*) AS harness_profiles FROM harness_profiles;" >/tmp/forgegate-db-profiles.txt

echo "Smoke validation completed. Artifacts:"
echo "  /tmp/forgegate-health.json"
echo "  /tmp/forgegate-profile.json"
echo "  /tmp/forgegate-sync.json"
echo "  /tmp/forgegate-runs.json"
echo "  /tmp/forgegate-snapshot.json"
echo "  /tmp/forgegate-beta-targets.json"
echo "  /tmp/forgegate-bootstrap-readiness.json"
echo "  /tmp/forgegate-oauth-operations.json"
echo "  /tmp/forgegate-db-profiles.txt"
