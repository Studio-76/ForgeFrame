import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.runtime.schemas import ChatCompletionsRequest
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.harness.models import HarnessVerificationRun
from app.harness.service import get_harness_service
from app.main import app
from app.providers import ProviderStreamEvent, ProviderStreamInterruptedError, ProviderUpstreamError
from app.readiness import RuntimeReadinessCheck, RuntimeReadinessReport, build_public_runtime_readiness_payload
from app.providers.openai_api.adapter import OpenAIAPIAdapter
from app.usage.models import CostBreakdown, TokenUsage


client = TestClient(app)
_ROTATED_ADMIN_PASSWORD = "ForgeFrame-Test-Admin-Secret-456"


def _admin_headers(test_client: TestClient = client) -> dict[str, str]:
    bootstrap_password = os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"]
    active_password = bootstrap_password
    response = test_client.post("/admin/auth/login", json={"username": "admin", "password": active_password})
    if response.status_code == 401:
        active_password = _ROTATED_ADMIN_PASSWORD
        response = test_client.post("/admin/auth/login", json={"username": "admin", "password": active_password})
    assert response.status_code == 201
    token = response.json()["access_token"]
    if response.json()["user"]["must_rotate_password"] is True:
        rotate_response = test_client.post(
            "/admin/auth/rotate-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": active_password,
                "new_password": _ROTATED_ADMIN_PASSWORD,
            },
        )
        assert rotate_response.status_code == 200
    return {"Authorization": f"Bearer {token}"}


def _sse_payload(raw: str, event_name: str) -> dict[str, object]:
    prefix = f"event: {event_name}\n"
    for frame in raw.split("\n\n"):
        if not frame.startswith(prefix):
            continue
        for line in frame.splitlines():
            if line.startswith("data: "):
                return json.loads(line.removeprefix("data: "))
    raise AssertionError(f"event {event_name!r} not found in stream payload")


def _chat_sse_payloads(raw: str) -> list[dict[str, object]]:
    payloads: list[dict[str, object]] = []
    for frame in raw.split("\n\n"):
        if not frame.startswith("data: "):
            continue
        data = frame.removeprefix("data: ").strip()
        if not data or data == "[DONE]":
            continue
        payloads.append(json.loads(data))
    return payloads


def _observability_events() -> list[dict[str, object]]:
    path = Path(os.environ["FORGEGATE_OBSERVABILITY_EVENTS_PATH"])
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return []
    return [json.loads(line) for line in raw.splitlines() if line.strip()]


def _mock_anthropic_tool_use_stream_response():
    class _MockStreamResponse:
        status_code = 200
        headers = {"content-type": "text/event-stream"}
        text = ""

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        @staticmethod
        def iter_lines():
            return iter(
                [
                    "event: message_start",
                    'data: {"type":"message_start","message":{"usage":{"input_tokens":5,"output_tokens":0}}}',
                    "event: content_block_start",
                    'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_1","name":"lookup"}}',
                    "event: content_block_delta",
                    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"q\\":\\"forge"}}',
                    "event: content_block_delta",
                    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"gate\\"}"}}',
                    "event: message_delta",
                    'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"input_tokens":5,"output_tokens":2,"total_tokens":7}}',
                    "event: message_stop",
                    'data: {"type":"message_stop"}',
                ]
            )

    return _MockStreamResponse()


def _mock_anthropic_text_response(content_text: str = "described"):
    class _MockResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        text = "ok"

        @staticmethod
        def json() -> dict[str, object]:
            return {
                "model": "claude-3-5-sonnet-latest",
                "content": [{"type": "text", "text": content_text}],
                "usage": {"input_tokens": 6, "output_tokens": 2, "total_tokens": 8},
                "stop_reason": "end_turn",
            }

    return _MockResponse()


def _enable_isolated_anthropic_runtime(monkeypatch: pytest.MonkeyPatch) -> None:
    for env_name in (
        "FORGEGATE_FORGEGATE_BASELINE_ENABLED",
        "FORGEGATE_OPENAI_API_ENABLED",
        "FORGEGATE_OPENAI_CODEX_ENABLED",
        "FORGEGATE_GEMINI_ENABLED",
        "FORGEGATE_GENERIC_HARNESS_ENABLED",
        "FORGEGATE_OLLAMA_ENABLED",
    ):
        monkeypatch.setenv(env_name, "false")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_API_KEY", "anthropic-key")
    monkeypatch.setenv("FORGEGATE_DEFAULT_PROVIDER", "anthropic")
    monkeypatch.setenv("FORGEGATE_DEFAULT_MODEL", "claude-3-5-sonnet-latest")


def _mock_ollama_models_unreachable(*args, **kwargs):
    url = str(args[0]) if args else "http://ollama.invalid/v1/models"
    raise httpx.RequestError(
        "ollama probe refused connection",
        request=httpx.Request("GET", url),
    )


def test_health_endpoint_has_runtime_metadata() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["api_base"] == "/v1"
    assert body["readiness"]["state"] == "degraded"
    assert body["readiness"]["accepting_traffic"] is True
    checks = {item["id"]: item for item in body["readiness"]["checks"]}
    assert checks["security_configuration"]["ok"] is True
    assert checks["runtime_model_configuration"]["ok"] is True
    assert checks["ui_delivery"]["ok"] is False
    assert checks["public_origin_contract"]["ok"] is False
    assert checks["tls_certificate_management"]["ok"] is False
    assert checks["deployment_posture"]["ok"] is False
    assert all("details" not in item for item in body["readiness"]["checks"])


def test_health_endpoint_stays_degraded_after_bootstrap_secret_rotation_until_public_surface_gaps_are_closed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD", "ForgeFrame-Admin-Secret-456")
    clear_runtime_dependency_caches()
    ready_client = TestClient(app)
    response = ready_client.get("/health")
    assert response.status_code == 200
    assert response.json()["readiness"]["state"] == "degraded"


def test_public_runtime_readiness_payload_keeps_critical_failures_critical() -> None:
    readiness = RuntimeReadinessReport.from_checks(
        [
            RuntimeReadinessCheck(
                id="default_provider_adapter_boot",
                ok=False,
                severity="critical",
                details="ProviderRegistryError: adapter boot failed",
            ),
            RuntimeReadinessCheck(
                id="default_provider_ready",
                ok=False,
                severity="warning",
                details="openai_api:not_ready",
            ),
        ],
        checked_at="2026-04-22T00:00:00+00:00",
    )

    payload = build_public_runtime_readiness_payload(readiness)

    checks = {item["id"]: item for item in payload["checks"]}
    assert checks["runtime_provider_configuration"] == {
        "id": "runtime_provider_configuration",
        "ok": False,
        "severity": "critical",
    }
    assert payload["warning_count"] == 0
    assert payload["critical_count"] == 1


