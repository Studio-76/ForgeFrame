#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env.compose"

HEALTH_ARTIFACT="${FORGEGATE_CLIENT_COMPAT_HEALTH_ARTIFACT:-/tmp/forgegate-client-compat-health.json}"
MODELS_ARTIFACT="${FORGEGATE_CLIENT_COMPAT_MODELS_ARTIFACT:-/tmp/forgegate-client-compat-models.json}"
CHAT_ARTIFACT="${FORGEGATE_CLIENT_COMPAT_CHAT_ARTIFACT:-/tmp/forgegate-client-compat-chat.json}"
CHAT_STREAM_ARTIFACT="${FORGEGATE_CLIENT_COMPAT_CHAT_STREAM_ARTIFACT:-/tmp/forgegate-client-compat-chat-stream.txt}"
RESPONSES_ARTIFACT="${FORGEGATE_CLIENT_COMPAT_RESPONSES_ARTIFACT:-/tmp/forgegate-client-compat-responses.json}"
RESPONSES_STREAM_ARTIFACT="${FORGEGATE_CLIENT_COMPAT_RESPONSES_STREAM_ARTIFACT:-/tmp/forgegate-client-compat-responses-stream.txt}"
NEGATIVE_ARTIFACT="${FORGEGATE_CLIENT_COMPAT_NEGATIVE_ARTIFACT:-/tmp/forgegate-client-compat-responses-startup-failure.json}"
NEGATIVE_HEADERS_ARTIFACT="${FORGEGATE_CLIENT_COMPAT_NEGATIVE_HEADERS_ARTIFACT:-/tmp/forgegate-client-compat-responses-startup-failure-headers.txt}"
NEGATIVE_DB_ARTIFACT="${FORGEGATE_CLIENT_COMPAT_NEGATIVE_DB_ARTIFACT:-/tmp/forgegate-client-compat-error-event.tsv}"
REPORT_PATH="${FORGEGATE_CLIENT_COMPAT_REPORT_PATH:-/tmp/forgegate-client-compat-signoff.json}"

NEGATIVE_MODEL="${FORGEGATE_CLIENT_COMPAT_NEGATIVE_MODEL:-gpt-5.3-codex}"
NEGATIVE_CLIENT_ID="${FORGEGATE_CLIENT_COMPAT_NEGATIVE_CLIENT_ID:-client-compat-signoff-responses-startup}"
NEGATIVE_RUN_TOKEN="${FORGEGATE_CLIENT_COMPAT_NEGATIVE_RUN_TOKEN:-$(python3 - <<'PY'
from uuid import uuid4

print(uuid4().hex[:12])
PY
)}"
NEGATIVE_CORRELATION_ID="${FORGEGATE_CLIENT_COMPAT_NEGATIVE_CORRELATION_ID:-corr_client_compat_signoff_${NEGATIVE_RUN_TOKEN}}"
NEGATIVE_TRACE_ID="${FORGEGATE_CLIENT_COMPAT_NEGATIVE_TRACE_ID:-trace_client_compat_signoff_${NEGATIVE_RUN_TOKEN}}"
NEGATIVE_SPAN_ID="${FORGEGATE_CLIENT_COMPAT_NEGATIVE_SPAN_ID:-span_client_compat_signoff_${NEGATIVE_RUN_TOKEN}}"

BASE_URL="http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}"

fail() {
  printf "[forgegate-client-compat-signoff][ERROR] %s\n" "$*" >&2
  exit 1
}

resolve_path() {
  local raw_path="$1"
  local target_dir
  local target_name

  target_dir="$(dirname "$raw_path")"
  target_name="$(basename "$raw_path")"
  mkdir -p "$target_dir"
  target_dir="$(cd "$target_dir" && pwd -P)"
  printf '%s/%s\n' "$target_dir" "$target_name"
}

ensure_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

ensure_compose_stack_running() {
  local running

  running="$(docker compose -f "$COMPOSE_FILE" ps --status running --services 2>/dev/null || true)"
  grep -qx "forgegate" <<<"$running" || fail "forgegate container is not running. Run bash scripts/compose-smoke.sh first."
  grep -qx "postgres" <<<"$running" || fail "postgres container is not running. Run bash scripts/compose-smoke.sh first."
}

