import json
import os
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

from conftest import admin_headers as shared_admin_headers, login_headers_allowing_password_rotation
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.auth.local_auth import hash_password, hash_token, new_secret_salt
from app.governance.models import (
    AdminSessionRecord,
    AdminUserRecord,
    AuditEventRecord,
    AuthenticatedAdmin,
    GatewayAccountRecord,
    GovernanceStateRecord,
    RuntimeKeyRecord,
)
from app.governance.service import GovernanceService, get_governance_service
from app.main import app
from app.settings.config import Settings
from app.storage.governance_repository import PostgresGovernanceRepository
from app.storage.migrator import apply_storage_migrations, list_storage_migrations


def _login_headers(client: TestClient, *, username: str, password: str) -> dict[str, str]:
    return login_headers_allowing_password_rotation(client, username=username, password=password)


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _create_admin_user_and_headers(
    client: TestClient,
    creator_headers: dict[str, str],
    *,
    username: str,
    display_name: str,
    role: str = "admin",
    password: str = "Admin-User-123",
) -> tuple[str, dict[str, str]]:
    created = client.post(
        "/admin/security/users",
        headers=creator_headers,
        json={
            "username": username,
            "display_name": display_name,
            "role": role,
            "password": password,
        },
    )
    assert created.status_code == 201
    return created.json()["user"]["user_id"], _login_headers(client, username=username, password=password)


def _approve_elevated_access_request(
    client: TestClient,
    approver_headers: dict[str, str],
    request_id: str,
    *,
    decision_note: str = "Approved after validating the incident context and target scope.",
) -> dict[str, object]:
    response = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/approve",
        headers=approver_headers,
        json={"decision_note": decision_note},
    )
    assert response.status_code == 200
    return response.json()["request"]


def _issue_elevated_access_request(
    client: TestClient,
    requester_headers: dict[str, str],
    request_id: str,
) -> dict[str, object]:
    response = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/issue",
        headers=requester_headers,
    )
    assert response.status_code == 201
    return response.json()


def _activate_break_glass_session(
    client: TestClient,
    requester_headers: dict[str, str],
    approver_headers: dict[str, str],
    *,
    approval_reference: str,
    justification: str,
    notification_targets: list[str] | None = None,
    duration_minutes: int = 20,
) -> dict[str, object]:
    request = client.post(
        "/admin/security/break-glass",
        headers=requester_headers,
        json={
            "approval_reference": approval_reference,
            "justification": justification,
            "notification_targets": notification_targets or ["pagerduty://security-review"],
            "duration_minutes": duration_minutes,
        },
    )
    assert request.status_code == 202
    request_id = request.json()["request"]["request_id"]
    _approve_elevated_access_request(client, approver_headers, request_id)
    return _issue_elevated_access_request(client, requester_headers, request_id)


def _activate_impersonation_session(
    client: TestClient,
    requester_headers: dict[str, str],
    approver_headers: dict[str, str],
    *,
    target_user_id: str,
    approval_reference: str,
    justification: str,
    notification_targets: list[str] | None = None,
    duration_minutes: int = 15,
) -> dict[str, object]:
    request = client.post(
        "/admin/security/impersonations",
        headers=requester_headers,
        json={
            "target_user_id": target_user_id,
            "approval_reference": approval_reference,
            "justification": justification,
            "notification_targets": notification_targets or ["slack://security-queue"],
            "duration_minutes": duration_minutes,
        },
    )
    assert request.status_code == 202
    request_id = request.json()["request"]["request_id"]
    _approve_elevated_access_request(client, approver_headers, request_id)
    return _issue_elevated_access_request(client, requester_headers, request_id)


def _create_runtime_account_and_key(
    client: TestClient,
    headers: dict[str, str],
    *,
    provider_bindings: list[str] | None = None,
    scopes: list[str],
) -> tuple[dict[str, object], dict[str, object]]:
    suffix = uuid4().hex[:8]
    account_response = client.post(
        "/admin/accounts/",
        headers=headers,
        json={
            "label": f"Runtime Account {suffix}",
            "provider_bindings": provider_bindings or [],
        },
    )
    assert account_response.status_code == 201
    account = account_response.json()["account"]

    key_response = client.post(
        "/admin/keys/",
        headers=headers,
        json={
            "label": f"Runtime Key {suffix}",
            "account_id": account["account_id"],
            "scopes": scopes,
        },
    )
    assert key_response.status_code == 201
    return account, key_response.json()["issued"]


def _read_observability_events() -> list[dict[str, object]]:
    path = Path(os.environ["FORGEGATE_OBSERVABILITY_EVENTS_PATH"])
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return []
    return [json.loads(line) for line in raw.splitlines() if line.strip()]


def test_admin_auth_bootstrap_and_login_flow_available() -> None:
    client = TestClient(app)
    bootstrap = client.get("/admin/auth/bootstrap")
    assert bootstrap.status_code == 200
    payload = bootstrap.json()
    assert payload["bootstrap"] == {"message": "Sign in to inspect bootstrap posture."}
    assert {
        "bootstrap_username",
        "must_rotate_password",
        "default_password_in_use",
        "admin_user_count",
        "active_session_count",
        "governance_storage_backend",
    }.isdisjoint(payload["bootstrap"])

    me_headers = _admin_headers(client)
    me = client.get("/admin/auth/me", headers=me_headers)
    assert me.status_code == 200
    assert me.json()["user"]["role"] == "admin"


def test_password_rotation_required_sessions_are_limited_to_self_rotation_until_cleared() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)

    created = client.post(
        "/admin/security/users",
        headers=admin_headers,
        json={
            "username": "rotation-admin",
            "display_name": "Rotation Admin",
            "role": "admin",
            "password": "Rotation-Admin-123",
        },
    )
    assert created.status_code == 201
    user_id = created.json()["user"]["user_id"]

    rotated = client.post(
        f"/admin/security/users/{user_id}/rotate-password",
        headers=admin_headers,
        json={"new_password": "Rotation-Reset-456"},
    )
    assert rotated.status_code == 200
    assert rotated.json()["user"]["must_rotate_password"] is True

    login = client.post("/admin/auth/login", json={"username": "rotation-admin", "password": "Rotation-Reset-456"})
    assert login.status_code == 201
    rotation_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    me = client.get("/admin/auth/me", headers=rotation_headers)
    assert me.status_code == 200
    assert me.json()["user"]["must_rotate_password"] is True

    blocked_responses = [
        client.get("/admin/dashboard/", headers=rotation_headers),
        client.get("/admin/security/users", headers=rotation_headers),
        client.get("/admin/accounts/", headers=rotation_headers),
    ]
    for response in blocked_responses:
        assert response.status_code == 403
        assert response.json()["detail"] == "password_rotation_required"

    rotated_self = client.post(
        "/admin/auth/rotate-password",
        headers=rotation_headers,
        json={
            "current_password": "Rotation-Reset-456",
            "new_password": "Rotation-Admin-789",
        },
    )
    assert rotated_self.status_code == 200
    assert rotated_self.json()["user"]["must_rotate_password"] is False

    dashboard = client.get("/admin/dashboard/", headers=rotation_headers)
    assert dashboard.status_code == 200

    users = client.get("/admin/security/users", headers=rotation_headers)
    assert users.status_code == 200


def test_dashboard_hides_admin_only_security_posture_from_operator_and_viewer_roles() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)

    _, operator_headers = _create_admin_user_and_headers(
        client,
        admin_headers,
        username=f"dashboard-operator-{uuid4().hex[:8]}",
        display_name="Dashboard Operator",
        role="operator",
        password="Dashboard-Operator-123",
    )
    _, viewer_headers = _create_admin_user_and_headers(
        client,
        admin_headers,
        username=f"dashboard-viewer-{uuid4().hex[:8]}",
        display_name="Dashboard Viewer",
        role="viewer",
        password="Dashboard-Viewer-123",
    )

    admin_dashboard = client.get("/admin/dashboard/", headers=admin_headers)
    assert admin_dashboard.status_code == 200
    assert "security" in admin_dashboard.json()

    operator_dashboard = client.get("/admin/dashboard/", headers=operator_headers)
    assert operator_dashboard.status_code == 200
    assert operator_dashboard.json()["status"] == "ok"
    assert "security" not in operator_dashboard.json()

    viewer_dashboard = client.get("/admin/dashboard/", headers=viewer_headers)
    assert viewer_dashboard.status_code == 200
    assert viewer_dashboard.json()["status"] == "ok"
    assert "security" not in viewer_dashboard.json()