def test_health_endpoint_reports_degraded_when_openai_default_provider_base_url_is_invalid(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_DEFAULT_PROVIDER", "openai_api")
    monkeypatch.setenv("FORGEGATE_DEFAULT_MODEL", "gpt-4.1-mini")
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("FORGEGATE_OPENAI_API_BASE_URL", "not-a-url")
    clear_runtime_dependency_caches()
    invalid_client = TestClient(app)

    response = invalid_client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["readiness"]["state"] == "degraded"
    checks = {item["id"]: item for item in body["readiness"]["checks"]}
    assert checks["runtime_provider_configuration"]["ok"] is False
    assert checks["runtime_provider_configuration"]["severity"] == "warning"
    assert body["readiness"]["warning_count"] >= 1
    assert body["readiness"]["critical_count"] == 0
    assert all("details" not in item for item in body["readiness"]["checks"])


def test_health_endpoint_reports_degraded_when_anthropic_default_provider_base_url_is_invalid(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_DEFAULT_PROVIDER", "anthropic")
    monkeypatch.setenv("FORGEGATE_DEFAULT_MODEL", "claude-3-5-sonnet-latest")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_API_KEY", "anthropic-key")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_BASE_URL", "not-a-url")
    clear_runtime_dependency_caches()
    invalid_client = TestClient(app)

    response = invalid_client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["readiness"]["state"] == "degraded"
    checks = {item["id"]: item for item in body["readiness"]["checks"]}
    assert checks["runtime_provider_configuration"]["ok"] is False
    assert checks["runtime_provider_configuration"]["severity"] == "warning"
    assert body["readiness"]["warning_count"] >= 1
    assert body["readiness"]["critical_count"] == 0
    assert all("details" not in item for item in body["readiness"]["checks"])


def test_health_endpoint_reports_degraded_when_gemini_default_provider_base_url_is_invalid(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_DEFAULT_PROVIDER", "gemini")
    monkeypatch.setenv("FORGEGATE_DEFAULT_MODEL", "gemini-2.5-flash")
    monkeypatch.setenv("FORGEGATE_GEMINI_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_BASE_URL", "not-a-url")
    clear_runtime_dependency_caches()
    invalid_client = TestClient(app)

    response = invalid_client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["readiness"]["state"] == "degraded"
    checks = {item["id"]: item for item in body["readiness"]["checks"]}
    assert checks["runtime_provider_configuration"]["ok"] is False
    assert checks["runtime_provider_configuration"]["severity"] == "warning"
    assert body["readiness"]["warning_count"] >= 1
    assert body["readiness"]["critical_count"] == 0
    assert all("details" not in item for item in body["readiness"]["checks"])


def test_health_endpoint_reports_degraded_when_codex_default_provider_base_url_is_invalid(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_DEFAULT_PROVIDER", "openai_codex")
    monkeypatch.setenv("FORGEGATE_DEFAULT_MODEL", "gpt-5.3-codex")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BASE_URL", "not-a-url")
    clear_runtime_dependency_caches()
    invalid_client = TestClient(app)

    response = invalid_client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["readiness"]["state"] == "degraded"
    checks = {item["id"]: item for item in body["readiness"]["checks"]}
    assert checks["runtime_provider_configuration"]["ok"] is False
    assert checks["runtime_provider_configuration"]["severity"] == "warning"
    assert body["readiness"]["warning_count"] >= 1
    assert body["readiness"]["critical_count"] == 0
    assert all("details" not in item for item in body["readiness"]["checks"])


def test_health_endpoint_reports_booting_for_insecure_bootstrap_admin_password(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD", "forgegate-admin")
    clear_runtime_dependency_caches()
    invalid_client = TestClient(app)
    response = invalid_client.get("/health")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "starting"
    assert body["readiness"]["state"] == "booting"
    checks = {item["id"]: item for item in body["readiness"]["checks"]}
    assert checks["security_configuration"]["ok"] is False
    assert "bootstrap_admin_password" not in checks
    assert all("details" not in item for item in body["readiness"]["checks"])


def test_health_endpoint_reports_booting_when_startup_validation_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_HARNESS_STORAGE_BACKEND", "postgresql")
    monkeypatch.setenv("FORGEGATE_HARNESS_POSTGRES_URL", "sqlite:///tmp/forgegate.db")
    clear_runtime_dependency_caches()
    invalid_client = TestClient(app)
    response = invalid_client.get("/health")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "starting"
    assert body["readiness"]["state"] == "booting"
    assert any(item["id"] == "startup_validation" for item in body["readiness"]["checks"])
    assert all("details" not in item for item in body["readiness"]["checks"])
    assert "sqlite:///tmp/forgegate.db" not in json.dumps(body)


def test_public_startup_failure_response_redacts_runtime_details(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_HARNESS_STORAGE_BACKEND", "postgresql")
    monkeypatch.setenv("FORGEGATE_HARNESS_POSTGRES_URL", "sqlite:///tmp/forgegate.db")
    clear_runtime_dependency_caches()
    invalid_client = TestClient(app)
    response = invalid_client.get("/v1/models")

    assert response.status_code == 503
    payload = response.json()
    assert payload["error"]["type"] == "startup_validation_failed"
    assert all("details" not in item for item in payload["error"]["details"]["checks"])
    assert "sqlite:///tmp/forgegate.db" not in json.dumps(payload)


def test_admin_runtime_readiness_endpoint_rejects_bootstrap_header_bypass() -> None:
    response = client.get(
        "/admin/auth/runtime-readiness",
        headers={
            "X-ForgeFrame-Bootstrap-Username": "admin",
            "X-ForgeFrame-Bootstrap-Password": os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"],
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Admin authentication required."


def test_admin_runtime_readiness_endpoint_keeps_full_failure_details_for_authenticated_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD", "forgegate-admin")
    clear_runtime_dependency_caches()
    invalid_client = TestClient(app)
    response = invalid_client.get(
        "/admin/auth/runtime-readiness",
        headers=_admin_headers(invalid_client),
    )

    assert response.status_code == 200
    checks = {item["id"]: item for item in response.json()["readiness"]["checks"]}
    assert checks["bootstrap_admin_password"]["ok"] is False
    assert "must be rotated" in checks["bootstrap_admin_password"]["details"]
    assert checks["bootstrap_admin_account"]["ok"] is True


def test_admin_runtime_readiness_endpoint_accepts_password_rotation_required_session() -> None:
    response = client.get(
        "/admin/auth/runtime-readiness",
        headers=_admin_headers(),
    )

    assert response.status_code == 200
    assert "checks" in response.json()["readiness"]


def test_models_endpoint_returns_sanitized_openai_compatible_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    response = local_client.get("/v1/models")
    assert response.status_code == 200
    body = response.json()
    assert body["object"] == "list"
    assert isinstance(body["data"], list)
    assert len(body["data"]) >= 1
    assert set(body["data"][0].keys()) == {"id", "object", "owned_by"}
    assert {item["id"] for item in body["data"]} == {"forgeframe-baseline-chat-v1"}
    forbidden_keys = {
        "provider",
        "display_name",
        "active",
        "category",
        "source",
        "discovery_status",
        "runtime_status",
        "availability_status",
        "status_reason",
        "last_seen_at",
        "last_probe_at",
        "stale_since",
        "ready",
        "readiness_reason",
        "capabilities",
        "oauth_required",
        "discovery_supported",
    }
    assert forbidden_keys.isdisjoint(body["data"][0].keys())


def test_models_endpoint_omits_gemini_when_bridge_base_url_is_invalid(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_GEMINI_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_BASE_URL", "not-a-url")
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    response = local_client.get("/v1/models")

    assert response.status_code == 200
    assert "gemini-2.5-flash" not in {item["id"] for item in response.json()["data"]}


def test_models_endpoint_omits_anthropic_when_base_url_is_invalid(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for env_name in (
        "FORGEGATE_FORGEGATE_BASELINE_ENABLED",
        "FORGEGATE_OPENAI_API_ENABLED",
        "FORGEGATE_OPENAI_CODEX_ENABLED",
        "FORGEGATE_GEMINI_ENABLED",
        "FORGEGATE_GENERIC_HARNESS_ENABLED",
        "FORGEGATE_OLLAMA_ENABLED",
    ):
        monkeypatch.setenv(env_name, "false")
    monkeypatch.setenv("FORGEGATE_DEFAULT_PROVIDER", "anthropic")
    monkeypatch.setenv("FORGEGATE_DEFAULT_MODEL", "claude-3-5-sonnet-latest")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_API_KEY", "anthropic-key")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_BASE_URL", "not-a-url")
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    response = local_client.get("/v1/models")

    assert response.status_code == 200
    assert response.json()["data"] == []


def test_models_endpoint_keeps_ready_anthropic_hidden_from_public_inventory_before_runtime_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_isolated_anthropic_runtime(monkeypatch)
    clear_runtime_dependency_caches()
    anthropic_client = TestClient(app)

    response = anthropic_client.get("/v1/models")

    assert response.status_code == 200
    assert response.json()["data"] == []


def test_chat_unknown_model_keeps_anthropic_public_inventory_hidden_before_runtime_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_isolated_anthropic_runtime(monkeypatch)
    clear_runtime_dependency_caches()
    anthropic_client = TestClient(app)

    response = anthropic_client.post(
        "/v1/chat/completions",
        json={
            "model": "missing-anthropic-model",
            "messages": [{"role": "user", "content": "show the public inventory"}],
        },
    )

    assert response.status_code == 404
    error = response.json()["error"]
    assert error["type"] == "model_not_found"
    assert error["available_models"] == []


def test_models_endpoint_keeps_anthropic_hidden_from_public_inventory_after_non_stream_runtime_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_isolated_anthropic_runtime(monkeypatch)
    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.post", lambda *args, **kwargs: _mock_anthropic_text_response())
    clear_runtime_dependency_caches()
    anthropic_client = TestClient(app)

    completion = anthropic_client.post(
        "/v1/chat/completions",
        json={
            "model": "claude-3-5-sonnet-latest",
            "messages": [{"role": "user", "content": "describe the image"}],
        },
    )
    assert completion.status_code == 200

    response = anthropic_client.get("/v1/models")

    assert response.status_code == 200
    assert response.json()["data"] == []


def test_models_endpoint_keeps_anthropic_hidden_from_public_inventory_after_responses_runtime_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_isolated_anthropic_runtime(monkeypatch)
    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.post", lambda *args, **kwargs: _mock_anthropic_text_response())
    clear_runtime_dependency_caches()
    anthropic_client = TestClient(app)

    response_payload = anthropic_client.post(
        "/v1/responses",
        json={
            "model": "claude-3-5-sonnet-latest",
            "input": "record runtime evidence through responses",
        },
    )
    assert response_payload.status_code == 200

    response = anthropic_client.get("/v1/models")

    assert response.status_code == 200
    assert response.json()["data"] == []


def test_chat_unknown_model_keeps_anthropic_public_inventory_hidden_after_runtime_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_isolated_anthropic_runtime(monkeypatch)
    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.post", lambda *args, **kwargs: _mock_anthropic_text_response())
    clear_runtime_dependency_caches()
    anthropic_client = TestClient(app)

    completion = anthropic_client.post(
        "/v1/chat/completions",
        json={
            "model": "claude-3-5-sonnet-latest",
            "messages": [{"role": "user", "content": "record runtime evidence"}],
        },
    )
    assert completion.status_code == 200

    response = anthropic_client.post(
        "/v1/chat/completions",
        json={
            "model": "missing-anthropic-model",
            "messages": [{"role": "user", "content": "show the public inventory after evidence"}],
        },
    )

    assert response.status_code == 404
    error = response.json()["error"]
    assert error["type"] == "model_not_found"
    assert error["available_models"] == []


def test_responses_unknown_model_keeps_anthropic_public_inventory_hidden_after_responses_runtime_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_isolated_anthropic_runtime(monkeypatch)
    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.post", lambda *args, **kwargs: _mock_anthropic_text_response())
    clear_runtime_dependency_caches()
    anthropic_client = TestClient(app)

    response_payload = anthropic_client.post(
        "/v1/responses",
        json={
            "model": "claude-3-5-sonnet-latest",
            "input": "record runtime evidence through responses",
        },
    )
    assert response_payload.status_code == 200

    response = anthropic_client.post(
        "/v1/responses",
        json={
            "input": "show the public inventory after responses evidence",
            "model": "missing-anthropic-model",
        },
    )

    assert response.status_code == 404
    error = response.json()["error"]
    assert error["type"] == "model_not_found"
    assert error["available_models"] == []


def test_models_endpoint_keeps_anthropic_hidden_from_public_inventory_after_responses_stream_runtime_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_isolated_anthropic_runtime(monkeypatch)
    clear_runtime_dependency_caches()
    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.stream", lambda *args, **kwargs: _mock_anthropic_tool_use_stream_response())
    anthropic_client = TestClient(app)

    with anthropic_client.stream(
        "POST",
        "/v1/responses",
        json={
            "model": "claude-3-5-sonnet-latest",
            "input": "record streaming runtime evidence",
            "stream": True,
            "tools": [{"type": "function", "function": {"name": "lookup", "parameters": {"type": "object"}}}],
        },
    ) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    completed = _sse_payload(raw, "response.completed")
    assert completed["output"][0]["type"] == "function_call"

    models_response = anthropic_client.get("/v1/models")

    assert models_response.status_code == 200
    assert models_response.json()["data"] == []


def test_models_endpoint_keeps_anthropic_hidden_from_public_inventory_after_chat_stream_runtime_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_isolated_anthropic_runtime(monkeypatch)
    clear_runtime_dependency_caches()
    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.stream", lambda *args, **kwargs: _mock_anthropic_tool_use_stream_response())
    anthropic_client = TestClient(app)

    with anthropic_client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "model": "claude-3-5-sonnet-latest",
            "messages": [{"role": "user", "content": "record streaming runtime evidence"}],
            "stream": True,
            "tools": [{"type": "function", "function": {"name": "lookup", "parameters": {"type": "object"}}}],
        },
    ) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    assert '"tool_calls"' in raw
    assert "[DONE]" in raw

    models_response = anthropic_client.get("/v1/models")

    assert models_response.status_code == 200
    assert models_response.json()["data"] == []


def test_models_endpoint_only_lists_models_that_dispatch_under_same_runtime_config(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    models_response = local_client.get("/v1/models")
    assert models_response.status_code == 200
    model_ids = [item["id"] for item in models_response.json()["data"]]
    assert model_ids == ["forgeframe-baseline-chat-v1"]

    for model_id in model_ids:
        completion = local_client.post(
            "/v1/chat/completions",
            json={
                "model": model_id,
                "messages": [{"role": "user", "content": f"dispatch {model_id}"}],
            },
        )
        assert completion.status_code == 200
        assert completion.json()["model"] == model_id


def test_models_endpoint_omits_stale_generic_harness_models_that_no_longer_dispatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)
    headers = _admin_headers(local_client)
    provider_key = "stale_inventory_profile"
    stale_model = "acme-stale-chat"

    create_profile = local_client.put(
        f"/admin/providers/harness/profiles/{provider_key}",
        headers=headers,
        json={
            "provider_key": provider_key,
            "label": "Acme Runtime",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://acme.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "acme-secret",
            "enabled": True,
            "models": [stale_model],
            "request_mapping": {
                "method": "POST",
                "path": "/chat/completions",
                "headers": {},
                "body_template": {
                    "model": "{{model}}",
                    "messages": "{{messages}}",
                    "stream": "{{stream}}",
                },
            },
            "capabilities": {
                "streaming": True,
                "tool_calling": True,
                "discovery_support": True,
                "model_source": "manual",
            },
        },
    )
    assert create_profile.status_code == 200

    sync_response = local_client.post(
        "/admin/providers/sync",
        headers=headers,
        json={"provider": "generic_harness"},
    )
    assert sync_response.status_code == 200

    update_profile = local_client.put(
        f"/admin/providers/harness/profiles/{provider_key}",
        headers=headers,
        json={
            "provider_key": provider_key,
            "label": "Acme Runtime",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://acme.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "acme-secret",
            "enabled": True,
            "models": ["acme-fresh-chat"],
            "request_mapping": {
                "method": "POST",
                "path": "/chat/completions",
                "headers": {},
                "body_template": {
                    "model": "{{model}}",
                    "messages": "{{messages}}",
                    "stream": "{{stream}}",
                },
            },
            "capabilities": {
                "streaming": True,
                "tool_calling": True,
                "discovery_support": True,
                "model_source": "manual",
            },
        },
    )
    assert update_profile.status_code == 200
    clear_runtime_dependency_caches()

    models_response = local_client.get("/v1/models")

    assert models_response.status_code == 200
    assert [item["id"] for item in models_response.json()["data"]] == ["forgeframe-baseline-chat-v1"]

    stale_dispatch = local_client.post(
        "/v1/chat/completions",
        json={
            "model": stale_model,
            "messages": [{"role": "user", "content": "dispatch stale harness model"}],
        },
    )

    assert stale_dispatch.status_code == 503
    assert stale_dispatch.json()["error"]["type"] == "provider_not_ready"


def test_models_endpoint_hides_enabled_templated_generic_harness_profiles_from_public_inventory(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)
    headers = _admin_headers(local_client)

    create_profile = local_client.put(
        "/admin/providers/harness/profiles/local_compose",
        headers=headers,
        json={
            "provider_key": "local_compose",
            "label": "Local Compose Harness",
            "integration_class": "templated_http",
            "endpoint_base_url": "https://example.invalid/api",
            "auth_scheme": "none",
            "auth_value": "",
            "enabled": True,
            "models": ["compose-model"],
            "discovery_enabled": False,
            "stream_mapping": {"enabled": False},
            "capabilities": {"streaming": False, "model_source": "manual"},
        },
    )
    assert create_profile.status_code == 200

    sync_response = local_client.post(
        "/admin/providers/sync",
        headers=headers,
        json={"provider": "generic_harness"},
    )
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()

    models_response = local_client.get("/v1/models")
    assert models_response.status_code == 200
    assert [item["id"] for item in models_response.json()["data"]] == ["forgeframe-baseline-chat-v1"]

    unknown_model = local_client.post(
        "/v1/chat/completions",
        json={
            "model": "missing-compose-model",
            "messages": [{"role": "user", "content": "list the same public inventory"}],
        },
    )
    assert unknown_model.status_code == 404
    assert unknown_model.json()["error"]["available_models"] == ["forgeframe-baseline-chat-v1"]


def test_models_endpoint_keeps_generic_harness_model_hidden_after_admin_probe_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)

    class _MockResponse:
        def __init__(self, model: str):
            self.status_code = 200
            self.headers = {"content-type": "application/json"}
            self.text = "ok"
            self._model = model

        def json(self) -> dict[str, object]:
            return {
                "model": self._model,
                "choices": [
                    {
                        "message": {"role": "assistant", "content": "probe-ok"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 4, "completion_tokens": 2, "total_tokens": 6},
            }

    def _mock_request(*args, **kwargs):
        del args
        payload = kwargs.get("json", {})
        return _MockResponse(str(payload.get("model", "acme-probe-only-chat")))

    monkeypatch.setattr("app.harness.service.httpx.request", _mock_request)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)
    headers = _admin_headers(local_client)
    provider_key = "acme_probe_only_profile"
    model_id = "acme-probe-only-chat"

    create_profile = local_client.put(
        f"/admin/providers/harness/profiles/{provider_key}",
        headers=headers,
        json={
            "provider_key": provider_key,
            "label": "Acme Probe Only",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://acme.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "acme-secret",
            "enabled": True,
            "models": [model_id],
            "request_mapping": {
                "method": "POST",
                "path": "/chat/completions",
                "headers": {},
                "body_template": {
                    "model": "{{model}}",
                    "messages": "{{messages}}",
                    "stream": "{{stream}}",
                },
            },
            "capabilities": {
                "streaming": False,
                "tool_calling": False,
                "discovery_support": True,
                "model_source": "manual",
            },
        },
    )
    assert create_profile.status_code == 200

    sync_response = local_client.post(
        "/admin/providers/sync",
        headers=headers,
        json={"provider": "generic_harness"},
    )
    assert sync_response.status_code == 200

    probe_response = local_client.post(
        "/admin/providers/harness/probe",
        headers=headers,
        json={
            "provider_key": provider_key,
            "model": model_id,
            "message": "probe only",
            "stream": False,
        },
    )
    assert probe_response.status_code == 200
    assert probe_response.json()["run"]["model"] == model_id

    after_probe = local_client.get("/v1/models")
    assert after_probe.status_code == 200
    assert [item["id"] for item in after_probe.json()["data"]] == ["forgeframe-baseline-chat-v1"]


def test_models_endpoint_only_promotes_generic_harness_models_with_model_specific_runtime_proof(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)

    class _MockResponse:
        def __init__(self, model: str):
            self.status_code = 200
            self.headers = {"content-type": "application/json"}
            self.text = "ok"
            self._model = model

        def json(self) -> dict[str, object]:
            return {
                "model": self._model,
                "choices": [
                    {
                        "message": {"role": "assistant", "content": f"{self._model}-ok"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 4, "completion_tokens": 2, "total_tokens": 6},
            }

    def _mock_request(*args, **kwargs):
        del args
        payload = kwargs.get("json", {})
        return _MockResponse(str(payload.get("model", "acme-proven-chat")))

    monkeypatch.setattr("app.harness.service.httpx.request", _mock_request)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)
    headers = _admin_headers(local_client)
    provider_key = "acme_multi_model_profile"
    proven_model = "acme-proven-chat"
    unproven_model = "acme-unproven-chat"

    create_profile = local_client.put(
        f"/admin/providers/harness/profiles/{provider_key}",
        headers=headers,
        json={
            "provider_key": provider_key,
            "label": "Acme Multi Model",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://acme.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "acme-secret",
            "enabled": True,
            "models": [proven_model, unproven_model],
            "request_mapping": {
                "method": "POST",
                "path": "/chat/completions",
                "headers": {},
                "body_template": {
                    "model": "{{model}}",
                    "messages": "{{messages}}",
                    "stream": "{{stream}}",
                },
            },
            "capabilities": {
                "streaming": False,
                "tool_calling": False,
                "discovery_support": True,
                "model_source": "manual",
            },
        },
    )
    assert create_profile.status_code == 200

    sync_response = local_client.post(
        "/admin/providers/sync",
        headers=headers,
        json={"provider": "generic_harness"},
    )
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()

    before_runtime = local_client.get("/v1/models")
    assert before_runtime.status_code == 200
    assert [item["id"] for item in before_runtime.json()["data"]] == ["forgeframe-baseline-chat-v1"]

    completion = local_client.post(
        "/v1/chat/completions",
        json={
            "model": proven_model,
            "messages": [{"role": "user", "content": "prove only one model"}],
        },
    )
    assert completion.status_code == 200
    assert completion.json()["model"] == proven_model

    harness_runs = local_client.get(
        f"/admin/providers/harness/runs?provider_key={provider_key}",
        headers=headers,
    )
    assert harness_runs.status_code == 200
    runtime_run = next(item for item in harness_runs.json()["runs"] if item["mode"] == "runtime_non_stream")
    assert runtime_run["model"] == proven_model

    after_runtime = local_client.get("/v1/models")
    assert after_runtime.status_code == 200
    assert [item["id"] for item in after_runtime.json()["data"]] == [
        "forgeframe-baseline-chat-v1",
        proven_model,
    ]
    assert unproven_model not in [item["id"] for item in after_runtime.json()["data"]]


def test_models_endpoint_keeps_generic_harness_public_model_when_unrelated_newer_runs_exceed_500(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)

    class _MockResponse:
        def __init__(self, model: str):
            self.status_code = 200
            self.headers = {"content-type": "application/json"}
            self.text = "ok"
            self._model = model

        def json(self) -> dict[str, object]:
            return {
                "model": self._model,
                "choices": [
                    {
                        "message": {"role": "assistant", "content": f"{self._model}-ok"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 4, "completion_tokens": 2, "total_tokens": 6},
            }

    def _mock_request(*args, **kwargs):
        del args
        payload = kwargs.get("json", {})
        return _MockResponse(str(payload.get("model", "acme-retained-proof-chat")))

    monkeypatch.setattr("app.harness.service.httpx.request", _mock_request)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)
    headers = _admin_headers(local_client)
    provider_key = "acme_retained_proof_profile"
    proven_model = "acme-retained-proof-chat"
    noise_model = "acme-noise-chat"

    proven_profile = local_client.put(
        f"/admin/providers/harness/profiles/{provider_key}",
        headers=headers,
        json={
            "provider_key": provider_key,
            "label": "Acme Retained Proof",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://acme.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "acme-secret",
            "enabled": True,
            "models": [proven_model, noise_model],
            "request_mapping": {
                "method": "POST",
                "path": "/chat/completions",
                "headers": {},
                "body_template": {
                    "model": "{{model}}",
                    "messages": "{{messages}}",
                    "stream": "{{stream}}",
                },
            },
            "capabilities": {
                "streaming": False,
                "tool_calling": False,
                "discovery_support": True,
                "model_source": "manual",
            },
        },
    )
    assert proven_profile.status_code == 200

    sync_response = local_client.post(
        "/admin/providers/sync",
        headers=headers,
        json={"provider": "generic_harness"},
    )
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()

    before_runtime = local_client.get("/v1/models")
    assert before_runtime.status_code == 200
    assert [item["id"] for item in before_runtime.json()["data"]] == ["forgeframe-baseline-chat-v1"]

    harness = get_harness_service()
    proof_recorded_at = datetime.now(tz=UTC)
    harness._store.record_run(
        HarnessVerificationRun(
            provider_key=provider_key,
            integration_class="openai_compatible",
            model=proven_model,
            mode="runtime_non_stream",
            status="ok",
            success=True,
            steps=[{"step": "request_render", "status": "ok"}, {"step": "response_mapping", "status": "ok"}],
            executed_at=proof_recorded_at.isoformat(),
            client_id="runtime",
            consumer="runtime",
            integration="generic_harness",
        )
    )
    newer_runtime_base = proof_recorded_at
    for offset in range(501):
        harness._store.record_run(
            HarnessVerificationRun(
                provider_key=provider_key,
                integration_class="openai_compatible",
                model=noise_model,
                mode="runtime_non_stream",
                status="ok",
                success=True,
                steps=[{"step": "request_render", "status": "ok"}, {"step": "response_mapping", "status": "ok"}],
                executed_at=(newer_runtime_base + timedelta(seconds=offset + 1)).isoformat(),
                client_id="runtime",
                consumer="runtime",
                integration="generic_harness",
            )
        )

    after_noise = local_client.get("/v1/models")
    assert after_noise.status_code == 200
    public_model_ids = {item["id"] for item in after_noise.json()["data"]}
    assert public_model_ids == {
        "forgeframe-baseline-chat-v1",
        proven_model,
        noise_model,
    }


def test_models_endpoint_lists_generic_harness_model_after_live_runtime_proof(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)

    class _MockResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        text = "ok"

        @staticmethod
        def json() -> dict[str, object]:
            return {
                "model": "acme-live-chat",
                "choices": [
                    {
                        "message": {"role": "assistant", "content": "acme-live"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 4, "completion_tokens": 2, "total_tokens": 6},
            }

    def _mock_request(*args, **kwargs):
        del args, kwargs
        return _MockResponse()

    monkeypatch.setattr("app.harness.service.httpx.request", _mock_request)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)
    headers = _admin_headers(local_client)
    model_id = "acme-live-chat"

    create_profile = local_client.put(
        "/admin/providers/harness/profiles/acme_live_profile",
        headers=headers,
        json={
            "provider_key": "acme_live_profile",
            "label": "Acme Live",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://acme.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "acme-secret",
            "enabled": True,
            "models": [model_id],
            "request_mapping": {
                "method": "POST",
                "path": "/chat/completions",
                "headers": {},
                "body_template": {
                    "model": "{{model}}",
                    "messages": "{{messages}}",
                    "stream": "{{stream}}",
                },
            },
            "capabilities": {
                "streaming": False,
                "tool_calling": False,
                "discovery_support": True,
                "model_source": "manual",
            },
        },
    )
    assert create_profile.status_code == 200

    sync_response = local_client.post(
        "/admin/providers/sync",
        headers=headers,
        json={"provider": "generic_harness"},
    )
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()

    before_runtime = local_client.get("/v1/models")
    assert before_runtime.status_code == 200
    assert [item["id"] for item in before_runtime.json()["data"]] == ["forgeframe-baseline-chat-v1"]

    completion = local_client.post(
        "/v1/chat/completions",
        json={
            "model": model_id,
            "messages": [{"role": "user", "content": "prove public runtime dispatch"}],
        },
    )
    assert completion.status_code == 200
    assert completion.json()["model"] == model_id

    after_runtime = local_client.get("/v1/models")
    assert after_runtime.status_code == 200
    assert [item["id"] for item in after_runtime.json()["data"]] == [
        "forgeframe-baseline-chat-v1",
        model_id,
    ]


def test_models_endpoint_hides_codex_inventory_when_bridge_is_disabled_even_with_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "false")
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    response = local_client.get("/v1/models")

    assert response.status_code == 200
    model_ids = [item["id"] for item in response.json()["data"]]
    assert model_ids == ["forgeframe-baseline-chat-v1"]
    assert "gpt-5.3-codex" not in model_ids


def test_chat_endpoint_rejects_explicit_codex_when_bridge_is_disabled_even_with_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "false")
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    response = local_client.post(
        "/v1/chat/completions",
        json={
            "model": "gpt-5.3-codex",
            "messages": [{"role": "user", "content": "route me to codex"}],
        },
    )

    assert response.status_code == 404
    error = response.json()["error"]
    assert error["type"] == "model_not_found"
    assert error["available_models"] == ["forgeframe-baseline-chat-v1"]
    assert "gpt-5.3-codex" not in error["available_models"]


def test_chat_endpoint_rejects_discovered_codex_when_bridge_is_disabled_even_with_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "false")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_DISCOVERY_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_DISCOVERED_MODELS", '["gpt-5.3-codex-preview"]')
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    response = local_client.post(
        "/v1/chat/completions",
        json={
            "model": "gpt-5.3-codex-preview",
            "messages": [{"role": "user", "content": "route me to discovered codex"}],
        },
    )

    assert response.status_code == 404
    error = response.json()["error"]
    assert error["type"] == "model_not_found"
    assert error["available_models"] == ["forgeframe-baseline-chat-v1"]
    assert "gpt-5.3-codex-preview" not in error["available_models"]


def test_models_endpoint_omits_codex_when_bridge_base_url_is_invalid(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BASE_URL", "not-a-url")
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    response = local_client.get("/v1/models")

    assert response.status_code == 200
    assert "gpt-5.3-codex" not in {item["id"] for item in response.json()["data"]}


def test_model_not_found_available_models_hide_codex_inventory_when_bridge_is_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "false")
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    response = local_client.post(
        "/v1/chat/completions",
        json={
            "model": "unknown-model",
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )

    assert response.status_code == 404
    error = response.json()["error"]
    assert error["type"] == "model_not_found"
    assert error["available_models"] == ["forgeframe-baseline-chat-v1"]
    assert "gpt-5.3-codex" not in error["available_models"]


def test_chat_endpoint_success_path_uses_baseline_provider_chain() -> None:
    before = int(datetime.now(tz=UTC).timestamp())
    response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello ForgeFrame"}],
        },
    )
    after = int(datetime.now(tz=UTC).timestamp())

    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "forgeframe-baseline-chat-v1"
    assert isinstance(body["created"], int)
    assert before <= body["created"] <= after
    assert "ForgeFrame baseline response" in body["choices"][0]["message"]["content"]
    assert body["usage"]["total_tokens"] > 0
    assert body["cost"]["avoided_cost"] >= 0.0
    assert "provider" not in body
    assert "credential_type" not in body
    assert "auth_source" not in body


def test_chat_endpoint_generates_unique_completion_ids_per_request() -> None:
    first = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "first id"}]},
    )
    second = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "second id"}]},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    first_id = first.json()["id"]
    second_id = second.json()["id"]
    assert first_id.startswith("chatcmpl-")
    assert second_id.startswith("chatcmpl-")
    assert first_id != second_id


