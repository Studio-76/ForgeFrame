#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env.compose"
ENV_EXAMPLE="$ROOT_DIR/docker/.env.compose.example"
BASE_URL="http://127.0.0.1:${FORGEFRAME_APP_PORT:-8000}"
AUTH_FILE="/tmp/forgeframe-admin-login.json"
AUTH_HEADER_FILE="/tmp/forgeframe-admin-auth-header.txt"
STARTUP_MIGRATION_PROOF_PATH="${FORGEFRAME_STARTUP_MIGRATION_PROOF_PATH:-/tmp/forgeframe-startup-migration-proof.json}"
OBSERVABILITY_TENANT_ID="${FORGEFRAME_OBSERVABILITY_SMOKE_TENANT_ID:-tenant_bootstrap}"
DRIFT_DB_NAME="forgeframe_smoke_pre0007_${PPID}_$$"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"

cleanup() {
  drop_drift_database
  if [[ "${1:-}" == "down" ]]; then
    docker compose -f "$COMPOSE_FILE" down -v
  fi
}

trap 'cleanup "${FORGEFRAME_SMOKE_DOWN:-}"' EXIT

command -v docker >/dev/null 2>&1 || { echo "docker command is required" >&2; exit 127; }
command -v curl >/dev/null 2>&1 || { echo "curl command is required" >&2; exit 127; }
command -v python3 >/dev/null 2>&1 || { echo "python3 command is required" >&2; exit 127; }
if [[ ! -f "$ENV_FILE" ]]; then
  forgeframe_ensure_compose_env_file "$ENV_FILE" "$ENV_EXAMPLE" || { echo "Missing $ENV_FILE and $ENV_EXAMPLE" >&2; exit 1; }
  echo "Created $ENV_FILE from $ENV_EXAMPLE" >&2
fi

GENERATED_ENV_ITEMS="$(forgeframe_prepare_compose_env "$ENV_FILE")" || { echo "Failed to prepare secure compose secrets in $ENV_FILE." >&2; exit 1; }
if [[ -n "$GENERATED_ENV_ITEMS" ]]; then
  while IFS= read -r item; do
    [[ -n "$item" ]] || continue
    echo "Generated $item in $ENV_FILE" >&2
  done <<< "$GENERATED_ENV_ITEMS"
fi

forgeframe_load_env_file "$ENV_FILE" || { echo "Missing $ENV_FILE" >&2; exit 1; }

BASE_URL="http://127.0.0.1:${FORGEFRAME_APP_PORT:-8000}"

postgres_psql() {
  local db_name="$1"
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "${FORGEFRAME_PG_USER:-forgeframe}" -d "$db_name"
}

drop_drift_database() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "${FORGEFRAME_PG_USER:-forgeframe}" -d postgres \
    -c "DROP DATABASE IF EXISTS ${DRIFT_DB_NAME} WITH (FORCE);" >/dev/null 2>&1 || true
}