def test_bootstrap_admin_password_reload_applies_before_first_rotation(monkeypatch) -> None:
    client = TestClient(app)
    old_password = os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"]
    first_login = client.post("/admin/auth/login", json={"username": "admin", "password": old_password})
    assert first_login.status_code == 201

    monkeypatch.setenv("FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD", "ForgeFrame-Test-Admin-Secret-456")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()

    reloaded_client = TestClient(app)
    stale_login = reloaded_client.post("/admin/auth/login", json={"username": "admin", "password": old_password})
    assert stale_login.status_code == 401

    refreshed_login = reloaded_client.post(
        "/admin/auth/login",
        json={"username": "admin", "password": os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"]},
    )
    assert refreshed_login.status_code == 201


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


def test_runtime_key_rejects_disabled_and_suspended_accounts(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()

    client = TestClient(app)
    headers = _admin_headers(client)

    for status in ("disabled", "suspended"):
        account, issued = _create_runtime_account_and_key(
            client,
            headers,
            provider_bindings=["forgeframe_baseline"],
            scopes=["models:read"],
        )
        updated = client.patch(
            f"/admin/accounts/{account['account_id']}",
            headers=headers,
            json={"status": status},
        )
        assert updated.status_code == 200

        response = client.get("/v1/models", headers={"Authorization": f"Bearer {issued['token']}"})
        assert response.status_code == 403
        error = response.json()["error"]
        assert error["type"] == "gateway_account_inactive"
        assert error["message"] == "Runtime key cannot access runtime APIs in its current state."
        assert error["details"] == {}

    governance = get_governance_service()
    denied_statuses = {
        item.metadata.get("account_status")
        for item in governance.list_audit_events(limit=50)
        if item.action == "runtime_account_status_denied"
    }
    assert {"disabled", "suspended"}.issubset(denied_statuses)


def test_runtime_provider_bindings_filter_models_and_block_disallowed_chat(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()

    client = TestClient(app)
    headers = _admin_headers(client)
    _, issued = _create_runtime_account_and_key(
        client,
        headers,
        provider_bindings=["openai_api"],
        scopes=["models:read", "chat:write"],
    )
    runtime_headers = {"Authorization": f"Bearer {issued['token']}"}

    models_response = client.get("/v1/models", headers=runtime_headers)
    assert models_response.status_code == 200
    payload = models_response.json()["data"]
    assert payload
    assert all(set(item.keys()) == {"id", "object", "owned_by"} for item in payload)
    assert {item["owned_by"] for item in payload} == {"OpenAI"}
    assert "forgeframe-baseline-chat-v1" not in {item["id"] for item in payload}

    denied = client.post(
        "/v1/chat/completions",
        headers=runtime_headers,
        json={
            "model": "forgeframe-baseline-chat-v1",
            "messages": [{"role": "user", "content": "binding check"}],
        },
    )
    assert denied.status_code == 403
    error = denied.json()["error"]
    assert error["type"] == "provider_not_allowed"
    assert error["message"] == "Requested model is not available for this runtime key."
    assert "details" not in error

    governance = get_governance_service()
    denial = next(
        item
        for item in governance.list_audit_events(limit=50)
        if item.action == "runtime_provider_binding_denied" and item.target_id == "forgeframe_baseline"
    )
    assert denial.metadata["requested_model"] == "forgeframe-baseline-chat-v1"


def test_runtime_provider_bindings_hide_unready_provider_models(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()

    client = TestClient(app)
    headers = _admin_headers(client)
    _, issued = _create_runtime_account_and_key(
        client,
        headers,
        provider_bindings=["openai_api"],
        scopes=["models:read", "chat:write"],
    )
    runtime_headers = {"Authorization": f"Bearer {issued['token']}"}

    models_response = client.get("/v1/models", headers=runtime_headers)
    assert models_response.status_code == 200
    assert models_response.json()["data"] == []

    unready_chat = client.post(
        "/v1/chat/completions",
        headers=runtime_headers,
        json={
            "model": "gpt-4.1-mini",
            "messages": [{"role": "user", "content": "binding readiness check"}],
        },
    )
    assert unready_chat.status_code == 503
    assert unready_chat.json()["error"]["type"] == "provider_not_ready"


def test_anthropic_public_models_stay_hidden_for_other_tenants_after_runtime_success(monkeypatch) -> None:
    for env_name in (
        "FORGEGATE_FORGEGATE_BASELINE_ENABLED",
        "FORGEGATE_OPENAI_API_ENABLED",
        "FORGEGATE_OPENAI_CODEX_ENABLED",
        "FORGEGATE_GEMINI_ENABLED",
        "FORGEGATE_GENERIC_HARNESS_ENABLED",
        "FORGEGATE_OLLAMA_ENABLED",
    ):
        monkeypatch.setenv(env_name, "false")
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_API_KEY", "anthropic-key")
    monkeypatch.setenv("FORGEGATE_DEFAULT_PROVIDER", "anthropic")
    monkeypatch.setenv("FORGEGATE_DEFAULT_MODEL", "claude-3-5-sonnet-latest")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()

    client = TestClient(app)
    headers = _admin_headers(client)
    tenant_a, issued_a = _create_runtime_account_and_key(
        client,
        headers,
        provider_bindings=["anthropic"],
        scopes=["models:read", "chat:write"],
    )
    tenant_b, issued_b = _create_runtime_account_and_key(
        client,
        headers,
        provider_bindings=["anthropic"],
        scopes=["models:read", "chat:write"],
    )

    tenant_b_models_before = client.get("/v1/models", headers={"Authorization": f"Bearer {issued_b['token']}"})
    assert tenant_b_models_before.status_code == 200
    assert tenant_b_models_before.json()["data"] == []

    class _MockAnthropicResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        text = "ok"

        @staticmethod
        def json() -> dict[str, object]:
            return {
                "model": "claude-3-5-sonnet-latest",
                "content": [{"type": "text", "text": "tenant-a-ok"}],
                "usage": {"input_tokens": 4, "output_tokens": 2},
                "stop_reason": "end_turn",
            }

    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.post", lambda *args, **kwargs: _MockAnthropicResponse())

    tenant_a_chat = client.post(
        "/v1/chat/completions",
        headers={"Authorization": f"Bearer {issued_a['token']}"},
        json={
            "model": "claude-3-5-sonnet-latest",
            "messages": [{"role": "user", "content": "tenant A runtime proof"}],
        },
    )
    assert tenant_a_chat.status_code == 200

    tenant_b_models_after = client.get("/v1/models", headers={"Authorization": f"Bearer {issued_b['token']}"})
    assert tenant_b_models_after.status_code == 200
    assert tenant_b_models_after.json()["data"] == []

    tenant_b_truth_response = client.get(
        f"/admin/providers/?tenantId={tenant_b['account_id']}",
        headers=headers,
    )
    assert tenant_b_truth_response.status_code == 200
    tenant_b_truth = next(
        item["runtime"]
        for item in tenant_b_truth_response.json()["truth_axes"]
        if item["provider"]["provider"] == "anthropic"
    )
    assert tenant_b_truth["evidence"]["runtime"]["status"] == "missing"
    assert tenant_b_truth["runtime_readiness"] == "partial"
    assert tenant_b_truth["ready"] is False


def test_runtime_provider_binding_denial_on_responses_persists_responses_route(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()

    client = TestClient(app)
    headers = _admin_headers(client)
    _, issued = _create_runtime_account_and_key(
        client,
        headers,
        provider_bindings=["openai_api"],
        scopes=["responses:write"],
    )
    runtime_headers = {"Authorization": f"Bearer {issued['token']}"}

    denied = client.post(
        "/v1/responses",
        headers=runtime_headers,
        json={
            "model": "forgeframe-baseline-chat-v1",
            "input": "binding check",
        },
    )
    assert denied.status_code == 403
    error = denied.json()["error"]
    assert error["type"] == "provider_not_allowed"
    assert error["message"] == "Requested model is not available for this runtime key."
    assert "details" not in error

    denial_events = [
        item["data"]
        for item in _read_observability_events()
        if item.get("kind") == "error" and item.get("data", {}).get("error_type") == "provider_not_allowed"
    ]
    assert denial_events
    latest_denial = denial_events[-1]
    assert latest_denial["model"] == "forgeframe-baseline-chat-v1"
    assert latest_denial["route"] == "/v1/responses"
    assert latest_denial["stream_mode"] == "non_stream"


def test_settings_and_logs_endpoints_return_structured_payloads() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    settings = client.get("/admin/settings/", headers=headers)
    logs = client.get("/admin/logs/", headers=headers)
    assert settings.status_code == 200
    assert logs.status_code == 200
    assert "settings" in settings.json()
    assert "audit_preview" in logs.json()


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
        json={"new_password": "operator-pass-456"},
    )
    assert rotated.status_code == 200
    assert rotated.json()["user"]["must_rotate_password"] is True

    reenabled = client.patch(
        f"/admin/security/users/{user_id}",
        headers=headers,
        json={"status": "active", "role": "viewer"},
    )
    assert reenabled.status_code == 200
    assert reenabled.json()["user"]["role"] == "viewer"

    viewer_login = client.post("/admin/auth/login", json={"username": "ops", "password": "operator-pass-456"})
    assert viewer_login.status_code == 201
    assert viewer_login.json()["user"]["must_rotate_password"] is True
    viewer_token = viewer_login.json()["access_token"]
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

    rotated_self = client.post(
        "/admin/auth/rotate-password",
        headers=viewer_headers,
        json={"current_password": "operator-pass-456", "new_password": "operator-pass-456"},
    )
    assert rotated_self.status_code == 200
    assert rotated_self.json()["user"]["must_rotate_password"] is False

    forbidden = client.get("/admin/security/users", headers=viewer_headers)
    assert forbidden.status_code == 403

    promoted = client.patch(
        f"/admin/security/users/{user_id}",
        headers=headers,
        json={"role": "operator"},
    )
    assert promoted.status_code == 200
    assert promoted.json()["user"]["role"] == "operator"

    stale_viewer_session = client.get("/admin/auth/me", headers=viewer_headers)
    assert stale_viewer_session.status_code == 401

    operator_login = client.post("/admin/auth/login", json={"username": "ops", "password": "operator-pass-456"})
    assert operator_login.status_code == 201
    operator_token = operator_login.json()["access_token"]
    operator_headers = {"Authorization": f"Bearer {operator_token}"}

    impersonation_target = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": "ops-impersonation-target",
            "display_name": "Ops Impersonation Target",
            "role": "operator",
            "password": "Ops-Impersonation-123",
        },
    )
    assert impersonation_target.status_code == 201
    impersonation_target_user_id = impersonation_target.json()["user"]["user_id"]

    policy = client.get("/admin/security/credential-policy", headers=headers)
    assert policy.status_code == 200
    assert policy.json()["policy"]["service_account_keys"]["ttl_days"] > 0
    assert policy.json()["policy"]["elevated_access_requests"]["requester_claim_required"] is True

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"security-approver-{uuid4().hex[:8]}",
        display_name="Security Approver",
    )

    impersonation = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": impersonation_target_user_id,
            "approval_reference": "INC-100",
            "justification": "Reproduce a tenant-scoped operator issue.",
            "notification_targets": ["slack://security-war-room"],
            "duration_minutes": 15,
        },
    )
    assert impersonation.status_code == 202
    impersonation_request = impersonation.json()["request"]
    assert impersonation_request["gate_status"] == "open"
    assert impersonation_request["issuance_status"] == "pending"
    assert impersonation_request["ready_to_issue"] is False

    impersonation_listing = client.get(
        "/admin/security/elevated-access-requests",
        headers=headers,
        params={"gate_status": "open"},
    )
    assert impersonation_listing.status_code == 200
    assert any(item["request_id"] == impersonation_request["request_id"] for item in impersonation_listing.json()["requests"])

    approved_impersonation = _approve_elevated_access_request(client, approver_headers, impersonation_request["request_id"])
    assert approved_impersonation["gate_status"] == "approved"
    assert approved_impersonation["ready_to_issue"] is True

    impersonation_issued = _issue_elevated_access_request(client, headers, impersonation_request["request_id"])
    assert impersonation_issued["request"]["issuance_status"] == "issued"
    impersonation_token = impersonation_issued["access_token"]
    impersonation_headers = {"Authorization": f"Bearer {impersonation_token}"}
    impersonation_me = client.get("/admin/auth/me", headers=impersonation_headers)
    assert impersonation_me.status_code == 200
    assert impersonation_me.json()["user"]["session_type"] == "impersonation"
    assert impersonation_me.json()["user"]["role"] == "operator"
    assert impersonation_me.json()["user"]["read_only"] is True
    assert impersonation_me.json()["user"]["issued_by_user_id"] is not None
    assert impersonation_me.json()["user"]["approved_by_user_id"] is not None
    assert impersonation_me.json()["user"]["approval_request_id"] == impersonation_request["request_id"]

    sessions_after_impersonation = client.get("/admin/security/sessions", headers=headers)
    assert sessions_after_impersonation.status_code == 200
    impersonation_session = next(
        item
        for item in sessions_after_impersonation.json()["sessions"]
        if item["approval_request_id"] == impersonation_request["request_id"]
        and item["session_type"] == "impersonation"
        and item["revoked_at"] is None
    )
    revoked_impersonation = client.post(
        f"/admin/security/sessions/{impersonation_session['session_id']}/revoke",
        headers=headers,
    )
    assert revoked_impersonation.status_code == 200
    assert revoked_impersonation.json()["session"]["revoked_reason"] == "admin_revoked"

    break_glass = client.post(
        "/admin/security/break-glass",
        headers=operator_headers,
        json={
            "approval_reference": "INC-101",
            "justification": "Temporarily elevate to contain a production credential incident.",
            "notification_targets": ["pagerduty://platform-oncall"],
            "duration_minutes": 30,
        },
    )
    assert break_glass.status_code == 202
    break_glass_request = break_glass.json()["request"]
    assert break_glass_request["requested_by_user_id"] == user_id
    assert break_glass_request["target_user_id"] == user_id

    approved_break_glass = _approve_elevated_access_request(client, headers, break_glass_request["request_id"])
    assert approved_break_glass["gate_status"] == "approved"

    break_glass_issued = _issue_elevated_access_request(client, operator_headers, break_glass_request["request_id"])
    break_glass_token = break_glass_issued["access_token"]
    break_glass_headers = {"Authorization": f"Bearer {break_glass_token}"}
    elevated_users = client.get("/admin/security/users", headers=break_glass_headers)
    assert elevated_users.status_code == 200
    break_glass_me = client.get("/admin/auth/me", headers=break_glass_headers)
    assert break_glass_me.status_code == 200
    assert break_glass_me.json()["user"]["session_type"] == "break_glass"
    assert break_glass_me.json()["user"]["role"] == "admin"
    assert break_glass_me.json()["user"]["approval_request_id"] == break_glass_request["request_id"]

    sessions = client.get("/admin/security/sessions", headers=headers)
    assert sessions.status_code == 200
    viewer_session = next(
        item for item in sessions.json()["sessions"] if item["user_id"] == user_id and item["session_type"] == "standard" and item["revoked_at"] is None
    )

    revoked = client.post(f"/admin/security/sessions/{viewer_session['session_id']}/revoke", headers=headers)
    assert revoked.status_code == 200
    assert revoked.json()["session"]["revoked_reason"] == "admin_revoked"

    created_profile = client.put(
        "/admin/providers/harness/profiles/rotation_history_profile",
        headers=headers,
        json={
            "provider_key": "rotation_history_profile",
            "label": "Rotation History Profile",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://example.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "secret-token-a",
            "models": ["model-a"],
        },
    )
    assert created_profile.status_code == 200
    assert created_profile.json()["profile"]["config_revision"] == 1

    updated_profile = client.put(
        "/admin/providers/harness/profiles/rotation_history_profile",
        headers=headers,
        json={
            "provider_key": "rotation_history_profile",
            "label": "Rotation History Profile",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://example.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "secret-token-b",
            "models": ["model-a"],
        },
    )
    assert updated_profile.status_code == 200
    assert updated_profile.json()["profile"]["config_revision"] == 2

    recorded_rotation = client.post(
        "/admin/security/secret-rotations",
        headers=headers,
        json={
            "target_type": "provider",
            "target_id": "openai_api",
            "kind": "manual_env_rotation",
            "reference": "ops-ticket-42",
            "notes": "Documented enterprise rotation evidence.",
        },
    )
    assert recorded_rotation.status_code == 201
    assert recorded_rotation.json()["rotation"]["reference"] == "ops-ticket-42"

    secret_posture = client.get("/admin/security/secret-posture", headers=headers)
    assert secret_posture.status_code == 200
    providers_payload = {item["provider"]: item for item in secret_posture.json()["providers"]}
    providers = set(providers_payload)
    assert {"openai_api", "anthropic", "github_copilot"}.issubset(providers)
    assert "generic_harness" in providers
    assert providers_payload["openai_api"]["history_count"] == 1
    assert providers_payload["openai_api"]["last_rotation_reference"] == "ops-ticket-42"
    assert secret_posture.json()["controls"]
    harness_profiles = {item["provider_key"]: item for item in secret_posture.json()["harness_profiles"]}
    assert harness_profiles["rotation_history_profile"]["history_count"] == 1
    assert harness_profiles["rotation_history_profile"]["last_rotation_reference"] == "config_revision_2"

    rotations = client.get("/admin/security/secret-rotations", headers=headers)
    assert rotations.status_code == 200
    rotation_targets = {(item["target_type"], item["target_id"]) for item in rotations.json()["rotations"]}
    assert ("provider", "openai_api") in rotation_targets
    assert ("harness_profile", "rotation_history_profile") in rotation_targets

    sessions_after_elevation = client.get("/admin/security/sessions", headers=headers)
    assert sessions_after_elevation.status_code == 200
    session_types = {item["session_type"] for item in sessions_after_elevation.json()["sessions"]}
    assert {"impersonation", "break_glass"}.issubset(session_types)
    assert any(item["elevated"] is True for item in sessions_after_elevation.json()["sessions"])
    assert any(item["read_only"] is True for item in sessions_after_elevation.json()["sessions"] if item["session_type"] == "impersonation")
    assert any(item["approval_request_id"] == impersonation_request["request_id"] for item in sessions_after_elevation.json()["sessions"])

    actions = {item.action for item in get_governance_service().list_audit_events(limit=100)}
    assert {
        "admin_role_change",
        "admin_token_exchange",
        "admin_impersonation_requested",
        "admin_impersonation_approved",
        "admin_impersonation_start",
        "admin_break_glass_requested",
        "admin_break_glass_approved",
        "admin_break_glass_start",
        "secret_rotation_record",
    }.issubset(actions)


def test_security_secret_posture_exposes_codex_oauth_mode_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_AUTH_MODE", "oauth")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_MODE", "device_hosted_code")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "test-token")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()

    client = TestClient(app)
    headers = _admin_headers(client)

    secret_posture = client.get("/admin/security/secret-posture", headers=headers)
    assert secret_posture.status_code == 200
    providers_payload = {item["provider"]: item for item in secret_posture.json()["providers"]}
    codex = providers_payload["openai_codex"]
    assert codex["auth_mode"] == "oauth"
    assert codex["oauth_mode"] == "device_hosted_code"
    assert codex["oauth_flow_support"] == "external_token_only"
    assert "does not initiate or complete" in codex["oauth_operator_truth"]


