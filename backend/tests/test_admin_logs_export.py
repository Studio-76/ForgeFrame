import csv
import io
import json
import os
from datetime import UTC, datetime, timedelta
from itertools import count
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers, login_headers_allowing_password_rotation
from app.governance.service import GovernanceService
from app.governance.service import get_governance_service
from app.main import app


def _login_headers(client: TestClient, *, username: str, password: str) -> dict[str, str]:
    return login_headers_allowing_password_rotation(client, username=username, password=password)


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


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
    return created.json()["user"], _login_headers(
        client,
        username=created.json()["user"]["username"],
        password=password,
    )


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
            "approval_reference": "INC-AUDIT-EXPORT",
            "justification": "Reproduce audit export access posture with a read-only impersonation session.",
            "notification_targets": ["slack://security-audit"],
            "duration_minutes": 15,
        },
    )
    assert request.status_code == 202
    request_id = request.json()["request"]["request_id"]

    approval = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/approve",
        headers=approver_headers,
        json={"decision_note": "Approved for audit export authorization verification."},
    )
    assert approval.status_code == 200

    issued = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/issue",
        headers=requester_headers,
    )
    assert issued.status_code == 201
    return {"Authorization": f"Bearer {issued.json()['access_token']}"}


def test_operator_can_generate_csv_audit_export_and_export_is_audited() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    _, operator_headers = _create_user_headers(client, admin_headers, role="operator")

    account_response = client.post(
        "/admin/accounts/",
        headers=admin_headers,
        json={
            "label": "Audit Export Account",
            "provider_bindings": ["openai_api"],
            "notes": "Creates a durable governance event before export.",
        },
    )
    assert account_response.status_code == 201
    account_id = account_response.json()["account"]["account_id"]

    export_response = client.post(
        f"/admin/logs/audit-export?tenantId={account_id}",
        headers=operator_headers,
        json={
            "format": "csv",
            "window": "all",
            "limit": 100,
        },
    )
    assert export_response.status_code == 200
    assert export_response.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=" in export_response.headers["content-disposition"]
    assert export_response.headers["x-forgeframe-audit-export-status"] == "ready"
    assert int(export_response.headers["x-forgeframe-audit-export-row-count"]) >= 1

    rows = list(csv.DictReader(io.StringIO(export_response.text)))
    assert rows
    assert {"event_id", "action", "status", "details"} <= set(rows[0].keys())
    assert any(row["action"] == "account_create" for row in rows)

    governance = get_governance_service()
    assert any(
        event.action == "audit_export_generated"
        for event in governance.list_audit_events(limit=20)
    )


def test_audit_export_applies_filters_before_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    start = datetime(2026, 1, 1, tzinfo=UTC)
    timeline = count()
    monkeypatch.setattr(
        GovernanceService,
        "_now",
        staticmethod(lambda: start + timedelta(seconds=next(timeline))),
    )

    client = TestClient(app)
    admin_headers = _admin_headers(client)

    account_response = client.post(
        "/admin/accounts/",
        headers=admin_headers,
        json={
            "label": "Filtered Export Account",
            "provider_bindings": ["openai_api"],
        },
    )
    assert account_response.status_code == 201
    account_id = account_response.json()["account"]["account_id"]

    key_response = client.post(
        "/admin/keys/",
        headers=admin_headers,
        json={
            "label": "Filtered Export Key",
            "account_id": account_id,
            "scopes": ["models:read", "chat:write", "responses:write"],
        },
    )
    assert key_response.status_code == 201

    governance = get_governance_service()
    recent_events = governance.list_audit_events(limit=2)
    assert recent_events[0].action == "runtime_key_issue"
    assert recent_events[1].action == "account_create"

    export_response = client.post(
        f"/admin/logs/audit-export?tenantId={account_id}",
        headers=admin_headers,
        json={
            "format": "json",
            "window": "all",
            "action": "account_create",
            "limit": 1,
        },
    )

    assert export_response.status_code == 200
    assert export_response.headers["x-forgeframe-audit-export-row-count"] == "1"
    payload = export_response.json()
    assert payload["row_count"] == 1
    assert payload["filters"]["action"] == "account_create"
    assert payload["events"][0]["action"] == "account_create"
    assert payload["events"][0]["target_id"] == account_id