seed_pre_0007_drift_database() {
  local migration
  local migration_stem
  local migration_version_text
  local migration_version
  local migration_name

  drop_drift_database
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "${FORGEFRAME_PG_USER:-forgeframe}" -d postgres \
    -c "CREATE DATABASE ${DRIFT_DB_NAME};" >/dev/null

  postgres_psql "$DRIFT_DB_NAME" <<'SQL'
CREATE TABLE IF NOT EXISTS forgeframe_schema_migrations (
    version INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

  for migration in "$ROOT_DIR"/backend/app/storage/migrations/000[1-6]_*.sql; do
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
      psql -v ON_ERROR_STOP=1 -U "${FORGEFRAME_PG_USER:-forgeframe}" -d "$DRIFT_DB_NAME" <"$migration"
    migration_stem="$(basename "$migration" .sql)"
    migration_version_text="${migration_stem%%_*}"
    migration_version="$((10#$migration_version_text))"
    migration_name="${migration_stem#*_}"
    postgres_psql "$DRIFT_DB_NAME" <<SQL
INSERT INTO forgeframe_schema_migrations (version, name)
VALUES (${migration_version}, '${migration_name}')
ON CONFLICT (version) DO NOTHING;
SQL
  done
}

prove_startup_migration_tolerance() {
  local drift_url
  drift_url="postgresql+psycopg://${FORGEFRAME_PG_USER:-forgeframe}:${FORGEFRAME_PG_PASSWORD:-forgeframe}@postgres:5432/${DRIFT_DB_NAME}"

  seed_pre_0007_drift_database

  docker compose -f "$COMPOSE_FILE" run --rm --no-deps \
    -e FORGEFRAME_POSTGRES_URL="$drift_url" \
    -e FORGEFRAME_HARNESS_POSTGRES_URL="$drift_url" \
    -e FORGEFRAME_CONTROL_PLANE_POSTGRES_URL="$drift_url" \
    -e FORGEFRAME_OBSERVABILITY_POSTGRES_URL="$drift_url" \
    -e FORGEFRAME_GOVERNANCE_POSTGRES_URL="$drift_url" \
    forgeframe /app/scripts/start-forgeframe.sh python - <<'PY' >"$STARTUP_MIGRATION_PROOF_PATH"
import json

from sqlalchemy import text

from app.readiness import validate_runtime_startup
from app.settings.config import get_settings
from app.storage.db import build_postgres_engine

validate_runtime_startup()

settings = get_settings()
engine = build_postgres_engine(settings.harness_postgres_url)
tables = ("usage_events", "error_events", "health_events", "oauth_operations")

with engine.begin() as connection:
    versions = [row[0] for row in connection.execute(text("SELECT version FROM forgeframe_schema_migrations ORDER BY version ASC"))]
    tenant_columns = {}
    for table in tables:
        tenant_columns[table] = bool(
            connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = :table_name
                      AND column_name = 'tenant_id'
                    """
                ),
                {"table_name": table},
            ).scalar()
        )

assert 7 in versions, versions
assert all(tenant_columns.values()), tenant_columns

print(
    json.dumps(
        {
            "status": "ok",
            "validated_startup_check": "validate_runtime_startup",
            "applied_versions": versions,
            "tenant_columns_present": tenant_columns,
        },
        indent=2,
    )
)
PY
}

docker compose -f "$COMPOSE_FILE" up -d --build

for _ in {1..40}; do
  if curl -sf "$BASE_URL/health" >/dev/null; then
    break
  fi
  sleep 2
done

curl -sf "$BASE_URL/health" | python3 -m json.tool >/tmp/forgeframe-health.json

prove_startup_migration_tolerance

forgeframe_login_and_rotate_bootstrap_admin_if_required "$BASE_URL" "$ENV_FILE" "$AUTH_FILE" "$AUTH_HEADER_FILE" || {
  echo "Failed to authenticate and, when required, rotate the bootstrap admin password." >&2
  exit 1
}
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
    "enabled": false,
    "models": ["compose-model"],
    "discovery_enabled": false,
    "stream_mapping": {"enabled": false},
    "capabilities": {"streaming": false, "model_source": "manual"}
  }' >/tmp/forgeframe-profile.json

curl -sf -X POST "$BASE_URL/admin/providers/sync" -H "$AUTH_HEADER" -H 'Content-Type: application/json' -d '{"provider": "generic_harness"}' >/tmp/forgeframe-sync.json
curl -sf -X POST "$BASE_URL/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [{"role": "user", "content": "compose observability smoke"}],
    "client": {"client_id": "compose-smoke", "consumer": "ops", "integration": "compose_smoke"}
  }' >/tmp/forgeframe-runtime-chat.json
ERROR_STATUS="$(
  curl -sS -o /tmp/forgeframe-runtime-error.json -w '%{http_code}' -X POST "$BASE_URL/v1/chat/completions" \
    -H 'Content-Type: application/json' \
    -d '{
      "model": "missing-compose-model",
      "messages": [{"role": "user", "content": "compose observability error"}],
      "client": {"client_id": "compose-smoke", "consumer": "ops", "integration": "compose_smoke"}
    }'
)"
[[ "$ERROR_STATUS" == "404" ]] || { echo "Expected 404 for invalid ForgeFrame compose smoke model, got $ERROR_STATUS" >&2; cat /tmp/forgeframe-runtime-error.json >&2; exit 1; }
curl -sf -X POST "$BASE_URL/admin/providers/health/run" -H "$AUTH_HEADER" >/tmp/forgeframe-health-run.json
curl -sf "$BASE_URL/admin/providers/harness/runs?provider_key=local_compose&limit=20" -H "$AUTH_HEADER" >/tmp/forgeframe-runs.json
curl -sf "$BASE_URL/admin/providers/harness/snapshot" -H "$AUTH_HEADER" >/tmp/forgeframe-snapshot.json
curl -sf "$BASE_URL/admin/providers/beta-targets" -H "$AUTH_HEADER" >/tmp/forgeframe-beta-targets.json
curl -sf "$BASE_URL/admin/usage/?window=24h&tenantId=${OBSERVABILITY_TENANT_ID}" -H "$AUTH_HEADER" >/tmp/forgeframe-usage-summary.json
curl -sf "$BASE_URL/admin/logs/?tenantId=${OBSERVABILITY_TENANT_ID}" -H "$AUTH_HEADER" >/tmp/forgeframe-logs.json
curl -sf "$BASE_URL/admin/providers/bootstrap/readiness" -H "$AUTH_HEADER" >/tmp/forgeframe-bootstrap-readiness.json
curl -sf "$BASE_URL/admin/providers/oauth-account/operations" -H "$AUTH_HEADER" >/tmp/forgeframe-oauth-operations.json

docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "${FORGEFRAME_PG_USER:-forgeframe}" -d "${FORGEFRAME_PG_DB:-forgeframe}" -c "SELECT count(*) AS harness_profiles FROM harness_profiles;" >/tmp/forgeframe-db-profiles.txt
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "${FORGEFRAME_PG_USER:-forgeframe}" -d "${FORGEFRAME_PG_DB:-forgeframe}" -At -F ',' -c "SELECT (SELECT count(*) FROM usage_events), (SELECT count(*) FROM error_events), (SELECT count(*) FROM health_events);" >/tmp/forgeframe-db-observability.csv

python3 - /tmp/forgeframe-health.json /tmp/forgeframe-usage-summary.json /tmp/forgeframe-logs.json /tmp/forgeframe-bootstrap-readiness.json /tmp/forgeframe-db-observability.csv <<'PY'
import json
import sys
from pathlib import Path

health = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
usage = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
logs = json.loads(Path(sys.argv[3]).read_text(encoding="utf-8"))
readiness = json.loads(Path(sys.argv[4]).read_text(encoding="utf-8"))
db_counts = [int(part) for part in Path(sys.argv[5]).read_text(encoding="utf-8").strip().split(",")]

assert health["readiness"]["state"] in {"degraded", "ready"}, health["readiness"]
assert health["readiness"]["accepting_traffic"] is True, health["readiness"]

assert usage["metrics"]["recorded_request_count"] >= 1, usage["metrics"]
assert usage["metrics"]["recorded_error_count"] >= 1, usage["metrics"]
assert usage["metrics"]["recorded_health_event_count"] >= 1, usage["metrics"]

operability = logs["operability"]
checks = {item["id"]: item for item in operability["checks"]}
assert operability["ready"] is True, operability
assert checks["runtime_signal_path"]["ok"] is True, checks
assert checks["health_signal_path"]["ok"] is True, checks
assert checks["audit_signal_path"]["ok"] is True, checks
assert operability["metrics"]["runtime_errors"] >= 1, operability["metrics"]

readiness_checks = {item["id"]: item for item in readiness["checks"]}
assert (
    readiness_checks["observability_signal_path"]["ok"] is True
    or readiness_checks["observability_signal_path"]["details"] == "tenant_filter_required"
), readiness_checks
assert (
    readiness_checks["observability_error_path"]["ok"] is True
    or readiness_checks["observability_error_path"]["details"] == "tenant_filter_required"
), readiness_checks

assert len(db_counts) == 3, db_counts
assert db_counts[0] >= 1, db_counts
assert db_counts[1] >= 1, db_counts
assert db_counts[2] >= 1, db_counts
PY

echo "Smoke validation completed. Artifacts:"
echo "  /tmp/forgeframe-health.json"
echo "  $STARTUP_MIGRATION_PROOF_PATH"
echo "  /tmp/forgeframe-profile.json"
echo "  /tmp/forgeframe-sync.json"
echo "  /tmp/forgeframe-runtime-chat.json"
echo "  /tmp/forgeframe-runtime-error.json"
echo "  /tmp/forgeframe-health-run.json"
echo "  /tmp/forgeframe-runs.json"
echo "  /tmp/forgeframe-snapshot.json"
echo "  /tmp/forgeframe-beta-targets.json"
echo "  /tmp/forgeframe-usage-summary.json"
echo "  /tmp/forgeframe-logs.json"
echo "  /tmp/forgeframe-bootstrap-readiness.json"
echo "  /tmp/forgeframe-oauth-operations.json"
echo "  /tmp/forgeframe-db-profiles.txt"
echo "  /tmp/forgeframe-db-observability.csv"
