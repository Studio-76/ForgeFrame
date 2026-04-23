import os

from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.governance.service import get_governance_service
from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _issue_runtime_key(client: TestClient, *, scopes: list[str]) -> str:
    headers = _admin_headers(client)
    account_response = client.post("/admin/accounts/", headers=headers, json={"label": "Tenant A"})
    assert account_response.status_code == 201
    account_id = account_response.json()["account"]["account_id"]

    key_response = client.post(
        "/admin/keys/",
        headers=headers,
        json={"label": f"Key {'-'.join(scopes)}", "account_id": account_id, "scopes": scopes},
    )
    assert key_response.status_code == 201
    return key_response.json()["issued"]["token"]


def test_models_route_requires_models_read_scope(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    client = TestClient(app)
    token = _issue_runtime_key(client, scopes=["chat:write"])

    response = client.get("/v1/models", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 403
    error = response.json()["error"]
    assert error["type"] == "forbidden"
    assert error["message"] == "Runtime key is not permitted to access this route."
    assert error["details"] == {}


def test_chat_route_requires_chat_write_scope(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    client = TestClient(app)
    token = _issue_runtime_key(client, scopes=["models:read"])

    response = client.post(
        "/v1/chat/completions",
        headers={"Authorization": f"Bearer {token}"},
        json={"messages": [{"role": "user", "content": "scope test"}]},
    )

    assert response.status_code == 403
    error = response.json()["error"]
    assert error["type"] == "forbidden"
    assert error["message"] == "Runtime key is not permitted to access this route."
    assert error["details"] == {}
    assert error["request_id"] == response.headers["X-ForgeFrame-Request-Id"]
    assert response.headers["X-ForgeFrame-Correlation-Id"] == error["request_id"]


def test_responses_route_accepts_runtime_key_with_responses_scope(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    client = TestClient(app)
    token = _issue_runtime_key(client, scopes=["responses:write"])

    response = client.post(
        "/v1/responses",
        headers={"Authorization": f"Bearer {token}"},
        json={"input": "hello policy layer"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["output"][0]["type"] == "message"
    assert body["output"][0]["content"][0]["type"] == "output_text"


def test_responses_retrieval_route_accepts_runtime_key_with_responses_scope(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    client = TestClient(app)
    token = _issue_runtime_key(client, scopes=["responses:write"])

    create_response = client.post(
        "/v1/responses",
        headers={"Authorization": f"Bearer {token}"},
        json={"input": "hello retrieval policy"},
    )
    assert create_response.status_code == 200
    response_id = create_response.json()["id"]

    fetch_response = client.get(
        f"/v1/responses/{response_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert fetch_response.status_code == 200
    assert fetch_response.json()["id"] == response_id
