from typing import Any
from uuid import uuid4

from conftest import admin_headers as shared_admin_headers
from conftest import login_headers_allowing_password_rotation
from fastapi.testclient import TestClient

from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.governance.service import get_governance_service
from app.main import app
from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID
from app.usage.analytics import ClientIdentity, get_usage_analytics_store


def _clear_dependency_caches() -> None:
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    get_usage_analytics_store.cache_clear()


def _admin_login(client: TestClient) -> tuple[dict[str, str], str]:
    headers = shared_admin_headers(client)
    return headers, headers["Authorization"].removeprefix("Bearer ")


def _default_instance_id(client: TestClient, headers: dict[str, str]) -> str:
    response = client.get("/admin/instances/", headers=headers)
    assert response.status_code == 200
    return response.json()["instances"][0]["instance_id"]


def _latest_audit_event_id(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID,
    company_id: str | None = None,
) -> str:
    company_query = f"&companyId={company_id}" if company_id else ""
    history = client.get(
        f"/admin/logs/audit-events?instanceId={instance_id}&tenantId={tenant_id}&window=all&limit=1{company_query}",
        headers=headers,
    )
    assert history.status_code == 200
    payload = history.json()
    assert payload["items"]
    return payload["items"][0]["eventId"]


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
) -> tuple[dict[str, Any], dict[str, str]]:
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
    instance_id = _default_instance_id(client, headers)
    _account_id, _key_id = _issue_runtime_key(client, headers, label="Preview Tenant")
    governance = get_governance_service()

    logs = client.get(
        f"/admin/logs/?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}",
        headers=headers,
    )

    assert logs.status_code == 200
    payload = logs.json()
    assert payload["audit_preview"]
    assert payload["audit_preview"][0]["eventId"] == governance.list_audit_events(limit=1, tenant_id=DEFAULT_BOOTSTRAP_TENANT_ID)[0].event_id
    assert payload["audit_retention"]["eventLimit"] >= 100
    assert "latestEventAt" in payload["audit_retention"]
    assert "correlation" in payload["audit_preview"][0]


def test_logs_overview_does_not_expose_raw_audit_events_or_metadata() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    headers, token = _admin_login(client)
    instance_id = _default_instance_id(client, headers)
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
        f"/admin/logs/?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}",
        headers=headers,
    )

    assert logs.status_code == 200
    payload = logs.json()
    assert "audit_events" not in payload
    assert payload["audit_preview"]
    assert "access_token" not in logs.text
    assert "top-secret-token" not in logs.text


def test_logs_overview_groups_security_and_tls_incidents_for_errors_surface() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    headers, _token = _admin_login(client)
    instance_id = _default_instance_id(client, headers)
    analytics = get_usage_analytics_store()

    analytics.record_runtime_error(
        provider=None,
        model=None,
        client=ClientIdentity(client_id="incident-suite", consumer="tests", integration="pytest"),
        route="/v1/responses",
        stream_mode="non_stream",
        error_type="permission_denied",
        status_code=403,
    )
    analytics.record_runtime_error(
        provider=None,
        model=None,
        client=ClientIdentity(client_id="incident-suite", consumer="tests", integration="pytest"),
        route="/ingress/callback",
        stream_mode="non_stream",
        error_type="tls_certificate_expired",
        status_code=503,
    )

    logs = client.get(
        f"/admin/logs/?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}",
        headers=headers,
    )

    assert logs.status_code == 200
    axes = {item["axis"]: item for item in logs.json()["incident_review"]["axes"]}
    assert axes["security"]["severity"] == "critical"
    assert axes["security"]["count"] == 1
    assert axes["security"]["next_step"] == "Open Security & Policies to inspect permissions, approvals, or request-path gates."
    assert axes["tls"]["severity"] == "critical"
    assert axes["tls"]["count"] == 1
    assert axes["tls"]["summary"] == "Most common TLS error: tls_certificate_expired."


