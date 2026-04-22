#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env.compose"
ENV_EXAMPLE="$ROOT_DIR/docker/.env.compose.example"
BASE_URL="http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}"
AUTH_FILE="/tmp/forgegate-admin-login.json"
AUTH_HEADER_FILE="/tmp/forgegate-admin-auth-header.txt"
STARTUP_MIGRATION_PROOF_PATH="${FORGEGATE_STARTUP_MIGRATION_PROOF_PATH:-/tmp/forgegate-startup-migration-proof.json}"
OBSERVABILITY_TENANT_ID="${FORGEGATE_OBSERVABILITY_SMOKE_TENANT_ID:-tenant_bootstrap}"
DRIFT_DB_NAME="forgegate_smoke_pre0007_${PPID}_$$"

ensure_bootstrap_admin_secret() {
  local generated_secret
  local status

  set +e
  generated_secret="$(
    python3 - "$ENV_FILE" <<'PY'
import secrets
import sys
from pathlib import Path

path = Path(sys.argv[1])
placeholder = "replace-with-a-strong-password"
lines = path.read_text(encoding="utf-8").splitlines()
generated = None
has_username = False
has_password = False
updated_lines: list[str] = []

for line in lines:
    if line.startswith("FORGEGATE_BOOTSTRAP_ADMIN_USERNAME="):
        has_username = True
        if not line.split("=", 1)[1].strip():
            line = "FORGEGATE_BOOTSTRAP_ADMIN_USERNAME=admin"
    elif line.startswith("FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD="):
        has_password = True
        password = line.split("=", 1)[1].strip()
        if password == "forgegate-admin":
            raise SystemExit(12)
        if not password or password == placeholder:
            generated = f"fg-admin-{secrets.token_urlsafe(18)}"
            line = f"FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD={generated}"
    updated_lines.append(line)

if not has_username:
    updated_lines.append("FORGEGATE_BOOTSTRAP_ADMIN_USERNAME=admin")
if not has_password:
    generated = f"fg-admin-{secrets.token_urlsafe(18)}"
    updated_lines.append(f"FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD={generated}")

path.write_text("\n".join(updated_lines) + "\n", encoding="utf-8")
if generated:
    print(generated)
PY
  )"
  status=$?
  set -e

  if [[ $status -eq 12 ]]; then
    echo "FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD in $ENV_FILE still uses the insecure default 'forgegate-admin'. Rotate it before running compose smoke." >&2
    exit 1
  fi
  if [[ $status -ne 0 ]]; then
    echo "Failed to ensure a secure bootstrap admin secret in $ENV_FILE." >&2
    exit 1
  fi
  if [[ -n "$generated_secret" ]]; then
    echo "Generated a bootstrap admin password in $ENV_FILE" >&2
  fi
}

cleanup() {
  drop_drift_database
  if [[ "${1:-}" == "down" ]]; then
    docker compose -f "$COMPOSE_FILE" down -v
  fi
}

trap 'cleanup "${FORGEGATE_SMOKE_DOWN:-}"' EXIT

command -v docker >/dev/null 2>&1 || { echo "docker command is required" >&2; exit 127; }
command -v curl >/dev/null 2>&1 || { echo "curl command is required" >&2; exit 127; }
command -v python3 >/dev/null 2>&1 || { echo "python3 command is required" >&2; exit 127; }
if [[ ! -f "$ENV_FILE" ]]; then
  [[ -f "$ENV_EXAMPLE" ]] || { echo "Missing $ENV_FILE and $ENV_EXAMPLE" >&2; exit 1; }
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "Created $ENV_FILE from $ENV_EXAMPLE" >&2
fi

ensure_bootstrap_admin_secret

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

BASE_URL="http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}"

postgres_psql() {
  local db_name="$1"
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "${FORGEGATE_PG_USER:-forgegate}" -d "$db_name"
}

