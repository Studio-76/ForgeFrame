#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker/docker-compose.yml"
BASE_URL="http://127.0.0.1:8000"

cleanup() {
  if [[ "${1:-}" == "down" ]]; then
    docker compose -f "$COMPOSE_FILE" down -v
  fi
}

trap 'cleanup "${FORGEGATE_SMOKE_DOWN:-}"' EXIT

docker compose -f "$COMPOSE_FILE" up -d --build

for _ in {1..40}; do
  if curl -sf "$BASE_URL/health" >/dev/null; then
    break
  fi
  sleep 2
done

curl -sf "$BASE_URL/health" | python -m json.tool >/tmp/forgegate-health.json

curl -sf -X PUT "$BASE_URL/admin/providers/harness/profiles/local_compose" \
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

curl -sf -X POST "$BASE_URL/admin/providers/sync" -H 'Content-Type: application/json' -d '{"provider": "generic_harness"}' >/tmp/forgegate-sync.json
curl -sf "$BASE_URL/admin/providers/harness/runs?provider_key=local_compose&limit=20" >/tmp/forgegate-runs.json
curl -sf "$BASE_URL/admin/providers/harness/snapshot" >/tmp/forgegate-snapshot.json


docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U forgegate -d forgegate -c "SELECT count(*) AS harness_profiles FROM harness_profiles;" >/tmp/forgegate-db-profiles.txt

echo "Smoke validation completed. Artifacts:"
echo "  /tmp/forgegate-health.json"
echo "  /tmp/forgegate-profile.json"
echo "  /tmp/forgegate-sync.json"
echo "  /tmp/forgegate-runs.json"
echo "  /tmp/forgegate-snapshot.json"
echo "  /tmp/forgegate-db-profiles.txt"
