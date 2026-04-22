import json
import os

import pytest
from fastapi.testclient import TestClient

from app.api.admin.control_plane import get_control_plane_service
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/admin/auth/login",
        json={"username": "admin", "password": os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"]},
    )
    assert response.status_code == 201
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    if response.json()["user"]["must_rotate_password"] is True:
        rotation = client.post(
            "/admin/auth/rotate-password",
            headers=headers,
            json={
                "current_password": os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"],
                "new_password": os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"],
            },
        )
        assert rotation.status_code == 200
    return headers


def _sse_payload(raw: str, event_name: str) -> dict[str, object]:
    for chunk in raw.split("\n\n"):
        lines = [line for line in chunk.splitlines() if line]
        if f"event: {event_name}" not in lines:
            continue
        data_line = next(line for line in lines if line.startswith("data: "))
        return json.loads(data_line.removeprefix("data: "))
    raise AssertionError(f"Missing SSE event '{event_name}'. Raw stream: {raw}")


def _upsert_harness_profile(
    client: TestClient,
    headers: dict[str, str],
    *,
    provider_key: str,
    model_id: str,
    auth_scheme: str = "bearer",
    auth_value: str = "acme-secret",
    auth_header: str = "Authorization",
    stream_enabled: bool,
    declared_streaming: bool,
    tool_calling: bool,
    vision: bool = False,
    discovery_enabled: bool = False,
    discovery_support: bool = True,
) -> None:
    response = client.put(
        f"/admin/providers/harness/profiles/{provider_key}",
        headers=headers,
        json={
            "provider_key": provider_key,
            "label": provider_key.replace("_", " ").title(),
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://acme.invalid/v1",
            "auth_scheme": auth_scheme,
            "auth_value": auth_value,
            "auth_header": auth_header,
            "enabled": True,
            "models": [model_id],
            "discovery_enabled": discovery_enabled,
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
            "stream_mapping": {"enabled": stream_enabled},
            "capabilities": {
                "streaming": declared_streaming,
                "tool_calling": tool_calling,
                "vision": vision,
                "discovery_support": discovery_support,
                "model_source": "manual",
            },
        },
    )
    assert response.status_code == 200


class _MockResponse:
    def __init__(self, *, status_code: int, payload: dict[str, object], content_type: str = "application/json"):
        self.status_code = status_code
        self._payload = payload
        self.headers = {"content-type": content_type}
        self.text = json.dumps(payload)

    def json(self) -> dict[str, object]:
        return self._payload


class _MockStreamResponse:
    def __init__(
        self,
        *,
        status_code: int,
        lines: list[str],
        payload: dict[str, object] | None = None,
        content_type: str = "text/event-stream",
    ):
        self.status_code = status_code
        self._lines = lines
        self.headers = {"content-type": content_type}
        self.text = json.dumps(payload or {})

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        del exc_type, exc, tb

    def iter_lines(self):
        yield from self._lines


