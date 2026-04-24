import os

from fastapi.testclient import TestClient
import pytest

from conftest import admin_headers as shared_admin_headers
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.authz.evaluator import PolicyEvaluator
from app.governance.service import get_governance_service
from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _issue_unbound_runtime_key(client: TestClient, *, scopes: list[str]) -> dict[str, object]:
    response = client.post(
        "/admin/keys/",
        headers=_admin_headers(client),
        json={"label": f"Unbound {'-'.join(scopes)}", "scopes": scopes},
    )
    assert response.status_code == 201
    return response.json()["issued"]


def test_runtime_rejects_x_api_key_fallback_when_bearer_is_required(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()

    client = TestClient(app)
    issued = _issue_unbound_runtime_key(client, scopes=["models:read"])

    response = client.get(
        "/v1/models",
        headers={"x-api-key": str(issued["token"])},
    )

    assert response.status_code == 401
    error = response.json()["error"]
    assert error["type"] == "missing_bearer"
    assert error["message"] == "Runtime requests must use Authorization: Bearer <api-key>."


def _issue_stale_account_runtime_key(
    client: TestClient,
    *,
    scopes: list[str],
) -> tuple[str, dict[str, object]]:
    headers = _admin_headers(client)
    account_response = client.post(
        "/admin/accounts/",
        headers=headers,
        json={"label": f"Stale {'-'.join(scopes)}"},
    )
    assert account_response.status_code == 201
    account_id = account_response.json()["account"]["account_id"]

    key_response = client.post(
        "/admin/keys/",
        headers=headers,
        json={
            "label": f"Stale {'-'.join(scopes)}",
            "account_id": account_id,
            "scopes": scopes,
        },
    )
    assert key_response.status_code == 201

    governance = get_governance_service()
    governance._state.gateway_accounts = [  # type: ignore[attr-defined]
        account
        for account in governance._state.gateway_accounts  # type: ignore[attr-defined]
        if account.account_id != account_id
    ]
    governance._persist()  # type: ignore[attr-defined]
    return account_id, key_response.json()["issued"]


@pytest.mark.parametrize(
    ("method", "path", "payload", "scopes"),
    [
        ("GET", "/v1/models", None, ["models:read"]),
        ("GET", "/v1/responses/resp_boundary", None, ["responses:write"]),
        ("GET", "/v1/responses/resp_boundary/input_items", None, ["responses:write"]),
        (
            "POST",
            "/v1/chat/completions",
            {"messages": [{"role": "user", "content": "boundary check"}]},
            ["chat:write"],
        ),
        ("POST", "/v1/responses", {"input": "boundary check"}, ["responses:write"]),
    ],
)
def test_unbound_runtime_keys_are_rejected_before_policy_evaluation(
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
    payload: dict[str, object] | None,
    scopes: list[str],
) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()

    client = TestClient(app)
    issued = _issue_unbound_runtime_key(client, scopes=scopes)

    def _fail_authorize(self, *, actor, policy, target):  # type: ignore[no-untyped-def]
        raise AssertionError("Policy evaluation must not run for an unbound runtime key.")

    monkeypatch.setattr(PolicyEvaluator, "authorize", _fail_authorize)

    response = client.request(
        method,
        path,
        headers={"Authorization": f"Bearer {issued['token']}"},
        json=payload,
    )

    assert response.status_code == 403
    error = response.json()["error"]
    assert error["type"] == "runtime_key_unbound"
    assert error["message"] == "Runtime key must be bound to a gateway account before it can access runtime APIs."
    assert error["details"] == {}
    assert error["request_id"] == response.headers["X-ForgeFrame-Request-Id"]
    assert response.headers["X-ForgeFrame-Correlation-Id"] == error["request_id"]

    governance = get_governance_service()
    denial = next(
        item
        for item in reversed(governance.list_audit_events(limit=50))
        if item.action == "runtime_key_binding_denied" and item.actor_id == issued["key_id"]
    )
    assert denial.target_id == issued["key_id"]
    assert denial.metadata["runtime_key_id"] == issued["key_id"]
    assert denial.metadata["binding_state"] == "missing_account_id"
    assert denial.metadata["account_id"] is None


@pytest.mark.parametrize(
    ("method", "path", "payload", "scopes"),
    [
        ("GET", "/v1/models", None, ["models:read"]),
        ("GET", "/v1/responses/resp_boundary", None, ["responses:write"]),
        ("GET", "/v1/responses/resp_boundary/input_items", None, ["responses:write"]),
        (
            "POST",
            "/v1/chat/completions",
            {"messages": [{"role": "user", "content": "stale boundary check"}]},
            ["chat:write"],
        ),
        ("POST", "/v1/responses", {"input": "stale boundary check"}, ["responses:write"]),
    ],
)
def test_stale_account_runtime_keys_are_rejected_before_policy_evaluation(
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
    payload: dict[str, object] | None,
    scopes: list[str],
) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()

    client = TestClient(app)
    account_id, issued = _issue_stale_account_runtime_key(client, scopes=scopes)

    def _fail_authorize(self, *, actor, policy, target):  # type: ignore[no-untyped-def]
        raise AssertionError("Policy evaluation must not run for a stale-account runtime key.")

    monkeypatch.setattr(PolicyEvaluator, "authorize", _fail_authorize)

    response = client.request(
        method,
        path,
        headers={"Authorization": f"Bearer {issued['token']}"},
        json=payload,
    )

    assert response.status_code == 403
    error = response.json()["error"]
    assert error["type"] == "runtime_key_unbound"
    assert error["message"] == "Runtime key must be bound to a gateway account before it can access runtime APIs."
    assert error["details"] == {}
    assert error["request_id"] == response.headers["X-ForgeFrame-Request-Id"]
    assert response.headers["X-ForgeFrame-Correlation-Id"] == error["request_id"]

    governance = get_governance_service()
    denial = next(
        item
        for item in reversed(governance.list_audit_events(limit=50))
        if item.action == "runtime_key_binding_denied" and item.actor_id == issued["key_id"]
    )
    assert denial.target_id == issued["key_id"]
    assert denial.metadata["runtime_key_id"] == issued["key_id"]
    assert denial.metadata["binding_state"] == "account_not_found"
    assert denial.metadata["account_id"] == account_id