drop_drift_database() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "${FORGEGATE_PG_USER:-forgegate}" -d postgres \
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
    psql -v ON_ERROR_STOP=1 -U "${FORGEGATE_PG_USER:-forgegate}" -d postgres \
    -c "CREATE DATABASE ${DRIFT_DB_NAME};" >/dev/null

  postgres_psql "$DRIFT_DB_NAME" <<'SQL'
CREATE TABLE IF NOT EXISTS forgegate_schema_migrations (
    version INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

  for migration in "$ROOT_DIR"/backend/app/storage/migrations/000[1-6]_*.sql; do
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
      psql -v ON_ERROR_STOP=1 -U "${FORGEGATE_PG_USER:-forgegate}" -d "$DRIFT_DB_NAME" <"$migration"
    migration_stem="$(basename "$migration" .sql)"
    migration_version_text="${migration_stem%%_*}"
    migration_version="$((10#$migration_version_text))"
    migration_name="${migration_stem#*_}"
    postgres_psql "$DRIFT_DB_NAME" <<SQL
INSERT INTO forgegate_schema_migrations (version, name)
VALUES (${migration_version}, '${migration_name}')
ON CONFLICT (version) DO NOTHING;
SQL
  done
}

prove_startup_migration_tolerance() {
  local drift_url
  drift_url="postgresql+psycopg://${FORGEGATE_PG_USER:-forgegate}:${FORGEGATE_PG_PASSWORD:-forgegate}@postgres:5432/${DRIFT_DB_NAME}"

  seed_pre_0007_drift_database

  docker compose -f "$COMPOSE_FILE" run --rm --no-deps \
    -e FORGEGATE_POSTGRES_URL="$drift_url" \
    -e FORGEGATE_HARNESS_POSTGRES_URL="$drift_url" \
    -e FORGEGATE_CONTROL_PLANE_POSTGRES_URL="$drift_url" \
    -e FORGEGATE_OBSERVABILITY_POSTGRES_URL="$drift_url" \
    -e FORGEGATE_GOVERNANCE_POSTGRES_URL="$drift_url" \
    forgegate /app/scripts/start-forgegate.sh python - <<'PY' >"$STARTUP_MIGRATION_PROOF_PATH"
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
    versions = [row[0] for row in connection.execute(text("SELECT version FROM forgegate_schema_migrations ORDER BY version ASC"))]
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

curl -sf "$BASE_URL/health" | python3 -m json.tool >/tmp/forgegate-health.json

prove_startup_migration_tolerance

curl -sf -X POST "$BASE_URL/admin/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${FORGEGATE_BOOTSTRAP_ADMIN_USERNAME:-admin}\",\"password\":\"${FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD}\"}" \
  >"$AUTH_FILE"
MUST_ROTATE_BOOTSTRAP_PASSWORD="$(
python3 - "$AUTH_FILE" "$AUTH_HEADER_FILE" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
Path(sys.argv[2]).write_text(f"Authorization: Bearer {payload['access_token']}\n", encoding="utf-8")
print("1" if payload.get("user", {}).get("must_rotate_password") else "0")
PY
)"
AUTH_HEADER="$(cat "$AUTH_HEADER_FILE")"

if [[ "$MUST_ROTATE_BOOTSTRAP_PASSWORD" == "1" ]]; then
  ROTATE_PAYLOAD="$(
    python3 - <<'PY'
import json
import os

password = os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"]
print(json.dumps({"current_password": password, "new_password": password}))
PY
  )"
  curl -sf -X POST "$BASE_URL/admin/auth/rotate-password" \
    -H "$AUTH_HEADER" \
    -H 'Content-Type: application/json' \
    -d "$ROTATE_PAYLOAD" >/tmp/forgegate-bootstrap-password-rotation.json
fi

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
  }' >/tmp/forgegate-profile.json

curl -sf -X POST "$BASE_URL/admin/providers/sync" -H "$AUTH_HEADER" -H 'Content-Type: application/json' -d '{"provider": "generic_harness"}' >/tmp/forgegate-sync.json
curl -sf -X POST "$BASE_URL/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [{"role": "user", "content": "compose observability smoke"}],
    "client": {"client_id": "compose-smoke", "consumer": "ops", "integration": "compose_smoke"}
  }' >/tmp/forgegate-runtime-chat.json
