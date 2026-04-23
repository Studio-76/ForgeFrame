import os
from uuid import uuid4

from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers, login_headers_allowing_password_rotation
from app.approvals.models import build_elevated_access_approval_id, build_execution_approval_id
from app.execution.dependencies import get_execution_transition_service
from app.governance.service import get_governance_service
from app.main import app


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
    headers = login_headers_allowing_password_rotation(client, username=username, password=password)
    return created.json()["user"]["user_id"], headers


def _open_execution_approval(*, company_id: str) -> tuple[str, str]:
    service = get_execution_transition_service()
    suffix = uuid4().hex[:8]
    created = service.admit_create(
        company_id=company_id,
        actor_type="agent",
        actor_id="agent_backend_api_lead",
        idempotency_key=f"idem_shared_approval_{suffix}",
        request_fingerprint_hash=f"fp_shared_approval_{suffix}",
        run_kind="provider_dispatch",
        issue_id="FOR-124",
    )
    claim = service.claim_next_attempt(company_id=company_id, worker_key=f"worker_{suffix}")
    assert claim is not None
    service.mark_attempt_executing(
        company_id=company_id,
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="manual_approval_gate",
    )
    approval_native_id = f"approval_shared_{suffix}"
    service.open_approval(
        company_id=company_id,
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        approval_id=approval_native_id,
        gate_key="manual_approval_gate",
    )
    return claim.run_id, approval_native_id


def _create_instance(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    company_id: str,
    tenant_id: str | None = None,
) -> str:
    response = client.post(
        "/admin/instances/",
        headers=headers,
        json={
            "instance_id": instance_id,
            "display_name": instance_id,
            "tenant_id": tenant_id or instance_id,
            "company_id": company_id,
            "deployment_mode": "restricted_eval",
            "exposure_mode": "local_only",
        },
    )
    assert response.status_code == 201
    return response.json()["instance"]["instance_id"]


def _activate_break_glass_session(
    client: TestClient,
    requester_headers: dict[str, str],
    approver_headers: dict[str, str],
    *,
    approval_reference: str,
    justification: str,
    duration_minutes: int = 20,
) -> dict[str, object]:
    request = client.post(
        "/admin/security/break-glass",
        headers=requester_headers,
        json={
            "approval_reference": approval_reference,
            "justification": justification,
            "notification_targets": ["pagerduty://security-review"],
            "duration_minutes": duration_minutes,
        },
    )
    assert request.status_code == 202
    request_id = request.json()["request"]["request_id"]
    approved = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/approve",
        headers=approver_headers,
        json={"decision_note": "Approve the break-glass request needed for the conflict preflight test."},
    )
    assert approved.status_code == 200
    issued = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/issue",
        headers=requester_headers,
    )
    assert issued.status_code == 201
    return issued.json()