def test_logs_overview_exposes_blocked_routing_failures_with_reason_categories() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    headers, _token = _admin_login(client)
    instance_id = _default_instance_id(client, headers)

    try:
        budget_update = client.patch(
            "/admin/routing/budget",
            headers=headers,
            json={"hard_blocked": True, "reason": "incident budget freeze"},
        )
        assert budget_update.status_code == 200

        simulation = client.post(
            "/admin/routing/simulate",
            headers=headers,
            json={"prompt": "This request should be blocked for incident review coverage."},
        )
        assert simulation.status_code == 200
        assert simulation.json()["error"]["type"] == "routing_budget_exceeded"

        logs = client.get(
            f"/admin/logs/?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}",
            headers=headers,
        )

        assert logs.status_code == 200
        payload = logs.json()["incident_review"]
        assert payload["blocked_routing_failures"]
        assert payload["blocked_routing_failures"][0]["error_type"] == "routing_budget_exceeded"
        assert payload["blocked_routing_failures"][0]["reason_category"] == "budget"
        assert payload["blocked_routing_failures"][0]["links"] == [
            {"label": "Open Routing", "href": "/routing"},
            {"label": "Open Costs", "href": "/costs"},
        ]
        axes = {item["axis"]: item for item in payload["axes"]}
        assert axes["routing"]["severity"] == "critical"
        assert axes["routing"]["count"] >= 1
    finally:
        reset = client.patch(
            "/admin/routing/budget",
            headers=headers,
            json={"hard_blocked": False, "reason": "reset after incident review test"},
        )
        assert reset.status_code == 200


def test_logs_overview_treats_budget_blocked_without_failure_row_as_active_routing_incident() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    headers, _token = _admin_login(client)
    instance_id = _default_instance_id(client, headers)

    try:
        budget_update = client.patch(
            "/admin/routing/budget",
            headers=headers,
            json={"hard_blocked": True, "reason": "preemptive budget freeze"},
        )
        assert budget_update.status_code == 200

        logs = client.get(
            f"/admin/logs/?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}",
            headers=headers,
        )

        assert logs.status_code == 200
        axes = {item["axis"]: item for item in logs.json()["incident_review"]["axes"]}
        routing_axis = axes["routing"]
        assert routing_axis["severity"] == "critical"
        assert routing_axis["count"] == 0
        assert routing_axis["current_effect"] == "Routing decisions are being blocked by policy, budget, circuit, or capability posture."
        assert routing_axis["next_step"] == "Open Routing to inspect policy stage, budget gates, and blocked candidates."
        assert routing_axis["summary"] == "Blocked decisions: 0 · open circuits: 0 · budget blocked: yes."
    finally:
        reset = client.patch(
            "/admin/routing/budget",
            headers=headers,
            json={"hard_blocked": False, "reason": "reset after incident review test"},
        )
        assert reset.status_code == 200