def test_chat_endpoint_stream_success_path_uses_baseline_provider_chain() -> None:
    with client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello stream"}],
            "stream": True,
        },
    ) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    assert "chat.completion.chunk" in raw
    assert '"usage": {' in raw
    assert "[DONE]" in raw
    assert '"provider"' not in raw
    assert "forgeframe_baseline" not in raw


def test_chat_endpoint_stream_reuses_one_unique_completion_id_per_request() -> None:
    def _stream_payloads(prompt: str) -> list[dict[str, object]]:
        with client.stream(
            "POST",
            "/v1/chat/completions",
            json={
                "messages": [{"role": "user", "content": prompt}],
                "stream": True,
            },
        ) as response:
            assert response.status_code == 200
            raw = "".join(response.iter_text())
        return _chat_sse_payloads(raw)

    first_payloads = _stream_payloads("stream first id")
    second_payloads = _stream_payloads("stream second id")
    assert first_payloads
    assert second_payloads

    first_ids = [payload["id"] for payload in first_payloads]
    second_ids = [payload["id"] for payload in second_payloads]
    first_created = [payload["created"] for payload in first_payloads]
    second_created = [payload["created"] for payload in second_payloads]

    assert all(item == first_ids[0] for item in first_ids)
    assert all(item == second_ids[0] for item in second_ids)
    assert all(item == first_created[0] for item in first_created)
    assert all(item == second_created[0] for item in second_created)
    assert isinstance(first_created[0], int)
    assert isinstance(second_created[0], int)
    assert first_ids[0].startswith("chatcmpl-")
    assert second_ids[0].startswith("chatcmpl-")
    assert first_ids[0] != second_ids[0]


