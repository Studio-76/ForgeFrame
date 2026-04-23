#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env.compose"
ENV_EXAMPLE="$ROOT_DIR/docker/.env.compose.example"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"
AUTH_FILE="/tmp/forgeframe-admin-login-ollama.json"
AUTH_HEADER_FILE="/tmp/forgeframe-admin-auth-header-ollama.txt"
HEALTH_PATH="/tmp/forgeframe-ollama-health.json"
HEALTH_RUN_PATH="/tmp/forgeframe-ollama-health-run.json"
PROVIDER_TRUTH_PATH="/tmp/forgeframe-ollama-provider-truth.json"
MODELS_PATH="/tmp/forgeframe-ollama-models.json"
CHAT_PATH="/tmp/forgeframe-ollama-chat.json"
STREAM_PATH="/tmp/forgeframe-ollama-stream.txt"
TOOL_BOUNDARY_PATH="/tmp/forgeframe-ollama-tool-boundary.json"

log() { printf "[forgeframe-compose-ollama-smoke] %s\n" "$*"; }
fail() { printf "[forgeframe-compose-ollama-smoke][ERROR] %s\n" "$*" >&2; exit 1; }

cleanup() {
  if [[ "${FORGEFRAME_OLLAMA_SMOKE_DOWN:-}" == "down" ]]; then
    docker compose -f "$COMPOSE_FILE" down -v
  fi
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' not found."
}

trap cleanup EXIT

require_cmd docker
require_cmd curl
require_cmd python3

if ! docker compose version >/dev/null 2>&1; then
  fail "Docker Compose plugin is required (docker compose ...)."
fi

if [[ ! -f "$ENV_FILE" ]]; then
  forgeframe_ensure_compose_env_file "$ENV_FILE" "$ENV_EXAMPLE" || fail "Missing $ENV_FILE and $ENV_EXAMPLE"
  log "Created $ENV_FILE from $ENV_EXAMPLE"
fi

GENERATED_ENV_ITEMS="$(forgeframe_prepare_compose_env "$ENV_FILE")" || fail "Failed to prepare secure compose secrets in $ENV_FILE."
if [[ -n "$GENERATED_ENV_ITEMS" ]]; then
  while IFS= read -r item; do
    [[ -n "$item" ]] || continue
    log "Generated $item in $ENV_FILE."
  done <<< "$GENERATED_ENV_ITEMS"
fi

forgeframe_load_env_file "$ENV_FILE" || fail "Missing $ENV_FILE"

: "${FORGEFRAME_OLLAMA_BASE_URL:?Set FORGEFRAME_OLLAMA_BASE_URL in .env.compose to a reachable Ollama OpenAI-compatible endpoint before running this smoke.}"
: "${FORGEFRAME_OLLAMA_DEFAULT_MODEL:?Set FORGEFRAME_OLLAMA_DEFAULT_MODEL in .env.compose before running this smoke.}"

OLLAMA_VALIDATION_MODEL="${FORGEFRAME_OLLAMA_VALIDATION_MODEL:-$FORGEFRAME_OLLAMA_DEFAULT_MODEL}"
BASE_URL="http://127.0.0.1:${FORGEFRAME_APP_PORT:-8000}"

python3 - "$FORGEFRAME_OLLAMA_BASE_URL" <<'PY' || fail "FORGEFRAME_OLLAMA_BASE_URL must target a container-reachable Ollama endpoint."
import sys
from urllib.parse import urlparse

target = sys.argv[1].strip()
parsed = urlparse(target)
host = (parsed.hostname or "").lower()
if not parsed.scheme.startswith("http"):
    raise SystemExit("FORGEFRAME_OLLAMA_BASE_URL must use http:// or https://")
if not host:
    raise SystemExit("FORGEFRAME_OLLAMA_BASE_URL must include a hostname")
if host in {"127.0.0.1", "localhost", "::1", "0.0.0.0"}:
    raise SystemExit(
        "FORGEFRAME_OLLAMA_BASE_URL points at localhost. The ForgeFrame container cannot use a host-local Ollama via localhost; use host.docker.internal or another reachable host."
    )
PY

log "Starting the default 2-service compose stack (postgres + forgeframe) for Ollama validation..."
docker compose -f "$COMPOSE_FILE" up -d --build postgres forgeframe >/dev/null

log "Waiting for ForgeFrame health endpoint..."
for _ in {1..60}; do
  if curl -sf "$BASE_URL/health" >"$HEALTH_PATH"; then
    break
  fi
  sleep 2
done
curl -sf "$BASE_URL/health" >"$HEALTH_PATH" || fail "ForgeFrame health endpoint is not ready."

forgeframe_login_and_rotate_bootstrap_admin_if_required "$BASE_URL" "$ENV_FILE" "$AUTH_FILE" "$AUTH_HEADER_FILE" || fail "Failed to authenticate and, when required, rotate the bootstrap admin password."
AUTH_HEADER="$(cat "$AUTH_HEADER_FILE")"

