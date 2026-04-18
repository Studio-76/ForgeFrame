from fastapi.testclient import TestClient

from app.main import app


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
    detail = response.json()["detail"]
    assert detail["type"] == "provider_not_ready"
    assert detail["provider"] == "openai_codex"


def test_chat_endpoint_rejects_unknown_model() -> None:
    response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "unknown-model",
        },
    )
    assert response.status_code == 404
    detail = response.json()["detail"]
    assert detail["type"] == "model_not_found"
