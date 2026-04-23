import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers import (
    ProviderBadRequestError,
    ProviderModelNotFoundError,
    ProviderPayloadTooLargeError,
    ProviderRateLimitError,
    ProviderStreamEvent,
    ProviderStreamInterruptedError,
)
from app.providers.openai_api.adapter import OpenAIAPIAdapter
from app.usage.models import CostBreakdown, TokenUsage


client = TestClient(app)


@pytest.fixture
def mock_openai_success(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        return {
            "model": payload["model"],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
            "choices": [
                {
                    "message": {"role": "assistant", "content": "openai-success"},
                    "finish_reason": "stop",
                }
            ],
        }

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)


@pytest.fixture
def mock_openai_stream_success(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_stream(self, payload: dict, messages: list[dict]):
        del payload, messages
        yield ProviderStreamEvent(event="delta", delta="openai-")
        yield ProviderStreamEvent(event="delta", delta="stream")
        yield ProviderStreamEvent(
            event="done",
            finish_reason="stop",
            usage=TokenUsage(input_tokens=12, output_tokens=3, total_tokens=15),
            cost=CostBreakdown(actual_cost=0.01, hypothetical_cost=0.01, avoided_cost=0.0, pricing_basis="api_metered"),
        )

    monkeypatch.setattr(OpenAIAPIAdapter, "_stream_chat_completion", _fake_stream)


def test_chat_endpoint_external_openai_success_path(mock_openai_success: None) -> None:
    response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Ping external"}],
            "model": "gpt-4.1-mini",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["choices"][0]["message"]["content"] == "openai-success"
    assert body["usage"]["total_tokens"] == 15
    assert body["cost"]["actual_cost"] >= 0.0
    assert "provider" not in body
    assert "credential_type" not in body
    assert "auth_source" not in body


def test_chat_endpoint_external_openai_stream_success_path(mock_openai_stream_success: None) -> None:
    with client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Ping external stream"}],
            "model": "gpt-4.1-mini",
            "stream": True,
        },
    ) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    assert "openai-" in raw
    assert "stream" in raw
    assert '"usage": {"input_tokens": 12' in raw
    assert "[DONE]" in raw
    assert '"provider"' not in raw
    assert "openai_api" not in raw


def test_chat_endpoint_openai_not_configured_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("FORGEGATE_OPENAI_API_KEY", raising=False)
    response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Ping external"}],
            "model": "gpt-4.1-mini",
        },
    )

    assert response.status_code == 503
    error = response.json()["error"]
    assert error["type"] == "provider_not_ready"
    assert "provider" not in error


def test_chat_endpoint_openai_rate_limit_maps_to_429(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        del payload
        raise ProviderRateLimitError("openai_api", "rate limited")

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)
    response = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "Ping external"}], "model": "gpt-4.1-mini"},
    )
    assert response.status_code == 429
    assert response.json()["error"]["type"] == "provider_rate_limited"


def test_chat_endpoint_openai_rate_limit_emits_retry_envelope_headers(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        del payload
        raise ProviderRateLimitError("openai_api", "rate limited", retry_after_seconds=17)

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)
    response = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "Ping external"}], "model": "gpt-4.1-mini"},
        headers={"X-Request-Id": "req_rate_limit_envelope_1"},
    )

    assert response.status_code == 429
    assert response.headers["Retry-After"] == "17"
    assert response.headers["X-ForgeFrame-Request-Id"] == "req_rate_limit_envelope_1"
    assert response.headers["X-ForgeFrame-Correlation-Id"] == "req_rate_limit_envelope_1"
    assert response.headers["X-ForgeFrame-Causation-Id"] == "req_rate_limit_envelope_1"
    assert response.json()["error"]["retry_after_seconds"] == 17


def test_chat_endpoint_openai_payload_too_large_maps_to_413(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        del payload
        raise ProviderPayloadTooLargeError("openai_api", "payload too large")

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)
    response = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "x" * 10}], "model": "gpt-4.1-mini"},
    )
    assert response.status_code == 413
    assert response.json()["error"]["type"] == "provider_payload_too_large"