def test_shared_approvals_queue_and_detail_include_execution_and_elevated_access() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    suffix = uuid4().hex[:8]

    _create_admin_user_and_headers(
        client,
        headers,
        username=f"shared-approver-{suffix}",
        display_name="Shared Approver",
    )
    created_user = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"shared-target-{suffix}",
            "display_name": "Shared Target",
            "role": "operator",
            "password": "Shared-Target-123",
        },
    )
    assert created_user.status_code == 201

    request = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": created_user.json()["user"]["user_id"],
            "approval_reference": "INC-SHARED-QUEUE",
            "justification": "Review a shared approvals queue contract with elevated access evidence.",
            "notification_targets": ["slack://shared-approvals"],
            "duration_minutes": 15,
        },
    )
    assert request.status_code == 202
    request_id = request.json()["request"]["request_id"]

    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    run_id, execution_native_id = _open_execution_approval(company_id="company_alpha")

    approvals = client.get("/admin/approvals", headers=headers)
    assert approvals.status_code == 200
    items = {item["approval_id"]: item for item in approvals.json()["approvals"]}

    execution_approval_id = build_execution_approval_id(
        instance_id=instance_id,
        company_id="company_alpha",
        approval_id=execution_native_id,
    )
    elevated_approval_id = build_elevated_access_approval_id(request_id)

    assert items[execution_approval_id]["source_kind"] == "execution_run"
    assert items[execution_approval_id]["approval_type"] == "execution_run"
    assert items[execution_approval_id]["status"] == "open"
    assert items[execution_approval_id]["instance_id"] == instance_id
    assert items[execution_approval_id]["company_id"] == "company_alpha"

    assert items[elevated_approval_id]["source_kind"] == "elevated_access"
    assert items[elevated_approval_id]["approval_type"] == "impersonation"
    assert items[elevated_approval_id]["status"] == "open"
    assert items[elevated_approval_id]["session_status"] == "not_issued"

    execution_detail = client.get(
        f"/admin/approvals/{execution_approval_id}",
        headers=headers,
        params={"instanceId": instance_id},
    )
    assert execution_detail.status_code == 200
    assert execution_detail.json()["approval"]["source"]["run_id"] == run_id
    assert execution_detail.json()["approval"]["source"]["instance_id"] == instance_id
    assert execution_detail.json()["approval"]["evidence"]["gate_key"] == "manual_approval_gate"

    elevated_detail = client.get(f"/admin/approvals/{elevated_approval_id}", headers=headers)
    assert elevated_detail.status_code == 200
    elevated_payload = elevated_detail.json()["approval"]
    assert elevated_payload["evidence"]["approval_reference"] == "INC-SHARED-QUEUE"
    assert elevated_payload["evidence"]["issuance_status"] == "pending"
    assert elevated_payload["actions"]["can_approve"] is False
    assert elevated_payload["actions"]["decision_blocked_reason"] == "elevated_access_self_approval_forbidden"


def test_shared_approvals_support_instance_scope_but_reject_legacy_tenant_and_company_filters() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    suffix = uuid4().hex[:8]

    _create_admin_user_and_headers(
        client,
        headers,
        username=f"company-scope-approver-{suffix}",
        display_name="Company Scope Approver",
    )
    created_user = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"company-scope-target-{suffix}",
            "display_name": "Company Scope Target",
            "role": "operator",
            "password": "Company-Scope-Target-123",
        },
    )
    assert created_user.status_code == 201

    request = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": created_user.json()["user"]["user_id"],
            "approval_reference": "INC-SHARED-COMPANY-SCOPE",
            "justification": "Create an elevated-access item alongside an execution approval before scoping the queue.",
            "notification_targets": ["slack://shared-approvals"],
            "duration_minutes": 15,
        },
    )
    assert request.status_code == 202

    alpha_instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    _create_instance(client, headers, instance_id="instance_beta", company_id="company_beta")
    alpha_run_id, alpha_native_id = _open_execution_approval(company_id="company_alpha")
    _beta_run_id, _beta_native_id = _open_execution_approval(company_id="company_beta")

    approvals = client.get(
        "/admin/approvals",
        headers=headers,
        params={"instanceId": alpha_instance_id},
    )
    assert approvals.status_code == 200
    approval_ids = {item["approval_id"] for item in approvals.json()["approvals"]}
    assert build_execution_approval_id(
        instance_id=alpha_instance_id,
        company_id="company_alpha",
        approval_id=alpha_native_id,
    ) in approval_ids
    assert not any(item.endswith("company_beta:" + _beta_native_id) for item in approval_ids)

    detail = client.get(
        f"/admin/approvals/{build_execution_approval_id(instance_id=alpha_instance_id, company_id='company_alpha', approval_id=alpha_native_id)}",
        headers=headers,
        params={"instanceId": alpha_instance_id},
    )
    assert detail.status_code == 200
    assert detail.json()["approval"]["source"]["run_id"] == alpha_run_id

    company_scoped = client.get(
        "/admin/approvals",
        headers=headers,
        params={"companyId": "company_alpha"},
    )
    assert company_scoped.status_code == 400
    assert company_scoped.json()["error"]["type"] == "approval_company_scope_unsupported"
    assert company_scoped.json()["error"]["message"] == (
        "companyId is not supported on /admin/approvals because elevated-access approvals are not company-scoped."
    )

    tenant_scoped = client.get(
        "/admin/approvals",
        headers=headers,
        params={"tenantId": "tenant_alpha"},
    )
    assert tenant_scoped.status_code == 400
    assert tenant_scoped.json()["error"]["type"] == "approval_tenant_scope_unsupported"


