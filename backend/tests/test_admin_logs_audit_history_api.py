import os
from uuid import uuid4

from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers, login_headers_allowing_password_rotation
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.governance.service import get_governance_service
from app.main import app
from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID
from app.usage.analytics import get_usage_analytics_store


def _clear_dependency_caches() -> None:
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    get_usage_analytics_store.cache_clear()


def _admin_login(client: TestClient) -> tuple[dict[str, str], str]:
    headers = shared_admin_headers(client)
    return headers, headers["Authorization"].removeprefix("Bearer ")


def _issue_runtime_key(client: TestClient, headers: dict[str, str], *, label: str) -> tuple[str, str]:
    account_response = client.post("/admin/accounts/", headers=headers, json={"label": label})
    assert account_response.status_code == 201
    account_id = account_response.json()["account"]["account_id"]

    key_response = client.post(
        "/admin/keys/",
        headers=headers,
        json={
            "label": f"{label} Key",
            "account_id": account_id,
            "scopes": ["models:read", "chat:write", "responses:write"],
        },
    )
    assert key_response.status_code == 201
    return account_id, key_response.json()["issued"]["key_id"]


def _create_user_headers(
    client: TestClient,
    creator_headers: dict[str, str],
    *,
    role: str,
) -> tuple[dict[str, object], dict[str, str]]:
    suffix = uuid4().hex[:8]
    password = f"ForgeFrame-{role}-pass-123"
    created = client.post(
        "/admin/security/users",
        headers=creator_headers,
        json={
            "username": f"{role}-{suffix}",
            "display_name": f"{role.title()} {suffix}",
            "role": role,
            "password": password,
        },
    )
    assert created.status_code == 201
    return created.json()["user"], _admin_login_with_password(
        client,
        username=created.json()["user"]["username"],
        password=password,
    )


def _admin_login_with_password(
    client: TestClient,
    *,
    username: str,
    password: str,
) -> dict[str, str]:
    return login_headers_allowing_password_rotation(client, username=username, password=password)


def _activate_impersonation_headers(
    client: TestClient,
    requester_headers: dict[str, str],
    approver_headers: dict[str, str],
    *,
    target_user_id: str,
) -> dict[str, str]:
    request = client.post(
        "/admin/security/impersonations",
        headers=requester_headers,
        json={
            "target_user_id": target_user_id,
            "approval_reference": "INC-AUDIT-HISTORY",
            "justification": "Verify read-only audit history access without reopening viewer scope.",
            "notification_targets": ["slack://security-audit"],
            "duration_minutes": 15,
        },
    )
    assert request.status_code == 202
    request_id = request.json()["request"]["request_id"]

    approval = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/approve",
        headers=approver_headers,
        json={"decision_note": "Approved for audit history authorization verification."},
    )
    assert approval.status_code == 200

    issued = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/issue",
        headers=requester_headers,
    )
    assert issued.status_code == 201
    return {"Authorization": f"Bearer {issued.json()['access_token']}"}


def test_logs_overview_returns_normalized_audit_preview_and_retention_summary() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    headers, _token = _admin_login(client)
    tenant_id, _key_id = _issue_runtime_key(client, headers, label="Preview Tenant")
    governance = get_governance_service()

    logs = client.get(f"/admin/logs/?tenantId={tenant_id}", headers=headers)

    assert logs.status_code == 200
    payload = logs.json()
    assert payload["audit_preview"]
    assert payload["audit_preview"][0]["eventId"] == governance.list_audit_events(limit=1, tenant_id=tenant_id)[0].event_id
    assert payload["audit_retention"]["eventLimit"] >= 100
    assert "latestEventAt" in payload["audit_retention"]


def test_logs_overview_does_not_expose_raw_audit_events_or_metadata() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    headers, token = _admin_login(client)
    governance = get_governance_service()
    admin = governance.authenticate_admin_token(token)

    governance.record_admin_audit_event(
        actor=admin,
        action="setting_override_upsert",
        target_type="setting",
        target_id="app_name",
        status="ok",
        details="Setting 'app_name' updated.",
        metadata={
            "reason": "overview smoke",
            "access_token": "top-secret-token",
        },
        tenant_id=DEFAULT_BOOTSTRAP_TENANT_ID,
    )

    logs = client.get(
        f"/admin/logs/?tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}",
        headers=headers,
    )

    assert logs.status_code == 200
    payload = logs.json()
    assert "audit_events" not in payload
    assert payload["audit_preview"]
    assert "access_token" not in logs.text
    assert "top-secret-token" not in logs.text


def test_audit_history_requires_tenant_filter_and_scopes_with_cursor() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    headers, _token = _admin_login(client)
    tenant_a, _key_a = _issue_runtime_key(client, headers, label="Tenant A")
    tenant_b, _key_b = _issue_runtime_key(client, headers, label="Tenant B")

    unscoped = client.get("/admin/logs/audit-events?window=all", headers=headers)
    assert unscoped.status_code == 400
    assert unscoped.json()["error"]["type"] == "tenant_filter_required"

    first_page = client.get(
        f"/admin/logs/audit-events?tenantId={tenant_a}&window=all&limit=1",
        headers=headers,
    )
    assert first_page.status_code == 200
    first_payload = first_page.json()
    assert first_payload["status"] == "ok"
    assert len(first_payload["items"]) == 1
    assert first_payload["page"]["hasMore"] is True
    assert first_payload["page"]["nextCursor"]
    assert first_payload["retention"]["oldestAvailableAt"] is not None
    assert first_payload["summary"]["totalInScope"] >= 1
    assert all(item["tenantId"] == tenant_a for item in first_payload["items"])

    second_page = client.get(
        f"/admin/logs/audit-events?tenantId={tenant_a}&window=all&limit=1&cursor={first_payload['page']['nextCursor']}",
        headers=headers,
    )
    assert second_page.status_code == 200
    second_payload = second_page.json()
    assert len(second_payload["items"]) == 1
    assert second_payload["items"][0]["eventId"] != first_payload["items"][0]["eventId"]

    bad_cursor = client.get(
        f"/admin/logs/audit-events?tenantId={tenant_a}&window=all&cursor=not-a-cursor",
        headers=headers,
    )
    assert bad_cursor.status_code == 400
    assert bad_cursor.json()["error"]["type"] == "invalid_audit_cursor"


