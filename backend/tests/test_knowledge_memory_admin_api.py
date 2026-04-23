from fastapi.testclient import TestClient

from app.main import app
from conftest import admin_headers as shared_admin_headers


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _instance_scope(instance_id: str) -> dict[str, str]:
    return {"instanceId": instance_id}


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


def _create_workspace(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    title: str,
) -> str:
    response = client.post(
        "/admin/workspaces",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "title": title,
            "summary": "Workspace for knowledge and memory verification.",
            "preview_status": "draft",
            "review_status": "not_requested",
            "handoff_status": "not_ready",
        },
    )
    assert response.status_code == 201
    return response.json()["workspace"]["workspace_id"]


def _create_source(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    source_kind: str,
    label: str,
    connection_target: str,
) -> str:
    response = client.post(
        "/admin/knowledge-sources",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "source_kind": source_kind,
            "label": label,
            "description": f"{label} source",
            "connection_target": connection_target,
            "visibility_scope": "team",
        },
    )
    assert response.status_code == 201
    return response.json()["source"]["source_id"]


def _create_contact(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    source_id: str,
    display_name: str,
    contact_ref: str,
) -> str:
    response = client.post(
        "/admin/contacts",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "source_id": source_id,
            "display_name": display_name,
            "contact_ref": contact_ref,
            "primary_email": "customer@example.com",
            "organization": "Acme",
            "visibility_scope": "team",
        },
    )
    assert response.status_code == 201
    return response.json()["contact"]["contact_id"]


def _create_conversation(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    contact_ref: str,
) -> str:
    response = client.post(
        "/admin/conversations",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "subject": "Knowledge-linked conversation",
            "summary": "Conversation anchored to a real contact record.",
            "triage_status": "new",
            "priority": "high",
            "contact_ref": contact_ref,
            "initial_thread_title": "Incoming thread",
            "initial_session_kind": "operator",
            "initial_message_role": "operator",
            "initial_message_body": "Need customer context before the next response.",
            "create_inbox_entry": False,
        },
    )
    assert response.status_code == 201
    return response.json()["conversation"]["conversation_id"]


def _create_task(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    workspace_id: str,
) -> str:
    response = client.post(
        "/admin/tasks",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "title": "Knowledge task",
            "summary": "Task linked to memory truth.",
            "workspace_id": workspace_id,
        },
    )
    assert response.status_code == 201
    return response.json()["task"]["task_id"]


def _create_channel(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
) -> str:
    response = client.post(
        "/admin/channels",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "channel_kind": "email",
            "label": "Ops email",
            "target": "ops@example.com",
        },
    )
    assert response.status_code == 201
    return response.json()["channel"]["channel_id"]


def _create_notification(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    task_id: str,
    channel_id: str,
) -> str:
    response = client.post(
        "/admin/notifications",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "task_id": task_id,
            "channel_id": channel_id,
            "title": "Knowledge notification",
            "body": "Notification linked to memory truth.",
            "preview_required": True,
        },
    )
    assert response.status_code == 201
    return response.json()["notification"]["notification_id"]


