from fastapi.testclient import TestClient
from uuid import uuid4

from app.main import app
from conftest import admin_headers as shared_admin_headers


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _instance_scope(instance_id: str) -> dict[str, str]:
    return {"instanceId": instance_id}


def _unique_contact_ref(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:8]}"


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
    if response.status_code != 201:
        raise AssertionError(response.json())
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
    assert response.status_code == 201, response.json()
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
    primary_phone: str | None = None,
    metadata: dict[str, object] | None = None,
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
            "primary_phone": primary_phone,
            "organization": "Acme",
            "visibility_scope": "team",
            "metadata": metadata or {},
        },
    )
    if response.status_code != 201:
        raise AssertionError(response.json())
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
    conversation_id: str | None = None,
) -> str:
    response = client.post(
        "/admin/notifications",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "task_id": task_id,
            "conversation_id": conversation_id,
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
    contact_ref = _unique_contact_ref("contact://customers/alex")
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
        contact_ref=contact_ref,
        primary_phone="+49-30-555-200",
        metadata={
            "channels": [
                {"kind": "slack", "label": "Escalation slack", "address": "@alex-customer", "source": "crm-sync"},
                {"kind": "email", "label": "Escalation mailbox"},
            ],
            "provenance": {
                "provider": "crm",
                "import_reference": "crm-4471",
                "imported_at": "2026-04-23T09:25:00Z",
                "last_verified_at": "2026-04-23T10:15:00Z",
                "note": "Imported from the CRM owner directory.",
            },
            "consent": {
                "status": "explicit_opt_in",
                "captured_at": "2026-04-23T09:30:00Z",
                "note": "Approved for commercial follow-up.",
            },
            "visibility": {
                "note": "Shared with the sales response team.",
            },
        },
    )
    conversation_id = _create_conversation(
        client,
        headers,
        instance_id=instance_id,
        contact_ref=contact_ref,
    )
    workspace_id = _create_workspace(client, headers, instance_id=instance_id, title="Context workspace")
    task_id = _create_task(client, headers, instance_id=instance_id, workspace_id=workspace_id)
    channel_id = _create_channel(client, headers, instance_id=instance_id)
    notification_id = _create_notification(
        client,
        headers,
        instance_id=instance_id,
        task_id=task_id,
        channel_id=channel_id,
        conversation_id=conversation_id,
    )

    created_memory = client.post(
        "/admin/memory",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "source_id": source_id,
            "contact_id": contact_id,
            "conversation_id": conversation_id,
            "task_id": task_id,
            "notification_id": notification_id,
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
    assert contact_payload["source_label"] == "Customer mailbox"
    assert contact_payload["source_kind"] == "mail"
    assert contact_payload["last_contact_at"] is not None
    assert contact_payload["channels"][0]["address"] == "customer@example.com"
    assert contact_payload["channels"][1]["address"] == "+49-30-555-200"
    assert contact_payload["channels"][2]["address"] == "@alex-customer"
    assert any("missing an address" in warning for warning in contact_payload["route_warnings"])
    assert contact_payload["provenance"]["provider"] == "crm"
    assert contact_payload["provenance"]["import_reference"] == "crm-4471"
    assert contact_payload["consent"]["status"] == "explicit_opt_in"
    assert contact_payload["visibility_note"] == "Shared with the sales response team."
    assert contact_payload["recent_conversations"][0]["record_id"] == conversation_id
    assert contact_payload["recent_tasks"][0]["record_id"] == task_id
    assert contact_payload["recent_notifications"][0]["record_id"] == notification_id
    assert contact_payload["recent_memory"][0]["memory_id"] == memory_id

    contact_list = client.get(
        "/admin/contacts",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert contact_list.status_code == 200
    list_payload = contact_list.json()["contacts"][0]
    assert list_payload["source_label"] == "Customer mailbox"
    assert list_payload["reachable_channel_count"] == 3
    assert list_payload["last_contact_at"] is not None

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


def test_contact_route_warnings_surface_incomplete_routes() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_contact_warning", company_id="company_contact_warning")
    contact_ref = _unique_contact_ref("contact://warning/contact")
    source_id = _create_source(
        client,
        headers,
        instance_id=instance_id,
        source_kind="contacts",
        label="Warning contacts",
        connection_target="contacts://warning",
    )
    contact_id = _create_contact(
        client,
        headers,
        instance_id=instance_id,
        source_id=source_id,
        display_name="Route Warning",
        contact_ref=contact_ref,
        metadata={
            "channels": [
                {"kind": "slack", "label": "Slack route"},
            ],
        },
    )

    contact_detail = client.get(
        f"/admin/contacts/{contact_id}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert contact_detail.status_code == 200
    payload = contact_detail.json()["contact"]
    assert payload["reachable_channel_count"] == 1
    assert any("missing an address" in warning for warning in payload["route_warnings"])


def test_contact_updates_can_clear_optional_route_and_source_fields() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_contact_clear", company_id="company_contact_clear")
    contact_ref = _unique_contact_ref("contact://clear/contact")
    source_id = _create_source(
        client,
        headers,
        instance_id=instance_id,
        source_kind="contacts",
        label="Clearable contacts",
        connection_target="contacts://clear",
    )
    contact_id = _create_contact(
        client,
        headers,
        instance_id=instance_id,
        source_id=source_id,
        display_name="Clearable Contact",
        contact_ref=contact_ref,
        primary_phone="+49-30-555-880",
    )

    cleared = client.patch(
        f"/admin/contacts/{contact_id}",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "source_id": None,
            "primary_email": None,
            "primary_phone": None,
            "organization": None,
            "title": None,
        },
    )
    assert cleared.status_code == 200
    payload = cleared.json()["contact"]
    assert payload["source_id"] is None
    assert payload["source"] is None
    assert payload["primary_email"] is None
    assert payload["primary_phone"] is None
    assert payload["organization"] is None
    assert payload["title"] is None
    assert any("No reachable channel is recorded" in warning for warning in payload["route_warnings"])


def test_memory_correction_and_delete_preserve_linkage_and_status_truth() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_memory_alpha", company_id="company_memory_alpha")
    contact_ref = _unique_contact_ref("contact://reviewers/nina")
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
        contact_ref=contact_ref,
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


def test_memory_revoke_marks_truth_state_and_human_override() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_memory_revoke", company_id="company_memory_revoke")
    contact_ref = _unique_contact_ref("contact://revocation/contact")
    source_id = _create_source(
        client,
        headers,
        instance_id=instance_id,
        source_kind="mail",
        label="Revocation mailbox",
        connection_target="mailbox://revocation",
    )
    contact_id = _create_contact(
        client,
        headers,
        instance_id=instance_id,
        source_id=source_id,
        display_name="Revocation Contact",
        contact_ref=contact_ref,
    )

    created_memory = client.post(
        "/admin/memory",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "source_id": source_id,
            "contact_id": contact_id,
            "memory_kind": "fact",
            "title": "Temporary runtime fact",
            "body": "This fact must be revoked after operator review.",
            "visibility_scope": "team",
            "sensitivity": "normal",
            "source_trust_class": "runtime_inferred",
        },
    )
    assert created_memory.status_code == 201
    memory_id = created_memory.json()["memory"]["memory_id"]

    revoked = client.post(
        f"/admin/memory/{memory_id}/revoke",
        headers=headers,
        params=_instance_scope(instance_id),
        json={"revocation_note": "Runtime signal was invalid."},
    )
    assert revoked.status_code == 200
    payload = revoked.json()["memory"]
    assert revoked.json()["action"] == "revoke"
    assert payload["truth_state"] == "revoked"
    assert payload["human_override"] is True
    assert payload["correction_note"] == "Runtime signal was invalid."

    detail = client.get(
        f"/admin/memory/{memory_id}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert detail.status_code == 200
    assert detail.json()["memory"]["truth_state"] == "revoked"


def test_contacts_sources_and_memory_are_hard_scoped_to_the_selected_instance() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_alpha = _create_instance(client, headers, instance_id="instance_scope_alpha", company_id="company_scope_alpha")
    instance_beta = _create_instance(client, headers, instance_id="instance_scope_beta", company_id="company_scope_beta")
    contact_ref = _unique_contact_ref("contact://scoped/contact")
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
        contact_ref=contact_ref,
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