def test_impersonation_sessions_are_read_only_for_control_plane_writes() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    suffix = uuid4().hex[:8]
    created_admin = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"impersonated-admin-{suffix}",
            "display_name": "Impersonated Admin",
            "role": "admin",
            "password": "Impersonated-Admin-123",
        },
    )
    assert created_admin.status_code == 201
    impersonated_user_id = created_admin.json()["user"]["user_id"]
    impersonated_headers = _login_headers(
        client,
        username=f"impersonated-admin-{suffix}",
        password="Impersonated-Admin-123",
    )
    target_logout = client.post("/admin/auth/logout", headers=impersonated_headers)
    assert target_logout.status_code == 200

    base_account = client.post(
        "/admin/accounts/",
        headers=headers,
        json={"label": f"Writable Account {suffix}"},
    )
    assert base_account.status_code == 201
    account_id = base_account.json()["account"]["account_id"]

    health_before = client.get("/admin/providers/health/config", headers=headers)
    assert health_before.status_code == 200
    interval_before = health_before.json()["config"]["interval_seconds"]

    settings_before = client.get("/admin/settings/", headers=headers)
    assert settings_before.status_code == 200
    app_name_before = next(
        item["effective_value"]
        for item in settings_before.json()["settings"]
        if item["key"] == "app_name"
    )

    account_count_before = len(client.get("/admin/accounts/", headers=headers).json()["accounts"])
    key_count_before = len(client.get("/admin/keys/", headers=headers).json()["keys"])
    session_count_before = len(client.get("/admin/security/sessions", headers=headers).json()["sessions"])

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"readonly-approver-{uuid4().hex[:8]}",
        display_name="Readonly Approver",
    )

    impersonation = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": impersonated_user_id,
            "approval_reference": "INC-READONLY",
            "justification": "Audit impersonation session write protections.",
            "notification_targets": ["slack://security-audit"],
            "duration_minutes": 15,
        },
    )
    assert impersonation.status_code == 202
    impersonation_request = impersonation.json()["request"]
    _approve_elevated_access_request(client, approver_headers, impersonation_request["request_id"])
    issued = _issue_elevated_access_request(client, headers, impersonation_request["request_id"])
    impersonation_headers = {"Authorization": f"Bearer {issued['access_token']}"}

    impersonation_me = client.get("/admin/auth/me", headers=impersonation_headers)
    assert impersonation_me.status_code == 200
    assert impersonation_me.json()["user"]["role"] == "admin"
    assert impersonation_me.json()["user"]["session_type"] == "impersonation"
    assert impersonation_me.json()["user"]["read_only"] is True
    assert impersonation_me.json()["user"]["approved_by_user_id"] is not None

    blocked_responses = [
        client.patch(
            "/admin/providers/health/config",
            headers=impersonation_headers,
            json={"interval_seconds": interval_before + 477},
        ),
        client.post(
            "/admin/accounts/",
            headers=impersonation_headers,
            json={"label": f"Blocked Account {suffix}"},
        ),
        client.post(
            "/admin/keys/",
            headers=impersonation_headers,
            json={"label": f"Blocked Key {suffix}", "account_id": account_id, "scopes": ["models:read"]},
        ),
        client.patch(
            "/admin/settings/",
            headers=impersonation_headers,
            json={"updates": {"app_name": f"Impersonated ForgeFrame {suffix}"}},
        ),
        client.post(
            "/admin/auth/rotate-password",
            headers=impersonation_headers,
            json={"current_password": "Impersonated-Admin-123", "new_password": "Blocked-Rotation-123"},
        ),
        client.post(
            "/admin/security/break-glass",
            headers=impersonation_headers,
            json={
                "approval_reference": "INC-BLOCKED",
                "justification": "Attempt write-capable escalation from impersonation.",
                "notification_targets": ["pagerduty://security-oncall"],
                "duration_minutes": 15,
            },
        ),
    ]
    for response in blocked_responses:
        assert response.status_code == 403
        assert response.json()["detail"] == "impersonation_session_read_only"

    health_after = client.get("/admin/providers/health/config", headers=headers)
    assert health_after.status_code == 200
    assert health_after.json()["config"]["interval_seconds"] == interval_before

    accounts_after = client.get("/admin/accounts/", headers=headers)
    assert accounts_after.status_code == 200
    assert len(accounts_after.json()["accounts"]) == account_count_before

    keys_after = client.get("/admin/keys/", headers=headers)
    assert keys_after.status_code == 200
    assert len(keys_after.json()["keys"]) == key_count_before

    settings_after = client.get("/admin/settings/", headers=headers)
    assert settings_after.status_code == 200
    app_name_after = next(
        item["effective_value"]
        for item in settings_after.json()["settings"]
        if item["key"] == "app_name"
    )
    assert app_name_after == app_name_before

    post_rotation_login = client.post(
        "/admin/auth/login",
        json={
            "username": f"impersonated-admin-{suffix}",
            "password": "Impersonated-Admin-123",
        },
    )
    assert post_rotation_login.status_code == 201

    policy = client.get("/admin/security/credential-policy", headers=headers)
    assert policy.status_code == 200
    assert policy.json()["policy"]["impersonation_sessions"]["read_only"] is True
    assert policy.json()["policy"]["impersonation_sessions"]["write_capable_admin_routes"] is False

    sessions_after = client.get("/admin/security/sessions", headers=headers)
    assert sessions_after.status_code == 200
    assert len(sessions_after.json()["sessions"]) == session_count_before + 3
    assert not any(
        item["session_type"] == "break_glass" and item["issued_by_user_id"] == impersonated_user_id
        for item in sessions_after.json()["sessions"]
    )


def test_elevated_access_requests_require_approval_before_issue_and_reject_self_approval() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    suffix = uuid4().hex[:8]
    created_user = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"approval-target-{suffix}",
            "display_name": "Approval Target",
            "role": "operator",
            "password": "Approval-Target-123",
        },
    )
    assert created_user.status_code == 201

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"approval-reviewer-{suffix}",
        display_name="Approval Reviewer",
    )

    request = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": created_user.json()["user"]["user_id"],
            "approval_reference": "INC-APPROVAL-GATE",
            "justification": "Investigate operator-visible authorization drift.",
            "notification_targets": ["slack://security-queue"],
            "duration_minutes": 15,
        },
    )
    assert request.status_code == 202
    request_id = request.json()["request"]["request_id"]

    issue_before_approval = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/issue",
        headers=headers,
    )
    assert issue_before_approval.status_code == 409
    assert issue_before_approval.json()["error"]["type"] == "elevated_access_request_conflict"

    self_approval = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/approve",
        headers=headers,
        json={"decision_note": "Attempting to self-approve should fail."},
    )
    assert self_approval.status_code == 403
    assert self_approval.json()["error"]["message"] == "elevated_access_self_approval_forbidden"

    approved = _approve_elevated_access_request(client, approver_headers, request_id)
    assert approved["gate_status"] == "approved"

    issued = _issue_elevated_access_request(client, headers, request_id)
    assert issued["request"]["issuance_status"] == "issued"

    issue_again = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/issue",
        headers=headers,
    )
    assert issue_again.status_code == 409
    assert issue_again.json()["error"]["type"] == "elevated_access_request_conflict"


def test_elevated_access_requests_require_recovery_when_no_second_admin_approver_exists() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    suffix = uuid4().hex[:8]
    created_user = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"recovery-target-{suffix}",
            "display_name": "Recovery Target",
            "role": "operator",
            "password": "Recovery-Target-123",
        },
    )
    assert created_user.status_code == 201

    bootstrap = client.get("/admin/security/bootstrap", headers=headers)
    assert bootstrap.status_code == 200
    approver_posture = bootstrap.json()["elevated_access_approver_posture"]
    assert approver_posture["state"] == "recovery_required"
    assert approver_posture["eligible_admin_approver_count"] == 0
    assert approver_posture["blocked_reason"] == "no_eligible_second_admin"

    policy = client.get("/admin/security/credential-policy", headers=headers)
    assert policy.status_code == 200
    assert policy.json()["policy"]["elevated_access_requests"]["approver_availability"]["state"] == "recovery_required"

    impersonation = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": created_user.json()["user"]["user_id"],
            "approval_reference": "INC-RECOVERY",
            "justification": "Need elevated access, but no second admin is available.",
            "notification_targets": ["slack://security-queue"],
            "duration_minutes": 15,
        },
    )
    assert impersonation.status_code == 409
    assert impersonation.json()["error"]["type"] == "elevated_access_recovery_required"
    assert impersonation.json()["error"]["details"]["blocked_reason"] == "no_eligible_second_admin"

    break_glass = client.post(
        "/admin/security/break-glass",
        headers=headers,
        json={
            "approval_reference": "INC-RECOVERY-BG",
            "justification": "Need break-glass access, but no second admin is available.",
            "notification_targets": ["pagerduty://security-review"],
            "duration_minutes": 15,
        },
    )
    assert break_glass.status_code == 409
    assert break_glass.json()["error"]["type"] == "elevated_access_recovery_required"
    assert break_glass.json()["error"]["details"]["request_type"] == "break_glass"

    requests = client.get("/admin/security/elevated-access-requests", headers=headers)
    assert requests.status_code == 200
    assert requests.json()["requests"] == []

    recovery_actions = {
        item.action
        for item in get_governance_service().list_audit_events(limit=100)
        if item.metadata.get("blocked_reason") == "no_eligible_second_admin"
    }
    assert {
        "admin_impersonation_recovery_required",
        "admin_break_glass_recovery_required",
    }.issubset(recovery_actions)


def test_security_posture_routes_are_operator_readable_for_elevated_access_requesters() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)

    _, operator_headers = _create_admin_user_and_headers(
        client,
        admin_headers,
        username=f"security-operator-{uuid4().hex[:8]}",
        display_name="Security Operator",
        role="operator",
        password="Security-Operator-123",
    )

    bootstrap = client.get("/admin/security/bootstrap", headers=operator_headers)
    assert bootstrap.status_code == 200
    bootstrap_payload = bootstrap.json()
    assert "bootstrap" not in bootstrap_payload
    assert "secret_posture" not in bootstrap_payload

    approver_posture = bootstrap_payload["elevated_access_approver_posture"]
    assert approver_posture["state"] == "approval_available"
    assert approver_posture["eligible_admin_approver_count"] == 1
    assert approver_posture["blocked_reason"] is None

    policy = client.get("/admin/security/credential-policy", headers=operator_headers)
    assert policy.status_code == 200
    policy_posture = policy.json()["policy"]["elevated_access_requests"]["approver_availability"]
    assert policy_posture["state"] == "approval_available"
    assert policy_posture["eligible_admin_approver_count"] == 1
    assert policy_posture["blocked_reason"] is None


def test_elevated_access_posture_returns_approval_available_after_second_admin_restore() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    second_admin_user_id, _ = _create_admin_user_and_headers(
        client,
        headers,
        username=f"restored-approver-{uuid4().hex[:8]}",
        display_name="Restored Approver",
    )

    disabled = client.patch(
        f"/admin/security/users/{second_admin_user_id}",
        headers=headers,
        json={"status": "disabled"},
    )
    assert disabled.status_code == 200

    bootstrap = client.get("/admin/security/bootstrap", headers=headers)
    assert bootstrap.status_code == 200
    assert bootstrap.json()["elevated_access_approver_posture"]["state"] == "recovery_required"

    policy = client.get("/admin/security/credential-policy", headers=headers)
    assert policy.status_code == 200
    assert policy.json()["policy"]["elevated_access_requests"]["approver_availability"]["state"] == "recovery_required"

    restored = client.patch(
        f"/admin/security/users/{second_admin_user_id}",
        headers=headers,
        json={"status": "active"},
    )
    assert restored.status_code == 200
    assert restored.json()["user"]["status"] == "active"

    bootstrap_after_restore = client.get("/admin/security/bootstrap", headers=headers)
    assert bootstrap_after_restore.status_code == 200
    approver_posture = bootstrap_after_restore.json()["elevated_access_approver_posture"]
    assert approver_posture["state"] == "approval_available"
    assert approver_posture["eligible_admin_approver_count"] == 1
    assert approver_posture["blocked_reason"] is None

    policy_after_restore = client.get("/admin/security/credential-policy", headers=headers)
    assert policy_after_restore.status_code == 200
    restored_policy_posture = policy_after_restore.json()["policy"]["elevated_access_requests"]["approver_availability"]
    assert restored_policy_posture["state"] == "approval_available"
    assert restored_policy_posture["eligible_admin_approver_count"] == 1
    assert restored_policy_posture["blocked_reason"] is None


def test_elevated_access_requests_reject_duplicate_active_subject_sessions_at_request_time() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    suffix = uuid4().hex[:8]
    created_user = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"duplicate-target-{suffix}",
            "display_name": "Duplicate Target",
            "role": "operator",
            "password": "Duplicate-Target-123",
        },
    )
    assert created_user.status_code == 201

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"duplicate-reviewer-{suffix}",
        display_name="Duplicate Reviewer",
    )

    first_request = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": created_user.json()["user"]["user_id"],
            "approval_reference": "INC-DUPLICATE-1",
            "justification": "Open the initial impersonation request for duplicate guard coverage.",
            "notification_targets": ["slack://security-queue"],
            "duration_minutes": 15,
        },
    )
    assert first_request.status_code == 202
    first_request_id = first_request.json()["request"]["request_id"]

    _approve_elevated_access_request(client, approver_headers, first_request_id)
    issued = _issue_elevated_access_request(client, headers, first_request_id)
    assert issued["request"]["issuance_status"] == "issued"

    duplicate_request = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": created_user.json()["user"]["user_id"],
            "approval_reference": "INC-DUPLICATE-2",
            "justification": "Attempt a redundant impersonation request while the subject is already elevated.",
            "notification_targets": ["slack://security-queue"],
            "duration_minutes": 15,
        },
    )
    assert duplicate_request.status_code == 409
    assert duplicate_request.json()["error"]["type"] == "elevated_access_request_conflict"
    assert duplicate_request.json()["error"]["message"] == (
        "An elevated session is already active for this subject. Review the active session before creating a new request."
    )