def test_generic_harness_openai_compatible_profile_proves_fidelity(monkeypatch: pytest.MonkeyPatch) -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    provider_key = "acme_openai_profile"
    model_id = "acme-chat-1"
    captured_runtime_headers: dict[str, str] = {}

    def _mock_request(method: str, url: str, headers: dict[str, str] | None = None, json: dict[str, object] | None = None, timeout: int | None = None):
        del method, timeout
        assert url == "https://acme.invalid/v1/chat/completions"
        if headers and not captured_runtime_headers and headers.get("X-ForgeGate-Route") == "/v1/chat/completions":
            captured_runtime_headers.update(headers)
        payload = json or {}
        messages = payload.get("messages", [])
        last_message = messages[-1] if isinstance(messages, list) and messages else {}
        prompt = str(last_message.get("content", ""))

        if prompt == "force-model-miss":
            return _MockResponse(
                status_code=404,
                payload={"error": {"message": "model missing", "type": "not_found"}},
            )

        tool_calls = []
        if payload.get("tools"):
            tool_calls = [
                {
                    "id": "call_1",
                    "type": "function",
                    "function": {"name": "lookup", "arguments": "{\"q\":\"forgegate\"}"},
                }
            ]
        finish_reason = "tool_calls" if tool_calls else "stop"
        content = "" if tool_calls else "acme-non-stream"
        return _MockResponse(
            status_code=200,
            payload={
                "model": payload["model"],
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": content,
                            **({"tool_calls": tool_calls} if tool_calls else {}),
                        },
                        "finish_reason": finish_reason,
                    }
                ],
                "usage": {"prompt_tokens": 5, "completion_tokens": 2, "total_tokens": 7},
            },
        )

    def _mock_stream(method: str, url: str, headers: dict[str, str] | None = None, json: dict[str, object] | None = None, timeout: int | None = None):
        del method, headers, timeout
        assert url == "https://acme.invalid/v1/chat/completions"
        payload = json or {}
        messages = payload.get("messages", [])
        last_message = messages[-1] if isinstance(messages, list) and messages else {}
        prompt = str(last_message.get("content", ""))

        if prompt == "force-stream-miss":
            return _MockStreamResponse(
                status_code=404,
                lines=[],
                payload={"error": {"message": "stream model missing", "type": "not_found"}},
                content_type="application/json",
            )

        if payload.get("tools"):
            return _MockStreamResponse(
                status_code=200,
                lines=[
                    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"lookup","arguments":"{\\"q\\":"}}]},"finish_reason":null}]}',
                    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"forgegate\\"}"}}]},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}',
                    "data: [DONE]",
                ],
            )

        return _MockStreamResponse(
            status_code=200,
            lines=[
                'data: {"choices":[{"delta":{"content":"acme-"},"finish_reason":null}]}',
                'data: {"choices":[{"delta":{"content":"stream"},"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":3,"total_tokens":7}}',
                "data: [DONE]",
            ],
        )

    monkeypatch.setattr("app.harness.service.httpx.request", _mock_request)
    monkeypatch.setattr("app.harness.service.httpx.stream", _mock_stream)

    create_profile = client.put(
        f"/admin/providers/harness/profiles/{provider_key}",
        headers=headers,
        json={
            "provider_key": provider_key,
            "label": "Acme OpenAI",
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
            "stream_mapping": {"enabled": True},
            "capabilities": {
                "streaming": True,
                "tool_calling": True,
                "discovery_support": True,
                "model_source": "manual",
            },
        },
    )
    assert create_profile.status_code == 200

    sync_response = client.post("/admin/providers/sync", headers=headers, json={"provider": "generic_harness"})
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    preview_response = client.post(
        "/admin/providers/harness/preview",
        headers=headers,
        json={
            "provider_key": provider_key,
            "model": model_id,
            "message": "preview me",
            "stream": False,
            "tools": [{"type": "function", "function": {"name": "lookup", "parameters": {"type": "object"}}}],
            "tool_choice": {"type": "function", "function": {"name": "lookup"}},
        },
    )
    assert preview_response.status_code == 200
    preview_payload = preview_response.json()["preview"]
    assert preview_payload["headers"]["Authorization"] == "***redacted***"
    assert preview_payload["json"]["tools"][0]["function"]["name"] == "lookup"
    assert preview_payload["json"]["tool_choice"]["function"]["name"] == "lookup"

    verify_response = client.post(
        "/admin/providers/harness/verify",
        headers=headers,
        json={"provider_key": provider_key, "model": model_id, "include_preview": True, "live_probe": False},
    )
    assert verify_response.status_code == 200
    verify_steps = {
        step["step"]: step
        for step in verify_response.json()["verification"]["steps"]
    }
    assert verify_steps["tool_calling_support"]["support"] == "supported"
    assert verify_steps["stream_readiness"]["status"] == "ok"

    probe_response = client.post(
        "/admin/providers/harness/probe",
        headers=headers,
        json={
            "provider_key": provider_key,
            "model": model_id,
            "message": "probe me",
            "stream": False,
            "tools": [{"type": "function", "function": {"name": "lookup", "parameters": {"type": "object"}}}],
        },
    )
    assert probe_response.status_code == 200
    probe_payload = probe_response.json()
    assert probe_payload["status_code"] == 200
    assert probe_payload["parsed"]["tool_calls"][0]["function"]["name"] == "lookup"

    chat_response = client.post(
        "/v1/chat/completions",
        headers={
            "X-Request-Id": "req_generic_harness_headers_1",
            "X-ForgeGate-Correlation-Id": "corr_generic_harness_headers_1",
            "X-ForgeGate-Trace-Id": "trace_generic_harness_headers_1",
            "X-ForgeGate-Span-Id": "span_generic_harness_headers_1",
        },
        json={
            "model": model_id,
            "messages": [{"role": "user", "content": "use a tool"}],
            "tools": [{"type": "function", "function": {"name": "lookup", "parameters": {"type": "object"}}}],
        },
    )
    assert chat_response.status_code == 200
    chat_payload = chat_response.json()
    assert chat_payload["choices"][0]["finish_reason"] == "tool_calls"
    assert chat_payload["choices"][0]["message"]["tool_calls"][0]["function"]["name"] == "lookup"
    assert "provider" not in chat_payload
    assert "credential_type" not in chat_payload
    assert "auth_source" not in chat_payload
    assert captured_runtime_headers["X-ForgeGate-Request-Id"] == "req_generic_harness_headers_1"
    assert captured_runtime_headers["X-ForgeGate-Correlation-Id"] == "corr_generic_harness_headers_1"
    assert captured_runtime_headers["X-ForgeGate-Trace-Id"] == "trace_generic_harness_headers_1"
    assert captured_runtime_headers["X-ForgeGate-Span-Id"] == "span_generic_harness_headers_1"
    assert captured_runtime_headers["X-ForgeGate-Route"] == "/v1/chat/completions"

    responses_response = client.post(
        "/v1/responses",
        json={
            "model": model_id,
            "input": "respond with tool",
            "tools": [{"type": "function", "function": {"name": "lookup", "parameters": {"type": "object"}}}],
        },
    )
    assert responses_response.status_code == 200
    responses_output = responses_response.json()["output"]
    assert responses_output == [
        {
            "type": "tool_call",
            "tool_call": {
                "id": "call_1",
                "type": "function",
                "function": {"name": "lookup", "arguments": "{\"q\":\"forgegate\"}"},
            },
        }
    ]

    with client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "model": model_id,
            "messages": [{"role": "user", "content": "stream a tool"}],
            "stream": True,
            "tools": [{"type": "function", "function": {"name": "lookup", "parameters": {"type": "object"}}}],
        },
    ) as response:
        assert response.status_code == 200
        raw_chat_stream = "".join(response.iter_text())
    assert '"tool_calls"' in raw_chat_stream
    assert '"finish_reason": "tool_calls"' in raw_chat_stream

    with client.stream(
        "POST",
        "/v1/responses",
        json={
            "model": model_id,
            "input": "stream a tool",
            "stream": True,
            "tools": [{"type": "function", "function": {"name": "lookup", "parameters": {"type": "object"}}}],
        },
    ) as response:
        assert response.status_code == 200
        raw_responses_stream = "".join(response.iter_text())
    completed_payload = _sse_payload(raw_responses_stream, "response.completed")
    assert completed_payload["output"] == responses_output
    assert completed_payload["output_text"] == ""

    normalized_error = client.post(
        "/v1/chat/completions",
        json={
            "model": model_id,
            "messages": [{"role": "user", "content": "force-model-miss"}],
        },
    )
    assert normalized_error.status_code == 404
    assert normalized_error.json()["error"]["type"] == "provider_model_not_found"
    assert "provider" not in normalized_error.json()["error"]

    with client.stream(
        "POST",
        "/v1/responses",
        json={
            "model": model_id,
            "input": "force-stream-miss",
            "stream": True,
        },
    ) as response:
        assert response.status_code == 200
        raw_error_stream = "".join(response.iter_text())
    error_payload = _sse_payload(raw_error_stream, "response.error")
    assert error_payload["error"]["type"] == "provider_model_not_found"
    assert "provider" not in error_payload["error"]

    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    truth_axes = providers_response.json()["truth_axes"]
    generic_truth = next(item for item in truth_axes if item["provider"]["provider"] == "generic_harness")
    assert generic_truth["harness"]["proof_status"] == "proven"
    assert provider_key in generic_truth["harness"]["proven_profile_keys"]
    assert generic_truth["ui"]["harness_proof_status"] == "proven"
    assert provider_key in generic_truth["ui"]["harness_proven_profile_keys"]

    matrix_response = client.get("/admin/providers/compatibility-matrix", headers=headers)
    assert matrix_response.status_code == 200
    generic_matrix_row = next(item for item in matrix_response.json()["matrix"] if item["provider"] == "generic_harness")
    assert generic_matrix_row["proof_status"] == "proven"
    assert provider_key in generic_matrix_row["proven_profile_keys"]
    assert provider_key in generic_matrix_row["notes"]

    beta_targets = client.get("/admin/providers/beta-targets", headers=headers).json()["targets"]
    generic_beta_row = next(item for item in beta_targets if item["provider_key"] == "openai_compatible_generic")
    assert generic_beta_row["runtime_readiness"] == "partial"
    assert generic_beta_row["streaming_readiness"] == "partial"