wait_for_health() {
  local attempt
  for attempt in {1..30}; do
    if curl -sf "$BASE_URL/health" >"$HEALTH_ARTIFACT"; then
      return 0
    fi
    sleep 2
  done
  fail "ForgeGate did not become healthy at $BASE_URL/health"
}

load_compose_env() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
    BASE_URL="http://127.0.0.1:${FORGEGATE_APP_PORT:-8000}"
  fi
}

query_latest_negative_error_event() {
  local pg_user
  local pg_db
  local escaped_client_id
  local escaped_correlation_id

  pg_user="${FORGEGATE_PG_USER:-forgegate}"
  pg_db="${FORGEGATE_PG_DB:-forgegate}"
  escaped_client_id="${NEGATIVE_CLIENT_ID//\'/\'\'}"
  escaped_correlation_id="${NEGATIVE_CORRELATION_ID//\'/\'\'}"

  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "$pg_user" -d "$pg_db" -At -F $'\t' \
      -c "
        SELECT
          COALESCE(provider, ''),
          COALESCE(model, ''),
          COALESCE(error_type, ''),
          status_code,
          COALESCE(payload ->> 'route', ''),
          COALESCE(payload ->> 'stream_mode', ''),
          COALESCE(payload ->> 'request_id', ''),
          COALESCE(payload ->> 'correlation_id', ''),
          COALESCE(payload ->> 'trace_id', ''),
          COALESCE(payload ->> 'span_id', '')
        FROM error_events
        WHERE client_id = '$escaped_client_id'
          AND payload ->> 'correlation_id' = '$escaped_correlation_id'
        ORDER BY created_at DESC, id DESC
        LIMIT 1;
      " >"$NEGATIVE_DB_ARTIFACT"
}

ensure_command docker
ensure_command curl
ensure_command python3

HEALTH_ARTIFACT="$(resolve_path "$HEALTH_ARTIFACT")"
MODELS_ARTIFACT="$(resolve_path "$MODELS_ARTIFACT")"
CHAT_ARTIFACT="$(resolve_path "$CHAT_ARTIFACT")"
CHAT_STREAM_ARTIFACT="$(resolve_path "$CHAT_STREAM_ARTIFACT")"
RESPONSES_ARTIFACT="$(resolve_path "$RESPONSES_ARTIFACT")"
RESPONSES_STREAM_ARTIFACT="$(resolve_path "$RESPONSES_STREAM_ARTIFACT")"
NEGATIVE_ARTIFACT="$(resolve_path "$NEGATIVE_ARTIFACT")"
NEGATIVE_HEADERS_ARTIFACT="$(resolve_path "$NEGATIVE_HEADERS_ARTIFACT")"
NEGATIVE_DB_ARTIFACT="$(resolve_path "$NEGATIVE_DB_ARTIFACT")"
REPORT_PATH="$(resolve_path "$REPORT_PATH")"

load_compose_env
ensure_compose_stack_running
wait_for_health

curl -sf "$BASE_URL/v1/models" >"$MODELS_ARTIFACT"
curl -sf -X POST "$BASE_URL/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [{"role": "user", "content": "ForgeGate client signoff chat"}]
  }' >"$CHAT_ARTIFACT"

curl -sfN -X POST "$BASE_URL/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [{"role": "user", "content": "ForgeGate client signoff chat stream"}],
    "stream": true
  }' >"$CHAT_STREAM_ARTIFACT"

curl -sf -X POST "$BASE_URL/v1/responses" \
  -H 'Content-Type: application/json' \
  -d '{
    "input": "ForgeGate client signoff responses"
  }' >"$RESPONSES_ARTIFACT"

curl -sfN -X POST "$BASE_URL/v1/responses" \
  -H 'Content-Type: application/json' \
  -d '{
    "input": "ForgeGate client signoff responses stream",
    "stream": true
  }' >"$RESPONSES_STREAM_ARTIFACT"

NEGATIVE_STATUS="$(
  curl -sS -D "$NEGATIVE_HEADERS_ARTIFACT" -o "$NEGATIVE_ARTIFACT" -w '%{http_code}' -X POST "$BASE_URL/v1/responses" \
    -H 'Content-Type: application/json' \
    -H "X-ForgeGate-Trace-Id: $NEGATIVE_TRACE_ID" \
    -H "X-ForgeGate-Correlation-Id: $NEGATIVE_CORRELATION_ID" \
    -H "X-ForgeGate-Span-Id: $NEGATIVE_SPAN_ID" \
    -d "{
      \"input\": \"ForgeGate client signoff unsupported response stream\",
      \"model\": \"$NEGATIVE_MODEL\",
      \"stream\": true,
      \"client\": {
        \"client_id\": \"$NEGATIVE_CLIENT_ID\",
        \"consumer\": \"release-validation\",
        \"integration\": \"compose-client-compat-signoff\"
      }
    }"
)"