def test_elevated_access_requests_surface_active_session_conflicts_during_review() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    suffix = uuid4().hex[:8]
    created_operator = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"review-conflict-operator-{suffix}",
            "display_name": "Review Conflict Operator",
            "role": "operator",
            "password": "Review-Conflict-123",
        },
    )
    assert created_operator.status_code == 201

    operator_headers = _login_headers(
        client,
        username=f"review-conflict-operator-{suffix}",
        password="Review-Conflict-123",
    )

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"review-conflict-approver-{suffix}",
        display_name="Review Conflict Approver",
    )

    approve_conflict_request = client.post(
        "/admin/security/break-glass",
        headers=operator_headers,
        json={
            "approval_reference": "INC-APPROVE-CONFLICT",
            "justification": "Leave this request pending until another elevated session becomes active.",
            "notification_targets": ["pagerduty://security-review"],
            "duration_minutes": 20,
        },
    )
    assert approve_conflict_request.status_code == 202
    approve_conflict_request_id = approve_conflict_request.json()["request"]["request_id"]

    issue_conflict_request = client.post(
        "/admin/security/break-glass",
        headers=operator_headers,
        json={
            "approval_reference": "INC-ISSUE-CONFLICT",
            "justification": "Approve this request before another elevated session becomes active.",
            "notification_targets": ["pagerduty://security-review"],
            "duration_minutes": 20,
        },
    )
    assert issue_conflict_request.status_code == 202
    issue_conflict_request_id = issue_conflict_request.json()["request"]["request_id"]
    approved_before_conflict = _approve_elevated_access_request(client, approver_headers, issue_conflict_request_id)
    assert approved_before_conflict["gate_status"] == "approved"

    active_request = client.post(
        "/admin/security/break-glass",
        headers=operator_headers,
        json={
            "approval_reference": "INC-ACTIVE-CONFLICT",
            "justification": "Use a different request to activate the conflicting elevated session.",
            "notification_targets": ["pagerduty://security-review"],
            "duration_minutes": 20,
        },
    )
    assert active_request.status_code == 202
    active_request_id = active_request.json()["request"]["request_id"]
    _approve_elevated_access_request(client, approver_headers, active_request_id)
    activated = _issue_elevated_access_request(client, operator_headers, active_request_id)
    assert activated["request"]["issuance_status"] == "issued"

    approve_conflict = client.post(
        f"/admin/security/elevated-access-requests/{approve_conflict_request_id}/approve",
        headers=approver_headers,
        json={"decision_note": "A later active session should block this approval."},
    )
    assert approve_conflict.status_code == 409
    assert approve_conflict.json()["error"]["type"] == "elevated_access_request_conflict"
    assert approve_conflict.json()["error"]["message"] == (
        "An elevated session is already active for this subject. Review the active session before creating a new request."
    )

    issue_conflict = client.post(
        f"/admin/security/elevated-access-requests/{issue_conflict_request_id}/issue",
        headers=operator_headers,
    )
    assert issue_conflict.status_code == 409
    assert issue_conflict.json()["error"]["type"] == "elevated_access_request_conflict"
    assert issue_conflict.json()["error"]["message"] == (
        "An elevated session is already active for this subject. Review the active session before creating a new request."
    )


def test_impersonation_requests_reject_requesters_with_active_break_glass_sessions() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    suffix = uuid4().hex[:8]
    created_operator = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"requester-conflict-target-{suffix}",
            "display_name": "Requester Conflict Target",
            "role": "operator",
            "password": "Requester-Conflict-123",
        },
    )
    assert created_operator.status_code == 201

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"requester-conflict-approver-{suffix}",
        display_name="Requester Conflict Approver",
    )

    activated = _activate_break_glass_session(
        client,
        headers,
        approver_headers,
        approval_reference="INC-REQUESTER-CONFLICT",
        justification="Keep an elevated requester session active before opening impersonation.",
    )
    assert activated["request"]["issuance_status"] == "issued"

    impersonation = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": created_operator.json()["user"]["user_id"],
            "approval_reference": "INC-REQUESTER-IMPERSONATION",
            "justification": "Attempt impersonation while the requester already has elevated access.",
            "notification_targets": ["slack://security-queue"],
            "duration_minutes": 15,
        },
    )
    assert impersonation.status_code == 409
    assert impersonation.json()["error"]["type"] == "elevated_access_request_conflict"
    assert impersonation.json()["error"]["message"] == (
        "An elevated session is already active for this subject. Review the active session before creating a new request."
    )


def test_impersonation_requests_recheck_requester_break_glass_conflicts_during_review() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    suffix = uuid4().hex[:8]
    created_operator = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"review-requester-target-{suffix}",
            "display_name": "Review Requester Target",
            "role": "operator",
            "password": "Review-Requester-123",
        },
    )
    assert created_operator.status_code == 201

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"review-requester-approver-{suffix}",
        display_name="Review Requester Approver",
    )

    impersonation = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": created_operator.json()["user"]["user_id"],
            "approval_reference": "INC-REQUESTER-APPROVAL",
            "justification": "Open an impersonation request before the requester becomes elevated.",
            "notification_targets": ["slack://security-queue"],
            "duration_minutes": 15,
        },
    )
    assert impersonation.status_code == 202
    request_id = impersonation.json()["request"]["request_id"]

    activated = _activate_break_glass_session(
        client,
        headers,
        approver_headers,
        approval_reference="INC-REQUESTER-APPROVAL-CONFLICT",
        justification="Activate requester break-glass before the impersonation approval decision.",
    )
    assert activated["request"]["issuance_status"] == "issued"

    approval = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/approve",
        headers=approver_headers,
        json={"decision_note": "Requester already has elevated access, so approval must fail."},
    )
    assert approval.status_code == 409
    assert approval.json()["error"]["type"] == "elevated_access_request_conflict"
    assert approval.json()["error"]["message"] == (
        "An elevated session is already active for this subject. Review the active session before creating a new request."
    )


def test_impersonation_requests_recheck_requester_break_glass_conflicts_during_issuance() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    suffix = uuid4().hex[:8]
    created_operator = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"issue-requester-target-{suffix}",
            "display_name": "Issue Requester Target",
            "role": "operator",
            "password": "Issue-Requester-123",
        },
    )
    assert created_operator.status_code == 201

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"issue-requester-approver-{suffix}",
        display_name="Issue Requester Approver",
    )

    impersonation = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": created_operator.json()["user"]["user_id"],
            "approval_reference": "INC-REQUESTER-ISSUE",
            "justification": "Approve impersonation before the requester later becomes elevated.",
            "notification_targets": ["slack://security-queue"],
            "duration_minutes": 15,
        },
    )
    assert impersonation.status_code == 202
    request_id = impersonation.json()["request"]["request_id"]
    approved = _approve_elevated_access_request(client, approver_headers, request_id)
    assert approved["gate_status"] == "approved"

    activated = _activate_break_glass_session(
        client,
        headers,
        approver_headers,
        approval_reference="INC-REQUESTER-ISSUE-CONFLICT",
        justification="Activate requester break-glass before the impersonation token exchange.",
    )
    assert activated["request"]["issuance_status"] == "issued"

    issue = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/issue",
        headers=headers,
    )
    assert issue.status_code == 409
    assert issue.json()["error"]["type"] == "elevated_access_request_conflict"
    assert issue.json()["error"]["message"] == (
        "An elevated session is already active for this subject. Review the active session before creating a new request."
    )


def test_impersonation_requests_reject_requesters_with_active_impersonation_sessions() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    suffix = uuid4().hex[:8]
    first_target = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"requester-impersonation-target-a-{suffix}",
            "display_name": "Requester Impersonation Target A",
            "role": "operator",
            "password": "Requester-Impersonation-A-123",
        },
    )
    assert first_target.status_code == 201

    second_target = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"requester-impersonation-target-b-{suffix}",
            "display_name": "Requester Impersonation Target B",
            "role": "operator",
            "password": "Requester-Impersonation-B-123",
        },
    )
    assert second_target.status_code == 201

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"requester-impersonation-approver-{suffix}",
        display_name="Requester Impersonation Approver",
    )

    activated = _activate_impersonation_session(
        client,
        headers,
        approver_headers,
        target_user_id=first_target.json()["user"]["user_id"],
        approval_reference="INC-REQUESTER-IMPERSONATION-ACTIVE",
        justification="Keep an active impersonation session owned by the requester.",
    )
    assert activated["request"]["issuance_status"] == "issued"
    assert activated["user"]["session_type"] == "impersonation"
    assert activated["user"]["issued_by_user_id"] == activated["request"]["requested_by_user_id"]

    sessions = client.get("/admin/security/sessions", headers=headers)
    assert sessions.status_code == 200
    assert any(
        item["session_type"] == "impersonation"
        and item["user_id"] == first_target.json()["user"]["user_id"]
        and item["issued_by_user_id"] == activated["request"]["requested_by_user_id"]
        for item in sessions.json()["sessions"]
    )

    impersonation = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": second_target.json()["user"]["user_id"],
            "approval_reference": "INC-REQUESTER-IMPERSONATION-CONFLICT",
            "justification": "Attempt a second impersonation while the requester already owns one.",
            "notification_targets": ["slack://security-queue"],
            "duration_minutes": 15,
        },
    )
    assert impersonation.status_code == 409
    assert impersonation.json()["error"]["type"] == "elevated_access_request_conflict"
    assert impersonation.json()["error"]["message"] == (
        "An elevated session is already active for this subject. Review the active session before creating a new request."
    )


def test_break_glass_requests_reject_requesters_with_active_impersonation_sessions() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    suffix = uuid4().hex[:8]
    target = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"requester-break-glass-target-{suffix}",
            "display_name": "Requester Break-Glass Target",
            "role": "operator",
            "password": "Requester-Break-Glass-123",
        },
    )
    assert target.status_code == 201

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"requester-break-glass-approver-{suffix}",
        display_name="Requester Break-Glass Approver",
    )

    activated = _activate_impersonation_session(
        client,
        headers,
        approver_headers,
        target_user_id=target.json()["user"]["user_id"],
        approval_reference="INC-REQUESTER-BREAK-GLASS-IMPERSONATION",
        justification="Keep an active requester-owned impersonation before opening break-glass.",
    )
    assert activated["request"]["issuance_status"] == "issued"
    assert activated["user"]["session_type"] == "impersonation"

    break_glass = client.post(
        "/admin/security/break-glass",
        headers=headers,
        json={
            "approval_reference": "INC-REQUESTER-BREAK-GLASS-CONFLICT",
            "justification": "Attempt break-glass while the requester already owns an impersonation session.",
            "notification_targets": ["pagerduty://security-review"],
            "duration_minutes": 20,
        },
    )
    assert break_glass.status_code == 409
    assert break_glass.json()["error"]["type"] == "elevated_access_request_conflict"
    assert break_glass.json()["error"]["message"] == (
        "An elevated session is already active for this subject. Review the active session before creating a new request."
    )


def test_impersonation_requests_recheck_requester_impersonation_conflicts_during_review() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    suffix = uuid4().hex[:8]
    first_target = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"review-impersonation-target-a-{suffix}",
            "display_name": "Review Impersonation Target A",
            "role": "operator",
            "password": "Review-Impersonation-A-123",
        },
    )
    assert first_target.status_code == 201

    second_target = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"review-impersonation-target-b-{suffix}",
            "display_name": "Review Impersonation Target B",
            "role": "operator",
            "password": "Review-Impersonation-B-123",
        },
    )
    assert second_target.status_code == 201

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"review-impersonation-approver-{suffix}",
        display_name="Review Impersonation Approver",
    )

    pending = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": second_target.json()["user"]["user_id"],
            "approval_reference": "INC-REVIEW-IMPERSONATION-PENDING",
            "justification": "Leave this impersonation request open until another impersonation becomes active.",
            "notification_targets": ["slack://security-queue"],
            "duration_minutes": 15,
        },
    )
    assert pending.status_code == 202
    request_id = pending.json()["request"]["request_id"]

    activated = _activate_impersonation_session(
        client,
        headers,
        approver_headers,
        target_user_id=first_target.json()["user"]["user_id"],
        approval_reference="INC-REVIEW-IMPERSONATION-ACTIVE",
        justification="Activate a different impersonation owned by the same requester before approval.",
    )
    assert activated["request"]["issuance_status"] == "issued"

    approval = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/approve",
        headers=approver_headers,
        json={"decision_note": "Requester already owns an active impersonation session."},
    )
    assert approval.status_code == 409
    assert approval.json()["error"]["type"] == "elevated_access_request_conflict"
    assert approval.json()["error"]["message"] == (
        "An elevated session is already active for this subject. Review the active session before creating a new request."
    )


def test_impersonation_requests_recheck_requester_impersonation_conflicts_during_issuance() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    suffix = uuid4().hex[:8]
    first_target = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"issue-impersonation-target-a-{suffix}",
            "display_name": "Issue Impersonation Target A",
            "role": "operator",
            "password": "Issue-Impersonation-A-123",
        },
    )
    assert first_target.status_code == 201

    second_target = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"issue-impersonation-target-b-{suffix}",
            "display_name": "Issue Impersonation Target B",
            "role": "operator",
            "password": "Issue-Impersonation-B-123",
        },
    )
    assert second_target.status_code == 201

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"issue-impersonation-approver-{suffix}",
        display_name="Issue Impersonation Approver",
    )

    pending = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": second_target.json()["user"]["user_id"],
            "approval_reference": "INC-ISSUE-IMPERSONATION-PENDING",
            "justification": "Approve this impersonation before another requester-owned impersonation becomes active.",
            "notification_targets": ["slack://security-queue"],
            "duration_minutes": 15,
        },
    )
    assert pending.status_code == 202
    request_id = pending.json()["request"]["request_id"]
    approved = _approve_elevated_access_request(client, approver_headers, request_id)
    assert approved["gate_status"] == "approved"

    activated = _activate_impersonation_session(
        client,
        headers,
        approver_headers,
        target_user_id=first_target.json()["user"]["user_id"],
        approval_reference="INC-ISSUE-IMPERSONATION-ACTIVE",
        justification="Activate a different requester-owned impersonation before token exchange.",
    )
    assert activated["request"]["issuance_status"] == "issued"

    issue = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/issue",
        headers=headers,
    )
    assert issue.status_code == 409
    assert issue.json()["error"]["type"] == "elevated_access_request_conflict"
    assert issue.json()["error"]["message"] == (
        "An elevated session is already active for this subject. Review the active session before creating a new request."
    )