def test_generic_harness_truth_surfaces_stay_planned_when_enabled_profile_owns_no_models() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    create_profile = client.put(
        "/admin/providers/harness/profiles/empty_runtime_profile",
        headers=headers,
        json={
            "provider_key": "empty_runtime_profile",
            "label": "Empty Runtime Profile",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://acme.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "acme-secret",
            "enabled": True,
            "models": [],
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
            "stream_mapping": {"enabled": True},
            "capabilities": {
                "streaming": True,
                "tool_calling": True,
                "discovery_support": True,
                "model_source": "manual",
            },
        },
    )
    assert create_profile.status_code == 200

    sync_response = client.post("/admin/providers/sync", headers=headers, json={"provider": "generic_harness"})
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    payload = providers_response.json()
    generic_truth = next(item["runtime"] for item in payload["truth_axes"] if item["provider"]["provider"] == "generic_harness")
    generic_ui = next(item for item in payload["providers"] if item["provider"] == "generic_harness")

    assert generic_truth["wired"] is True
    assert generic_truth["ready"] is False
    assert generic_truth["readiness_reason"] == "Harness profiles exist, but no enabled profile owns any models."
    assert generic_truth["runtime_readiness"] == "planned"
    assert generic_truth["streaming_readiness"] == "planned"
    assert generic_truth["provider_axis"] == "openai_compatible_provider"
    assert generic_truth["auth_mechanism"] == "bearer"
    assert generic_truth["capabilities"]["auth_mechanisms"] == ["bearer"]
    assert generic_truth["capabilities"]["active_profile_count"] == 1
    assert generic_ui["auth_mechanism"] == "bearer"
    assert generic_ui["capabilities"]["auth_mechanisms"] == ["bearer"]
    assert generic_ui["capabilities"]["active_profile_count"] == 1

    matrix_response = client.get("/admin/providers/compatibility-matrix", headers=headers)
    assert matrix_response.status_code == 200
    generic_row = next(item for item in matrix_response.json()["matrix"] if item["provider"] == "generic_harness")
    assert generic_row["ready"] is False
    assert generic_row["runtime_readiness"] == "planned"
    assert generic_row["streaming_readiness"] == "planned"
    assert generic_row["provider_axis"] == "openai_compatible_provider"
    assert generic_row["notes"] == "Harness profiles exist, but no enabled profile owns any models."

    beta_targets = client.get("/admin/providers/beta-targets", headers=headers).json()["targets"]
    generic_beta_row = next(item for item in beta_targets if item["provider_key"] == "openai_compatible_generic")
    assert generic_beta_row["readiness"] == "planned"
    assert generic_beta_row["runtime_readiness"] == "planned"
    assert generic_beta_row["streaming_readiness"] == "planned"
    assert "no enabled profile currently owns a runtime model" in generic_beta_row["status_summary"]