def test_shared_execution_approval_decisions_record_instance_scoped_audit_truth() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    _run_id, execution_native_id = _open_execution_approval(company_id="company_alpha")
    approval_id = build_execution_approval_id(
        instance_id=instance_id,
        company_id="company_alpha",
        approval_id=execution_native_id,
    )

    approved = client.post(
        f"/admin/approvals/{approval_id}/approve",
        headers=headers,
        params={"instanceId": instance_id},
        json={"decision_note": "Approve the execution run after verifying the instance-scoped failure evidence."},
    )

    assert approved.status_code == 200
    approval_payload = approved.json()["approval"]
    assert approval_payload["status"] == "approved"
    assert approval_payload["instance_id"] == instance_id
    assert approval_payload["source"]["instance_id"] == instance_id

    governance = get_governance_service()
    audit_event = next(
        item
        for item in governance.list_audit_events(limit=20, company_id="company_alpha")
        if item.action == "execution_approval_approved" and item.target_id == approval_id
    )
    assert audit_event.instance_id == instance_id
    assert audit_event.metadata["instance_id"] == instance_id


def test_shared_execution_approvals_require_instance_membership_and_separate_read_from_decide() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    suffix = uuid4().hex[:8]
    instance_id = _create_instance(client, admin_headers, instance_id=f"instance_{suffix}", company_id=f"company_{suffix}")
    _run_id, execution_native_id = _open_execution_approval(company_id=f"company_{suffix}")
    approval_id = build_execution_approval_id(
        instance_id=instance_id,
        company_id=f"company_{suffix}",
        approval_id=execution_native_id,
    )

    operator_user_id, operator_headers = _create_admin_user_and_headers(
        client,
        admin_headers,
        username=f"instance-approval-operator-{suffix}",
        display_name="Instance Approval Operator",
        role="operator",
        password="Instance-Approval-Operator-123",
    )

    denied_listing = client.get(
        "/admin/approvals",
        headers=operator_headers,
        params={"instanceId": instance_id},
    )
    assert denied_listing.status_code == 403
    assert denied_listing.json()["error"]["type"] == "approval_forbidden"
    assert denied_listing.json()["error"]["message"] == "instance_membership_required"

    granted = client.put(
        f"/admin/security/users/{operator_user_id}/memberships/{instance_id}",
        headers=admin_headers,
        json={"role": "operator", "status": "active"},
    )
    assert granted.status_code == 200

    operator_headers = login_headers_allowing_password_rotation(
        client,
        username=f"instance-approval-operator-{suffix}",
        password="Instance-Approval-Operator-123",
    )

    listing = client.get(
        "/admin/approvals",
        headers=operator_headers,
        params={"instanceId": instance_id},
    )
    assert listing.status_code == 200
    assert any(item["approval_id"] == approval_id for item in listing.json()["approvals"])

    detail = client.get(
        f"/admin/approvals/{approval_id}",
        headers=operator_headers,
        params={"instanceId": instance_id},
    )
    assert detail.status_code == 200
    approval_payload = detail.json()["approval"]
    assert approval_payload["instance_id"] == instance_id
    assert approval_payload["actions"]["can_approve"] is False
    assert approval_payload["actions"]["decision_blocked_reason"] == "missing_instance_permission:approvals.decide"

    denied_decision = client.post(
        f"/admin/approvals/{approval_id}/approve",
        headers=operator_headers,
        params={"instanceId": instance_id},
        json={"decision_note": "Operators can review this execution approval but they cannot decide it."},
    )
    assert denied_decision.status_code == 403
    assert denied_decision.json()["error"]["type"] == "approval_forbidden"
    assert denied_decision.json()["error"]["message"] == "missing_instance_permission:approvals.decide"

    approved = client.post(
        f"/admin/approvals/{approval_id}/approve",
        headers=admin_headers,
        params={"instanceId": instance_id},
        json={"decision_note": "Approve the instance-scoped execution approval after membership validation."},
    )
    assert approved.status_code == 200
    assert approved.json()["approval"]["status"] == "approved"


