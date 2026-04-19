import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers.openai_api.adapter import OpenAIAPIAdapter


client = TestClient(app)


def test_health_endpoint_has_runtime_metadata() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["phase"] == "phase-5 streaming/codex baseline"


def test_models_endpoint_returns_structured_list() -> None:
    response = client.get("/v1/models")
    assert response.status_code == 200
    body = response.json()
    assert body["object"] == "list"
    assert isinstance(body["data"], list)
    assert len(body["data"]) >= 1
    assert {
        "id",
        "provider",
        "owned_by",
        "ready",
        "capabilities",
        "readiness_reason",
        "source",
        "discovery_status",
    }.issubset(body["data"][0].keys())


def test_chat_endpoint_success_path_uses_baseline_provider_chain() -> None:
    response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello ForgeGate"}],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "forgegate_baseline"
    assert body["model"] == "forgegate-baseline-chat-v1"
    assert "ForgeGate baseline response" in body["choices"][0]["message"]["content"]
    assert body["usage"]["total_tokens"] > 0
    assert body["cost"]["avoided_cost"] >= 0.0


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
    assert "forgegate_baseline" in raw
    assert '"usage": {' in raw
    assert "[DONE]" in raw


def test_chat_endpoint_returns_not_ready_for_openai_codex() -> None:
    response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "gpt-5.3-codex",
        },
    )
    assert response.status_code == 503
    error = response.json()["error"]
    assert error["type"] == "provider_not_ready"
    assert error["provider"] == "openai_codex"


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


def test_chat_endpoint_rejects_tool_calling_for_baseline_provider() -> None:
    response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello"}],
            "tools": [{"type": "function", "function": {"name": "ping", "description": "Ping", "parameters": {"type": "object"}}}],
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["type"] == "provider_unsupported_feature"


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


def test_admin_usage_summary_endpoint_available() -> None:
    response = client.get("/admin/usage/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["object"] == "usage_summary"
    assert "pricing_snapshot" in payload
    assert "aggregations" in payload


def test_admin_oauth_operations_endpoint_available() -> None:
    response = client.get("/admin/providers/oauth-account/operations")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "operations" in payload
    assert "recent" in payload
    assert "total_operations" in payload


def test_provider_control_plane_exposes_oauth_mode() -> None:
    response = client.get("/admin/providers/")
    assert response.status_code == 200
    providers = response.json()["providers"]
    codex = next(item for item in providers if item["provider"] == "openai_codex")
    assert "oauth_mode" in codex


def test_admin_bootstrap_readiness_endpoint_available() -> None:
    response = client.get("/admin/providers/bootstrap/readiness")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "checks" in payload
    assert "next_steps" in payload


def test_harness_runs_endpoint_contains_ops_summary() -> None:
    response = client.get("/admin/providers/harness/runs")
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

    usage_response = client.get("/admin/usage/")
    assert usage_response.status_code == 200
    payload = usage_response.json()
    assert payload["metrics"]["recorded_request_count"] >= 1


def test_responses_endpoint_openai_compatible_baseline() -> None:
    response = client.post(
        "/v1/responses",
        json={"input": "Hello responses"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["object"] == "response"
    assert isinstance(body["output"], list)
    assert body["provider"] == "forgegate_baseline"


def test_responses_endpoint_rejects_stream_mode_for_now() -> None:
    response = client.post("/v1/responses", json={"input": "Hello responses", "stream": True})
    assert response.status_code == 400
    assert response.json()["error"]["type"] == "unsupported_feature"


def test_responses_endpoint_rejects_invalid_temperature() -> None:
    response = client.post("/v1/responses", json={"input": "Hello responses", "temperature": 3})
    assert response.status_code == 400
    assert response.json()["error"]["type"] == "invalid_request"


def test_responses_endpoint_rejects_invalid_input_list_object() -> None:
    response = client.post("/v1/responses", json={"input": [{"type": "text"}]})
    assert response.status_code == 422
    assert response.json()["error"]["type"] == "unsupported_input"


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
    assert any(item.get("type") == "tool_call" for item in output)
    assert not any(item.get("type") == "output_text" and not str(item.get("text", "")).strip() for item in output)
