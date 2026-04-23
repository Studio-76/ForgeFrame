from uuid import uuid4

from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers
from app.approvals.models import build_execution_approval_id
from app.execution.dependencies import get_execution_transition_service
from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _create_instance(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    company_id: str,
) -> str:
    response = client.post(
        "/admin/instances/",
        headers=headers,
        json={
            "instance_id": instance_id,
            "display_name": instance_id,
            "tenant_id": instance_id,
            "company_id": company_id,
            "deployment_mode": "restricted_eval",
            "exposure_mode": "local_only",
        },
    )
    assert response.status_code == 201
    return response.json()["instance"]["instance_id"]


def _instance_scope(instance_id: str) -> dict[str, str]:
    return {"instanceId": instance_id}


def _create_workspace(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    title: str,
    issue_id: str,
) -> dict[str, object]:
    response = client.post(
        "/admin/workspaces",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "title": title,
            "issue_id": issue_id,
            "summary": "Workspace created for artifact and handoff verification.",
            "preview_status": "draft",
            "review_status": "not_requested",
            "handoff_status": "not_ready",
        },
    )
    assert response.status_code == 201
    return response.json()["workspace"]


def _open_execution_approval(*, company_id: str, workspace_id: str, issue_id: str) -> tuple[str, str]:
    service = get_execution_transition_service()
    suffix = uuid4().hex[:8]
    created = service.admit_create(
        company_id=company_id,
        actor_type="agent",
        actor_id="agent_workspace_runtime",
        idempotency_key=f"idem_workspace_{suffix}",
        request_fingerprint_hash=f"fp_workspace_{suffix}",
        run_kind="provider_dispatch",
        workspace_id=workspace_id,
        issue_id=issue_id,
    )
    claim = service.claim_next_attempt(company_id=company_id, worker_key=f"worker_{suffix}")
    assert claim is not None
    service.mark_attempt_executing(
        company_id=company_id,
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="preview_gate",
    )
    approval_native_id = f"approval_workspace_{suffix}"
    service.open_approval(
        company_id=company_id,
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        approval_id=approval_native_id,
        gate_key="preview_gate",
    )
    return claim.run_id, approval_native_id