def test_generic_harness_matrix_keeps_current_reason_when_historical_proof_profile_is_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    proven_profile_key = "proven_disabled"
    proven_model_id = "proven-disabled-model"

    def _mock_request(method: str, url: str, headers: dict[str, str] | None = None, json: dict[str, object] | None = None, timeout: int | None = None):
        del method, headers, timeout
        assert url == "https://acme.invalid/v1/chat/completions"
        payload = json or {}
        return _MockResponse(
            status_code=200,
            payload={
                "model": str(payload.get("model", proven_model_id)),
                "choices": [{"message": {"role": "assistant", "content": "historical-proof"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 5, "completion_tokens": 2, "total_tokens": 7},
            },
        )

    def _mock_stream(method: str, url: str, headers: dict[str, str] | None = None, json: dict[str, object] | None = None, timeout: int | None = None):
        del method, headers, json, timeout
        assert url == "https://acme.invalid/v1/chat/completions"
        return _MockStreamResponse(
            status_code=200,
            lines=[
                'data: {"choices":[{"delta":{"content":"historical-"},"finish_reason":null}]}',
                'data: {"choices":[{"delta":{"content":"stream"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}',
                "data: [DONE]",
            ],
        )

    monkeypatch.setattr("app.harness.service.httpx.request", _mock_request)
    monkeypatch.setattr("app.harness.service.httpx.stream", _mock_stream)

    _upsert_harness_profile(
        client,
        headers,
        provider_key=proven_profile_key,
        model_id=proven_model_id,
        stream_enabled=True,
        declared_streaming=True,
        tool_calling=False,
    )

    sync_response = client.post("/admin/providers/sync", headers=headers, json={"provider": "generic_harness"})
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    preview_response = client.post(
        "/admin/providers/harness/preview",
        headers=headers,
        json={"provider_key": proven_profile_key, "model": proven_model_id, "message": "preview me", "stream": False},
    )
    assert preview_response.status_code == 200

    verify_response = client.post(
        "/admin/providers/harness/verify",
        headers=headers,
        json={"provider_key": proven_profile_key, "model": proven_model_id, "include_preview": True, "live_probe": False},
    )
    assert verify_response.status_code == 200

    probe_response = client.post(
        "/admin/providers/harness/probe",
        headers=headers,
        json={"provider_key": proven_profile_key, "model": proven_model_id, "message": "probe me", "stream": False},
    )
    assert probe_response.status_code == 200

    chat_response = client.post(
        "/v1/chat/completions",
        json={"model": proven_model_id, "messages": [{"role": "user", "content": "record runtime proof"}]},
    )
    assert chat_response.status_code == 200

    with client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "model": proven_model_id,
            "messages": [{"role": "user", "content": "record stream proof"}],
            "stream": True,
        },
    ) as response:
        assert response.status_code == 200
        assert "historical-" in "".join(response.iter_text())

    deactivate_response = client.post(f"/admin/providers/harness/profiles/{proven_profile_key}/deactivate", headers=headers)
    assert deactivate_response.status_code == 200

    empty_profile_response = client.put(
        "/admin/providers/harness/profiles/empty_runtime_profile",
        headers=headers,
        json={
            "provider_key": "empty_runtime_profile",
            "label": "Empty Runtime Profile",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://acme.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "acme-secret",
            "enabled": True,
            "models": [],
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
            "stream_mapping": {"enabled": True},
            "capabilities": {
                "streaming": True,
                "tool_calling": True,
                "discovery_support": True,
                "model_source": "manual",
            },
        },
    )
    assert empty_profile_response.status_code == 200

    sync_response = client.post("/admin/providers/sync", headers=headers, json={"provider": "generic_harness"})
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    payload = providers_response.json()
    generic_truth = next(item for item in payload["truth_axes"] if item["provider"]["provider"] == "generic_harness")

    assert generic_truth["runtime"]["readiness_reason"] == "Harness profiles exist, but no enabled profile owns any models."
    assert generic_truth["harness"]["proof_status"] == "proven"
    assert proven_profile_key in generic_truth["harness"]["proven_profile_keys"]

    matrix_response = client.get("/admin/providers/compatibility-matrix", headers=headers)
    assert matrix_response.status_code == 200
    generic_row = next(item for item in matrix_response.json()["matrix"] if item["provider"] == "generic_harness")
    assert generic_row["proof_status"] == "proven"
    assert proven_profile_key in generic_row["proven_profile_keys"]
    assert generic_row["notes"] == "Harness profiles exist, but no enabled profile owns any models."

    beta_targets = client.get("/admin/providers/beta-targets", headers=headers).json()["targets"]
    generic_beta_row = next(item for item in beta_targets if item["provider_key"] == "openai_compatible_generic")
    assert generic_beta_row["readiness"] == "planned"
    assert "no enabled profile currently owns a runtime model" in generic_beta_row["status_summary"]


