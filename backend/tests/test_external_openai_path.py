import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers import ProviderPayloadTooLargeError, ProviderRateLimitError, ProviderStreamEvent
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
    assert body["provider"] == "openai_api"
    assert body["choices"][0]["message"]["content"] == "openai-success"
    assert body["usage"]["total_tokens"] == 15
    assert body["cost"]["actual_cost"] >= 0.0


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
    assert error["provider"] == "openai_api"


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