curl -sf -X POST "$BASE_URL/admin/providers/health/run" -H "$AUTH_HEADER" >"$HEALTH_RUN_PATH"
curl -sf "$BASE_URL/admin/providers/" -H "$AUTH_HEADER" >"$PROVIDER_TRUTH_PATH"
curl -sf "$BASE_URL/v1/models" >"$MODELS_PATH"

python3 - "$HEALTH_PATH" "$PROVIDER_TRUTH_PATH" "$MODELS_PATH" "$OLLAMA_VALIDATION_MODEL" <<'PY'
import json
import sys
from pathlib import Path

health = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
provider_truth = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
models = json.loads(Path(sys.argv[3]).read_text(encoding="utf-8"))
validation_model = sys.argv[4]

assert health["status"] == "ok", health
assert health["readiness"]["accepting_traffic"] is True, health["readiness"]

truth_row = next(item for item in provider_truth["truth_axes"] if item["provider"]["provider"] == "ollama")
runtime = truth_row["runtime"]
assert runtime["ready"] is True, runtime
assert runtime["runtime_readiness"] == "ready", runtime
assert runtime["streaming_readiness"] == "ready", runtime
assert runtime["tool_calling_level"] == "none", runtime

model_ids = {item["id"] for item in models["data"]}
assert validation_model in model_ids, {"expected_model": validation_model, "models": sorted(model_ids)}
PY

CHAT_PAYLOAD="$(
  python3 - "$OLLAMA_VALIDATION_MODEL" <<'PY'
import json
import sys

model = sys.argv[1]
print(
    json.dumps(
        {
            "model": model,
            "messages": [{"role": "user", "content": "Respond with the phrase local axis validated."}],
        }
    )
)
PY
)"
curl -sf -X POST "$BASE_URL/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -d "$CHAT_PAYLOAD" >"$CHAT_PATH"
python3 - "$CHAT_PATH" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["choices"][0]["message"]["content"].strip(), payload
assert payload["usage"]["total_tokens"] > 0, payload["usage"]
PY

STREAM_PAYLOAD="$(
  python3 - "$OLLAMA_VALIDATION_MODEL" <<'PY'
import json
import sys

model = sys.argv[1]
print(
    json.dumps(
        {
            "model": model,
            "stream": True,
            "messages": [{"role": "user", "content": "Stream a short validation reply."}],
        }
    )
)
PY
)"
curl -sS -N -X POST "$BASE_URL/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -d "$STREAM_PAYLOAD" >"$STREAM_PATH"
python3 - "$STREAM_PATH" <<'PY'
import json
import sys
from pathlib import Path

raw = Path(sys.argv[1]).read_text(encoding="utf-8")
payloads = []
done_seen = False
for line in raw.splitlines():
    if not line.startswith("data: "):
        continue
    data = line.removeprefix("data: ")
    if data == "[DONE]":
        done_seen = True
        continue
    payloads.append(json.loads(data))

assert done_seen, raw
assert payloads, raw
assert all("error" not in payload for payload in payloads), payloads
assert any(payload["choices"][0]["delta"].get("content") for payload in payloads[:-1]), payloads
assert payloads[-1]["choices"][0]["finish_reason"] == "stop", payloads[-1]
PY

TOOL_PAYLOAD="$(
  python3 - "$OLLAMA_VALIDATION_MODEL" <<'PY'
import json
import sys

model = sys.argv[1]
print(
    json.dumps(
        {
            "model": model,
            "messages": [{"role": "user", "content": "Call the ping tool."}],
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "ping",
                        "description": "Ping",
                        "parameters": {"type": "object", "properties": {}},
                    },
                }
            ],
            "tool_choice": "auto",
        }
    )
)
PY
)"
TOOL_STATUS="$(
  curl -sS -o "$TOOL_BOUNDARY_PATH" -w '%{http_code}' -X POST "$BASE_URL/v1/chat/completions" \
    -H 'Content-Type: application/json' \
    -d "$TOOL_PAYLOAD"
)"
[[ "$TOOL_STATUS" == "400" ]] || fail "Expected Ollama tool-calling boundary to return 400, got $TOOL_STATUS"
python3 - "$TOOL_BOUNDARY_PATH" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
error = payload["error"]
assert error["type"] == "provider_unsupported_feature", error
assert error["provider"] == "ollama", error
PY

log "Ollama local-axis validation completed."
log "Artifacts:"
log "  $HEALTH_PATH"
log "  $HEALTH_RUN_PATH"
log "  $PROVIDER_TRUTH_PATH"
log "  $MODELS_PATH"
log "  $CHAT_PATH"
log "  $STREAM_PATH"
log "  $TOOL_BOUNDARY_PATH"