def test_audit_export_matches_audit_history_on_window_boundary(monkeypatch: pytest.MonkeyPatch) -> None:
    current_time = {"value": datetime(2026, 1, 2, tzinfo=UTC)}
    monkeypatch.setattr(
        GovernanceService,
        "_now",
        staticmethod(lambda: current_time["value"]),
    )

    client = TestClient(app)
    admin_headers = _admin_headers(client)

    current_time["value"] = datetime(2026, 1, 1, tzinfo=UTC)

    account_response = client.post(
        "/admin/accounts/",
        headers=admin_headers,
        json={
            "label": "Boundary Export Account",
            "provider_bindings": ["openai_api"],
        },
    )
    assert account_response.status_code == 201
    account_id = account_response.json()["account"]["account_id"]

    current_time["value"] = datetime(2026, 1, 2, tzinfo=UTC)

    history_response = client.get(
        f"/admin/logs/audit-events?tenantId={account_id}&window=24h&action=account_create&limit=10",
        headers=admin_headers,
    )
    assert history_response.status_code == 200
    history_payload = history_response.json()
    assert history_payload["summary"]["totalMatchingFilters"] == 1
    assert len(history_payload["items"]) == 1
    assert history_payload["items"][0]["target"]["id"] == account_id

    export_response = client.post(
        f"/admin/logs/audit-export?tenantId={account_id}",
        headers=admin_headers,
        json={
            "format": "json",
            "window": "24h",
            "action": "account_create",
            "limit": 10,
        },
    )

    assert export_response.status_code == 200
    assert export_response.headers["x-forgeframe-audit-export-row-count"] == "1"
    export_payload = export_response.json()
    assert export_payload["row_count"] == history_payload["summary"]["totalMatchingFilters"]
    assert export_payload["events"][0]["event_id"] == history_payload["items"][0]["eventId"]
    assert export_payload["events"][0]["target_id"] == account_id


@pytest.mark.parametrize("export_format", ["json", "csv"])
def test_audit_export_redacts_sensitive_metadata_but_keeps_safe_context(export_format: str) -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)

    account_response = client.post(
        "/admin/accounts/",
        headers=admin_headers,
        json={
            "label": "Redacted Export Account",
            "provider_bindings": ["openai_api"],
        },
    )
    assert account_response.status_code == 201
    account_id = account_response.json()["account"]["account_id"]

    governance = get_governance_service()
    admin = governance.authenticate_admin_token(admin_headers["Authorization"].removeprefix("Bearer "))
    governance.record_admin_audit_event(
        actor=admin,
        action="setting_override_upsert",
        target_type="setting",
        target_id="app_name",
        status="ok",
        details="Setting 'app_name' updated for export redaction coverage.",
        metadata={
            "reason": "manual verification",
            "access_token": "top-secret-token",
            "provider": {
                "api_secret": "very-secret",
                "region": "us-east-1",
            },
        },
        tenant_id=account_id,
    )

    export_response = client.post(
        f"/admin/logs/audit-export?tenantId={account_id}",
        headers=admin_headers,
        json={
            "format": export_format,
            "window": "all",
            "action": "setting_override_upsert",
            "limit": 5,
        },
    )

    assert export_response.status_code == 200
    assert "top-secret-token" not in export_response.text
    assert "very-secret" not in export_response.text
    assert "manual verification" in export_response.text

    if export_format == "json":
        payload = export_response.json()
        assert payload["row_count"] == 1
        metadata = payload["events"][0]["metadata"]
    else:
        rows = list(csv.DictReader(io.StringIO(export_response.text)))
        assert len(rows) == 1
        metadata = json.loads(rows[0]["metadata"])

    assert metadata["reason"] == "manual verification"
    assert metadata["access_token"] == "[redacted]"
    assert metadata["provider"]["api_secret"] == "[redacted]"
    assert metadata["provider"]["region"] == "us-east-1"