def test_chat_endpoint_rejects_static_codex_when_bridge_is_disabled_without_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("FORGEGATE_OPENAI_CODEX_API_KEY", raising=False)
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "false")
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    response = local_client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "gpt-5.3-codex",
        },
    )

    assert response.status_code == 404
    error = response.json()["error"]
    assert error["type"] == "model_not_found"
    assert error["available_models"] == ["forgeframe-baseline-chat-v1"]
    assert "provider" not in error


def test_chat_endpoint_returns_not_ready_when_openai_base_url_is_invalid(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("FORGEGATE_OPENAI_API_BASE_URL", "not-a-url")
    clear_runtime_dependency_caches()
    invalid_client = TestClient(app)

    response = invalid_client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "gpt-4.1-mini",
        },
    )

    assert response.status_code == 503
    error = response.json()["error"]
    assert error["type"] == "provider_not_ready"
    assert "provider" not in error


def test_chat_endpoint_returns_not_ready_when_gemini_base_url_is_invalid(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_GEMINI_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_BASE_URL", "not-a-url")
    clear_runtime_dependency_caches()
    invalid_client = TestClient(app)

    response = invalid_client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "gemini-2.5-flash",
        },
    )

    assert response.status_code == 503
    error = response.json()["error"]
    assert error["type"] == "provider_not_ready"
    assert "provider" not in error


