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
) -> str:
    response = client.post(
        "/admin/workspaces",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "title": title,
            "issue_id": issue_id,
            "summary": "Workspace linked to conversation triage verification.",
            "preview_status": "draft",
            "review_status": "not_requested",
            "handoff_status": "not_ready",
        },
    )
    assert response.status_code == 201
    return response.json()["workspace"]["workspace_id"]


def _open_execution_approval(*, company_id: str, workspace_id: str, issue_id: str) -> tuple[str, str]:
    service = get_execution_transition_service()
    created = service.admit_create(
        company_id=company_id,
        actor_type="agent",
        actor_id="agent_conversation_runtime",
        idempotency_key=f"idem_conv_{workspace_id}",
        request_fingerprint_hash=f"fp_conv_{workspace_id}",
        run_kind="provider_dispatch",
        workspace_id=workspace_id,
        issue_id=issue_id,
    )
    claim = service.claim_next_attempt(company_id=company_id, worker_key=f"worker_conv_{workspace_id}")
    assert claim is not None
    service.mark_attempt_executing(
        company_id=company_id,
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="triage_gate",
    )
    approval_id = f"approval_conv_{workspace_id}"
    service.open_approval(
        company_id=company_id,
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        approval_id=approval_id,
        gate_key="triage_gate",
    )
    return claim.run_id, approval_id


def test_conversation_creation_persists_thread_history_and_inbox_item() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    workspace_id = _create_workspace(
        client,
        headers,
        instance_id=instance_id,
        title="Conversation workspace",
        issue_id="FOR-801",
    )
    run_id, approval_id = _open_execution_approval(company_id="company_alpha", workspace_id=workspace_id, issue_id="FOR-801")
    shared_approval_id = build_execution_approval_id(
        instance_id=instance_id,
        company_id="company_alpha",
        approval_id=approval_id,
    )

    artifact = client.post(
        "/admin/artifacts",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "workspace_id": workspace_id,
            "artifact_type": "handoff_note",
            "label": "Initial handoff note",
            "uri": "file:///tmp/handoff-note.md",
            "attachments": [{"target_kind": "run", "target_id": run_id, "role": "run_output"}],
        },
    )
    assert artifact.status_code == 201
    artifact_id = artifact.json()["artifact"]["artifact_id"]

    created = client.post(
        "/admin/conversations",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "workspace_id": workspace_id,
            "subject": "Customer pricing conversation",
            "summary": "Incoming pricing question with pending runtime evidence.",
            "triage_status": "new",
            "priority": "high",
            "contact_ref": "contact://customer/acme",
            "run_id": run_id,
            "artifact_id": artifact_id,
            "approval_id": shared_approval_id,
            "decision_id": "decision_preview_alpha",
            "initial_thread_title": "Incoming thread",
            "initial_session_kind": "external",
            "initial_message_role": "user",
            "initial_message_body": "Can someone confirm the final pricing package?",
            "create_inbox_entry": True,
        },
    )
    assert created.status_code == 201
    payload = created.json()["conversation"]
    assert payload["workspace_id"] == workspace_id
    assert payload["thread_count"] == 1
    assert payload["session_count"] == 1
    assert payload["message_count"] == 1
    assert payload["inbox_count"] == 1
    assert payload["threads"][0]["title"] == "Incoming thread"
    assert payload["sessions"][0]["session_kind"] == "external"
    assert payload["messages"][0]["body"] == "Can someone confirm the final pricing package?"
    assert payload["inbox_items"][0]["triage_status"] == "new"
    assert payload["inbox_items"][0]["decision_id"] == "decision_preview_alpha"

    listed = client.get(
        "/admin/inbox",
        headers=headers,
        params={**_instance_scope(instance_id), "triageStatus": "new"},
    )
    assert listed.status_code == 200
    assert listed.json()["items"][0]["conversation_id"] == payload["conversation_id"]


def test_appending_message_creates_session_continuation_visible_in_detail() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")

    created = client.post(
        "/admin/conversations",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "subject": "Operator follow-up",
            "summary": "Operator opened a follow-up conversation.",
            "triage_status": "relevant",
            "priority": "normal",
            "initial_thread_title": "Primary",
            "initial_session_kind": "operator",
            "initial_message_role": "operator",
            "initial_message_body": "Initial operator note.",
        },
    )
    assert created.status_code == 201
    conversation_id = created.json()["conversation"]["conversation_id"]
    thread_id = created.json()["conversation"]["threads"][0]["thread_id"]

    appended = client.post(
        f"/admin/conversations/{conversation_id}/messages",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "thread_id": thread_id,
            "start_new_session": True,
            "session_kind": "assistant",
            "continuity_key": "assistant-review-1",
            "message_role": "assistant",
            "body": "Assistant reviewed the thread and suggested the next handoff step.",
            "structured_payload": {"source": "assistant_review"},
        },
    )
    assert appended.status_code == 200
    payload = appended.json()["conversation"]
    assert payload["session_count"] == 2
    assert payload["message_count"] == 2
    assert payload["messages"][0]["message_role"] == "assistant"
    assert payload["messages"][0]["structured_payload"]["source"] == "assistant_review"
    assert payload["sessions"][0]["session_kind"] == "assistant"
    assert payload["threads"][0]["message_count"] == 2


def test_inbox_item_update_persists_triage_links_and_conversation_reference() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")

    created_conversation = client.post(
        "/admin/conversations",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "subject": "Delegation candidate",
            "summary": "Conversation for inbox link verification.",
            "triage_status": "new",
            "priority": "normal",
            "initial_thread_title": "Primary",
            "initial_session_kind": "operator",
            "initial_message_role": "operator",
            "initial_message_body": "Need delegation context.",
            "create_inbox_entry": False,
        },
    )
    assert created_conversation.status_code == 201
    conversation_id = created_conversation.json()["conversation"]["conversation_id"]
    thread_id = created_conversation.json()["conversation"]["threads"][0]["thread_id"]

    created_item = client.post(
        "/admin/inbox",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "conversation_id": conversation_id,
            "thread_id": thread_id,
            "title": "Delegate pricing follow-up",
            "summary": "Pending delegation.",
            "triage_status": "relevant",
            "priority": "high",
            "decision_id": "decision_inbox_alpha",
            "contact_ref": "contact://customer/acme",
        },
    )
    assert created_item.status_code == 201
    inbox_id = created_item.json()["item"]["inbox_id"]

    updated = client.patch(
        f"/admin/inbox/{inbox_id}",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "triage_status": "delegated",
            "status": "snoozed",
            "summary": "Delegated to team lead pending answer.",
            "decision_id": "decision_inbox_beta",
        },
    )
    assert updated.status_code == 200
    payload = updated.json()["item"]
    assert payload["triage_status"] == "delegated"
    assert payload["status"] == "snoozed"
    assert payload["decision_id"] == "decision_inbox_beta"
    assert payload["conversation"]["conversation_id"] == conversation_id