@pytest.mark.parametrize("export_format", ["json", "csv"])
def test_audit_export_subject_filter_uses_redacted_metadata_for_search(export_format: str) -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)

    account_response = client.post(
        "/admin/accounts/",
        headers=admin_headers,
        json={
            "label": "Subject Filter Export Account",
            "provider_bindings": ["openai_api"],
        },
    )
    assert account_response.status_code == 201
    account_id = account_response.json()["account"]["account_id"]

    governance = get_governance_service()
    admin = governance.authenticate_admin_token(admin_headers["Authorization"].removeprefix("Bearer "))
    governance.record_admin_audit_event(
        actor=admin,
        action="setting_override_upsert",
        target_type="setting",
        target_id="app_name",
        status="ok",
        details="Setting 'app_name' updated for export subject filtering coverage.",
        metadata={
            "reason": "manual verification",
            "access_token": "top-secret-token",
            "provider": {
                "api_secret": "very-secret",
                "region": "us-east-1",
            },
        },
        tenant_id=account_id,
    )

    base_payload = {
        "format": export_format,
        "window": "all",
        "action": "setting_override_upsert",
        "limit": 5,
    }
    secret_response = client.post(
        f"/admin/logs/audit-export?tenantId={account_id}",
        headers=admin_headers,
        json={**base_payload, "subject": "top-secret-token"},
    )
    wrong_secret_response = client.post(
        f"/admin/logs/audit-export?tenantId={account_id}",
        headers=admin_headers,
        json={**base_payload, "subject": "wrong-secret"},
    )
    safe_context_response = client.post(
        f"/admin/logs/audit-export?tenantId={account_id}",
        headers=admin_headers,
        json={**base_payload, "subject": "manual verification"},
    )

    assert secret_response.status_code == 200
    assert wrong_secret_response.status_code == 200
    assert safe_context_response.status_code == 200
    assert secret_response.headers["x-forgeframe-audit-export-row-count"] == "0"
    assert wrong_secret_response.headers["x-forgeframe-audit-export-row-count"] == "0"
    assert safe_context_response.headers["x-forgeframe-audit-export-row-count"] == "1"
    assert "very-secret" not in safe_context_response.text
    assert "manual verification" in safe_context_response.text

    if export_format == "json":
        secret_payload = secret_response.json()
        wrong_secret_payload = wrong_secret_response.json()
        safe_context_payload = safe_context_response.json()

        assert secret_payload["row_count"] == 0
        assert wrong_secret_payload["row_count"] == 0
        assert safe_context_payload["row_count"] == 1
        assert safe_context_payload["events"][0]["metadata"]["reason"] == "manual verification"
        assert safe_context_payload["events"][0]["metadata"]["access_token"] == "[redacted]"
        assert safe_context_payload["events"][0]["metadata"]["provider"]["api_secret"] == "[redacted]"
    else:
        secret_rows = list(csv.DictReader(io.StringIO(secret_response.text)))
        wrong_secret_rows = list(csv.DictReader(io.StringIO(wrong_secret_response.text)))
        safe_context_rows = list(csv.DictReader(io.StringIO(safe_context_response.text)))

        assert secret_rows == []
        assert wrong_secret_rows == []
        assert len(safe_context_rows) == 1
        metadata = json.loads(safe_context_rows[0]["metadata"])
        assert metadata["reason"] == "manual verification"
        assert metadata["access_token"] == "[redacted]"
        assert metadata["provider"]["api_secret"] == "[redacted]"


def test_audit_export_normalizes_action_whitespace_like_audit_history() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)

    account_response = client.post(
        "/admin/accounts/",
        headers=admin_headers,
        json={
            "label": "Normalized Action Export Account",
            "provider_bindings": ["openai_api"],
        },
    )
    assert account_response.status_code == 201
    account_id = account_response.json()["account"]["account_id"]

    history_response = client.get(
        f"/admin/logs/audit-events?tenantId={account_id}&window=all&action=%20%20ACCOUNT_CREATE%20%20&limit=10",
        headers=admin_headers,
    )
    assert history_response.status_code == 200
    history_payload = history_response.json()
    assert history_payload["filters"]["applied"]["action"] == "account_create"
    assert history_payload["summary"]["totalMatchingFilters"] == 1
    assert history_payload["items"][0]["target"]["id"] == account_id

    export_response = client.post(
        f"/admin/logs/audit-export?tenantId={account_id}",
        headers=admin_headers,
        json={
            "format": "json",
            "window": "all",
            "action": "  ACCOUNT_CREATE  ",
            "limit": 10,
        },
    )
    assert export_response.status_code == 200
    assert export_response.headers["x-forgeframe-audit-export-row-count"] == "1"

    export_payload = export_response.json()
    assert export_payload["filters"]["action"] == "account_create"
    assert export_payload["row_count"] == history_payload["summary"]["totalMatchingFilters"]
    assert export_payload["events"][0]["event_id"] == history_payload["items"][0]["eventId"]
    assert export_payload["events"][0]["target_id"] == account_id


