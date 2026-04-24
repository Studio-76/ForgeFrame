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


def _issue_runtime_key_record(
    client: TestClient,
    *,
    scopes: list[str],
) -> dict[str, object]:
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
    return key_response.json()["issued"]


def _update_runtime_key_policy(
    client: TestClient,
    *,
    key_id: str,
    allowed_request_paths: list[str],
    default_request_path: str,
    pinned_target_key: str | None = None,
    local_only_policy: str = "require_local_target",
    review_required_conditions: list[str] | None = None,
) -> dict[str, object]:
    response = client.patch(
        f"/admin/keys/{key_id}/request-path-policy",
        headers=_admin_headers(client),
        json={
            "allowed_request_paths": allowed_request_paths,
            "default_request_path": default_request_path,
            "pinned_target_key": pinned_target_key,
            "local_only_policy": local_only_policy,
            "review_required_conditions": review_required_conditions or [],
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["key"]


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


def test_runtime_request_path_blocked_rejects_runtime_execution(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    client = TestClient(app)
    issued = _issue_runtime_key_record(client, scopes=["responses:write"])
    _update_runtime_key_policy(
        client,
        key_id=str(issued["key_id"]),
        allowed_request_paths=["blocked"],
        default_request_path="blocked",
    )

    response = client.post(
        "/v1/responses",
        headers={"Authorization": f"Bearer {issued['token']}"},
        json={"input": "blocked request path"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["type"] == "request_path_blocked"


def test_runtime_request_path_review_required_rejects_runtime_execution(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    client = TestClient(app)
    issued = _issue_runtime_key_record(client, scopes=["responses:write"])
    _update_runtime_key_policy(
        client,
        key_id=str(issued["key_id"]),
        allowed_request_paths=["review_required"],
        default_request_path="review_required",
        review_required_conditions=["operator_approval"],
    )

    response = client.post(
        "/v1/responses",
        headers={"Authorization": f"Bearer {issued['token']}"},
        json={"input": "review required request path"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["type"] == "request_path_review_required"


def test_runtime_local_only_filters_public_inventory_to_local_targets(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    client = TestClient(app)
    issued = _issue_runtime_key_record(client, scopes=["models:read"])
    _update_runtime_key_policy(
        client,
        key_id=str(issued["key_id"]),
        allowed_request_paths=["local_only"],
        default_request_path="local_only",
    )

    response = client.get(
        "/v1/models",
        headers={"Authorization": f"Bearer {issued['token']}"},
    )

    assert response.status_code == 200
    records = response.json()["data"]
    assert records
    assert {item["owned_by"] for item in records} <= {"ForgeFrame", "Ollama"}
    assert {item["id"] for item in records} <= {"forgeframe-baseline-chat-v1", "llama3.2"}


def test_runtime_pinned_target_routes_to_the_configured_target(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    client = TestClient(app)
    issued = _issue_runtime_key_record(client, scopes=["responses:write"])
    targets_response = client.get("/admin/provider-targets/", headers=_admin_headers(client))
    assert targets_response.status_code == 200
    pinned_target_key = next(
        item["target_key"]
        for item in targets_response.json()["targets"]
        if item["provider"] == "forgeframe_baseline"
    )
    _update_runtime_key_policy(
        client,
        key_id=str(issued["key_id"]),
        allowed_request_paths=["pinned_target"],
        default_request_path="pinned_target",
        pinned_target_key=pinned_target_key,
    )

    response = client.post(
        "/v1/responses",
        headers={"Authorization": f"Bearer {issued['token']}"},
        json={"input": "pinned target request"},
    )

    assert response.status_code == 200
    assert response.headers["X-ForgeFrame-Routing-Target"] == pinned_target_key
    assert response.headers["X-ForgeFrame-Request-Path"] == "pinned_target"


def test_runtime_queue_background_forces_background_responses(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    client = TestClient(app)
    issued = _issue_runtime_key_record(client, scopes=["responses:write"])
    _update_runtime_key_policy(
        client,
        key_id=str(issued["key_id"]),
        allowed_request_paths=["queue_background"],
        default_request_path="queue_background",
    )

    response = client.post(
        "/v1/responses",
        headers={"Authorization": f"Bearer {issued['token']}"},
        json={"input": "force background"},
    )

    assert response.status_code == 202
    body = response.json()
    assert body["background"] is True
    assert body["status"] == "queued"
    assert response.headers["X-ForgeFrame-Request-Path"] == "queue_background"
