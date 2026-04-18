from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_endpoint_has_runtime_metadata() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"


def test_models_endpoint_returns_structured_list() -> None:
    response = client.get("/v1/models")
    assert response.status_code == 200
    body = response.json()
    assert body["object"] == "list"
    assert isinstance(body["data"], list)
    assert len(body["data"]) >= 1
    assert {"id", "provider", "owned_by", "ready"}.issubset(body["data"][0].keys())


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


def test_chat_endpoint_returns_not_implemented_for_openai_codex() -> None:
    response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "gpt-5.3-codex",
        },
    )
    assert response.status_code == 501
    detail = response.json()["detail"]
    assert detail["type"] == "provider_not_implemented"
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