def test_audit_export_honors_company_scope_and_self_audits_with_company_id() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    governance = get_governance_service()
    admin = governance.authenticate_admin_token(admin_headers["Authorization"].removeprefix("Bearer "))
    assert admin is not None

    suffix = uuid4().hex[:8]
    company_alpha = f"company_alpha_{suffix}"
    company_beta = f"company_beta_{suffix}"
    alpha_run_id = f"run_alpha_{suffix}"
    beta_run_id = f"run_beta_{suffix}"

    governance.record_admin_audit_event(
        actor=admin,
        action="execution_run_replay",
        target_type="execution_run",
        target_id=alpha_run_id,
        status="ok",
        details="Execution replay admitted for company alpha export scope.",
        metadata={"reason": "company alpha replay"},
        company_id=company_alpha,
    )
    governance.record_admin_audit_event(
        actor=admin,
        action="execution_run_replay",
        target_type="execution_run",
        target_id=beta_run_id,
        status="ok",
        details="Execution replay admitted for company beta export scope.",
        metadata={"reason": "company beta replay"},
        company_id=company_beta,
    )

    export_response = client.post(
        f"/admin/logs/audit-export?companyId={company_alpha}",
        headers=admin_headers,
        json={
            "format": "json",
            "window": "all",
            "action": "execution_run_replay",
            "limit": 10,
        },
    )

    assert export_response.status_code == 200
    assert f"forgeframe-audit-export-company-{company_alpha}-" in export_response.headers["content-disposition"]
    assert export_response.headers["x-forgeframe-audit-export-row-count"] == "1"

    export_payload = export_response.json()
    assert export_payload["filters"]["tenant_id"] is None
    assert export_payload["filters"]["company_id"] == company_alpha
    assert export_payload["row_count"] == 1
    assert export_payload["events"][0]["target_id"] == alpha_run_id
    assert export_payload["events"][0]["company_id"] == company_alpha
    assert export_payload["events"][0]["metadata"]["reason"] == "company alpha replay"

    export_id = export_response.headers["x-forgeframe-audit-export-id"]
    assert any(
        event.action == "audit_export_generated"
        and event.target_id == export_id
        and event.company_id == company_alpha
        for event in governance.list_audit_events(limit=50, company_id=company_alpha)
    )


def test_audit_export_requires_tenant_filter_for_mixed_history_and_scoped_export_still_succeeds() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)

    tenant_a_response = client.post(
        "/admin/accounts/",
        headers=admin_headers,
        json={
            "label": "Tenant A Export Scope",
            "provider_bindings": ["openai_api"],
        },
    )
    assert tenant_a_response.status_code == 201
    tenant_a = tenant_a_response.json()["account"]["account_id"]

    tenant_b_response = client.post(
        "/admin/accounts/",
        headers=admin_headers,
        json={
            "label": "Tenant B Export Scope",
            "provider_bindings": ["openai_api"],
        },
    )
    assert tenant_b_response.status_code == 201
    tenant_b = tenant_b_response.json()["account"]["account_id"]

    unscoped_response = client.post(
        "/admin/logs/audit-export",
        headers=admin_headers,
        json={
            "format": "json",
            "window": "all",
            "action": "account_create",
            "limit": 10,
        },
    )
    assert unscoped_response.status_code == 400
    assert unscoped_response.json()["error"]["type"] == "tenant_filter_required"

    scoped_response = client.post(
        f"/admin/logs/audit-export?tenantId={tenant_a}",
        headers=admin_headers,
        json={
            "format": "json",
            "window": "all",
            "action": "account_create",
            "limit": 10,
        },
    )
    assert scoped_response.status_code == 200
    assert scoped_response.headers["x-forgeframe-audit-export-row-count"] == "1"

    scoped_payload = scoped_response.json()
    assert scoped_payload["filters"]["tenant_id"] == tenant_a
    assert scoped_payload["row_count"] == 1
    assert scoped_payload["events"][0]["tenant_id"] == tenant_a
    assert scoped_payload["events"][0]["target_id"] == tenant_a
    assert scoped_payload["events"][0]["target_id"] != tenant_b


def test_viewer_cannot_generate_audit_export() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    _, viewer_headers = _create_user_headers(client, admin_headers, role="viewer")

    response = client.post(
        "/admin/logs/audit-export",
        headers=viewer_headers,
        json={
            "format": "json",
            "window": "all",
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "operator_role_required"


def test_read_only_impersonation_cannot_generate_audit_export() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    target_user, _ = _create_user_headers(client, admin_headers, role="operator")
    _, approver_headers = _create_user_headers(client, admin_headers, role="admin")
    impersonation_headers = _activate_impersonation_headers(
        client,
        admin_headers,
        approver_headers,
        target_user_id=target_user["user_id"],
    )

    response = client.post(
        "/admin/logs/audit-export",
        headers=impersonation_headers,
        json={
            "format": "json",
            "window": "all",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "impersonation_session_read_only"

    governance = get_governance_service()
    assert not any(
        event.action == "audit_export_generated"
        for event in governance.list_audit_events(limit=50)
    )