def test_audit_history_uses_instance_scope_and_supports_cursor() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    headers, _token = _admin_login(client)
    instance_id = _default_instance_id(client, headers)
    _account_a, _key_a = _issue_runtime_key(client, headers, label="Tenant A")
    _account_b, _key_b = _issue_runtime_key(client, headers, label="Tenant B")

    unscoped = client.get(f"/admin/logs/audit-events?instanceId={instance_id}&window=all", headers=headers)
    assert unscoped.status_code == 200
    assert unscoped.json()["items"]

    first_page = client.get(
        f"/admin/logs/audit-events?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}&window=all&limit=1",
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
    assert all(item["tenantId"] == DEFAULT_BOOTSTRAP_TENANT_ID for item in first_payload["items"])

    second_page = client.get(
        f"/admin/logs/audit-events?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}&window=all&limit=1&cursor={first_payload['page']['nextCursor']}",
        headers=headers,
    )
    assert second_page.status_code == 200
    second_payload = second_page.json()
    assert len(second_payload["items"]) == 1
    assert second_payload["items"][0]["eventId"] != first_payload["items"][0]["eventId"]

    bad_cursor = client.get(
        f"/admin/logs/audit-events?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}&window=all&cursor=not-a-cursor",
        headers=headers,
    )
    assert bad_cursor.status_code == 400
    assert bad_cursor.json()["error"]["type"] == "invalid_audit_cursor"


def test_audit_history_detail_supports_instance_scoped_lookup_with_optional_tenant_filter() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    headers, _token = _admin_login(client)
    instance_id = _default_instance_id(client, headers)
    _account_a, _key_a = _issue_runtime_key(client, headers, label="Tenant A Detail")
    _account_b, _key_b = _issue_runtime_key(client, headers, label="Tenant B Detail")
    event_id = _latest_audit_event_id(client, headers, instance_id=instance_id)

    unscoped = client.get(
        f"/admin/logs/audit-events/{event_id}?instanceId={instance_id}",
        headers=headers,
    )
    assert unscoped.status_code == 200
    assert unscoped.json()["event"]["eventId"] == event_id

    scoped = client.get(
        f"/admin/logs/audit-events/{event_id}?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}",
        headers=headers,
    )
    assert scoped.status_code == 200
    assert scoped.json()["event"]["eventId"] == event_id


def test_viewer_cannot_access_audit_history_or_detail() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    admin_headers, _token = _admin_login(client)
    instance_id = _default_instance_id(client, admin_headers)
    _account_id, _key_id = _issue_runtime_key(client, admin_headers, label="Viewer Restricted Tenant")
    event_id = _latest_audit_event_id(client, admin_headers, instance_id=instance_id)
    _viewer_user, viewer_headers = _create_user_headers(client, admin_headers, role="viewer")

    history = client.get(
        f"/admin/logs/audit-events?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}&window=all",
        headers=viewer_headers,
    )
    assert history.status_code == 403
    assert history.json()["error"]["type"] == "operator_role_required"
    assert history.json()["error"]["message"] == "Operator role required."

    detail = client.get(
        f"/admin/logs/audit-events/{event_id}?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}",
        headers=viewer_headers,
    )
    assert detail.status_code == 403
    assert detail.json()["error"]["type"] == "operator_role_required"
    assert detail.json()["error"]["message"] == "Operator role required."


def test_audit_history_requires_admin_auth_with_normalized_error_envelope() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    admin_headers, _token = _admin_login(client)
    instance_id = _default_instance_id(client, admin_headers)
    _account_id, _key_id = _issue_runtime_key(client, admin_headers, label="Unauthenticated Audit Tenant")
    event_id = _latest_audit_event_id(client, admin_headers, instance_id=instance_id)

    history = client.get(
        f"/admin/logs/audit-events?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}&window=all",
    )
    assert history.status_code == 401
    assert history.json()["error"]["type"] == "admin_auth_required"
    assert history.json()["error"]["message"] == "Admin authentication required."

    detail = client.get(
        f"/admin/logs/audit-events/{event_id}?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}",
    )
    assert detail.status_code == 401
    assert detail.json()["error"]["type"] == "admin_auth_required"
    assert detail.json()["error"]["message"] == "Admin authentication required."


def test_read_only_impersonation_can_access_audit_history_and_detail() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    admin_headers, _token = _admin_login(client)
    instance_id = _default_instance_id(client, admin_headers)
    _account_id, _key_id = _issue_runtime_key(client, admin_headers, label="Impersonation Audit Tenant")
    event_id = _latest_audit_event_id(client, admin_headers, instance_id=instance_id)
    target_user, _target_headers = _create_user_headers(client, admin_headers, role="operator")
    _approver_user, approver_headers = _create_user_headers(client, admin_headers, role="admin")
    impersonation_headers = _activate_impersonation_headers(
        client,
        admin_headers,
        approver_headers,
        target_user_id=str(target_user["user_id"]),
    )

    history = client.get(
        f"/admin/logs/audit-events?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}&window=all",
        headers=impersonation_headers,
    )
    assert history.status_code == 200
    assert history.json()["items"]
    assert any(item["eventId"] == event_id for item in history.json()["items"])

    detail = client.get(
        f"/admin/logs/audit-events/{event_id}?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}",
        headers=impersonation_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["event"]["eventId"] == event_id


def test_audit_history_detail_redacts_sensitive_metadata_and_links_related_route() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    headers, token = _admin_login(client)
    instance_id = _default_instance_id(client, headers)
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
        f"/admin/logs/audit-events/{event.event_id}?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}",
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
    assert payload["correlation"] is None


def test_audit_history_target_search_matches_target_labels_and_returns_correlation_summary() -> None:
    _clear_dependency_caches()
    client = TestClient(app)
    headers, token = _admin_login(client)
    instance_id = _default_instance_id(client, headers)
    governance = get_governance_service()
    admin = governance.authenticate_admin_token(token)

    governance.record_admin_audit_event(
        actor=admin,
        action="setting_override_upsert",
        target_type="setting",
        target_id="app_name",
        status="warning",
        details="Setting 'app_name' updated after request review.",
        metadata={
            "request_id": "req-audit-42",
            "reason": "manual verification",
        },
        tenant_id=DEFAULT_BOOTSTRAP_TENANT_ID,
    )

    history = client.get(
        f"/admin/logs/audit-events?instanceId={instance_id}&tenantId={DEFAULT_BOOTSTRAP_TENANT_ID}&window=all&targetId=app%20name",
        headers=headers,
    )

    assert history.status_code == 200
    payload = history.json()
    assert payload["items"]
    assert payload["items"][0]["target"]["label"] == "App Name"
    assert payload["items"][0]["correlation"] == {
        "label": "Request",
        "value": "req-audit-42",
    }