def test_chat_endpoint_openai_tool_calls_are_forwarded(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        del payload
        return {
            "model": "gpt-4.1-mini",
            "usage": {"prompt_tokens": 7, "completion_tokens": 4, "total_tokens": 11},
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "",
                        "tool_calls": [{"id": "call_1", "type": "function", "function": {"name": "ping", "arguments": "{}"}}],
                    },
                    "finish_reason": "tool_calls",
                }
            ],
        }

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)
    response = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "Ping external"}], "model": "gpt-4.1-mini"},
    )
    assert response.status_code == 200
    message = response.json()["choices"][0]["message"]
    assert isinstance(message["tool_calls"], list)
    assert message["tool_calls"][0]["function"]["name"] == "ping"


def test_chat_endpoint_openai_model_not_found_maps_to_404(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        del payload
        raise ProviderModelNotFoundError("openai_api", model="gpt-missing")

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)
    response = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "Ping external"}], "model": "gpt-4.1-mini"},
    )
    assert response.status_code == 404
    assert response.json()["error"]["type"] == "provider_model_not_found"


def test_chat_endpoint_sanitizes_upstream_provider_error_message(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        del payload
        raise ProviderBadRequestError(
            "openai_api",
            "OpenAI rejected request (400): upstream-body secret_token=sk-live-123 prompt=tenant-a",
        )

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)
    response = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "sanitize chat"}], "model": "gpt-4.1-mini"},
    )

    assert response.status_code == 400
    error = response.json()["error"]
    assert error["type"] == "provider_bad_request"
    assert error["message"] == "Selected provider rejected the request."
    payload = json.dumps(response.json())
    assert "secret_token" not in payload
    assert "sk-live-123" not in payload
    assert "tenant-a" not in payload
    assert "upstream-body" not in payload


def test_responses_endpoint_sanitizes_upstream_provider_error_message(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        del payload
        raise ProviderBadRequestError(
            "openai_api",
            "OpenAI rejected request (400): upstream-body secret_token=sk-live-456 prompt=tenant-b",
        )

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)
    response = client.post(
        "/v1/responses",
        json={"input": "sanitize responses", "model": "gpt-4.1-mini"},
    )

    assert response.status_code == 400
    error = response.json()["error"]
    assert error["type"] == "provider_bad_request"
    assert error["message"] == "Selected provider rejected the request."
    payload = json.dumps(response.json())
    assert "secret_token" not in payload
    assert "sk-live-456" not in payload
    assert "tenant-b" not in payload
    assert "upstream-body" not in payload


def test_chat_stream_sanitizes_provider_stream_error_message(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_stream(self, payload: dict, messages: list[dict]):
        del payload, messages
        yield ProviderStreamEvent(event="delta", delta="partial")
        raise ProviderStreamInterruptedError(
            "openai_api",
            "Network error while streaming OpenAI API: secret_token=sk-live-789 prompt=tenant-c",
        )

    monkeypatch.setattr(OpenAIAPIAdapter, "_stream_chat_completion", _fake_stream)
    with client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "sanitize stream"}],
            "model": "gpt-4.1-mini",
            "stream": True,
        },
    ) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    assert "Selected provider stream was interrupted." in raw
    assert '"provider"' not in raw
    assert "openai_api" not in raw
    assert "secret_token" not in raw
    assert "sk-live-789" not in raw
    assert "tenant-c" not in raw


def test_responses_stream_sanitizes_provider_stream_error_message(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_stream(self, payload: dict, messages: list[dict]):
        del payload, messages
        yield ProviderStreamEvent(event="delta", delta="partial")
        raise ProviderStreamInterruptedError(
            "openai_api",
            "Network error while streaming OpenAI API: secret_token=sk-live-000 prompt=tenant-d",
        )

    monkeypatch.setattr(OpenAIAPIAdapter, "_stream_chat_completion", _fake_stream)
    with client.stream(
        "POST",
        "/v1/responses",
        json={
            "input": "sanitize responses stream",
            "model": "gpt-4.1-mini",
            "stream": True,
        },
    ) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    assert "Selected provider stream was interrupted." in raw
    assert '"provider"' not in raw
    assert "openai_api" not in raw
    assert "secret_token" not in raw
    assert "sk-live-000" not in raw
    assert "tenant-d" not in raw