def test_chat_endpoint_rejects_unknown_model() -> None:
    response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "unknown-model",
        },
    )
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["type"] == "model_not_found"


def test_chat_endpoint_rejects_tool_choice_without_tools() -> None:
    response = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "Hello"}], "tool_choice": "auto"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["type"] == "invalid_request"


def test_chat_endpoint_rejects_unsupported_classic_control_fields() -> None:
    response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "gpt-4.1-mini",
            "temperature": 1.3,
            "max_tokens": 17,
            "top_p": 0.2,
        },
    )

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["type"] == "invalid_request"
    assert "temperature" in error["message"]
    assert "max_tokens" in error["message"]
    assert "top_p" in error["message"]
    assert {
        issue["loc"][-1]
        for issue in error["details"]["issues"]
        if issue["type"] == "extra_forbidden"
    } == {"temperature", "max_tokens", "top_p"}


def test_chat_endpoint_rejects_tool_calling_for_baseline_provider() -> None:
    response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello"}],
            "tools": [{"type": "function", "function": {"name": "ping", "description": "Ping", "parameters": {"type": "object"}}}],
        },
    )
    assert response.status_code == 503
    assert response.json()["error"]["type"] == "provider_not_ready"


def test_chat_endpoint_rejects_invalid_tool_definition() -> None:
    response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello"}],
            "tools": [{"type": "function", "function": {"description": "missing name"}}],
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["type"] == "invalid_request"


def test_chat_endpoint_rejects_tool_choice_name_not_in_tools() -> None:
    response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello"}],
            "tools": [{"type": "function", "function": {"name": "ping"}}],
            "tool_choice": {"type": "function", "function": {"name": "pong"}},
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["type"] == "invalid_request"


def test_chat_endpoint_rejects_unsupported_message_content_before_forwarding(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")
    clear_runtime_dependency_caches()

    def _unexpected_post(self, payload: dict) -> dict:
        del self, payload
        raise AssertionError("unsupported message content should be rejected before provider dispatch")

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _unexpected_post)

    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "gpt-4.1-mini",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_audio",
                            "input_audio": {"data": "AAAA", "format": "wav"},
                        }
                    ],
                }
            ],
        },
    )

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["type"] == "invalid_request"
    assert "unsupported content block type 'input_audio'" in error["message"]


def test_chat_endpoint_rejects_message_extra_fields_before_forwarding(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")
    clear_runtime_dependency_caches()

    def _unexpected_post(self, payload: dict) -> dict:
        del self, payload
        raise AssertionError("message extra fields should be rejected before provider dispatch")

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _unexpected_post)

    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "gpt-4.1-mini",
            "messages": [
                {
                    "role": "user",
                    "content": "Hello",
                    "metadata": {"tenant": "unexpected"},
                }
            ],
        },
    )

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["type"] == "invalid_request"
    assert "unsupported field: metadata" in error["message"]


def test_chat_request_schema_rejects_unsupported_classic_control_fields() -> None:
    with pytest.raises(ValidationError) as exc_info:
        ChatCompletionsRequest.model_validate(
            {
                "messages": [{"role": "user", "content": "Hello"}],
                "model": "gpt-4.1-mini",
                "temperature": 1.3,
                "max_tokens": 17,
                "top_p": 0.2,
            }
        )

    assert {
        error["loc"][-1]
        for error in exc_info.value.errors()
        if error["type"] == "extra_forbidden"
    } == {"temperature", "max_tokens", "top_p"}


def test_admin_usage_summary_endpoint_available() -> None:
    response = client.get("/admin/usage/", headers=_admin_headers())
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["object"] == "usage_summary"
    assert "pricing_snapshot" in payload
    assert "aggregations" in payload


def test_admin_oauth_operations_endpoint_available() -> None:
    response = client.get("/admin/providers/oauth-account/operations", headers=_admin_headers())
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "operations" in payload
    assert "recent" in payload
    assert "total_operations" in payload


def test_provider_control_plane_exposes_oauth_mode() -> None:
    response = client.get("/admin/providers/", headers=_admin_headers())
    assert response.status_code == 200
    providers = response.json()["providers"]
    codex = next(item for item in providers if item["provider"] == "openai_codex")
    gemini = next(item for item in providers if item["provider"] == "gemini")
    assert "oauth_mode" in codex
    assert codex["oauth_mode"] == "manual_redirect_completion"
    assert gemini["oauth_mode"] is None


def test_admin_bootstrap_readiness_endpoint_available() -> None:
    response = client.get("/admin/providers/bootstrap/readiness", headers=_admin_headers())
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["ready"] is False
    assert "checks" in payload
    assert "next_steps" in payload
    checks = {item["id"]: item for item in payload["checks"]}
    assert checks["host_install_script"]["ok"] is True
    assert checks["host_env_template"]["ok"] is True
    assert checks["systemd_runtime_units"]["ok"] is True
    assert checks["linux_host_installation"]["ok"] is True
    assert checks["root_ui_on_slash"]["ok"] is True
    assert checks["public_https_listener"]["ok"] is False
    assert checks["tls_certificate_management"]["ok"] is False


def test_oauth_onboarding_and_harness_export_endpoints_available() -> None:
    onboarding = client.get("/admin/providers/oauth-account/onboarding", headers=_admin_headers())
    assert onboarding.status_code == 200
    assert "targets" in onboarding.json()

    harness_export = client.get("/admin/providers/harness/export", headers=_admin_headers())
    assert harness_export.status_code == 200
    assert harness_export.json()["snapshot"]["object"] == "harness_config_export"


def test_harness_runs_endpoint_contains_ops_summary() -> None:
    response = client.get("/admin/providers/harness/runs", headers=_admin_headers())
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "ops" in payload
    assert "profile_count" in payload["ops"]


def test_admin_usage_summary_records_runtime_requests() -> None:
    chat_response = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "Track me"}]},
    )
    assert chat_response.status_code == 200

    usage_response = client.get("/admin/usage/", headers=_admin_headers())
    assert usage_response.status_code == 200
    payload = usage_response.json()
    assert payload["metrics"]["recorded_request_count"] >= 1


def test_admin_usage_drilldown_endpoints_expose_provider_and_client_views() -> None:
    chat_response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Drilldown me"}],
            "client": {"client_id": "integration-suite", "consumer": "tests", "integration": "pytest"},
        },
    )
    assert chat_response.status_code == 200

    provider_response = client.get("/admin/usage/providers/forgeframe_baseline", headers=_admin_headers())
    assert provider_response.status_code == 200
    assert provider_response.json()["drilldown"]["provider"] == "forgeframe_baseline"

    client_response = client.get("/admin/usage/clients/integration-suite", headers=_admin_headers())
    assert client_response.status_code == 200
    assert client_response.json()["drilldown"]["client_id"] == "integration-suite"