def test_audit_history_detail_requires_tenant_filter_for_mixed_history() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    headers, _token = _admin_login(client)
    tenant_a, _key_a = _issue_runtime_key(client, headers, label="Tenant A Detail")
    _tenant_b, _key_b = _issue_runtime_key(client, headers, label="Tenant B Detail")
    event = get_governance_service().list_audit_events(limit=1, tenant_id=tenant_a)[0]

    unscoped = client.get(f"/admin/logs/audit-events/{event.event_id}", headers=headers)
    assert unscoped.status_code == 400
    assert unscoped.json()["error"]["type"] == "tenant_filter_required"

    scoped = client.get(
        f"/admin/logs/audit-events/{event.event_id}?tenantId={tenant_a}",
        headers=headers,
    )
    assert scoped.status_code == 200
    assert scoped.json()["event"]["eventId"] == event.event_id


def test_viewer_cannot_access_audit_history_or_detail() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    admin_headers, _token = _admin_login(client)
    tenant_id, _key_id = _issue_runtime_key(client, admin_headers, label="Viewer Restricted Tenant")
    event = get_governance_service().list_audit_events(limit=1, tenant_id=tenant_id)[0]
    _viewer_user, viewer_headers = _create_user_headers(client, admin_headers, role="viewer")

    history = client.get(
        f"/admin/logs/audit-events?tenantId={tenant_id}&window=all",
        headers=viewer_headers,
    )
    assert history.status_code == 403
    assert history.json()["error"]["type"] == "operator_role_required"
    assert history.json()["error"]["message"] == "Operator role required."

    detail = client.get(
        f"/admin/logs/audit-events/{event.event_id}?tenantId={tenant_id}",
        headers=viewer_headers,
    )
    assert detail.status_code == 403
    assert detail.json()["error"]["type"] == "operator_role_required"
    assert detail.json()["error"]["message"] == "Operator role required."


def test_audit_history_requires_admin_auth_with_normalized_error_envelope() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    admin_headers, _token = _admin_login(client)
    tenant_id, _key_id = _issue_runtime_key(client, admin_headers, label="Unauthenticated Audit Tenant")
    event = get_governance_service().list_audit_events(limit=1, tenant_id=tenant_id)[0]

    history = client.get(
        f"/admin/logs/audit-events?tenantId={tenant_id}&window=all",
    )
    assert history.status_code == 401
    assert history.json()["error"]["type"] == "admin_auth_required"
    assert history.json()["error"]["message"] == "Admin authentication required."

    detail = client.get(
        f"/admin/logs/audit-events/{event.event_id}?tenantId={tenant_id}",
    )
    assert detail.status_code == 401
    assert detail.json()["error"]["type"] == "admin_auth_required"
    assert detail.json()["error"]["message"] == "Admin authentication required."


def test_read_only_impersonation_can_access_audit_history_and_detail() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    admin_headers, _token = _admin_login(client)
    tenant_id, _key_id = _issue_runtime_key(client, admin_headers, label="Impersonation Audit Tenant")
    event = get_governance_service().list_audit_events(limit=1, tenant_id=tenant_id)[0]
    target_user, _target_headers = _create_user_headers(client, admin_headers, role="operator")
    _approver_user, approver_headers = _create_user_headers(client, admin_headers, role="admin")
    impersonation_headers = _activate_impersonation_headers(
        client,
        admin_headers,
        approver_headers,
        target_user_id=str(target_user["user_id"]),
    )

    history = client.get(
        f"/admin/logs/audit-events?tenantId={tenant_id}&window=all",
        headers=impersonation_headers,
    )
    assert history.status_code == 200
    assert history.json()["items"]
    assert history.json()["items"][0]["eventId"] == event.event_id

    detail = client.get(
        f"/admin/logs/audit-events/{event.event_id}?tenantId={tenant_id}",
        headers=impersonation_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["event"]["eventId"] == event.event_id


def test_audit_history_detail_redacts_sensitive_metadata_and_links_related_route() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    headers, token = _admin_login(client)
    governance = get_governance_service()
    admin = governance.authenticate_admin_token(token)

    governance.record_admin_audit_event(
        actor=admin,
        action="setting_override_upsert",
        target_type="setting",
        target_id="app_name",
        status="ok",
        details="Setting 'app_name' updated.",
        metadata={
            "reason": "manual verification",
            "access_token": "top-secret-token",
        },
        tenant_id=DEFAULT_BOOTSTRAP_TENANT_ID,
    )
    event = governance.list_audit_events(limit=1, tenant_id=DEFAULT_BOOTSTRAP_TENANT_ID)[0]

    detail = client.get(
        f"/admin/logs/audit-events/{event.event_id}?tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}",
        headers=headers,
    )

    assert detail.status_code == 200
    payload = detail.json()
    assert payload["status"] == "ok"
    assert payload["event"]["eventId"] == event.event_id
    assert payload["rawMetadata"]["access_token"] == "[redacted]"
    assert any(item["path"] == "access_token" for item in payload["redactions"])
    assert any(item["label"] == "Reason" and item["value"] == "manual verification" for item in payload["changeContext"])
    assert any(link["href"] == "/settings" for link in payload["relatedLinks"])