[[ "$NEGATIVE_STATUS" == "404" ]] || fail "Expected 404 for hidden public response stream model, got $NEGATIVE_STATUS"

query_latest_negative_error_event

python3 - "$HEALTH_ARTIFACT" "$MODELS_ARTIFACT" "$CHAT_ARTIFACT" "$CHAT_STREAM_ARTIFACT" "$RESPONSES_ARTIFACT" "$RESPONSES_STREAM_ARTIFACT" "$NEGATIVE_ARTIFACT" "$NEGATIVE_HEADERS_ARTIFACT" "$NEGATIVE_DB_ARTIFACT" "$REPORT_PATH" "$NEGATIVE_MODEL" "$NEGATIVE_CLIENT_ID" "$NEGATIVE_CORRELATION_ID" "$NEGATIVE_TRACE_ID" "$NEGATIVE_SPAN_ID" <<'PY'
import json
import sys
from pathlib import Path


def parse_headers(path: Path) -> dict[str, str]:
    headers: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("HTTP/"):
            continue
        name, separator, value = line.partition(":")
        if not separator:
            continue
        headers[name.strip().lower()] = value.strip()
    return headers


health = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
models = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
chat = json.loads(Path(sys.argv[3]).read_text(encoding="utf-8"))
chat_stream = Path(sys.argv[4]).read_text(encoding="utf-8")
responses = json.loads(Path(sys.argv[5]).read_text(encoding="utf-8"))
responses_stream = Path(sys.argv[6]).read_text(encoding="utf-8")
negative = json.loads(Path(sys.argv[7]).read_text(encoding="utf-8"))
negative_headers = parse_headers(Path(sys.argv[8]))
db_row = Path(sys.argv[9]).read_text(encoding="utf-8").rstrip("\n")
report_path = Path(sys.argv[10])
negative_model = sys.argv[11]
negative_client_id = sys.argv[12]
negative_correlation_id = sys.argv[13]
negative_trace_id = sys.argv[14]
negative_span_id = sys.argv[15]

assert health["status"] == "ok", health
assert health["readiness"]["accepting_traffic"] is True, health["readiness"]
assert health["readiness"]["state"] in {"ready", "degraded"}, health["readiness"]

assert models["object"] == "list", models
assert isinstance(models["data"], list) and models["data"], models
public_model_ids = [item["id"] for item in models["data"]]
assert "compose-model" not in public_model_ids, public_model_ids
for item in models["data"]:
    assert set(item.keys()) == {"id", "object", "owned_by"}, item

verified_runtime_model_id = chat["model"]
assert verified_runtime_model_id in public_model_ids, chat
assert chat["choices"][0]["message"]["content"], chat
assert chat["usage"]["total_tokens"] > 0, chat["usage"]
assert "provider" not in chat, chat
assert "credential_type" not in chat, chat
assert "auth_source" not in chat, chat

assert "chat.completion.chunk" in chat_stream, chat_stream
assert "[DONE]" in chat_stream, chat_stream
assert '"provider"' not in chat_stream, chat_stream
assert '"credential_type"' not in chat_stream, chat_stream
assert '"auth_source"' not in chat_stream, chat_stream

assert responses["object"] == "response", responses
assert responses["status"] == "completed", responses
assert isinstance(responses["output"], list), responses
assert responses["output_text"], responses
assert "provider" not in responses, responses
assert "credential_type" not in responses, responses
assert "auth_source" not in responses, responses

assert "response.created" in responses_stream, responses_stream
assert "response.completed" in responses_stream, responses_stream
assert "[DONE]" in responses_stream, responses_stream
assert '"provider"' not in responses_stream, responses_stream
assert '"credential_type"' not in responses_stream, responses_stream
assert '"auth_source"' not in responses_stream, responses_stream