ERROR_STATUS="$(
  curl -sS -o /tmp/forgegate-runtime-error.json -w '%{http_code}' -X POST "$BASE_URL/v1/chat/completions" \
    -H 'Content-Type: application/json' \
    -d '{
      "model": "missing-compose-model",
      "messages": [{"role": "user", "content": "compose observability error"}],
      "client": {"client_id": "compose-smoke", "consumer": "ops", "integration": "compose_smoke"}
    }'
)"
[[ "$ERROR_STATUS" == "404" ]] || { echo "Expected 404 for invalid compose smoke model, got $ERROR_STATUS" >&2; cat /tmp/forgegate-runtime-error.json >&2; exit 1; }
curl -sf -X POST "$BASE_URL/admin/providers/health/run" -H "$AUTH_HEADER" >/tmp/forgegate-health-run.json
curl -sf "$BASE_URL/admin/providers/harness/runs?provider_key=local_compose&limit=20" -H "$AUTH_HEADER" >/tmp/forgegate-runs.json
curl -sf "$BASE_URL/admin/providers/harness/snapshot" -H "$AUTH_HEADER" >/tmp/forgegate-snapshot.json
curl -sf "$BASE_URL/admin/providers/beta-targets" -H "$AUTH_HEADER" >/tmp/forgegate-beta-targets.json
curl -sf "$BASE_URL/admin/usage/?window=24h&tenantId=${OBSERVABILITY_TENANT_ID}" -H "$AUTH_HEADER" >/tmp/forgegate-usage-summary.json
curl -sf "$BASE_URL/admin/logs/?tenantId=${OBSERVABILITY_TENANT_ID}" -H "$AUTH_HEADER" >/tmp/forgegate-logs.json
curl -sf "$BASE_URL/admin/providers/bootstrap/readiness" -H "$AUTH_HEADER" >/tmp/forgegate-bootstrap-readiness.json
curl -sf "$BASE_URL/admin/providers/oauth-account/operations" -H "$AUTH_HEADER" >/tmp/forgegate-oauth-operations.json

docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "${FORGEGATE_PG_USER:-forgegate}" -d "${FORGEGATE_PG_DB:-forgegate}" -c "SELECT count(*) AS harness_profiles FROM harness_profiles;" >/tmp/forgegate-db-profiles.txt
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "${FORGEGATE_PG_USER:-forgegate}" -d "${FORGEGATE_PG_DB:-forgegate}" -At -F ',' -c "SELECT (SELECT count(*) FROM usage_events), (SELECT count(*) FROM error_events), (SELECT count(*) FROM health_events);" >/tmp/forgegate-db-observability.csv

python3 - /tmp/forgegate-health.json /tmp/forgegate-usage-summary.json /tmp/forgegate-logs.json /tmp/forgegate-bootstrap-readiness.json /tmp/forgegate-db-observability.csv <<'PY'
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
echo "  /tmp/forgegate-health.json"
echo "  $STARTUP_MIGRATION_PROOF_PATH"
echo "  /tmp/forgegate-profile.json"
echo "  /tmp/forgegate-sync.json"
echo "  /tmp/forgegate-runtime-chat.json"
echo "  /tmp/forgegate-runtime-error.json"
echo "  /tmp/forgegate-health-run.json"
echo "  /tmp/forgegate-runs.json"
echo "  /tmp/forgegate-snapshot.json"
echo "  /tmp/forgegate-beta-targets.json"
echo "  /tmp/forgegate-usage-summary.json"
echo "  /tmp/forgegate-logs.json"
echo "  /tmp/forgegate-bootstrap-readiness.json"
echo "  /tmp/forgegate-oauth-operations.json"
echo "  /tmp/forgegate-db-profiles.txt"
echo "  /tmp/forgegate-db-observability.csv"