def test_workspaces_and_artifacts_routes_persist_preview_and_handoff_truth() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")

    workspace = _create_workspace(
        client,
        headers,
        instance_id=instance_id,
        title="Customer Preview Workspace",
        issue_id="FOR-501",
    )
    workspace_id = workspace["workspace_id"]

    artifact = client.post(
        "/admin/artifacts",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "workspace_id": workspace_id,
            "workspace_role": "preview",
            "artifact_type": "preview_link",
            "label": "Preview build",
            "uri": "https://forgeframe.local/previews/ws-alpha",
            "preview_url": "https://forgeframe.local/previews/ws-alpha",
            "attachments": [
                {"target_kind": "instance", "target_id": instance_id, "role": "instance_scope"},
            ],
            "metadata": {"channel": "preview"},
        },
    )

    assert artifact.status_code == 201
    artifact_payload = artifact.json()["artifact"]
    attachment_roles = {(item["target_kind"], item["role"]) for item in artifact_payload["attachments"]}
    assert ("workspace", "preview") in attachment_roles
    assert ("instance", "instance_scope") in attachment_roles

    detail = client.get(
        f"/admin/workspaces/{workspace_id}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert detail.status_code == 200
    workspace_detail = detail.json()["workspace"]
    assert workspace_detail["preview_status"] == "ready"
    assert workspace_detail["preview_artifact_id"] == artifact_payload["artifact_id"]
    assert workspace_detail["artifact_count"] == 1
    assert workspace_detail["events"][0]["event_kind"] == "preview_ready"
    assert workspace_detail["artifacts"][0]["artifact_id"] == artifact_payload["artifact_id"]

    listing = client.get(
        "/admin/artifacts",
        headers=headers,
        params={**_instance_scope(instance_id), "workspaceId": workspace_id},
    )
    assert listing.status_code == 200
    assert listing.json()["artifacts"][0]["artifact_id"] == artifact_payload["artifact_id"]


def test_execution_and_approvals_detail_include_workspace_and_artifact_context() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")

    workspace = _create_workspace(
        client,
        headers,
        instance_id=instance_id,
        title="Workspace with execution handoff",
        issue_id="FOR-601",
    )
    workspace_id = workspace["workspace_id"]
    run_id, approval_native_id = _open_execution_approval(
        company_id="company_alpha",
        workspace_id=workspace_id,
        issue_id="FOR-601",
    )
    shared_approval_id = build_execution_approval_id(
        instance_id=instance_id,
        company_id="company_alpha",
        approval_id=approval_native_id,
    )

    updated_workspace = client.patch(
        f"/admin/workspaces/{workspace_id}",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "active_run_id": run_id,
            "latest_approval_id": shared_approval_id,
            "review_status": "pending",
            "event_note": "Review opened after preview run reached the approval gate.",
        },
    )
    assert updated_workspace.status_code == 200

    artifact = client.post(
        "/admin/artifacts",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "workspace_id": workspace_id,
            "artifact_type": "file",
            "label": "handoff.patch",
            "uri": "file:///tmp/handoff.patch",
            "attachments": [
                {"target_kind": "run", "target_id": run_id, "role": "run_output"},
                {"target_kind": "approval", "target_id": shared_approval_id, "role": "approval_evidence"},
            ],
            "metadata": {"format": "patch"},
        },
    )
    assert artifact.status_code == 201
    artifact_id = artifact.json()["artifact"]["artifact_id"]

    run_detail = client.get(
        f"/admin/execution/runs/{run_id}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert run_detail.status_code == 200
    run_payload = run_detail.json()["run"]
    assert run_payload["workspace_id"] == workspace_id
    assert run_payload["workspace"]["workspace_id"] == workspace_id
    assert run_payload["workspace"]["approval_count"] == 1
    assert any(item["artifact_id"] == artifact_id for item in run_payload["artifacts"])

    approval_detail = client.get(
        f"/admin/approvals/{shared_approval_id}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert approval_detail.status_code == 200
    approval_payload = approval_detail.json()["approval"]
    assert approval_payload["workspace_id"] == workspace_id
    assert approval_payload["workspace"]["workspace_id"] == workspace_id
    assert approval_payload["source"]["workspace_id"] == workspace_id
    assert any(item["artifact_id"] == artifact_id for item in approval_payload["artifacts"])

    workspace_detail = client.get(
        f"/admin/workspaces/{workspace_id}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert workspace_detail.status_code == 200
    payload = workspace_detail.json()["workspace"]
    assert payload["run_count"] == 1
    assert payload["approval_count"] == 1
    assert payload["runs"][0]["run_id"] == run_id
    assert payload["approvals"][0]["shared_approval_id"] == shared_approval_id


def test_artifact_creation_rejects_unknown_runtime_targets() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    workspace = _create_workspace(
        client,
        headers,
        instance_id=instance_id,
        title="Validation workspace",
        issue_id="FOR-701",
    )

    invalid_run_attachment = client.post(
        "/admin/artifacts",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "workspace_id": workspace["workspace_id"],
            "artifact_type": "json",
            "label": "invalid-target.json",
            "uri": "file:///tmp/invalid-target.json",
            "attachments": [
                {"target_kind": "run", "target_id": "run_missing", "role": "run_output"},
            ],
        },
    )

    assert invalid_run_attachment.status_code == 404
    assert invalid_run_attachment.json()["error"]["type"] == "artifact_invalid"

    invalid_approval_attachment = client.post(
        "/admin/artifacts",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "workspace_id": workspace["workspace_id"],
            "artifact_type": "json",
            "label": "invalid-approval.json",
            "uri": "file:///tmp/invalid-approval.json",
            "attachments": [
                {"target_kind": "approval", "target_id": "elevated:req_x", "role": "approval_evidence"},
            ],
        },
    )

    assert invalid_approval_attachment.status_code == 404
    assert invalid_approval_attachment.json()["error"]["type"] == "artifact_invalid"
