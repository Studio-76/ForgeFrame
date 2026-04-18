import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers import ProviderStreamEvent
from app.providers.openai_api.adapter import OpenAIAPIAdapter


client = TestClient(app)


@pytest.fixture
def mock_openai_success(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        return {
            "model": payload["model"],
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

    def _fake_stream(self, payload: dict):
        yield ProviderStreamEvent(event="delta", delta="openai-")
        yield ProviderStreamEvent(event="delta", delta="stream")
        yield ProviderStreamEvent(event="done", finish_reason="stop")

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
    detail = response.json()["detail"]
    assert detail["type"] == "provider_not_ready"
    assert detail["provider"] == "openai_api"