def test_elevated_access_requests_support_rejection_and_timeout_states() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    suffix = uuid4().hex[:8]
    created_operator = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"break-glass-operator-{suffix}",
            "display_name": "Break Glass Operator",
            "role": "operator",
            "password": "Break-Glass-Operator-123",
        },
    )
    assert created_operator.status_code == 201

    operator_headers = _login_headers(
        client,
        username=f"break-glass-operator-{suffix}",
        password="Break-Glass-Operator-123",
    )

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"security-reviewer-{suffix}",
        display_name="Security Reviewer",
    )

    rejected_request = client.post(
        "/admin/security/break-glass",
        headers=operator_headers,
        json={
            "approval_reference": "INC-REJECT",
            "justification": "Need temporary admin to inspect a provider outage.",
            "notification_targets": ["pagerduty://security-review"],
            "duration_minutes": 20,
        },
    )
    assert rejected_request.status_code == 202
    rejected_request_id = rejected_request.json()["request"]["request_id"]

    rejected = client.post(
        f"/admin/security/elevated-access-requests/{rejected_request_id}/reject",
        headers=approver_headers,
        json={"decision_note": "Rejected because the incident did not require elevated access."},
    )
    assert rejected.status_code == 200
    assert rejected.json()["request"]["gate_status"] == "rejected"

    rejected_issue = client.post(
        f"/admin/security/elevated-access-requests/{rejected_request_id}/issue",
        headers=operator_headers,
    )
    assert rejected_issue.status_code == 409
    assert rejected_issue.json()["error"]["type"] == "elevated_access_request_conflict"

    timed_out_request = client.post(
        "/admin/security/break-glass",
        headers=operator_headers,
        json={
            "approval_reference": "INC-TIMEOUT",
            "justification": "Need temporary admin to inspect a separate incident.",
            "notification_targets": ["pagerduty://security-review"],
            "duration_minutes": 20,
        },
    )
    assert timed_out_request.status_code == 202
    timed_out_request_id = timed_out_request.json()["request"]["request_id"]

    service = get_governance_service()
    record = service._find_elevated_access_request(timed_out_request_id)
    assert record is not None
    record.approval_expires_at = "2000-01-01T00:00:00+00:00"
    service._persist()

    listing = client.get(
        "/admin/security/elevated-access-requests",
        headers=headers,
        params={"gate_status": "timed_out"},
    )
    assert listing.status_code == 200
    assert any(item["request_id"] == timed_out_request_id for item in listing.json()["requests"])

    timed_out_approval = client.post(
        f"/admin/security/elevated-access-requests/{timed_out_request_id}/approve",
        headers=approver_headers,
        json={"decision_note": "Too late to approve; the request already expired."},
    )
    assert timed_out_approval.status_code == 409
    assert timed_out_approval.json()["error"]["type"] == "elevated_access_request_conflict"

    actions = {item.action for item in get_governance_service().list_audit_events(limit=100)}
    assert {"admin_break_glass_rejected", "admin_break_glass_timed_out"}.issubset(actions)


def test_elevated_access_requests_support_requester_cancellation() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    suffix = uuid4().hex[:8]
    created_operator = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"cancel-operator-{suffix}",
            "display_name": "Cancel Operator",
            "role": "operator",
            "password": "Cancel-Operator-123",
        },
    )
    assert created_operator.status_code == 201

    operator_headers = _login_headers(
        client,
        username=f"cancel-operator-{suffix}",
        password="Cancel-Operator-123",
    )

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"cancel-reviewer-{suffix}",
        display_name="Cancel Reviewer",
    )

    pending_request = client.post(
        "/admin/security/break-glass",
        headers=operator_headers,
        json={
            "approval_reference": "INC-CANCEL",
            "justification": "Need temporary admin to investigate an issue that just cleared.",
            "notification_targets": ["pagerduty://security-review"],
            "duration_minutes": 20,
        },
    )
    assert pending_request.status_code == 202
    request_id = pending_request.json()["request"]["request_id"]

    cancelled = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/cancel",
        headers=operator_headers,
    )
    assert cancelled.status_code == 200
    cancelled_request = cancelled.json()["request"]
    assert cancelled_request["gate_status"] == "cancelled"
    assert cancelled_request["ready_to_issue"] is False
    assert cancelled_request["session_status"] == "not_issued"
    assert cancelled_request["decided_by_user_id"] == created_operator.json()["user"]["user_id"]

    cancelled_listing = client.get(
        "/admin/security/elevated-access-requests",
        headers=operator_headers,
        params={"gate_status": "cancelled"},
    )
    assert cancelled_listing.status_code == 200
    assert any(item["request_id"] == request_id for item in cancelled_listing.json()["requests"])

    approve_after_cancel = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/approve",
        headers=approver_headers,
        json={"decision_note": "Too late to approve; the requester already withdrew the request."},
    )
    assert approve_after_cancel.status_code == 409
    assert approve_after_cancel.json()["error"]["type"] == "elevated_access_request_conflict"

    actions = {item.action for item in get_governance_service().list_audit_events(limit=100)}
    assert "admin_break_glass_cancelled" in actions


def test_elevated_access_requester_cancellation_rejects_viewer_after_role_downgrade() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    suffix = uuid4().hex[:8]
    requester = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"cancel-viewer-{suffix}",
            "display_name": "Cancel Viewer",
            "role": "operator",
            "password": "Cancel-Viewer-123",
        },
    )
    assert requester.status_code == 201
    requester_user_id = requester.json()["user"]["user_id"]

    operator_headers = _login_headers(
        client,
        username=f"cancel-viewer-{suffix}",
        password="Cancel-Viewer-123",
    )

    pending_request = client.post(
        "/admin/security/break-glass",
        headers=operator_headers,
        json={
            "approval_reference": "INC-CANCEL-VIEWER",
            "justification": "Need temporary admin to validate a downgrade regression.",
            "notification_targets": ["pagerduty://security-review"],
            "duration_minutes": 20,
        },
    )
    assert pending_request.status_code == 202
    request_id = pending_request.json()["request"]["request_id"]

    downgraded = client.patch(
        f"/admin/security/users/{requester_user_id}",
        headers=headers,
        json={"role": "viewer"},
    )
    assert downgraded.status_code == 200
    assert downgraded.json()["user"]["role"] == "viewer"

    viewer_headers = _login_headers(
        client,
        username=f"cancel-viewer-{suffix}",
        password="Cancel-Viewer-123",
    )

    service = get_governance_service()
    viewer_actor = service.authenticate_admin_token(viewer_headers["Authorization"].split(" ", 1)[1])
    with pytest.raises(PermissionError, match="operator_role_required"):
        service.cancel_elevated_access_request(request_id=request_id, actor=viewer_actor)

    listing = client.get("/admin/security/elevated-access-requests", headers=viewer_headers)
    assert listing.status_code == 403
    assert listing.json()["detail"] == "operator_role_required"

    cancelled = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/cancel",
        headers=viewer_headers,
    )
    assert cancelled.status_code == 403
    assert cancelled.json()["detail"] == "operator_role_required"

    record = service._find_elevated_access_request(request_id)
    assert record is not None
    assert record.gate_status == "open"
    assert record.decided_at is None
    assert record.decided_by_user_id is None


def test_admin_login_rate_limit_is_enforced(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_ADMIN_LOGIN_RATE_LIMIT_ATTEMPTS", "2")
    monkeypatch.setenv("FORGEGATE_ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES", "60")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()

    client = TestClient(app)

    first = client.post("/admin/auth/login", json={"username": "admin", "password": "wrong-pass"})
    second = client.post("/admin/auth/login", json={"username": "admin", "password": "wrong-pass"})
    third = client.post("/admin/auth/login", json={"username": "admin", "password": "wrong-pass"})

    assert first.status_code == 401
    assert second.status_code == 401
    assert third.status_code == 429


def test_postgres_governance_relational_backfill_dual_write_and_read_cutover(tmp_path: Path) -> None:
    schema_name = f"test_governance_relational_{uuid4().hex[:12]}"
    base_url = "postgresql+psycopg://forgegate:forgegate@localhost:5432/forgegate"
    scoped_url = f"{base_url}?options=-csearch_path%3D{schema_name}"
    admin_engine = create_engine(base_url, isolation_level="AUTOCOMMIT")

    def _count(connection, table_name: str) -> int:
        return int(connection.execute(text(f'SELECT count(*) FROM "{schema_name}".{table_name}')).scalar_one())

    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))

    try:
        PostgresGovernanceRepository(scoped_url)
        with admin_engine.connect() as connection:
            pre_migration_tables = {
                row[0]
                for row in connection.execute(
                    text("SELECT tablename FROM pg_tables WHERE schemaname = :schema_name"),
                    {"schema_name": schema_name},
                )
            }
        assert "governance_state" not in pre_migration_tables
        assert "tenants" not in pre_migration_tables

        migration_result = apply_storage_migrations(scoped_url)
        assert migration_result["latest_version"] >= 10
        assert 9 in [*migration_result["applied_versions"], *migration_result["skipped_versions"]]
        assert 10 in [*migration_result["applied_versions"], *migration_result["skipped_versions"]]

        with admin_engine.connect() as connection:
            tables = {
                row[0]
                for row in connection.execute(
                    text("SELECT tablename FROM pg_tables WHERE schemaname = :schema_name"),
                    {"schema_name": schema_name},
                )
            }
            constraints = {
                row[0]
                for row in connection.execute(
                    text(
                        """
                        SELECT con.conname
                        FROM pg_constraint con
                        JOIN pg_class rel ON rel.oid = con.conrelid
                        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
                        WHERE ns.nspname = :schema_name
                        """
                    ),
                    {"schema_name": schema_name},
                )
            }
        assert {
            "tenants",
            "principals",
            "tenant_memberships",
            "scope_grants",
            "service_accounts",
            "agent_credentials",
            "auth_sessions",
            "audit_events",
        }.issubset(tables)
        assert {
            "tenant_memberships_created_by_same_tenant_fk",
            "service_accounts_owner_membership_same_tenant_fk",
            "scope_grants_membership_same_tenant_fk",
            "scope_grants_service_account_same_tenant_fk",
            "scope_grants_created_by_same_tenant_fk",
            "agent_credentials_service_account_same_tenant_fk",
            "agent_credentials_rotated_from_same_tenant_fk",
            "agent_credentials_issued_by_same_tenant_fk",
            "auth_sessions_membership_same_tenant_fk",
        }.issubset(constraints)

        salt = new_secret_salt()
        legacy_state = GovernanceStateRecord(
            admin_users=[
                AdminUserRecord(
                    user_id="admin_seed",
                    username="admin",
                    display_name="ForgeFrame Admin",
                    role="admin",
                    status="active",
                    password_hash=hash_password("forgegate-admin", salt),
                    password_salt=salt,
                    must_rotate_password=False,
                    created_at="2026-04-21T00:00:00+00:00",
                    updated_at="2026-04-21T00:00:00+00:00",
                    created_by="system",
                )
            ],
            admin_sessions=[
                AdminSessionRecord(
                    session_id="sess_seed",
                    user_id="admin_seed",
                    token_hash=hash_token("fgas_seed_session"),
                    role="admin",
                    created_at="2026-04-21T00:05:00+00:00",
                    expires_at="2099-04-22T00:05:00+00:00",
                    last_used_at="2026-04-21T00:05:00+00:00",
                    issued_by_user_id="admin_seed",
                    approved_by_user_id="admin_seed",
                    approval_request_id="req_seed",
                    approval_reference="INC-SEED",
                    justification="Seed elevated access session.",
                    notification_targets=["pagerduty://seed-review"],
                )
            ],
            gateway_accounts=[
                GatewayAccountRecord(
                    account_id="acct_seed",
                    label="Tenant A",
                    provider_bindings=["openai_api"],
                    notes="legacy seed account",
                    created_at="2026-04-21T00:10:00+00:00",
                    updated_at="2026-04-21T00:10:00+00:00",
                )
            ],
            runtime_keys=[
                RuntimeKeyRecord(
                    key_id="key_seed",
                    account_id="acct_seed",
                    label="Seed Key",
                    prefix="fgk_seed_prefix",
                    secret_hash=hash_token("fgk_seed_runtime_key"),
                    scopes=["models:read", "chat:write"],
                    status="active",
                    created_at="2026-04-21T00:15:00+00:00",
                    updated_at="2026-04-21T00:15:00+00:00",
                )
            ],
            audit_events=[
                AuditEventRecord(
                    event_id="audit_seed_account",
                    actor_type="admin_user",
                    actor_id="admin_seed",
                    tenant_id="acct_seed",
                    action="account_create",
                    target_type="gateway_account",
                    target_id="acct_seed",
                    status="ok",
                    details="Seed account created.",
                    metadata={"account_id": "acct_seed"},
                    created_at="2026-04-21T00:20:00+00:00",
                )
            ],
        )

        with admin_engine.begin() as connection:
            connection.execute(
                text(
                    f'''
                    INSERT INTO "{schema_name}".governance_state (state_key, payload, updated_at)
                    VALUES (:state_key, CAST(:payload AS jsonb), NOW())
                    '''
                ),
                {
                    "state_key": "default",
                    "payload": json.dumps(legacy_state.model_dump()),
                },
            )

        settings = Settings(
            governance_storage_backend="postgresql",
            governance_postgres_url=scoped_url,
            governance_relational_dual_write_enabled=True,
            governance_relational_reads_enabled=False,
            governance_state_path=str(tmp_path / "ignored_governance_state.json"),
        )
        repository = PostgresGovernanceRepository(
            scoped_url,
            bootstrap_tenant_id=settings.bootstrap_tenant_id,
            relational_dual_write_enabled=True,
            relational_reads_enabled=False,
        )

        loaded = repository.load_state()
        assert loaded.gateway_accounts[0].label == "Tenant A"
        assert loaded.runtime_keys[0].key_id == "key_seed"
        assert loaded.admin_sessions[0].approved_by_user_id == "admin_seed"
        assert loaded.admin_sessions[0].approval_request_id == "req_seed"

        with admin_engine.connect() as connection:
            first_counts = {
                "tenants": _count(connection, "tenants"),
                "principals": _count(connection, "principals"),
                "tenant_memberships": _count(connection, "tenant_memberships"),
                "service_accounts": _count(connection, "service_accounts"),
                "agent_credentials": _count(connection, "agent_credentials"),
                "auth_sessions": _count(connection, "auth_sessions"),
                "audit_events": _count(connection, "audit_events"),
            }
        assert first_counts == {
            "tenants": 2,
            "principals": 1,
            "tenant_memberships": 1,
            "service_accounts": 1,
            "agent_credentials": 1,
            "auth_sessions": 1,
            "audit_events": 1,
        }

        with pytest.raises(IntegrityError):
            with admin_engine.begin() as connection:
                connection.execute(
                    text(
                        f'''
                        INSERT INTO "{schema_name}".auth_sessions (
                            session_id,
                            tenant_id,
                            membership_id,
                            session_hash,
                            status,
                            issued_at,
                            expires_at,
                            last_used_at
                        ) VALUES (
                            :session_id,
                            :tenant_id,
                            :membership_id,
                            :session_hash,
                            :status,
                            :issued_at,
                            :expires_at,
                            :last_used_at
                        )
                        '''
                    ),
                    {
                        "session_id": "sess_cross_tenant",
                        "tenant_id": "acct_seed",
                        "membership_id": "membership_admin_seed",
                        "session_hash": hash_token("cross-tenant-auth-session"),
                        "status": "active",
                        "issued_at": "2026-04-21T01:00:00+00:00",
                        "expires_at": "2026-04-22T01:00:00+00:00",
                        "last_used_at": "2026-04-21T01:00:00+00:00",
                    },
                )

        with pytest.raises(IntegrityError):
            with admin_engine.begin() as connection:
                connection.execute(
                    text(
                        f'''
                        INSERT INTO "{schema_name}".scope_grants (
                            grant_id,
                            tenant_id,
                            membership_id,
                            scope_kind,
                            scope_id,
                            permission_set,
                            effect,
                            created_at
                        ) VALUES (
                            :grant_id,
                            :tenant_id,
                            :membership_id,
                            :scope_kind,
                            :scope_id,
                            :permission_set,
                            :effect,
                            :created_at
                        )
                        '''
                    ),
                    {
                        "grant_id": "grant_cross_tenant_membership",
                        "tenant_id": "acct_seed",
                        "membership_id": "membership_admin_seed",
                        "scope_kind": "tenant",
                        "scope_id": "acct_seed",
                        "permission_set": "admin",
                        "effect": "allow",
                        "created_at": "2026-04-21T01:05:00+00:00",
                    },
                )

        with pytest.raises(IntegrityError):
            with admin_engine.begin() as connection:
                connection.execute(
                    text(
                        f'''
                        INSERT INTO "{schema_name}".scope_grants (
                            grant_id,
                            tenant_id,
                            service_account_id,
                            scope_kind,
                            scope_id,
                            permission_set,
                            effect,
                            created_at
                        ) VALUES (
                            :grant_id,
                            :tenant_id,
                            :service_account_id,
                            :scope_kind,
                            :scope_id,
                            :permission_set,
                            :effect,
                            :created_at
                        )
                        '''
                    ),
                    {
                        "grant_id": "grant_cross_tenant_service_account",
                        "tenant_id": settings.bootstrap_tenant_id,
                        "service_account_id": "acct_seed",
                        "scope_kind": "tenant",
                        "scope_id": settings.bootstrap_tenant_id,
                        "permission_set": "viewer",
                        "effect": "allow",
                        "created_at": "2026-04-21T01:10:00+00:00",
                    },
                )

        repository.load_state()
        with admin_engine.connect() as connection:
            second_counts = {
                "tenants": _count(connection, "tenants"),
                "principals": _count(connection, "principals"),
                "tenant_memberships": _count(connection, "tenant_memberships"),
                "service_accounts": _count(connection, "service_accounts"),
                "agent_credentials": _count(connection, "agent_credentials"),
                "auth_sessions": _count(connection, "auth_sessions"),
                "audit_events": _count(connection, "audit_events"),
            }
        assert second_counts == first_counts

        service = GovernanceService(settings, repository=repository, harness_service=object())
        actor = AuthenticatedAdmin(
            session_id="sess_seed",
            user_id="admin_seed",
            username="admin",
            display_name="ForgeFrame Admin",
            role="admin",
        )
        created_account = service.create_account(
            label="Tenant B",
            provider_bindings=["gemini"],
            notes="dual-write verification",
            actor=actor,
        )
        assert created_account.label == "Tenant B"

        with admin_engine.connect() as connection:
            post_write_counts = {
                "tenants": _count(connection, "tenants"),
                "service_accounts": _count(connection, "service_accounts"),
                "audit_events": _count(connection, "audit_events"),
            }
            payload = connection.execute(
                text(f'SELECT payload FROM "{schema_name}".governance_state WHERE state_key = :state_key'),
                {"state_key": "default"},
            ).scalar_one()
        assert post_write_counts == {
            "tenants": 3,
            "service_accounts": 2,
            "audit_events": 2,
        }
        assert {item["label"] for item in payload["gateway_accounts"]} == {"Tenant A", "Tenant B"}

        audit_shadow_payload = dict(payload)
        audit_shadow_payload["audit_events"] = []
        with admin_engine.begin() as connection:
            connection.execute(
                text(
                    f'''
                    UPDATE "{schema_name}".governance_state
                    SET payload = CAST(:payload AS jsonb), updated_at = NOW()
                    WHERE state_key = :state_key
                    '''
                ),
                {
                    "payload": json.dumps(audit_shadow_payload),
                    "state_key": "default",
                },
            )

        audit_shadow_repository = PostgresGovernanceRepository(
            scoped_url,
            bootstrap_tenant_id=settings.bootstrap_tenant_id,
            relational_dual_write_enabled=True,
            relational_reads_enabled=False,
        )
        audit_shadow_state = audit_shadow_repository.load_state()
        assert len(audit_shadow_state.audit_events) == 2
        assert {event.target_id for event in audit_shadow_state.audit_events} == {"acct_seed", created_account.account_id}

        stale_same_event_payload = dict(payload)
        stale_same_event_payload["audit_events"] = [
            {
                **event,
                "details": "legacy-json-details",
            }
            if event["event_id"] == "audit_seed_account"
            else event
            for event in stale_same_event_payload["audit_events"]
        ]
        with admin_engine.begin() as connection:
            connection.execute(
                text(
                    f'''
                    UPDATE "{schema_name}".audit_events
                    SET details = :details
                    WHERE event_id = :event_id
                    '''
                ),
                {
                    "details": "relational-truth-details",
                    "event_id": "audit_seed_account",
                },
            )
            connection.execute(
                text(
                    f'''
                    UPDATE "{schema_name}".governance_state
                    SET payload = CAST(:payload AS jsonb), updated_at = NOW()
                    WHERE state_key = :state_key
                    '''
                ),
                {
                    "payload": json.dumps(stale_same_event_payload),
                    "state_key": "default",
                },
            )

        stale_same_event_repository = PostgresGovernanceRepository(
            scoped_url,
            bootstrap_tenant_id=settings.bootstrap_tenant_id,
            relational_dual_write_enabled=True,
            relational_reads_enabled=False,
        )
        stale_same_event_state = stale_same_event_repository.load_state()
        stale_same_event = next(
            event for event in stale_same_event_state.audit_events if event.event_id == "audit_seed_account"
        )
        assert stale_same_event.details == "relational-truth-details"
        with admin_engine.connect() as connection:
            stored_same_event_details = connection.execute(
                text(
                    f'''
                    SELECT details
                    FROM "{schema_name}".audit_events
                    WHERE event_id = :event_id
                    '''
                ),
                {"event_id": "audit_seed_account"},
            ).scalar_one()
        assert stored_same_event_details == "relational-truth-details"

        audit_shadow_service = GovernanceService(
            settings,
            repository=audit_shadow_repository,
            harness_service=object(),
        )
        tenant_events = audit_shadow_service.list_audit_events(limit=10, tenant_id=created_account.account_id)
        assert any(event.action == "account_create" and event.target_id == created_account.account_id for event in tenant_events)

        stale_payload = dict(payload)
        stale_payload["admin_users"] = []
        stale_payload["admin_sessions"] = []
        stale_payload["gateway_accounts"] = []
        stale_payload["runtime_keys"] = []
        stale_payload["audit_events"] = []
        with admin_engine.begin() as connection:
            connection.execute(
                text(
                    f'''
                    UPDATE "{schema_name}".governance_state
                    SET payload = CAST(:payload AS jsonb), updated_at = NOW()
                    WHERE state_key = :state_key
                    '''
                ),
                {
                    "payload": json.dumps(stale_payload),
                    "state_key": "default",
                },
            )

        cutover_settings = settings.model_copy(update={"governance_relational_reads_enabled": True})
        cutover_repository = PostgresGovernanceRepository(
            scoped_url,
            bootstrap_tenant_id=cutover_settings.bootstrap_tenant_id,
            relational_dual_write_enabled=True,
            relational_reads_enabled=True,
        )
        cutover_state = cutover_repository.load_state()
        assert cutover_state.admin_sessions[0].approved_by_user_id == "admin_seed"
        assert cutover_state.admin_sessions[0].approval_request_id == "req_seed"
        cutover_service = GovernanceService(
            cutover_settings,
            repository=cutover_repository,
            harness_service=object(),
        )

        assert [user.username for user in cutover_service.list_admin_users()] == ["admin"]
        assert {account.label for account in cutover_service.list_accounts()} == {"Tenant A", "Tenant B"}
        assert [key.key_id for key in cutover_service.list_runtime_keys()] == ["key_seed"]
        tenant_events = cutover_service.list_audit_events(limit=10, tenant_id=created_account.account_id)
        assert any(event.action == "account_create" and event.target_id == created_account.account_id for event in tenant_events)
    finally:
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()