def test_shared_approvals_expose_elevated_access_requests_to_operator_observers_in_review_only_mode() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    suffix = uuid4().hex[:8]

    _, requester_headers = _create_admin_user_and_headers(
        client,
        admin_headers,
        username=f"approval-requester-{suffix}",
        display_name="Approval Requester",
        role="operator",
        password="Approval-Requester-123",
    )
    _, observer_headers = _create_admin_user_and_headers(
        client,
        admin_headers,
        username=f"approval-observer-{suffix}",
        display_name="Approval Observer",
        role="operator",
        password="Approval-Observer-123",
    )

    request = client.post(
        "/admin/security/break-glass",
        headers=requester_headers,
        json={
            "approval_reference": "INC-OPERATOR-OBSERVER",
            "justification": "Need temporary admin to inspect a provider outage.",
            "notification_targets": ["pagerduty://security-review"],
            "duration_minutes": 20,
        },
    )
    assert request.status_code == 202
    request_id = request.json()["request"]["request_id"]
    approval_id = build_elevated_access_approval_id(request_id)

    requester_history = client.get("/admin/security/elevated-access-requests", headers=observer_headers)
    assert requester_history.status_code == 200
    assert all(item["request_id"] != request_id for item in requester_history.json()["requests"])

    approvals = client.get("/admin/approvals", headers=observer_headers)
    assert approvals.status_code == 200
    item = next(item for item in approvals.json()["approvals"] if item["approval_id"] == approval_id)
    assert item["source_kind"] == "elevated_access"
    assert item["approval_type"] == "break_glass"
    assert item["status"] == "open"

    detail = client.get(f"/admin/approvals/{approval_id}", headers=observer_headers)
    assert detail.status_code == 200
    approval_payload = detail.json()["approval"]
    assert approval_payload["requester"]["display_name"] == "Approval Requester"
    assert approval_payload["actions"]["can_approve"] is False
    assert approval_payload["actions"]["can_reject"] is False
    assert approval_payload["actions"]["decision_blocked_reason"] == "admin_role_required"

    approve = client.post(
        f"/admin/approvals/{approval_id}/approve",
        headers=observer_headers,
        json={"decision_note": "Operators can inspect this approval, but they cannot decide it."},
    )
    assert approve.status_code == 403
    assert approve.json()["detail"] == "admin_role_required"


def test_shared_approvals_approve_endpoint_updates_elevated_access_lifecycle() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    suffix = uuid4().hex[:8]

    created_user = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"approve-target-{suffix}",
            "display_name": "Approve Target",
            "role": "operator",
            "password": "Approve-Target-123",
        },
    )
    assert created_user.status_code == 201

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"approve-reviewer-{suffix}",
        display_name="Approve Reviewer",
    )

    request = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": created_user.json()["user"]["user_id"],
            "approval_reference": "INC-SHARED-APPROVE",
            "justification": "Approve through the shared approvals endpoint and issue afterwards.",
            "notification_targets": ["slack://security-approvals"],
            "duration_minutes": 15,
        },
    )
    assert request.status_code == 202
    request_id = request.json()["request"]["request_id"]
    approval_id = build_elevated_access_approval_id(request_id)

    approved = client.post(
        f"/admin/approvals/{approval_id}/approve",
        headers=approver_headers,
        json={"decision_note": "Approved from the shared approvals queue after reviewing the evidence."},
    )
    assert approved.status_code == 200
    approval_payload = approved.json()["approval"]
    assert approval_payload["status"] == "approved"
    assert approval_payload["ready_to_issue"] is True
    assert approval_payload["session_status"] == "not_issued"

    issued = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/issue",
        headers=headers,
    )
    assert issued.status_code == 201
    assert issued.json()["request"]["approval_id"] == approval_id
    assert issued.json()["request"]["session_status"] == "active"

    approved_listing = client.get(
        "/admin/approvals",
        headers=headers,
        params={"status": "approved"},
    )
    assert approved_listing.status_code == 200
    assert any(item["approval_id"] == approval_id for item in approved_listing.json()["approvals"])