def test_contacts_sources_and_memory_linkage_persist_context_truth() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_context_alpha", company_id="company_context_alpha")
    source_id = _create_source(
        client,
        headers,
        instance_id=instance_id,
        source_kind="mail",
        label="Customer mailbox",
        connection_target="mailbox://customer-support",
    )
    contact_id = _create_contact(
        client,
        headers,
        instance_id=instance_id,
        source_id=source_id,
        display_name="Alex Customer",
        contact_ref="contact://customers/alex",
    )
    conversation_id = _create_conversation(
        client,
        headers,
        instance_id=instance_id,
        contact_ref="contact://customers/alex",
    )

    created_memory = client.post(
        "/admin/memory",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "source_id": source_id,
            "contact_id": contact_id,
            "conversation_id": conversation_id,
            "memory_kind": "fact",
            "title": "Preferred contract cadence",
            "body": "Customer expects weekly contract updates.",
            "visibility_scope": "team",
            "sensitivity": "normal",
        },
    )
    assert created_memory.status_code == 201
    memory_id = created_memory.json()["memory"]["memory_id"]

    contact_detail = client.get(
        f"/admin/contacts/{contact_id}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert contact_detail.status_code == 200
    contact_payload = contact_detail.json()["contact"]
    assert contact_payload["source"]["source_id"] == source_id
    assert contact_payload["recent_conversations"][0]["record_id"] == conversation_id
    assert contact_payload["recent_memory"][0]["memory_id"] == memory_id

    source_detail = client.get(
        f"/admin/knowledge-sources/{source_id}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert source_detail.status_code == 200
    source_payload = source_detail.json()["source"]
    assert source_payload["contact_count"] == 1
    assert source_payload["memory_count"] == 1
    assert source_payload["contacts"][0]["contact_id"] == contact_id
    assert source_payload["memory_entries"][0]["memory_id"] == memory_id


def test_memory_correction_and_delete_preserve_linkage_and_status_truth() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_memory_alpha", company_id="company_memory_alpha")
    workspace_id = _create_workspace(client, headers, instance_id=instance_id, title="Context workspace")
    source_id = _create_source(
        client,
        headers,
        instance_id=instance_id,
        source_kind="knowledge_base",
        label="Pricing playbook",
        connection_target="kb://pricing",
    )
    contact_id = _create_contact(
        client,
        headers,
        instance_id=instance_id,
        source_id=source_id,
        display_name="Nina Reviewer",
        contact_ref="contact://reviewers/nina",
    )
    task_id = _create_task(client, headers, instance_id=instance_id, workspace_id=workspace_id)
    channel_id = _create_channel(client, headers, instance_id=instance_id)
    notification_id = _create_notification(
        client,
        headers,
        instance_id=instance_id,
        task_id=task_id,
        channel_id=channel_id,
    )

    created_memory = client.post(
        "/admin/memory",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "source_id": source_id,
            "contact_id": contact_id,
            "task_id": task_id,
            "notification_id": notification_id,
            "workspace_id": workspace_id,
            "memory_kind": "preference",
            "title": "Quiet review window",
            "body": "Do not send review pings after 18:00 CET.",
            "visibility_scope": "personal",
            "sensitivity": "sensitive",
        },
    )
    assert created_memory.status_code == 201
    original_memory_id = created_memory.json()["memory"]["memory_id"]

    corrected = client.post(
        f"/admin/memory/{original_memory_id}/correct",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "title": "Quiet review window corrected",
            "body": "Do not send review pings after 17:30 CET.",
            "correction_note": "Quiet-hours correction after reviewer feedback.",
            "visibility_scope": "personal",
            "sensitivity": "sensitive",
        },
    )
    assert corrected.status_code == 200
    corrected_payload = corrected.json()["memory"]
    corrected_memory_id = corrected_payload["memory_id"]
    assert corrected.json()["action"] == "correct"
    assert corrected_payload["supersedes_memory_id"] == original_memory_id
    assert corrected_payload["task"]["record_id"] == task_id
    assert corrected_payload["notification"]["record_id"] == notification_id
    assert corrected_payload["workspace"]["record_id"] == workspace_id

    original_detail = client.get(
        f"/admin/memory/{original_memory_id}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert original_detail.status_code == 200
    assert original_detail.json()["memory"]["status"] == "corrected"

    deleted = client.post(
        f"/admin/memory/{corrected_memory_id}/delete",
        headers=headers,
        params=_instance_scope(instance_id),
        json={"deletion_note": "Remove outdated private preference."},
    )
    assert deleted.status_code == 200
    deleted_payload = deleted.json()["memory"]
    assert deleted.json()["action"] == "delete"
    assert deleted_payload["status"] == "deleted"
    assert deleted_payload["deleted_at"] is not None

    deleted_list = client.get(
        "/admin/memory",
        headers=headers,
        params={**_instance_scope(instance_id), "status": "deleted"},
    )
    assert deleted_list.status_code == 200
    assert deleted_list.json()["memory"][0]["memory_id"] == corrected_memory_id


def test_contacts_sources_and_memory_are_hard_scoped_to_the_selected_instance() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_alpha = _create_instance(client, headers, instance_id="instance_scope_alpha", company_id="company_scope_alpha")
    instance_beta = _create_instance(client, headers, instance_id="instance_scope_beta", company_id="company_scope_beta")
    source_id = _create_source(
        client,
        headers,
        instance_id=instance_alpha,
        source_kind="contacts",
        label="Private contacts",
        connection_target="contacts://private",
    )
    contact_id = _create_contact(
        client,
        headers,
        instance_id=instance_alpha,
        source_id=source_id,
        display_name="Scoped Contact",
        contact_ref="contact://scoped/contact",
    )
    created_memory = client.post(
        "/admin/memory",
        headers=headers,
        params=_instance_scope(instance_alpha),
        json={
            "source_id": source_id,
            "contact_id": contact_id,
            "memory_kind": "fact",
            "title": "Scoped fact",
            "body": "This should not leak across instances.",
            "visibility_scope": "restricted",
            "sensitivity": "restricted",
        },
    )
    assert created_memory.status_code == 201
    memory_id = created_memory.json()["memory"]["memory_id"]

    wrong_source = client.get(
        f"/admin/knowledge-sources/{source_id}",
        headers=headers,
        params=_instance_scope(instance_beta),
    )
    wrong_contact = client.get(
        f"/admin/contacts/{contact_id}",
        headers=headers,
        params=_instance_scope(instance_beta),
    )
    wrong_memory = client.get(
        f"/admin/memory/{memory_id}",
        headers=headers,
        params=_instance_scope(instance_beta),
    )

    assert wrong_source.status_code == 404
    assert wrong_contact.status_code == 404
    assert wrong_memory.status_code == 404