error = negative["error"]
assert error["type"] == "model_not_found", negative
assert error["message"] == f"Requested model '{negative_model}' is not available.", negative
assert error["available_models"] == public_model_ids, negative
assert negative_model not in error["available_models"], negative

request_id = negative_headers.get("x-forgegate-request-id", "")
assert request_id, negative_headers
assert negative_headers.get("x-forgegate-correlation-id") == negative_correlation_id, negative_headers
assert negative_headers.get("x-forgegate-trace-id") == negative_trace_id, negative_headers
assert negative_headers.get("x-forgegate-span-id") == negative_span_id, negative_headers
assert negative_headers.get("x-forgegate-causation-id") == request_id, negative_headers

assert db_row, "expected a persisted error_events row for the negative responses-stream check"
row_parts = db_row.split("\t")
assert len(row_parts) == 10, row_parts
provider, model, error_type, status_code, route, stream_mode, persisted_request_id, persisted_correlation_id, persisted_trace_id, persisted_span_id = row_parts
assert provider == "", db_row
assert model == negative_model, db_row
assert error_type == "model_not_found", db_row
assert int(status_code) == 404, db_row
assert route == "/v1/responses", db_row
assert stream_mode == "stream", db_row
assert persisted_request_id == request_id, db_row
assert persisted_correlation_id == negative_correlation_id, db_row
assert persisted_trace_id == negative_trace_id, db_row
assert persisted_span_id == negative_span_id, db_row

report = {
    "status": "ok",
    "validated_under": "docker-compose runtime path",
    "checks": {
        "health_ready_for_runtime": "passed",
        "models_public_inventory": "passed",
        "chat_non_stream": "passed",
        "chat_stream": "passed",
        "responses_non_stream": "passed",
        "responses_stream": "passed",
        "responses_stream_hidden_model_contract": "passed",
        "responses_stream_hidden_model_observability": "passed",
    },
    "beta_ready_today": [
        "GET /v1/models returns a sanitized public inventory and includes the verified compose baseline model.",
        "POST /v1/chat/completions succeeds on the compose baseline path in both non-stream and stream modes without leaking provider/auth provenance.",
        "POST /v1/responses succeeds on the compose baseline path in both non-stream and stream modes without leaking provider/auth provenance.",
        "A hidden Codex `/v1/responses` stream request fails as `model_not_found`, keeps the public inventory sanitized, and persists an `error_events` record for the exact request headers.",
    ],
    "still_partial": [
        "This signoff only proves the documented beta client endpoints on the current compose/runtime path, not blanket parity for every provider/model path or dispatchability for every listed model.",
        "Tool-calling parity remains provider-specific and is not claimed by this client-axis signoff.",
        "Dedicated local/Ollama validation and OAuth/account-provider runtime truth remain separate release-evidence tracks.",
    ],
    "verified_runtime_model_id": verified_runtime_model_id,
    "negative_request_context": {
        "client_id": negative_client_id,
        "request_id": request_id,
        "correlation_id": negative_correlation_id,
        "trace_id": negative_trace_id,
        "span_id": negative_span_id,
    },
    "artifacts": {
        "health": str(Path(sys.argv[1])),
        "models": str(Path(sys.argv[2])),
        "chat": str(Path(sys.argv[3])),
        "chat_stream": str(Path(sys.argv[4])),
        "responses": str(Path(sys.argv[5])),
        "responses_stream": str(Path(sys.argv[6])),
        "negative_contract": str(Path(sys.argv[7])),
        "negative_headers": str(Path(sys.argv[8])),
        "negative_error_event": str(Path(sys.argv[9])),
    },
}
report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
PY

printf 'Client compatibility signoff completed. Artifacts:\n'
printf '  %s\n' "$HEALTH_ARTIFACT"
printf '  %s\n' "$MODELS_ARTIFACT"
printf '  %s\n' "$CHAT_ARTIFACT"
printf '  %s\n' "$CHAT_STREAM_ARTIFACT"
printf '  %s\n' "$RESPONSES_ARTIFACT"
printf '  %s\n' "$RESPONSES_STREAM_ARTIFACT"
printf '  %s\n' "$NEGATIVE_ARTIFACT"
printf '  %s\n' "$NEGATIVE_HEADERS_ARTIFACT"
printf '  %s\n' "$NEGATIVE_DB_ARTIFACT"
printf '  %s\n' "$REPORT_PATH"