def test_responses_endpoint_openai_compatible_baseline() -> None:
    response = client.post(
        "/v1/responses",
        json={"input": "Hello responses"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["object"] == "response"
    assert isinstance(body["output"], list)
    assert "provider" not in body
    assert "credential_type" not in body
    assert "auth_source" not in body


def test_responses_endpoint_supports_stream_mode() -> None:
    with client.stream("POST", "/v1/responses", json={"input": "Hello responses", "stream": True}) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())
    assert "response.created" in raw
    assert "response.completed" in raw
    assert "[DONE]" in raw


def test_responses_endpoint_persists_response_and_allows_retrieval() -> None:
    response = client.post(
        "/v1/responses",
        json={
            "input": "persist this response",
            "metadata": {"case": "retrieval"},
        },
    )
    assert response.status_code == 200
    created = response.json()

    fetch_response = client.get(f"/v1/responses/{created['id']}")
    assert fetch_response.status_code == 200
    assert fetch_response.json() == created
    native_mapping = created["metadata"]["forgeframe_native_mapping"]
    assert native_mapping["contract_surface"] == "openai_responses"
    assert native_mapping["processing_mode"] == "sync"
    assert native_mapping["primary_native_object_kind"] == "response"
    object_kinds = [item["kind"] for item in native_mapping["objects"]]
    assert object_kinds.count("response") == 1
    assert "response_item" in object_kinds
    assert native_mapping["objects"][0] == {
        "kind": "response",
        "object_id": created["id"],
        "relation": "primary_follow_object",
        "lifecycle_state": "completed",
        "label": None,
        "details": {
            "requested_model": None,
            "resolved_model": created["model"],
        },
    }
    assert native_mapping["commands"] == []
    assert native_mapping["notes"]

    input_items_response = client.get(f"/v1/responses/{created['id']}/input_items")
    assert input_items_response.status_code == 200
    input_items = input_items_response.json()
    assert input_items["object"] == "list"
    assert input_items["has_more"] is False
    assert len(input_items["data"]) == 1
    assert input_items["data"][0]["type"] == "message"
    assert input_items["data"][0]["role"] == "user"
    assert input_items["data"][0]["content"] == [{"type": "input_text", "text": "persist this response"}]


def test_responses_endpoint_background_path_returns_queued_response_and_location() -> None:
    response = client.post(
        "/v1/responses",
        json={
            "input": "queue this response",
            "background": True,
            "metadata": {"case": "background"},
        },
    )

    assert response.status_code == 202
    body = response.json()
    assert body["object"] == "response"
    assert body["status"] == "queued"
    assert body["background"] is True
    assert body["output"] == []
    native_mapping = body["metadata"]["forgeframe_native_mapping"]
    assert native_mapping["primary_native_object_kind"] == "run"
    assert native_mapping["processing_mode"] == "background"
    assert native_mapping["objects"][0]["kind"] == "run"
    assert native_mapping["commands"][0]["command_kind"] == "start_run"
    assert response.headers["Location"] == f"/v1/responses/{body['id']}"

    queued = client.get(response.headers["Location"])
    assert queued.status_code == 200
    assert queued.json()["status"] == "queued"
    assert queued.json()["background"] is True


def test_responses_endpoint_preserves_function_call_output_inputs_and_retrieves_them(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        del self
        captured["payload"] = payload
        return {
            "model": payload["model"],
            "usage": {"prompt_tokens": 8, "completion_tokens": 3, "total_tokens": 11},
            "choices": [
                {
                    "message": {"role": "assistant", "content": "tool-output-accepted"},
                    "finish_reason": "stop",
                }
            ],
        }

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)
    response = client.post(
        "/v1/responses",
        json={
            "model": "gpt-4.1-mini",
            "input": [
                {"type": "message", "role": "user", "content": [{"type": "input_text", "text": "use tool output"}]},
                {"type": "function_call", "call_id": "call_123", "name": "lookup", "arguments": "{\"q\":\"forgeframe\"}"},
                {"type": "function_call_output", "call_id": "call_123", "output": "lookup result"},
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["output_text"] == "tool-output-accepted"
    assert captured["payload"]["messages"] == [
        {"role": "user", "content": "use tool output"},
        {
            "role": "assistant",
            "content": "",
            "tool_calls": [
                {
                    "id": "call_123",
                    "type": "function",
                    "function": {"name": "lookup", "arguments": "{\"q\":\"forgeframe\"}"},
                }
            ],
        },
        {
            "role": "tool",
            "tool_call_id": "call_123",
            "content": "lookup result",
        },
    ]

    input_items_response = client.get(f"/v1/responses/{response.json()['id']}/input_items")
    assert input_items_response.status_code == 200
    input_items = input_items_response.json()["data"]
    assert [item["type"] for item in input_items] == ["message", "function_call", "function_call_output"]
    assert input_items[1]["call_id"] == "call_123"
    assert input_items[2]["call_id"] == "call_123"
    assert input_items[2]["output"] == "lookup result"


def test_responses_stream_unknown_model_returns_filtered_public_inventory(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)
    models_response = local_client.get("/v1/models")
    assert models_response.status_code == 200
    public_inventory = [item["id"] for item in models_response.json()["data"]]

    response = local_client.post(
        "/v1/responses",
        json={"input": "Hello responses", "model": "unknown-model", "stream": True},
    )

    assert response.status_code == 404
    error = response.json()["error"]
    assert error["type"] == "model_not_found"
    assert error["available_models"] == public_inventory
    assert error["available_models"] == ["forgeframe-baseline-chat-v1"]


def test_responses_stream_unknown_model_keeps_anthropic_public_inventory_hidden_after_runtime_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_isolated_anthropic_runtime(monkeypatch)
    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.post", lambda *args, **kwargs: _mock_anthropic_text_response())
    clear_runtime_dependency_caches()
    anthropic_client = TestClient(app)

    completion = anthropic_client.post(
        "/v1/chat/completions",
        json={
            "model": "claude-3-5-sonnet-latest",
            "messages": [{"role": "user", "content": "record runtime evidence"}],
        },
    )
    assert completion.status_code == 200

    response = anthropic_client.post(
        "/v1/responses",
        json={
            "input": "show the public inventory after evidence",
            "model": "missing-anthropic-model",
            "stream": True,
        },
    )

    assert response.status_code == 404
    error = response.json()["error"]
    assert error["type"] == "model_not_found"
    assert error["available_models"] == []


def test_responses_endpoint_rejects_static_codex_when_bridge_is_disabled_without_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("FORGEGATE_OPENAI_CODEX_API_KEY", raising=False)
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "false")
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    response = local_client.post(
        "/v1/responses",
        json={
            "input": "Hello responses",
            "model": "gpt-5.3-codex",
        },
    )

    assert response.status_code == 404
    error = response.json()["error"]
    assert error["type"] == "model_not_found"
    assert error["available_models"] == ["forgeframe-baseline-chat-v1"]
    assert "provider" not in error


def test_responses_stream_hidden_codex_requests_persist_model_not_found_error_event(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("FORGEGATE_OPENAI_CODEX_API_KEY", raising=False)
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "false")
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    response = local_client.post(
        "/v1/responses",
        headers={
            "X-ForgeFrame-Trace-Id": "trace_responses_stream_failure_1",
            "X-ForgeFrame-Correlation-Id": "corr_responses_stream_failure_1",
            "X-ForgeFrame-Span-Id": "span_responses_stream_failure_1",
        },
        json={
            "input": "Hello responses",
            "model": "gpt-5.3-codex",
            "stream": True,
            "client": {
                "client_id": "responses-stream-startup-failure",
                "consumer": "tests",
                "integration": "pytest",
            },
        },
    )

    assert response.status_code == 404
    error = response.json()["error"]
    assert error["type"] == "model_not_found"
    assert error["available_models"] == ["forgeframe-baseline-chat-v1"]
    assert "provider" not in error

    error_events = [
        item["data"]
        for item in _observability_events()
        if item.get("kind") == "error"
        and item.get("data", {}).get("client_id") == "responses-stream-startup-failure"
    ]
    assert error_events
    latest_error = error_events[-1]
    assert latest_error["model"] == "gpt-5.3-codex"
    assert latest_error["route"] == "/v1/responses"
    assert latest_error["stream_mode"] == "stream"
    assert latest_error["error_type"] == "model_not_found"
    assert latest_error["trace_id"] == "trace_responses_stream_failure_1"
    assert latest_error["correlation_id"] == "corr_responses_stream_failure_1"
    assert latest_error["request_id"] == response.headers["X-ForgeFrame-Request-Id"]
    assert latest_error["span_id"] == "span_responses_stream_failure_1"
    assert response.headers["X-ForgeFrame-Span-Id"] == "span_responses_stream_failure_1"
    assert latest_error["duration_ms"] >= 0


def test_responses_stream_rejects_explicit_codex_when_bridge_is_disabled_even_with_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "false")
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    response = local_client.post(
        "/v1/responses",
        json={
            "input": "route me to codex",
            "model": "gpt-5.3-codex",
            "stream": True,
        },
    )

    assert response.status_code == 404
    error = response.json()["error"]
    assert error["type"] == "model_not_found"
    assert error["available_models"] == ["forgeframe-baseline-chat-v1"]
    assert "gpt-5.3-codex" not in error["available_models"]


def test_responses_stream_rejects_discovered_codex_when_bridge_is_disabled_even_with_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "false")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_DISCOVERY_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_DISCOVERED_MODELS", '["gpt-5.3-codex-preview"]')
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_ollama_models_unreachable)
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    response = local_client.post(
        "/v1/responses",
        json={
            "input": "route me to discovered codex",
            "model": "gpt-5.3-codex-preview",
            "stream": True,
        },
    )

    assert response.status_code == 404
    error = response.json()["error"]
    assert error["type"] == "model_not_found"
    assert error["available_models"] == ["forgeframe-baseline-chat-v1"]
    assert "gpt-5.3-codex-preview" not in error["available_models"]


def test_chat_endpoint_persists_trace_context_in_usage_event() -> None:
    response = client.post(
        "/v1/chat/completions",
        headers={
            "X-ForgeFrame-Trace-Id": "trace_chat_usage_1",
            "X-ForgeFrame-Correlation-Id": "corr_chat_usage_1",
            "X-ForgeFrame-Causation-Id": "cause_chat_usage_1",
            "X-ForgeFrame-Span-Id": "span_chat_usage_1",
        },
        json={
            "messages": [{"role": "user", "content": "trace the runtime call"}],
            "client": {
                "client_id": "trace-runtime-usage",
                "consumer": "tests",
                "integration": "pytest",
            },
        },
    )

    assert response.status_code == 200
    assert response.headers["X-ForgeFrame-Trace-Id"] == "trace_chat_usage_1"
    usage_events = [
        item["data"]
        for item in _observability_events()
        if item.get("kind") == "usage"
        and item.get("data", {}).get("client_id") == "trace-runtime-usage"
    ]
    assert usage_events
    latest_usage = usage_events[-1]
    assert latest_usage["route"] == "/v1/chat/completions"
    assert latest_usage["trace_id"] == "trace_chat_usage_1"
    assert latest_usage["correlation_id"] == "corr_chat_usage_1"
    assert latest_usage["causation_id"] == "cause_chat_usage_1"
    assert latest_usage["span_id"] == "span_chat_usage_1"
    assert latest_usage["request_id"] == response.headers["X-ForgeFrame-Request-Id"]
    assert response.headers["X-ForgeFrame-Span-Id"] == "span_chat_usage_1"
    assert latest_usage["duration_ms"] >= 0


def test_chat_endpoint_sanitizes_raw_provider_error_body(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        del self, payload
        raise ProviderUpstreamError(
            "openai_api",
            'OpenAI upstream error (500): {"prompt":"super secret prompt","sql":"select * from runtime_keys","provider_debug":"trace-id=fg-123"}',
        )

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)
    response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Ping external"}],
            "model": "gpt-4.1-mini",
        },
    )

    assert response.status_code == 502
    error = response.json()["error"]
    assert error["type"] == "provider_upstream_error"
    assert error["message"] == "Selected provider failed while processing the request."
    serialized = json.dumps(error)
    assert "super secret prompt" not in serialized
    assert "select * from runtime_keys" not in serialized
    assert "trace-id=fg-123" not in serialized


def test_responses_endpoint_sanitizes_raw_provider_error_body(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        del self, payload
        raise ProviderUpstreamError(
            "openai_api",
            'OpenAI upstream error (500): {"tokens":[111,222],"provider_json":{"secret":"abc"},"debug":"stack=xyz"}',
        )

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)
    response = client.post("/v1/responses", json={"input": "hello", "model": "gpt-4.1-mini"})

    assert response.status_code == 502
    error = response.json()["error"]
    assert error["type"] == "provider_upstream_error"
    assert error["message"] == "Selected provider failed while processing the request."
    serialized = json.dumps(error)
    assert '"tokens"' not in serialized
    assert '"secret"' not in serialized
    assert "stack=xyz" not in serialized