def test_generic_harness_runtime_preserves_multiturn_multimodal_chat_sequence(monkeypatch: pytest.MonkeyPatch) -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    provider_key = "chat_sequence_profile"
    model_id = "chat-sequence-model"
    expected_messages = [
        {"role": "system", "content": "Stay terse."},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Call the calculator."},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://example.invalid/runtime-proof.png",
                        "detail": "high",
                    },
                },
            ],
        },
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": "call_1",
                    "type": "function",
                    "function": {"name": "calculator", "arguments": "{\"expression\":\"6*7\"}"},
                }
            ],
        },
        {"role": "tool", "tool_call_id": "call_1", "content": "42"},
        {"role": "user", "content": "Explain the result."},
    ]
    captured_non_stream_messages: list[dict[str, object]] | None = None
    captured_stream_messages: list[dict[str, object]] | None = None

    def _mock_request(method: str, url: str, headers: dict[str, str] | None = None, json: dict[str, object] | None = None, timeout: int | None = None):
        del method, headers, timeout
        nonlocal captured_non_stream_messages
        assert url == "https://acme.invalid/v1/chat/completions"
        captured_non_stream_messages = json.get("messages") if isinstance(json, dict) else None
        return _MockResponse(
            status_code=200,
            payload={
                "model": model_id,
                "choices": [{"message": {"role": "assistant", "content": "sequence-ok"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 9, "completion_tokens": 2, "total_tokens": 11},
            },
        )

    def _mock_stream(method: str, url: str, headers: dict[str, str] | None = None, json: dict[str, object] | None = None, timeout: int | None = None):
        del method, headers, timeout
        nonlocal captured_stream_messages
        assert url == "https://acme.invalid/v1/chat/completions"
        captured_stream_messages = json.get("messages") if isinstance(json, dict) else None
        return _MockStreamResponse(
            status_code=200,
            lines=[
                'data: {"choices":[{"delta":{"content":"sequence-"},"finish_reason":null}]}',
                'data: {"choices":[{"delta":{"content":"stream"},"finish_reason":"stop"}],"usage":{"prompt_tokens":9,"completion_tokens":3,"total_tokens":12}}',
                "data: [DONE]",
            ],
        )

    monkeypatch.setattr("app.harness.service.httpx.request", _mock_request)
    monkeypatch.setattr("app.harness.service.httpx.stream", _mock_stream)

    _upsert_harness_profile(
        client,
        headers,
        provider_key=provider_key,
        model_id=model_id,
        stream_enabled=True,
        declared_streaming=True,
        tool_calling=True,
    )

    sync_response = client.post("/admin/providers/sync", headers=headers, json={"provider": "generic_harness"})
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    chat_response = client.post(
        "/v1/chat/completions",
        json={"model": model_id, "messages": expected_messages},
    )
    assert chat_response.status_code == 200
    assert chat_response.json()["choices"][0]["message"]["content"] == "sequence-ok"
    assert captured_non_stream_messages == expected_messages
    assert captured_non_stream_messages[1]["content"][1]["image_url"]["url"] == "https://example.invalid/runtime-proof.png"

    with client.stream(
        "POST",
        "/v1/chat/completions",
        json={"model": model_id, "messages": expected_messages, "stream": True},
    ) as response:
        assert response.status_code == 200
        raw_stream = "".join(response.iter_text())

    assert "sequence-" in raw_stream
    assert "stream" in raw_stream
    assert captured_stream_messages == expected_messages
    assert captured_stream_messages[1]["content"][1]["image_url"]["detail"] == "high"


def test_generic_harness_admin_truth_reports_single_profile_auth_scheme() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    _upsert_harness_profile(
        client,
        headers,
        provider_key="no_auth_needed",
        model_id="no-auth-model",
        auth_scheme="none",
        auth_value="",
        stream_enabled=False,
        declared_streaming=False,
        tool_calling=False,
    )

    sync_response = client.post("/admin/providers/sync", headers=headers, json={"provider": "generic_harness"})
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    payload = providers_response.json()
    generic_truth = next(item["runtime"] for item in payload["truth_axes"] if item["provider"]["provider"] == "generic_harness")
    generic_ui = next(item for item in payload["providers"] if item["provider"] == "generic_harness")

    assert generic_truth["auth_mechanism"] == "none"
    assert generic_truth["capabilities"]["auth_mechanisms"] == ["none"]
    assert generic_ui["auth_mechanism"] == "none"


def test_generic_harness_admin_truth_demotes_zero_support_profiles() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    _upsert_harness_profile(
        client,
        headers,
        provider_key="batch_only",
        model_id="batch-only-model",
        stream_enabled=True,
        declared_streaming=False,
        tool_calling=False,
    )

    sync_response = client.post("/admin/providers/sync", headers=headers, json={"provider": "generic_harness"})
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    payload = providers_response.json()
    generic_truth = next(item["runtime"] for item in payload["truth_axes"] if item["provider"]["provider"] == "generic_harness")
    generic_ui = next(item for item in payload["providers"] if item["provider"] == "generic_harness")

    assert generic_truth["discovery_supported"] is False
    assert generic_truth["capabilities"]["discovery_support"] is False
    assert generic_truth["capabilities"]["streaming"] is False
    assert generic_truth["capabilities"]["streaming_level"] == "none"
    assert generic_truth["tool_calling_level"] == "none"
    assert generic_truth["streaming_readiness"] == "planned"
    assert generic_ui["discovery_supported"] is False
    assert generic_ui["tool_calling_level"] == "none"
    assert generic_ui["streaming_readiness"] == "planned"

    matrix_response = client.get("/admin/providers/compatibility-matrix", headers=headers)
    assert matrix_response.status_code == 200
    generic_row = next(item for item in matrix_response.json()["matrix"] if item["provider"] == "generic_harness")
    assert generic_row["discovery"] == "none"
    assert generic_row["streaming"] == "none"
    assert generic_row["tool_calling"] == "none"
    assert generic_row["streaming_readiness"] == "planned"


def test_generic_harness_admin_truth_demotes_declared_discovery_without_profile_capability() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    _upsert_harness_profile(
        client,
        headers,
        provider_key="discovery_declared_off",
        model_id="catalog-model",
        auth_scheme="none",
        auth_value="",
        stream_enabled=False,
        declared_streaming=False,
        tool_calling=False,
        discovery_enabled=True,
        discovery_support=False,
    )

    sync_response = client.post("/admin/providers/sync", headers=headers, json={"provider": "generic_harness"})
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    payload = providers_response.json()
    generic_truth = next(item["runtime"] for item in payload["truth_axes"] if item["provider"]["provider"] == "generic_harness")
    generic_ui = next(item for item in payload["providers"] if item["provider"] == "generic_harness")

    assert generic_truth["discovery_supported"] is False
    assert generic_truth["capabilities"]["discovery_support"] is False
    assert generic_ui["discovery_supported"] is False

    matrix_response = client.get("/admin/providers/compatibility-matrix", headers=headers)
    assert matrix_response.status_code == 200
    generic_row = next(item for item in matrix_response.json()["matrix"] if item["provider"] == "generic_harness")
    assert generic_row["discovery"] == "none"


def test_generic_harness_admin_truth_reports_profile_driven_vision_support() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    _upsert_harness_profile(
        client,
        headers,
        provider_key="vision_enabled",
        model_id="vision-model",
        auth_scheme="none",
        auth_value="",
        stream_enabled=False,
        declared_streaming=False,
        tool_calling=False,
        vision=True,
    )

    sync_response = client.post("/admin/providers/sync", headers=headers, json={"provider": "generic_harness"})
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    payload = providers_response.json()
    generic_truth = next(item["runtime"] for item in payload["truth_axes"] if item["provider"]["provider"] == "generic_harness")
    generic_ui = next(item for item in payload["providers"] if item["provider"] == "generic_harness")

    assert generic_truth["capabilities"]["vision"] is True
    assert generic_truth["capabilities"]["vision_level"] == "partial"
    assert generic_truth["capabilities"]["vision_profile_count"] == 1
    assert generic_ui["capabilities"]["vision"] is True

    matrix_response = client.get("/admin/providers/compatibility-matrix", headers=headers)
    assert matrix_response.status_code == 200
    generic_row = next(item for item in matrix_response.json()["matrix"] if item["provider"] == "generic_harness")
    assert generic_row["vision"] == "partial"


def test_generic_harness_admin_truth_keeps_partial_support_for_mixed_profiles() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    _upsert_harness_profile(
        client,
        headers,
        provider_key="stream_tool",
        model_id="stream-tool-model",
        auth_scheme="none",
        auth_value="",
        stream_enabled=True,
        declared_streaming=True,
        tool_calling=True,
    )
    _upsert_harness_profile(
        client,
        headers,
        provider_key="batch_only",
        model_id="batch-only-model",
        auth_scheme="api_key_header",
        auth_value="batch-key",
        auth_header="X-API-Key",
        stream_enabled=False,
        declared_streaming=False,
        tool_calling=False,
    )

    sync_response = client.post("/admin/providers/sync", headers=headers, json={"provider": "generic_harness"})
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    payload = providers_response.json()
    generic_truth = next(item["runtime"] for item in payload["truth_axes"] if item["provider"]["provider"] == "generic_harness")
    generic_ui = next(item for item in payload["providers"] if item["provider"] == "generic_harness")

    assert generic_truth["auth_mechanism"] == "mixed"
    assert generic_truth["capabilities"]["auth_mechanisms"] == ["api_key_header", "none"]
    assert generic_truth["capabilities"]["streaming"] is True
    assert generic_truth["capabilities"]["streaming_level"] == "partial"
    assert generic_truth["tool_calling_level"] == "partial"
    assert generic_truth["streaming_readiness"] == "partial"
    assert generic_ui["auth_mechanism"] == "mixed"
    assert generic_ui["tool_calling_level"] == "partial"
    assert generic_ui["streaming_readiness"] == "partial"

    matrix_response = client.get("/admin/providers/compatibility-matrix", headers=headers)
    assert matrix_response.status_code == 200
    generic_row = next(item for item in matrix_response.json()["matrix"] if item["provider"] == "generic_harness")
    assert generic_row["streaming"] == "partial"
    assert generic_row["tool_calling"] == "partial"
    assert generic_row["streaming_readiness"] == "partial"


def test_generic_harness_compatibility_matrix_demotes_mixed_proven_and_model_less_profiles(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    proven_profile_key = "proven_runtime_profile"
    proven_model_id = "proven-runtime-model"

    def _mock_request(
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        json: dict[str, object] | None = None,
        timeout: int | None = None,
    ):
        del method, headers, timeout
        assert url == "https://acme.invalid/v1/chat/completions"
        payload = json or {}
        return _MockResponse(
            status_code=200,
            payload={
                "model": payload["model"],
                "choices": [{"message": {"role": "assistant", "content": "ok"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 4, "completion_tokens": 2, "total_tokens": 6},
            },
        )

    def _mock_stream(
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        json: dict[str, object] | None = None,
        timeout: int | None = None,
    ):
        del method, headers, json, timeout
        assert url == "https://acme.invalid/v1/chat/completions"
        return _MockStreamResponse(
            status_code=200,
            lines=[
                'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":null}]}',
                'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":2,"total_tokens":6}}',
                "data: [DONE]",
            ],
        )

    monkeypatch.setattr("app.harness.service.httpx.request", _mock_request)
    monkeypatch.setattr("app.harness.service.httpx.stream", _mock_stream)

    _upsert_harness_profile(
        client,
        headers,
        provider_key=proven_profile_key,
        model_id=proven_model_id,
        stream_enabled=True,
        declared_streaming=True,
        tool_calling=True,
    )

    sync_response = client.post("/admin/providers/sync", headers=headers, json={"provider": "generic_harness"})
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    preview_response = client.post(
        "/admin/providers/harness/preview",
        headers=headers,
        json={"provider_key": proven_profile_key, "model": proven_model_id, "message": "preview me", "stream": False},
    )
    assert preview_response.status_code == 200

    verify_response = client.post(
        "/admin/providers/harness/verify",
        headers=headers,
        json={"provider_key": proven_profile_key, "model": proven_model_id, "include_preview": False, "live_probe": False},
    )
    assert verify_response.status_code == 200

    probe_response = client.post(
        "/admin/providers/harness/probe",
        headers=headers,
        json={"provider_key": proven_profile_key, "model": proven_model_id, "message": "probe me", "stream": False},
    )
    assert probe_response.status_code == 200

    chat_response = client.post(
        "/v1/chat/completions",
        json={"model": proven_model_id, "messages": [{"role": "user", "content": "hello"}]},
    )
    assert chat_response.status_code == 200

    with client.stream(
        "POST",
        "/v1/chat/completions",
        json={"model": proven_model_id, "messages": [{"role": "user", "content": "stream hello"}], "stream": True},
    ) as stream_response:
        assert stream_response.status_code == 200
        assert "[DONE]" in "".join(stream_response.iter_text())

    empty_profile_response = client.put(
        "/admin/providers/harness/profiles/empty_runtime_profile",
        headers=headers,
        json={
            "provider_key": "empty_runtime_profile",
            "label": "Empty Runtime Profile",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://acme.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "acme-secret",
            "enabled": True,
            "models": [],
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
            "stream_mapping": {"enabled": True},
            "capabilities": {
                "streaming": True,
                "tool_calling": True,
                "discovery_support": True,
                "model_source": "manual",
            },
        },
    )
    assert empty_profile_response.status_code == 200

    sync_response = client.post("/admin/providers/sync", headers=headers, json={"provider": "generic_harness"})
    assert sync_response.status_code == 200
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    generic_truth = next(
        item for item in providers_response.json()["truth_axes"] if item["provider"]["provider"] == "generic_harness"
    )
    assert generic_truth["harness"]["proof_status"] == "proven"
    assert proven_profile_key in generic_truth["harness"]["proven_profile_keys"]

    matrix_response = client.get("/admin/providers/compatibility-matrix", headers=headers)
    assert matrix_response.status_code == 200
    generic_row = next(item for item in matrix_response.json()["matrix"] if item["provider"] == "generic_harness")
    assert generic_row["runtime_readiness"] == "partial"
    assert generic_row["proof_status"] == "partial"
    assert proven_profile_key in generic_row["proven_profile_keys"]
    assert proven_profile_key in generic_row["notes"]
    assert "currently own no models" in generic_row["notes"]