def test_shared_approvals_detail_preflights_conflicts_and_keeps_reject_available() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    suffix = uuid4().hex[:8]

    created_user = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": f"conflict-target-{suffix}",
            "display_name": "Conflict Target",
            "role": "operator",
            "password": "Conflict-Target-123",
        },
    )
    assert created_user.status_code == 201

    _, approver_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"conflict-reviewer-{suffix}",
        display_name="Conflict Reviewer",
    )

    request = client.post(
        "/admin/security/impersonations",
        headers=headers,
        json={
            "target_user_id": created_user.json()["user"]["user_id"],
            "approval_reference": "INC-SHARED-CONFLICT",
            "justification": "Open impersonation approval before a conflicting requester session becomes active.",
            "notification_targets": ["slack://security-conflicts"],
            "duration_minutes": 15,
        },
    )
    assert request.status_code == 202
    request_id = request.json()["request"]["request_id"]
    approval_id = build_elevated_access_approval_id(request_id)

    activated = _activate_break_glass_session(
        client,
        headers,
        approver_headers,
        approval_reference="INC-SHARED-CONFLICT-BREAK-GLASS",
        justification="Activate requester break-glass before shared approval review.",
    )
    assert activated["request"]["issuance_status"] == "issued"

    detail = client.get(f"/admin/approvals/{approval_id}", headers=approver_headers)
    assert detail.status_code == 200
    approval_payload = detail.json()["approval"]
    assert approval_payload["actions"]["can_approve"] is False
    assert approval_payload["actions"]["can_reject"] is True
    assert approval_payload["actions"]["decision_blocked_reason"] == "elevated_access_active_session_conflict"
    assert approval_payload["actions"]["approve_blocked_reason"] == "elevated_access_active_session_conflict"
    assert approval_payload["actions"]["reject_blocked_reason"] is None
    assert approval_payload["source"]["active_session_conflict"] is True
    assert approval_payload["source"]["conflicting_session_type"] == "break_glass"

    approve = client.post(
        f"/admin/approvals/{approval_id}/approve",
        headers=approver_headers,
        json={"decision_note": "Approval should fail because the requester already has active elevated access."},
    )
    assert approve.status_code == 409
    assert approve.json()["error"]["type"] == "approval_conflict"

    reject = client.post(
        f"/admin/approvals/{approval_id}/reject",
        headers=approver_headers,
        json={"decision_note": "Reject the request because the requester already has active elevated access."},
    )
    assert reject.status_code == 200
    assert reject.json()["approval"]["status"] == "rejected"


def test_shared_approvals_expose_cancelled_elevated_access_requests() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    suffix = uuid4().hex[:8]

    _, requester_headers = _create_admin_user_and_headers(
        client,
        headers,
        username=f"cancelled-requester-{suffix}",
        display_name="Cancelled Requester",
        role="operator",
        password="Cancelled-Requester-123",
    )

    request = client.post(
        "/admin/security/break-glass",
        headers=requester_headers,
        json={
            "approval_reference": "INC-SHARED-CANCELLED",
            "justification": "Open a pending request and then withdraw it before review.",
            "notification_targets": ["slack://security-cancelled"],
            "duration_minutes": 20,
        },
    )
    assert request.status_code == 202
    request_id = request.json()["request"]["request_id"]
    approval_id = build_elevated_access_approval_id(request_id)

    cancelled = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/cancel",
        headers=requester_headers,
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["request"]["gate_status"] == "cancelled"

    approvals = client.get(
        "/admin/approvals",
        headers=headers,
        params={"status": "cancelled"},
    )
    assert approvals.status_code == 200
    item = next(item for item in approvals.json()["approvals"] if item["approval_id"] == approval_id)
    assert item["source_kind"] == "elevated_access"
    assert item["status"] == "cancelled"

    detail = client.get(f"/admin/approvals/{approval_id}", headers=headers)
    assert detail.status_code == 200
    approval_payload = detail.json()["approval"]
    assert approval_payload["status"] == "cancelled"
    assert approval_payload["actions"]["can_approve"] is False
    assert approval_payload["actions"]["can_reject"] is False
    assert approval_payload["actions"]["decision_blocked_reason"] == "approval_not_open"
