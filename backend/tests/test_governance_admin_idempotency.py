import os

import pytest
from fastapi.testclient import TestClient

from app.approvals.models import build_elevated_access_approval_id
from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    password = os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"]
    response = client.post("/admin/auth/login", json={"username": "admin", "password": password})
    assert response.status_code == 201
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    if response.json()["user"].get("must_rotate_password") is True:
        rotation = client.post(
            "/admin/auth/rotate-password",
            headers=headers,
            json={"current_password": password, "new_password": password},
        )
        assert rotation.status_code == 200
    return headers


def _assert_idempotency_not_supported(
    client: TestClient,
    *,
    method: str,
    path: str,
    json: dict[str, object] | None = None,
    headers: dict[str, str] | None = None,
) -> None:
    request_headers = {"Idempotency-Key": f"idem_boundary_{method}_{path.replace('/', '_')}"}
    if headers is not None:
        request_headers.update(headers)
    response = client.request(method.upper(), path, headers=request_headers, json=json)
    assert response.status_code == 400
    assert response.json()["error"]["type"] == "idempotency_not_supported"
    assert response.headers["Idempotency-Key"] == request_headers["Idempotency-Key"]


def test_admin_auth_mutations_reject_idempotency_key() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    password = os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"]

    _assert_idempotency_not_supported(
        client,
        method="post",
        path="/admin/auth/login",
        json={"username": "admin", "password": password},
    )
    _assert_idempotency_not_supported(
        client,
        method="post",
        path="/admin/auth/logout",
        headers=admin_headers,
    )
    _assert_idempotency_not_supported(
        client,
        method="post",
        path="/admin/auth/rotate-password",
        headers=admin_headers,
        json={"current_password": password, "new_password": password},
    )


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("post", "/admin/accounts/", {"label": "Boundary Account", "provider_bindings": ["openai_api"], "notes": "boundary"}),
        ("patch", "/admin/accounts/account_boundary", {"label": "Boundary Account Updated"}),
        ("post", "/admin/keys/", {"label": "Boundary Key", "account_id": "account_boundary", "scopes": ["models:read"]}),
        ("post", "/admin/keys/key_boundary/rotate", None),
        ("post", "/admin/keys/key_boundary/disable", None),
        ("post", "/admin/keys/key_boundary/activate", None),
        ("post", "/admin/keys/key_boundary/revoke", None),
        ("patch", "/admin/settings/", {"updates": {"default_model": "forgegate-baseline-chat-v1"}}),
        ("delete", "/admin/settings/runtime_auth_required", None),
    ],
)
def test_account_key_and_settings_mutations_reject_idempotency_key(
    method: str,
    path: str,
    payload: dict[str, object] | None,
) -> None:
    client = TestClient(app)
    _assert_idempotency_not_supported(
        client,
        method=method,
        path=path,
        json=payload,
        headers=_admin_headers(client),
    )


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("post", "/admin/security/users", {
            "username": "boundary-user",
            "display_name": "Boundary User",
            "role": "operator",
            "password": "Boundary-User-123",
        }),
        ("patch", "/admin/security/users/user_boundary", {"status": "disabled"}),
        ("post", "/admin/security/users/user_boundary/rotate-password", {"new_password": "Boundary-User-456"}),
        ("post", "/admin/security/sessions/session_boundary/revoke", None),
        ("post", "/admin/security/secret-rotations", {
            "target_type": "provider",
            "target_id": "openai_api",
            "kind": "manual_rotation",
            "reference": "INC-BOUNDARY",
            "notes": "boundary",
        }),
        ("post", "/admin/security/impersonations", {
            "target_user_id": "user_boundary",
            "approval_reference": "INC-BOUNDARY-IMPERSONATION",
            "justification": "Boundary test for idempotency rejection.",
            "notification_targets": ["slack://security-boundary"],
            "duration_minutes": 15,
        }),
        ("post", "/admin/security/break-glass", {
            "approval_reference": "INC-BOUNDARY-BREAKGLASS",
            "justification": "Boundary test for break-glass idempotency rejection.",
            "notification_targets": ["slack://security-boundary"],
            "duration_minutes": 15,
        }),
        ("post", "/admin/security/elevated-access-requests/request_boundary/approve", {
            "decision_note": "Approved for idempotency-boundary test coverage.",
        }),
        ("post", "/admin/security/elevated-access-requests/request_boundary/reject", {
            "decision_note": "Rejected for idempotency-boundary test coverage.",
        }),
        ("post", "/admin/security/elevated-access-requests/request_boundary/cancel", None),
        ("post", "/admin/security/elevated-access-requests/request_boundary/issue", None),
    ],
)
def test_security_mutations_reject_idempotency_key(
    method: str,
    path: str,
    payload: dict[str, object] | None,
) -> None:
    client = TestClient(app)
    _assert_idempotency_not_supported(
        client,
        method=method,
        path=path,
        json=payload,
        headers=_admin_headers(client),
    )


@pytest.mark.parametrize("decision", ["approve", "reject"])
def test_shared_elevated_access_approval_decisions_reject_idempotency_key(decision: str) -> None:
    client = TestClient(app)
    approval_id = build_elevated_access_approval_id("request_boundary")
    _assert_idempotency_not_supported(
        client,
        method="post",
        path=f"/admin/approvals/{approval_id}/{decision}",
        json={"decision_note": "Boundary test coverage for shared approval idempotency handling."},
        headers=_admin_headers(client),
    )