def test_postgres_governance_migration_backfills_legacy_audit_events_into_relational_table() -> None:
    schema_name = f"test_governance_audit_backfill_{uuid4().hex[:12]}"
    base_url = "postgresql+psycopg://forgegate:forgegate@localhost:5432/forgegate"
    scoped_url = f"{base_url}?options=-csearch_path%3D{schema_name}"
    admin_engine = create_engine(base_url, isolation_level="AUTOCOMMIT")

    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))

    try:
        initial_result = apply_storage_migrations(scoped_url)
        assert initial_result["latest_version"] >= 14

        legacy_state = GovernanceStateRecord(
            audit_events=[
                AuditEventRecord(
                    event_id="audit_seed_admin",
                    actor_type="admin_user",
                    actor_id="admin_seed",
                    tenant_id="acct_seed",
                    company_id="company_seed",
                    action="account_create",
                    target_type="gateway_account",
                    target_id="acct_seed",
                    status="ok",
                    details="Seed account created.",
                    metadata={"account_id": "acct_seed"},
                    created_at="2026-04-22T00:00:00+00:00",
                ),
                AuditEventRecord(
                    event_id="audit_seed_runtime",
                    actor_type="runtime_key",
                    actor_id="key_seed",
                    tenant_id="acct_seed",
                    action="runtime_provider_binding_denied",
                    target_type="provider",
                    target_id="openai_api",
                    status="failed",
                    details="Runtime key denied access to provider 'openai_api'.",
                    metadata={"account_id": "acct_seed", "requested_model": "gpt-4.1-mini"},
                    created_at="2026-04-22T00:05:00+00:00",
                ),
            ],
        )

        with admin_engine.begin() as connection:
            connection.execute(
                text(
                    f'''
                    DELETE FROM "{schema_name}".forgegate_schema_migrations
                    WHERE version = 14
                    '''
                )
            )
            connection.execute(text(f'DELETE FROM "{schema_name}".audit_events'))
            connection.execute(text(f'DELETE FROM "{schema_name}".tenants'))
            connection.execute(
                text(
                    f'''
                    DELETE FROM "{schema_name}".governance_state
                    WHERE state_key = :state_key
                    '''
                ),
                {"state_key": "default"},
            )
            connection.execute(
                text(
                    f'''
                    INSERT INTO "{schema_name}".governance_state (state_key, payload, updated_at)
                    VALUES (:state_key, CAST(:payload AS jsonb), NOW())
                    '''
                ),
                {
                    "state_key": "default",
                    "payload": json.dumps(legacy_state.model_dump()),
                },
            )

        repair_result = apply_storage_migrations(scoped_url)
        assert repair_result["latest_version"] >= 14
        assert 14 in repair_result["applied_versions"]

        with admin_engine.connect() as connection:
            audit_rows = connection.execute(
                text(
                    f'''
                    SELECT
                        event_id,
                        tenant_id,
                        actor_type,
                        metadata->>'legacy_actor_id' AS legacy_actor_id,
                        metadata->>'runtime_key_id' AS runtime_key_id
                    FROM "{schema_name}".audit_events
                    ORDER BY created_at ASC, event_id ASC
                    '''
                )
            ).all()
            tenant_rows = connection.execute(
                text(
                    f'''
                    SELECT tenant_id
                    FROM "{schema_name}".tenants
                    ORDER BY tenant_id ASC
                    '''
                )
            ).all()

        assert [row[0] for row in audit_rows] == ["audit_seed_admin", "audit_seed_runtime"]
        assert all(row[1] == "acct_seed" for row in audit_rows)
        assert audit_rows[0][3] == "admin_seed"
        assert audit_rows[1][4] == "key_seed"
        assert [row[0] for row in tenant_rows] == ["acct_seed"]

        with admin_engine.begin() as connection:
            connection.execute(
                text(
                    f'''
                    DELETE FROM "{schema_name}".forgegate_schema_migrations
                    WHERE version = 14
                    '''
                )
            )

        replay_result = apply_storage_migrations(scoped_url)
        assert 14 in replay_result["applied_versions"]

        with admin_engine.connect() as connection:
            replay_count = int(
                connection.execute(text(f'SELECT count(*) FROM "{schema_name}".audit_events')).scalar_one()
            )

        assert replay_count == 2
    finally:
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()


