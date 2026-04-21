from fastapi.testclient import TestClient

from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.governance.service import get_governance_service
from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    response = client.post("/admin/auth/login", json={"username": "admin", "password": "forgegate-admin"})
    assert response.status_code == 201
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_admin_auth_bootstrap_and_login_flow_available() -> None:
    client = TestClient(app)
    bootstrap = client.get("/admin/auth/bootstrap")
    assert bootstrap.status_code == 200
    assert bootstrap.json()["bootstrap"]["bootstrap_username"] == "admin"

    me_headers = _admin_headers(client)
    me = client.get("/admin/auth/me", headers=me_headers)
    assert me.status_code == 200
    assert me.json()["user"]["role"] == "admin"


def test_accounts_and_runtime_keys_can_be_managed() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    create_account = client.post(
        "/admin/accounts/",
        headers=headers,
        json={"label": "Integration Account", "provider_bindings": ["openai_api", "ollama"], "notes": "runtime consumer"},
    )
    assert create_account.status_code == 201
    account_id = create_account.json()["account"]["account_id"]

    create_key = client.post(
        "/admin/keys/",
        headers=headers,
        json={"label": "Integration Key", "account_id": account_id, "scopes": ["models:read", "chat:write"]},
    )
    assert create_key.status_code == 201
    issued = create_key.json()["issued"]
    assert issued["token"].startswith("fgk_")


def test_runtime_key_can_authenticate_models_endpoint_when_runtime_auth_required(monkeypatch) -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    account = client.post("/admin/accounts/", headers=headers, json={"label": "Secured Account"}).json()["account"]
    issued = client.post(
        "/admin/keys/",
        headers=headers,
        json={"label": "Secured Key", "account_id": account["account_id"], "scopes": ["models:read"]},
    ).json()["issued"]

    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    secured_client = TestClient(app)

    unauthorized = secured_client.get("/v1/models")
    assert unauthorized.status_code == 401

    authorized = secured_client.get("/v1/models", headers={"Authorization": f"Bearer {issued['token']}"})
    assert authorized.status_code == 200


def test_settings_and_logs_endpoints_return_structured_payloads() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    settings = client.get("/admin/settings/", headers=headers)
    logs = client.get("/admin/logs/", headers=headers)
    assert settings.status_code == 200
    assert logs.status_code == 200
    assert "settings" in settings.json()
    assert "audit_events" in logs.json()


def test_security_admin_endpoints_manage_users_sessions_and_secret_posture() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    bootstrap = client.get("/admin/security/bootstrap", headers=headers)
    assert bootstrap.status_code == 200
    assert bootstrap.json()["bootstrap"]["admin_user_count"] >= 1

    created = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": "ops",
            "display_name": "Ops User",
            "role": "operator",
            "password": "operator-pass-123",
        },
    )
    assert created.status_code == 201
    user_id = created.json()["user"]["user_id"]

    updated = client.patch(
        f"/admin/security/users/{user_id}",
        headers=headers,
        json={"status": "disabled", "must_rotate_password": True},
    )
    assert updated.status_code == 200
    assert updated.json()["user"]["status"] == "disabled"

    rotated = client.post(
        f"/admin/security/users/{user_id}/rotate-password",
        headers=headers,
        json={"new_password": "operator-pass-456", "must_rotate_password": False},
    )
    assert rotated.status_code == 200

    reenabled = client.patch(
        f"/admin/security/users/{user_id}",
        headers=headers,
        json={"status": "active", "role": "viewer"},
    )
    assert reenabled.status_code == 200
    assert reenabled.json()["user"]["role"] == "viewer"

    viewer_login = client.post("/admin/auth/login", json={"username": "ops", "password": "operator-pass-456"})
    assert viewer_login.status_code == 201
    viewer_token = viewer_login.json()["access_token"]
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

    forbidden = client.get("/admin/security/users", headers=viewer_headers)
    assert forbidden.status_code == 403

    sessions = client.get("/admin/security/sessions", headers=headers)
    assert sessions.status_code == 200
    viewer_session = next(
        item for item in sessions.json()["sessions"] if item["user_id"] == user_id and item["revoked_at"] is None
    )

    revoked = client.post(f"/admin/security/sessions/{viewer_session['session_id']}/revoke", headers=headers)
    assert revoked.status_code == 200
    assert revoked.json()["session"]["revoked_reason"] == "admin_revoked"

    secret_posture = client.get("/admin/security/secret-posture", headers=headers)
    assert secret_posture.status_code == 200
    providers = {item["provider"] for item in secret_posture.json()["providers"]}
    assert {"openai_api", "anthropic", "github_copilot"}.issubset(providers)