def test_responses_stream_sanitizes_raw_provider_error_event(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_stream(self, payload: dict, messages: list[dict]):
        del self, payload, messages
        raise ProviderStreamInterruptedError(
            "openai_api",
            'Failed to decode chunk: {"prompt":"hidden stream prompt","token":"sk-live-123","debug":"chunk=oops"}',
        )
        yield ProviderStreamEvent(event="delta", delta="unreachable")

    monkeypatch.setattr(OpenAIAPIAdapter, "_stream_chat_completion", _fake_stream)
    with client.stream("POST", "/v1/responses", json={"input": "hello", "model": "gpt-4.1-mini", "stream": True}) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    created_event = _sse_payload(raw, "response.created")
    error_event = _sse_payload(raw, "response.error")
    assert error_event["id"] == created_event["id"]
    assert error_event["object"] == "response"
    assert error_event["status"] == "failed"
    assert error_event["model"] == "gpt-4.1-mini"
    assert error_event["error"]["code"] == "provider_stream_interrupted"
    assert error_event["error"]["message"] == "Selected provider stream was interrupted."
    assert "provider" not in error_event["error"]
    assert "hidden stream prompt" not in raw
    assert "sk-live-123" not in raw
    assert "chunk=oops" not in raw
    assert "openai_api" not in raw


def test_chat_stream_sanitizes_yielded_provider_error_event(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_stream(self, payload: dict, messages: list[dict]):
        del self, payload, messages
        yield ProviderStreamEvent(
            event="error",
            error_type="provider_stream_interrupted",
            error_message="raw upstream secret_token=sk-live-leak tenant=acme",
        )

    monkeypatch.setattr(OpenAIAPIAdapter, "_stream_chat_completion", _fake_stream)
    with client.stream("POST", "/v1/chat/completions", json={"messages": [{"role": "user", "content": "hello"}], "model": "gpt-4.1-mini", "stream": True}) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    assert '"type": "provider_stream_interrupted"' in raw
    assert "Selected provider stream was interrupted." in raw
    assert '"provider"' not in raw
    assert "secret_token" not in raw
    assert "sk-live-leak" not in raw
    assert "tenant=acme" not in raw
    assert "openai_api" not in raw


def test_chat_stream_yielded_provider_error_event_persists_runtime_error_event(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_stream(self, payload: dict, messages: list[dict]):
        del self, payload, messages
        yield ProviderStreamEvent(
            event="error",
            error_type="provider_stream_interrupted",
            error_message="raw upstream secret_token=sk-live-leak tenant=acme",
        )

    monkeypatch.setattr(OpenAIAPIAdapter, "_stream_chat_completion", _fake_stream)
    with client.stream(
        "POST",
        "/v1/chat/completions",
        headers={
            "X-ForgeFrame-Trace-Id": "trace_chat_stream_yielded_error_1",
            "X-ForgeFrame-Correlation-Id": "corr_chat_stream_yielded_error_1",
            "X-ForgeFrame-Span-Id": "span_chat_stream_yielded_error_1",
        },
        json={
            "messages": [{"role": "user", "content": "hello"}],
            "model": "gpt-4.1-mini",
            "stream": True,
            "client": {
                "client_id": "chat-stream-yielded-error",
                "consumer": "tests",
                "integration": "pytest",
            },
        },
    ) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    assert '"type": "provider_stream_interrupted"' in raw
    error_events = [
        item["data"]
        for item in _observability_events()
        if item.get("kind") == "error"
        and item.get("data", {}).get("client_id") == "chat-stream-yielded-error"
    ]
    assert error_events
    latest_error = error_events[-1]
    assert latest_error["provider"] == "openai_api"
    assert latest_error["model"] == "gpt-4.1-mini"
    assert latest_error["route"] == "/v1/chat/completions"
    assert latest_error["stream_mode"] == "stream"
    assert latest_error["error_type"] == "provider_stream_interrupted"
    assert latest_error["status_code"] == 502
    assert latest_error["trace_id"] == "trace_chat_stream_yielded_error_1"
    assert latest_error["correlation_id"] == "corr_chat_stream_yielded_error_1"
    assert latest_error["request_id"] == response.headers["X-ForgeFrame-Request-Id"]
    assert latest_error["span_id"] == "span_chat_stream_yielded_error_1"
    assert latest_error["duration_ms"] >= 0


def test_responses_stream_sanitizes_yielded_provider_error_event(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_stream(self, payload: dict, messages: list[dict]):
        del self, payload, messages
        yield ProviderStreamEvent(
            event="error",
            error_type="provider_stream_interrupted",
            error_message="raw upstream secret_token=sk-live-leak tenant=acme",
        )

    monkeypatch.setattr(OpenAIAPIAdapter, "_stream_chat_completion", _fake_stream)
    with client.stream("POST", "/v1/responses", json={"input": "hello", "model": "gpt-4.1-mini", "stream": True}) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    created_event = _sse_payload(raw, "response.created")
    error_event = _sse_payload(raw, "response.error")
    assert error_event["id"] == created_event["id"]
    assert error_event["object"] == "response"
    assert error_event["status"] == "failed"
    assert error_event["model"] == "gpt-4.1-mini"
    assert error_event["error"]["code"] == "provider_stream_interrupted"
    assert error_event["error"]["message"] == "Selected provider stream was interrupted."
    assert "provider" not in error_event["error"]
    assert "secret_token" not in raw
    assert "sk-live-leak" not in raw
    assert "tenant=acme" not in raw
    assert "openai_api" not in raw


def test_runtime_models_endpoint_requires_key_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    secure_client = TestClient(app)
    response = secure_client.get("/v1/models")
    assert response.status_code == 401
    error = response.json()["error"]
    assert error["type"] == "missing_bearer"
    assert error["request_id"] == response.headers["X-ForgeFrame-Request-Id"]
    assert response.headers["X-ForgeFrame-Correlation-Id"] == error["request_id"]


def test_responses_endpoint_rejects_invalid_temperature() -> None:
    response = client.post("/v1/responses", json={"input": "Hello responses", "temperature": 3})
    assert response.status_code == 400
    assert response.json()["error"]["type"] == "invalid_request"


def test_responses_endpoint_rejects_unsupported_extra_control_fields() -> None:
    response = client.post(
        "/v1/responses",
        json={
            "input": "Hello responses",
            "store": True,
            "reasoning": {"effort": "medium"},
        },
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["type"] == "unsupported_parameter"
    assert "reasoning" in error["message"]
    assert "store" in error["message"]


def test_responses_endpoint_forwards_supported_control_fields_to_openai_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        del self
        captured["payload"] = payload
        return {
            "model": payload["model"],
            "usage": {"prompt_tokens": 7, "completion_tokens": 3, "total_tokens": 10},
            "choices": [
                {
                    "message": {"role": "assistant", "content": "openai-controls"},
                    "finish_reason": "stop",
                }
            ],
        }

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)
    response = client.post(
        "/v1/responses",
        json={
            "input": "Hello responses",
            "model": "gpt-4.1-mini",
            "max_output_tokens": 12,
            "temperature": 0.25,
            "metadata": {"ticket": "FOR-409"},
        },
    )

    assert response.status_code == 200
    assert response.json()["output_text"] == "openai-controls"
    assert captured["payload"]["max_tokens"] == 12
    assert captured["payload"]["temperature"] == 0.25
    assert captured["payload"]["metadata"] == {"ticket": "FOR-409"}


def test_responses_stream_forwards_supported_control_fields_to_openai_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_stream(self, payload: dict, messages: list[dict]):
        del self, messages
        captured["payload"] = payload
        yield ProviderStreamEvent(event="delta", delta="stream-controls")
        yield ProviderStreamEvent(
            event="done",
            finish_reason="stop",
            usage=TokenUsage(input_tokens=7, output_tokens=3, total_tokens=10),
            cost=CostBreakdown(actual_cost=0.01, hypothetical_cost=0.01, avoided_cost=0.0, pricing_basis="api_metered"),
        )

    monkeypatch.setattr(OpenAIAPIAdapter, "_stream_chat_completion", _fake_stream)
    with client.stream(
        "POST",
        "/v1/responses",
        json={
            "input": "Hello responses stream",
            "model": "gpt-4.1-mini",
            "stream": True,
            "max_output_tokens": 9,
            "temperature": 0.4,
            "metadata": {"ticket": "FOR-409-stream"},
        },
    ) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    completed = _sse_payload(raw, "response.completed")
    assert completed["output_text"] == "stream-controls"
    assert captured["payload"]["max_tokens"] == 9
    assert captured["payload"]["temperature"] == 0.4
    assert captured["payload"]["metadata"] == {"ticket": "FOR-409-stream"}


def test_responses_endpoint_rejects_empty_text_block_input() -> None:
    response = client.post("/v1/responses", json={"input": [{"type": "text"}]})
    assert response.status_code == 400
    assert response.json()["error"]["type"] == "invalid_request"


def test_responses_endpoint_forwards_tools_to_chat_validation() -> None:
    response = client.post(
        "/v1/responses",
        json={
            "input": "hello",
            "tools": [{"type": "function", "function": {"name": "ping"}}],
            "tool_choice": {"type": "function", "function": {"name": "pong"}},
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["type"] == "invalid_request"


def test_responses_endpoint_accepts_input_text_blocks() -> None:
    response = client.post(
        "/v1/responses",
        json={
            "input": [
                {"role": "user", "content": [{"type": "input_text", "text": "hello"}]},
                {"role": "user", "content": [{"type": "text", "text": "world"}]},
            ]
        },
    )
    assert response.status_code == 200
    assert response.json()["object"] == "response"
    assert response.json()["status"] == "completed"
    assert "output_text" in response.json()


def test_responses_endpoint_accepts_single_input_text_object() -> None:
    response = client.post(
        "/v1/responses",
        json={"input": {"type": "input_text", "text": "hello single block"}},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["object"] == "response"
    assert body["status"] == "completed"
    assert body["output_text"]


def test_responses_endpoint_rejects_input_image_file_ids() -> None:
    response = client.post(
        "/v1/responses",
        json={
            "input": [
                {
                    "role": "user",
                    "content": [{"type": "input_image", "file_id": "file_123"}],
                }
            ]
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["type"] == "unsupported_input"


def test_chat_default_routing_prefers_vision_capable_provider_for_image_messages(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    monkeypatch.setenv("FORGEGATE_DEFAULT_MODEL", "forgeframe-baseline-chat-v1")
    monkeypatch.setenv("FORGEGATE_DEFAULT_PROVIDER", "forgeframe_baseline")
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")
    clear_runtime_dependency_caches()

    def _fake_post(self, payload: dict) -> dict:
        del self
        captured["payload"] = payload
        return {
            "model": "gpt-4.1-mini",
            "choices": [{"message": {"content": "vision-ok"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 7, "completion_tokens": 2, "total_tokens": 9},
        }

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)
    local_client = TestClient(app)
    response = local_client.post(
        "/v1/chat/completions",
        json={
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What is shown?"},
                        {"type": "image_url", "image_url": {"url": "https://example.com/invoice.png"}},
                    ],
                }
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["model"] == "gpt-4.1-mini"
    assert response.json()["choices"][0]["message"]["content"] == "vision-ok"
    assert captured["payload"]["model"] == "gpt-4.1-mini"


def test_chat_endpoint_rejects_image_inputs_for_non_vision_requested_model() -> None:
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    response = local_client.post(
        "/v1/chat/completions",
        json={
            "model": "forgeframe-baseline-chat-v1",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What is shown?"},
                        {"type": "image_url", "image_url": {"url": "https://example.com/invoice.png"}},
                    ],
                }
            ],
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["type"] == "provider_unsupported_feature"


def test_chat_endpoint_preserves_image_inputs_for_anthropic_runtime(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    _enable_isolated_anthropic_runtime(monkeypatch)
    clear_runtime_dependency_caches()

    class _MockResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        text = "ok"

        @staticmethod
        def json() -> dict:
            return {
                "model": "claude-3-5-sonnet-latest",
                "content": [{"type": "text", "text": "invoice detected"}],
                "usage": {"input_tokens": 7, "output_tokens": 2, "total_tokens": 9},
                "stop_reason": "end_turn",
            }

    def _mock_post(*args, **kwargs):
        captured["payload"] = kwargs.get("json", {})
        return _MockResponse()

    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.post", _mock_post)
    anthropic_client = TestClient(app)
    response = anthropic_client.post(
        "/v1/chat/completions",
        json={
            "model": "claude-3-5-sonnet-latest",
            "messages": [
                {"role": "system", "content": "Act as OCR."},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What is shown?"},
                        {"type": "image_url", "image_url": {"url": "https://example.com/invoice.png"}},
                    ],
                },
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["content"] == "invoice detected"
    assert captured["payload"]["system"] == "Act as OCR."
    assert captured["payload"]["messages"] == [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What is shown?"},
                {
                    "type": "image",
                    "source": {"type": "url", "url": "https://example.com/invoice.png"},
                },
            ],
        }
    ]


def test_responses_endpoint_rejects_image_inputs_for_non_vision_requested_model() -> None:
    clear_runtime_dependency_caches()
    local_client = TestClient(app)

    response = local_client.post(
        "/v1/responses",
        json={
            "model": "forgeframe-baseline-chat-v1",
            "input": [
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": "What is shown?"},
                        {"type": "input_image", "image_url": "https://example.com/invoice.png"},
                    ],
                }
            ],
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["type"] == "provider_unsupported_feature"


def test_responses_endpoint_preserves_image_inputs_for_anthropic_runtime(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    _enable_isolated_anthropic_runtime(monkeypatch)
    clear_runtime_dependency_caches()

    class _MockResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        text = "ok"

        @staticmethod
        def json() -> dict:
            return {
                "model": "claude-3-5-sonnet-latest",
                "content": [{"type": "text", "text": "invoice detected"}],
                "usage": {"input_tokens": 7, "output_tokens": 2, "total_tokens": 9},
                "stop_reason": "end_turn",
            }

    def _mock_post(*args, **kwargs):
        captured["payload"] = kwargs.get("json", {})
        return _MockResponse()

    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.post", _mock_post)
    anthropic_client = TestClient(app)
    response = anthropic_client.post(
        "/v1/responses",
        json={
            "model": "claude-3-5-sonnet-latest",
            "instructions": "Act as OCR.",
            "max_output_tokens": 77,
            "temperature": 0.3,
            "input": [
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": "What is shown?"},
                        {"type": "input_image", "image_url": "https://example.com/invoice.png"},
                    ],
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["output_text"] == "invoice detected"
    assert captured["payload"]["system"] == "Act as OCR."
    assert captured["payload"]["max_tokens"] == 77
    assert captured["payload"]["temperature"] == 0.3
    assert captured["payload"]["messages"] == [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What is shown?"},
                {
                    "type": "image",
                    "source": {"type": "url", "url": "https://example.com/invoice.png"},
                },
            ],
        }
    ]


def test_responses_endpoint_includes_tool_call_output(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        del payload
        return {
            "model": "gpt-4.1-mini",
            "usage": {"prompt_tokens": 6, "completion_tokens": 3, "total_tokens": 9},
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "",
                        "tool_calls": [{"id": "call_1", "type": "function", "function": {"name": "lookup", "arguments": "{\"q\":\"x\"}"}}],
                    },
                    "finish_reason": "tool_calls",
                }
            ],
        }

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)
    response = client.post("/v1/responses", json={"input": "hello", "model": "gpt-4.1-mini"})
    assert response.status_code == 200
    output = response.json()["output"]
    assert output == [
        {
            "id": "call_1",
            "type": "function_call",
            "call_id": "call_1",
            "name": "lookup",
            "arguments": "{\"q\":\"x\"}",
            "status": "completed",
        }
    ]


def test_responses_stream_completed_payload_includes_tool_call_output(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_stream(self, payload: dict, messages: list[dict]):
        del self, payload, messages
        yield ProviderStreamEvent(
            event="done",
            finish_reason="tool_calls",
            usage=TokenUsage(input_tokens=6, output_tokens=3, total_tokens=9),
            cost=CostBreakdown(actual_cost=0.01, hypothetical_cost=0.01, avoided_cost=0.0, pricing_basis="api_metered"),
            tool_calls=[{"id": "call_1", "type": "function", "function": {"name": "lookup", "arguments": "{\"q\":\"forgegate\"}"}}],
            credential_type="api_key",
            auth_source="openai_api_key",
        )

    monkeypatch.setattr(OpenAIAPIAdapter, "_stream_chat_completion", _fake_stream)
    with client.stream("POST", "/v1/responses", json={"input": "hello", "model": "gpt-4.1-mini", "stream": True}) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    completed = _sse_payload(raw, "response.completed")
    assert completed["output"] == [
        {
            "id": "call_1",
            "type": "function_call",
            "call_id": "call_1",
            "name": "lookup",
            "arguments": "{\"q\":\"forgegate\"}",
            "status": "completed",
        }
    ]
    assert completed["output_text"] == ""
    assert "provider" not in completed
    assert "credential_type" not in completed
    assert "auth_source" not in completed


def test_chat_stream_anthropic_tool_use_blocks_surface_as_tool_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    _enable_isolated_anthropic_runtime(monkeypatch)
    clear_runtime_dependency_caches()
    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.stream", lambda *args, **kwargs: _mock_anthropic_tool_use_stream_response())
    anthropic_client = TestClient(app)

    with anthropic_client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "model": "claude-3-5-sonnet-latest",
            "messages": [{"role": "user", "content": "use a tool"}],
            "stream": True,
            "tools": [{"type": "function", "function": {"name": "lookup", "parameters": {"type": "object"}}}],
        },
    ) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    assert '"tool_calls"' in raw
    assert '"finish_reason": "tool_calls"' in raw


def test_responses_stream_anthropic_tool_use_blocks_surface_as_tool_call_output(monkeypatch: pytest.MonkeyPatch) -> None:
    _enable_isolated_anthropic_runtime(monkeypatch)
    clear_runtime_dependency_caches()
    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.stream", lambda *args, **kwargs: _mock_anthropic_tool_use_stream_response())
    anthropic_client = TestClient(app)

    with anthropic_client.stream(
        "POST",
        "/v1/responses",
        json={
            "model": "claude-3-5-sonnet-latest",
            "input": "use a tool",
            "stream": True,
            "tools": [{"type": "function", "function": {"name": "lookup", "parameters": {"type": "object"}}}],
        },
    ) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    completed = _sse_payload(raw, "response.completed")
    assert completed["output"] == [
        {
            "id": "toolu_1",
            "type": "function_call",
            "call_id": "toolu_1",
            "name": "lookup",
            "arguments": "{\"q\":\"forgegate\"}",
            "status": "completed",
        }
    ]
    assert completed["output_text"] == ""


def test_chat_stream_usage_event_preserves_provider_auth_attribution(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_stream(self, payload: dict, messages: list[dict]):
        del self, payload, messages
        yield ProviderStreamEvent(event="delta", delta="hello")
        yield ProviderStreamEvent(
            event="done",
            finish_reason="stop",
            usage=TokenUsage(input_tokens=6, output_tokens=3, total_tokens=9),
            cost=CostBreakdown(actual_cost=0.01, hypothetical_cost=0.01, avoided_cost=0.0, pricing_basis="api_metered"),
            credential_type="api_key",
            auth_source="openai_api_key",
        )

    monkeypatch.setattr(OpenAIAPIAdapter, "_stream_chat_completion", _fake_stream)

    with client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "hello"}],
            "model": "gpt-4.1-mini",
            "stream": True,
            "client": {
                "client_id": "stream-auth-chat",
                "consumer": "tests",
                "integration": "pytest",
            },
        },
    ) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    assert "[DONE]" in raw

    usage_events = [
        item["data"]
        for item in _observability_events()
        if item.get("kind") == "usage"
        and item.get("data", {}).get("client_id") == "stream-auth-chat"
    ]
    assert usage_events
    latest_usage = usage_events[-1]
    assert latest_usage["stream_mode"] == "stream"
    assert latest_usage["credential_type"] == "api_key"
    assert latest_usage["auth_source"] == "openai_api_key"

    summary = client.get("/admin/usage/", headers=_admin_headers())
    assert summary.status_code == 200
    by_auth = summary.json()["aggregations"]["by_auth"]
    assert by_auth == [{"auth_key": "api_key:openai_api_key", "requests": 1, "tokens": 9}]


def test_responses_stream_usage_event_preserves_provider_auth_attribution(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_AUTH_MODE", "oauth")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "test-token")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "true")

    def _fake_stream(self, payload: dict, messages: list[dict], request_metadata: dict[str, str] | None = None):
        del self, payload, messages, request_metadata
        yield ProviderStreamEvent(
            event="done",
            finish_reason="stop",
            usage=TokenUsage(input_tokens=8, output_tokens=4, total_tokens=12),
            cost=CostBreakdown(actual_cost=0.0, hypothetical_cost=0.02, avoided_cost=0.02, pricing_basis="oauth_hypothetical"),
            credential_type="oauth_access_token",
            auth_source="codex_oauth_account_bridge",
        )

    monkeypatch.setattr("app.providers.openai_codex.adapter.OpenAICodexAdapter._stream", _fake_stream)

    with client.stream(
        "POST",
        "/v1/responses",
        json={
            "input": "hello",
            "model": "gpt-5.3-codex",
            "stream": True,
            "client": {
                "client_id": "stream-auth-responses",
                "consumer": "tests",
                "integration": "pytest",
            },
        },
    ) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    assert "response.completed" in raw

    usage_events = [
        item["data"]
        for item in _observability_events()
        if item.get("kind") == "usage"
        and item.get("data", {}).get("client_id") == "stream-auth-responses"
    ]
    assert usage_events
    latest_usage = usage_events[-1]
    assert latest_usage["route"] == "/v1/responses"
    assert latest_usage["stream_mode"] == "stream"
    assert latest_usage["credential_type"] == "oauth_access_token"
    assert latest_usage["auth_source"] == "codex_oauth_account_bridge"

    summary = client.get("/admin/usage/", headers=_admin_headers())
    assert summary.status_code == 200
    by_auth = summary.json()["aggregations"]["by_auth"]
    assert by_auth == [{"auth_key": "oauth_access_token:codex_oauth_account_bridge", "requests": 1, "tokens": 12}]