def test_postgres_governance_migrations_repair_legacy_scope_grant_permission_key() -> None:
    schema_name = f"test_governance_scope_grants_legacy_{uuid4().hex[:12]}"
    base_url = "postgresql+psycopg://forgegate:forgegate@localhost:5432/forgegate"
    scoped_url = f"{base_url}?options=-csearch_path%3D{schema_name}"
    admin_engine = create_engine(base_url, isolation_level="AUTOCOMMIT")

    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))

    try:
        with admin_engine.begin() as connection:
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".tenants (
                        tenant_id VARCHAR(191) PRIMARY KEY,
                        slug VARCHAR(191) NOT NULL UNIQUE,
                        display_name VARCHAR(191) NOT NULL,
                        status VARCHAR(32) NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL,
                        updated_at TIMESTAMPTZ NOT NULL,
                        attributes JSONB NOT NULL DEFAULT '{{}}'::jsonb
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".principals (
                        principal_id VARCHAR(191) PRIMARY KEY,
                        principal_type VARCHAR(32) NOT NULL,
                        external_subject VARCHAR(191),
                        username VARCHAR(191),
                        display_name VARCHAR(191) NOT NULL,
                        status VARCHAR(32) NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL,
                        updated_at TIMESTAMPTZ NOT NULL,
                        attributes JSONB NOT NULL DEFAULT '{{}}'::jsonb
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".tenant_memberships (
                        membership_id VARCHAR(191) PRIMARY KEY,
                        tenant_id VARCHAR(191) NOT NULL REFERENCES "{schema_name}".tenants(tenant_id),
                        principal_id VARCHAR(191) NOT NULL REFERENCES "{schema_name}".principals(principal_id),
                        membership_role VARCHAR(32) NOT NULL,
                        status VARCHAR(32) NOT NULL,
                        created_by_membership_id VARCHAR(191),
                        created_at TIMESTAMPTZ NOT NULL,
                        updated_at TIMESTAMPTZ NOT NULL,
                        attributes JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                        UNIQUE (tenant_id, principal_id)
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".service_accounts (
                        service_account_id VARCHAR(191) PRIMARY KEY,
                        tenant_id VARCHAR(191) NOT NULL REFERENCES "{schema_name}".tenants(tenant_id),
                        slug VARCHAR(191) NOT NULL,
                        display_name VARCHAR(191) NOT NULL,
                        status VARCHAR(32) NOT NULL,
                        owner_membership_id VARCHAR(191),
                        created_at TIMESTAMPTZ NOT NULL,
                        updated_at TIMESTAMPTZ NOT NULL,
                        last_used_at TIMESTAMPTZ,
                        attributes JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                        UNIQUE (tenant_id, slug)
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".scope_grants (
                        grant_id VARCHAR(191) PRIMARY KEY,
                        tenant_id VARCHAR(191) NOT NULL REFERENCES "{schema_name}".tenants(tenant_id),
                        membership_id VARCHAR(191) REFERENCES "{schema_name}".tenant_memberships(membership_id),
                        service_account_id VARCHAR(191) REFERENCES "{schema_name}".service_accounts(service_account_id),
                        scope_kind VARCHAR(32) NOT NULL,
                        scope_id VARCHAR(191),
                        permission_key VARCHAR(64) NOT NULL,
                        effect VARCHAR(16) NOT NULL,
                        created_by_membership_id VARCHAR(191),
                        expires_at TIMESTAMPTZ,
                        created_at TIMESTAMPTZ NOT NULL
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f"""
                    INSERT INTO "{schema_name}".tenants (
                        tenant_id,
                        slug,
                        display_name,
                        status,
                        created_at,
                        updated_at
                    ) VALUES (
                        'tenant_legacy',
                        'tenant-legacy',
                        'Legacy Tenant',
                        'active',
                        NOW(),
                        NOW()
                    )
                    """
                )
            )
            connection.execute(
                text(
                    f"""
                    INSERT INTO "{schema_name}".principals (
                        principal_id,
                        principal_type,
                        username,
                        display_name,
                        status,
                        created_at,
                        updated_at
                    ) VALUES (
                        'principal_legacy',
                        'admin_user',
                        'legacy-admin',
                        'Legacy Admin',
                        'active',
                        NOW(),
                        NOW()
                    )
                    """
                )
            )
            connection.execute(
                text(
                    f"""
                    INSERT INTO "{schema_name}".tenant_memberships (
                        membership_id,
                        tenant_id,
                        principal_id,
                        membership_role,
                        status,
                        created_at,
                        updated_at
                    ) VALUES (
                        'membership_legacy',
                        'tenant_legacy',
                        'principal_legacy',
                        'admin',
                        'active',
                        NOW(),
                        NOW()
                    )
                    """
                )
            )
            connection.execute(
                text(
                    f"""
                    INSERT INTO "{schema_name}".scope_grants (
                        grant_id,
                        tenant_id,
                        membership_id,
                        scope_kind,
                        scope_id,
                        permission_key,
                        effect,
                        created_at
                    ) VALUES (
                        'grant_legacy',
                        'tenant_legacy',
                        'membership_legacy',
                        'tenant',
                        'tenant_legacy',
                        'admin',
                        'allow',
                        NOW()
                    )
                    """
                )
            )

        migration_result = apply_storage_migrations(scoped_url)
        assert migration_result["latest_version"] >= 10

        with admin_engine.connect() as connection:
            repaired_permission_set = connection.execute(
                text(
                    f'''
                    SELECT permission_set
                    FROM "{schema_name}".scope_grants
                    WHERE grant_id = :grant_id
                    '''
                ),
                {"grant_id": "grant_legacy"},
            ).scalar_one()
            columns = {
                row[0]
                for row in connection.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_schema = :schema_name
                          AND table_name = 'scope_grants'
                        """
                    ),
                    {"schema_name": schema_name},
                )
            }
            indexes = {
                row[0]
                for row in connection.execute(
                    text(
                        """
                        SELECT indexname
                        FROM pg_indexes
                        WHERE schemaname = :schema_name
                          AND tablename = 'scope_grants'
                        """
                    ),
                    {"schema_name": schema_name},
                )
            }

        assert repaired_permission_set == "admin"
        assert "permission_set" in columns
        assert "scope_grants_membership_scope_idx" in indexes
        assert "scope_grants_service_account_scope_idx" in indexes
    finally:
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()


def test_postgres_governance_integrity_guard_migration_replays_cleanly() -> None:
    schema_name = f"test_governance_integrity_replay_{uuid4().hex[:12]}"
    base_url = "postgresql+psycopg://forgegate:forgegate@localhost:5432/forgegate"
    scoped_url = f"{base_url}?options=-csearch_path%3D{schema_name}"
    admin_engine = create_engine(base_url, isolation_level="AUTOCOMMIT")

    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))

    try:
        first_result = apply_storage_migrations(scoped_url)
        assert first_result["latest_version"] >= 11

        with admin_engine.begin() as connection:
            connection.execute(
                text(
                    f'''
                    DELETE FROM "{schema_name}".forgegate_schema_migrations
                    WHERE version = 10
                    '''
                )
            )

        replay_result = apply_storage_migrations(scoped_url)
        assert 10 in replay_result["applied_versions"]
        assert 11 in replay_result["skipped_versions"]

        with admin_engine.connect() as connection:
            constraints = {
                row[0]
                for row in connection.execute(
                    text(
                        """
                        SELECT con.conname
                        FROM pg_constraint con
                        JOIN pg_class rel ON rel.oid = con.conrelid
                        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
                        WHERE ns.nspname = :schema_name
                        """
                    ),
                    {"schema_name": schema_name},
                )
            }

        assert {
            "tenant_memberships_tenant_membership_key",
            "service_accounts_tenant_service_account_key",
            "agent_credentials_tenant_credential_key",
            "tenant_memberships_created_by_same_tenant_fk",
            "service_accounts_owner_membership_same_tenant_fk",
            "scope_grants_membership_same_tenant_fk",
            "scope_grants_service_account_same_tenant_fk",
            "scope_grants_created_by_same_tenant_fk",
            "agent_credentials_service_account_same_tenant_fk",
            "agent_credentials_rotated_from_same_tenant_fk",
            "agent_credentials_issued_by_same_tenant_fk",
            "auth_sessions_membership_same_tenant_fk",
        }.issubset(constraints)
    finally:
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()


def test_postgres_governance_migrations_repair_legacy_tenant_shape_when_phase23_marked_applied(
    tmp_path: Path,
) -> None:
    schema_name = f"test_governance_phase23_repair_{uuid4().hex[:12]}"
    base_url = "postgresql+psycopg://forgegate:forgegate@localhost:5432/forgegate"
    scoped_url = f"{base_url}?options=-csearch_path%3D{schema_name}"
    admin_engine = create_engine(base_url, isolation_level="AUTOCOMMIT")

    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))

    try:
        latest_phase23_version = max(
            migration.version
            for migration in list_storage_migrations()
            if migration.version <= 10
        )
        with admin_engine.begin() as connection:
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".forgegate_schema_migrations (
                        version INTEGER PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    '''
                )
            )
            for version in range(1, latest_phase23_version + 1):
                connection.execute(
                    text(
                        f'''
                        INSERT INTO "{schema_name}".forgegate_schema_migrations (version, name)
                        VALUES (:version, :name)
                        '''
                    ),
                    {"version": version, "name": f"legacy_{version}"},
                )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".governance_state (
                        state_key VARCHAR(32) PRIMARY KEY,
                        payload JSONB NOT NULL,
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    INSERT INTO "{schema_name}".governance_state (state_key, payload)
                    VALUES (:state_key, CAST(:payload AS jsonb))
                    '''
                ),
                {
                    "state_key": "default",
                    "payload": json.dumps(GovernanceStateRecord().model_dump()),
                },
            )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".tenants (
                        tenant_id VARCHAR(191) PRIMARY KEY,
                        slug VARCHAR(191) NOT NULL UNIQUE,
                        display_name VARCHAR(191) NOT NULL,
                        status VARCHAR(32) NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL,
                        updated_at TIMESTAMPTZ NOT NULL
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".principals (
                        principal_id VARCHAR(191) PRIMARY KEY,
                        principal_type VARCHAR(32) NOT NULL,
                        display_name VARCHAR(191) NOT NULL,
                        status VARCHAR(32) NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL,
                        updated_at TIMESTAMPTZ NOT NULL
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".tenant_memberships (
                        membership_id VARCHAR(191) PRIMARY KEY,
                        tenant_id VARCHAR(191) NOT NULL REFERENCES "{schema_name}".tenants(tenant_id),
                        principal_id VARCHAR(191) NOT NULL REFERENCES "{schema_name}".principals(principal_id),
                        membership_role VARCHAR(32) NOT NULL,
                        status VARCHAR(32) NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL,
                        updated_at TIMESTAMPTZ NOT NULL,
                        UNIQUE (tenant_id, principal_id)
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".service_accounts (
                        service_account_id VARCHAR(191) PRIMARY KEY,
                        tenant_id VARCHAR(191) NOT NULL REFERENCES "{schema_name}".tenants(tenant_id),
                        slug VARCHAR(191) NOT NULL,
                        display_name VARCHAR(191) NOT NULL,
                        status VARCHAR(32) NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL,
                        updated_at TIMESTAMPTZ NOT NULL,
                        UNIQUE (tenant_id, slug)
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".scope_grants (
                        grant_id VARCHAR(191) PRIMARY KEY,
                        tenant_id VARCHAR(191) NOT NULL REFERENCES "{schema_name}".tenants(tenant_id),
                        membership_id VARCHAR(191) REFERENCES "{schema_name}".tenant_memberships(membership_id),
                        service_account_id VARCHAR(191) REFERENCES "{schema_name}".service_accounts(service_account_id),
                        scope_kind VARCHAR(32) NOT NULL,
                        permission_key VARCHAR(64) NOT NULL,
                        effect VARCHAR(16) NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    INSERT INTO "{schema_name}".tenants (
                        tenant_id,
                        slug,
                        display_name,
                        status,
                        created_at,
                        updated_at
                    ) VALUES (
                        'tenant_bootstrap',
                        'tenant-bootstrap',
                        'Bootstrap Tenant',
                        'active',
                        NOW(),
                        NOW()
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    INSERT INTO "{schema_name}".scope_grants (
                        grant_id,
                        tenant_id,
                        membership_id,
                        service_account_id,
                        scope_kind,
                        permission_key,
                        effect,
                        created_at
                    ) VALUES (
                        'grant_bootstrap',
                        'tenant_bootstrap',
                        NULL,
                        NULL,
                        'tenant',
                        'admin',
                        'allow',
                        NOW()
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".agent_credentials (
                        credential_id VARCHAR(191) PRIMARY KEY,
                        tenant_id VARCHAR(191) NOT NULL REFERENCES "{schema_name}".tenants(tenant_id),
                        service_account_id VARCHAR(191) NOT NULL REFERENCES "{schema_name}".service_accounts(service_account_id),
                        provider_key VARCHAR(64) NOT NULL,
                        credential_kind VARCHAR(32) NOT NULL,
                        slot VARCHAR(64) NOT NULL,
                        secret_ref VARCHAR(191) NOT NULL,
                        secret_hash VARCHAR(191) NOT NULL,
                        status VARCHAR(32) NOT NULL,
                        rotation_state VARCHAR(32) NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL,
                        updated_at TIMESTAMPTZ NOT NULL
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".auth_sessions (
                        session_id VARCHAR(191) PRIMARY KEY,
                        tenant_id VARCHAR(191) NOT NULL REFERENCES "{schema_name}".tenants(tenant_id),
                        membership_id VARCHAR(191) NOT NULL REFERENCES "{schema_name}".tenant_memberships(membership_id),
                        session_hash VARCHAR(191) NOT NULL UNIQUE,
                        status VARCHAR(32) NOT NULL,
                        issued_at TIMESTAMPTZ NOT NULL,
                        expires_at TIMESTAMPTZ NOT NULL,
                        last_used_at TIMESTAMPTZ NOT NULL
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".audit_events (
                        event_id VARCHAR(191) PRIMARY KEY,
                        tenant_id VARCHAR(191) REFERENCES "{schema_name}".tenants(tenant_id),
                        actor_type VARCHAR(32) NOT NULL,
                        action VARCHAR(64) NOT NULL,
                        target_type VARCHAR(64) NOT NULL,
                        target_id VARCHAR(191),
                        status VARCHAR(32) NOT NULL,
                        details TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL
                    )
                    '''
                )
            )
            # Versions 1..10 include the observability tables. Recreate the
            # minimal shapes they contribute so later migrations see a
            # consistent pre-phase23 schema instead of an impossible fixture.
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".usage_events (
                        id BIGSERIAL PRIMARY KEY,
                        tenant_id VARCHAR(191) NOT NULL,
                        provider VARCHAR(191) NOT NULL,
                        model VARCHAR(191) NOT NULL,
                        traffic_type VARCHAR(32) NOT NULL,
                        client_id VARCHAR(191) NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL,
                        payload JSONB NOT NULL
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".error_events (
                        id BIGSERIAL PRIMARY KEY,
                        tenant_id VARCHAR(191) NOT NULL,
                        provider VARCHAR(191),
                        model VARCHAR(191),
                        traffic_type VARCHAR(32) NOT NULL,
                        client_id VARCHAR(191) NOT NULL,
                        error_type VARCHAR(191) NOT NULL,
                        status_code INTEGER NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL,
                        payload JSONB NOT NULL
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".health_events (
                        id BIGSERIAL PRIMARY KEY,
                        tenant_id VARCHAR(191) NOT NULL,
                        provider VARCHAR(64),
                        model VARCHAR(128),
                        check_type VARCHAR(64) NOT NULL,
                        status VARCHAR(64) NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL,
                        payload JSONB NOT NULL
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    CREATE TABLE "{schema_name}".oauth_operations (
                        id BIGSERIAL PRIMARY KEY,
                        tenant_id VARCHAR(191) NOT NULL,
                        provider_key VARCHAR(191) NOT NULL,
                        action VARCHAR(64) NOT NULL,
                        status VARCHAR(64) NOT NULL,
                        details TEXT NOT NULL,
                        executed_at TIMESTAMPTZ NOT NULL,
                        payload JSONB NOT NULL
                    )
                    '''
                )
            )

        migration_result = apply_storage_migrations(scoped_url)
        assert 11 in migration_result["applied_versions"]
        assert 10 in migration_result["skipped_versions"]

        with admin_engine.begin() as connection:
            connection.execute(
                text(
                    f'''
                    INSERT INTO "{schema_name}".principals (
                        principal_id,
                        principal_type,
                        username,
                        display_name,
                        status,
                        created_at,
                        updated_at
                    ) VALUES (
                        'principal_canonical',
                        'admin_user',
                        'canonical-admin',
                        'Canonical Admin',
                        'active',
                        NOW(),
                        NOW()
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    INSERT INTO "{schema_name}".tenant_memberships (
                        membership_id,
                        tenant_id,
                        principal_id,
                        membership_role,
                        status,
                        created_by_membership_id,
                        created_at,
                        updated_at
                    ) VALUES (
                        'membership_canonical',
                        'tenant_bootstrap',
                        'principal_canonical',
                        'admin',
                        'active',
                        NULL,
                        NOW(),
                        NOW()
                    )
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    INSERT INTO "{schema_name}".scope_grants (
                        grant_id,
                        tenant_id,
                        membership_id,
                        service_account_id,
                        scope_kind,
                        scope_id,
                        permission_set,
                        effect,
                        created_by_membership_id,
                        created_at
                    ) VALUES (
                        'grant_canonical',
                        'tenant_bootstrap',
                        'membership_canonical',
                        NULL,
                        'tenant',
                        'tenant_bootstrap',
                        'viewer',
                        'allow',
                        'membership_canonical',
                        NOW()
                    )
                    '''
                )
            )

        with admin_engine.connect() as connection:
            tenant_columns = {
                row[0]
                for row in connection.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_schema = :schema_name
                          AND table_name = 'tenants'
                        """
                    ),
                    {"schema_name": schema_name},
                )
            }
            repaired_permission_set = connection.execute(
                text(
                    f'''
                    SELECT permission_set
                    FROM "{schema_name}".scope_grants
                    WHERE grant_id = :grant_id
                    '''
                ),
                {"grant_id": "grant_bootstrap"},
            ).scalar_one()
            canonical_permission_set = connection.execute(
                text(
                    f'''
                    SELECT permission_set
                    FROM "{schema_name}".scope_grants
                    WHERE grant_id = :grant_id
                    '''
                ),
                {"grant_id": "grant_canonical"},
            ).scalar_one()
            scope_grant_columns = {
                row[0]
                for row in connection.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_schema = :schema_name
                          AND table_name = 'scope_grants'
                        """
                    ),
                    {"schema_name": schema_name},
                )
            }
            constraints = {
                row[0]
                for row in connection.execute(
                    text(
                        """
                        SELECT con.conname
                        FROM pg_constraint con
                        JOIN pg_class rel ON rel.oid = con.conrelid
                        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
                        WHERE ns.nspname = :schema_name
                        """
                    ),
                    {"schema_name": schema_name},
                )
            }

        settings = Settings(
            governance_storage_backend="postgresql",
            governance_postgres_url=scoped_url,
            governance_state_path=str(tmp_path / "ignored_governance_state.json"),
            bootstrap_admin_password="ForgeFrame-Bootstrap-123",
        )
        service = GovernanceService(
            settings,
            repository=PostgresGovernanceRepository(scoped_url),
            harness_service=object(),
        )

        assert [user.username for user in service.list_admin_users()] == ["admin"]
        assert "attributes" in tenant_columns
        assert repaired_permission_set == "admin"
        assert canonical_permission_set == "viewer"
        assert "permission_set" in scope_grant_columns
        assert "permission_key" not in scope_grant_columns
        assert {
            "tenant_memberships_tenant_membership_key",
            "service_accounts_tenant_service_account_key",
            "agent_credentials_tenant_credential_key",
            "tenant_memberships_created_by_same_tenant_fk",
            "service_accounts_owner_membership_same_tenant_fk",
            "scope_grants_membership_same_tenant_fk",
            "scope_grants_service_account_same_tenant_fk",
            "scope_grants_created_by_same_tenant_fk",
            "agent_credentials_service_account_same_tenant_fk",
            "agent_credentials_rotated_from_same_tenant_fk",
            "agent_credentials_issued_by_same_tenant_fk",
            "auth_sessions_membership_same_tenant_fk",
        }.issubset(constraints)
    finally:
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()


def test_postgres_governance_migrations_repair_legacy_principal_must_rotate_password_default() -> None:
    schema_name = f"test_governance_principal_default_repair_{uuid4().hex[:12]}"
    base_url = "postgresql+psycopg://forgegate:forgegate@localhost:5432/forgegate"
    scoped_url = f"{base_url}?options=-csearch_path%3D{schema_name}"
    admin_engine = create_engine(base_url, isolation_level="AUTOCOMMIT")

    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))

    try:
        initial_result = apply_storage_migrations(scoped_url)
        assert initial_result["latest_version"] >= 12

        salt = new_secret_salt()
        legacy_state = GovernanceStateRecord(
            admin_users=[
                AdminUserRecord(
                    user_id="admin_seed",
                    username="admin",
                    display_name="ForgeFrame Admin",
                    role="admin",
                    status="active",
                    password_hash=hash_password("Operator-Seed-123", salt),
                    password_salt=salt,
                    must_rotate_password=False,
                    created_at="2026-04-22T00:00:00+00:00",
                    updated_at="2026-04-22T00:00:00+00:00",
                    created_by="system",
                )
            ]
        )

        with admin_engine.begin() as connection:
            connection.execute(
                text(
                    f'''
                    DELETE FROM "{schema_name}".forgegate_schema_migrations
                    WHERE version = 12
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    ALTER TABLE "{schema_name}".principals
                    ADD COLUMN password_hash VARCHAR(191)
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    ALTER TABLE "{schema_name}".principals
                    ADD COLUMN password_salt VARCHAR(191)
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    ALTER TABLE "{schema_name}".principals
                    ALTER COLUMN must_rotate_password DROP DEFAULT
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    ALTER TABLE "{schema_name}".principals
                    ADD COLUMN last_login_at TIMESTAMPTZ
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    ALTER TABLE "{schema_name}".principals
                    ADD COLUMN created_by VARCHAR(64)
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    DELETE FROM "{schema_name}".governance_state
                    WHERE state_key = :state_key
                    '''
                ),
                {"state_key": "default"},
            )
            connection.execute(
                text(
                    f'''
                    INSERT INTO "{schema_name}".governance_state (state_key, payload, updated_at)
                    VALUES (:state_key, CAST(:payload AS jsonb), NOW())
                    '''
                ),
                {
                    "state_key": "default",
                    "payload": json.dumps(legacy_state.model_dump()),
                },
            )

        repair_result = apply_storage_migrations(scoped_url)
        assert repair_result["latest_version"] >= 12
        assert 12 in repair_result["applied_versions"]

        with admin_engine.connect() as connection:
            column_default = connection.execute(
                text(
                    """
                    SELECT column_default
                    FROM information_schema.columns
                    WHERE table_schema = :schema_name
                      AND table_name = 'principals'
                      AND column_name = 'must_rotate_password'
                    """
                ),
                {"schema_name": schema_name},
            ).scalar_one()

        assert column_default is not None
        assert "true" in column_default.lower()

        repository = PostgresGovernanceRepository(scoped_url)
        loaded_state = repository.load_state()

        assert len(loaded_state.admin_users) == 1
        assert loaded_state.admin_users[0].username == "admin"
        assert loaded_state.admin_users[0].must_rotate_password is False

        with admin_engine.connect() as connection:
            relational_flag = connection.execute(
                text(
                    f'''
                    SELECT attributes->>'must_rotate_password'
                    FROM "{schema_name}".principals
                    WHERE principal_id = :principal_id
                    '''
                ),
                {"principal_id": "admin_seed"},
            ).scalar_one()

        assert relational_flag == "false"
    finally:
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()


def test_postgres_governance_migrations_repair_legacy_shadow_default_columns() -> None:
    schema_name = f"test_governance_shadow_default_repair_{uuid4().hex[:12]}"
    base_url = "postgresql+psycopg://forgegate:forgegate@localhost:5432/forgegate"
    scoped_url = f"{base_url}?options=-csearch_path%3D{schema_name}"
    admin_engine = create_engine(base_url, isolation_level="AUTOCOMMIT")

    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))

    try:
        initial_result = apply_storage_migrations(scoped_url)
        assert initial_result["latest_version"] >= 14

        salt = new_secret_salt()
        legacy_state = GovernanceStateRecord(
            admin_users=[
                AdminUserRecord(
                    user_id="admin_seed",
                    username="admin",
                    display_name="ForgeFrame Admin",
                    role="admin",
                    status="active",
                    password_hash=hash_password("Operator-Seed-123", salt),
                    password_salt=salt,
                    must_rotate_password=False,
                    created_at="2026-04-22T00:00:00+00:00",
                    updated_at="2026-04-22T00:00:00+00:00",
                    created_by="system",
                )
            ],
            admin_sessions=[
                AdminSessionRecord(
                    session_id="sess_seed",
                    user_id="admin_seed",
                    token_hash=hash_token("fgas_seed_shadow_session"),
                    role="admin",
                    session_type="standard",
                    created_at="2026-04-22T00:05:00+00:00",
                    expires_at="2026-04-23T00:05:00+00:00",
                    last_used_at="2026-04-22T00:05:00+00:00",
                    issued_by_user_id="admin_seed",
                    approved_by_user_id="admin_seed",
                    approval_reference="INC-SHADOW",
                )
            ],
            gateway_accounts=[
                GatewayAccountRecord(
                    account_id="acct_shadow",
                    label="Shadow Account",
                    provider_bindings=["openai_api"],
                    notes="legacy shadow account",
                    created_at="2026-04-22T00:10:00+00:00",
                    updated_at="2026-04-22T00:10:00+00:00",
                    last_activity_at="2026-04-22T00:15:00+00:00",
                )
            ],
            runtime_keys=[
                RuntimeKeyRecord(
                    key_id="key_shadow",
                    account_id="acct_shadow",
                    label="Shadow Runtime Key",
                    prefix="fg_shadow",
                    secret_hash="hash_shadow",
                    scopes=["models:read"],
                    status="active",
                    created_at="2026-04-22T00:20:00+00:00",
                    updated_at="2026-04-22T00:20:00+00:00",
                    last_used_at="2026-04-22T00:21:00+00:00",
                    created_by="admin_seed",
                )
            ],
        )

        with admin_engine.begin() as connection:
            connection.execute(
                text(
                    f'''
                    DELETE FROM "{schema_name}".forgegate_schema_migrations
                    WHERE version = 13
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    ALTER TABLE "{schema_name}".service_accounts
                    ALTER COLUMN source_kind DROP DEFAULT
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    ALTER TABLE "{schema_name}".service_accounts
                    ALTER COLUMN notes DROP DEFAULT
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    ALTER TABLE "{schema_name}".service_accounts
                    ALTER COLUMN provider_bindings DROP DEFAULT
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    ALTER TABLE "{schema_name}".agent_credentials
                    ALTER COLUMN label DROP DEFAULT
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    ALTER TABLE "{schema_name}".agent_credentials
                    ALTER COLUMN permission_scopes DROP DEFAULT
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    ALTER TABLE "{schema_name}".auth_sessions
                    ALTER COLUMN session_role DROP DEFAULT
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    ALTER TABLE "{schema_name}".auth_sessions
                    ALTER COLUMN session_type DROP DEFAULT
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    ALTER TABLE "{schema_name}".auth_sessions
                    ALTER COLUMN created_at DROP DEFAULT
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    ALTER TABLE "{schema_name}".auth_sessions
                    ALTER COLUMN updated_at DROP DEFAULT
                    '''
                )
            )
            connection.execute(
                text(
                    f'''
                    DELETE FROM "{schema_name}".governance_state
                    WHERE state_key = :state_key
                    '''
                ),
                {"state_key": "default"},
            )
            connection.execute(
                text(
                    f'''
                    INSERT INTO "{schema_name}".governance_state (state_key, payload, updated_at)
                    VALUES (:state_key, CAST(:payload AS jsonb), NOW())
                    '''
                ),
                {
                    "state_key": "default",
                    "payload": json.dumps(legacy_state.model_dump()),
                },
            )

        repair_result = apply_storage_migrations(scoped_url)
        assert repair_result["latest_version"] >= 14
        assert 13 in repair_result["applied_versions"]

        with admin_engine.connect() as connection:
            defaults = {
                row[0]: row[1]
                for row in connection.execute(
                    text(
                        """
                        SELECT column_name, column_default
                        FROM information_schema.columns
                        WHERE table_schema = :schema_name
                          AND (
                              (table_name = 'service_accounts' AND column_name IN ('source_kind', 'notes', 'provider_bindings'))
                              OR (table_name = 'agent_credentials' AND column_name IN ('label', 'permission_scopes'))
                              OR (table_name = 'auth_sessions' AND column_name IN ('session_role', 'session_type', 'created_at', 'updated_at'))
                          )
                        """
                    ),
                    {"schema_name": schema_name},
                )
            }

        assert defaults["source_kind"] == "'relational_shadow'::character varying"
        assert defaults["notes"] == "''::text"
        assert defaults["provider_bindings"] == "'[]'::jsonb"
        assert defaults["label"] == "''::character varying"
        assert defaults["permission_scopes"] == "'[]'::jsonb"
        assert defaults["session_role"] == "'viewer'::character varying"
        assert defaults["session_type"] == "'standard'::character varying"
        assert "now()" in defaults["created_at"].lower()
        assert "now()" in defaults["updated_at"].lower()

        repository = PostgresGovernanceRepository(scoped_url)
        loaded_state = repository.load_state()

        assert len(loaded_state.gateway_accounts) == 1
        assert loaded_state.gateway_accounts[0].account_id == "acct_shadow"
        assert loaded_state.gateway_accounts[0].provider_bindings == ["openai_api"]
        assert loaded_state.gateway_accounts[0].notes == "legacy shadow account"

        assert len(loaded_state.runtime_keys) == 1
        assert loaded_state.runtime_keys[0].key_id == "key_shadow"
        assert loaded_state.runtime_keys[0].label == "Shadow Runtime Key"
        assert loaded_state.runtime_keys[0].scopes == ["models:read"]

        assert len(loaded_state.admin_sessions) == 1
        assert loaded_state.admin_sessions[0].role == "admin"
        assert loaded_state.admin_sessions[0].session_type == "standard"
    finally:
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()
