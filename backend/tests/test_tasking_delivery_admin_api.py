from datetime import UTC, datetime, timedelta

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
    issue_id: str,
) -> str:
    response = client.post(
        "/admin/workspaces",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "title": title,
            "issue_id": issue_id,
            "summary": "Workspace used for tasking and delivery verification.",
            "preview_status": "draft",
            "review_status": "not_requested",
            "handoff_status": "not_ready",
        },
    )
    assert response.status_code == 201
    return response.json()["workspace"]["workspace_id"]


def _create_conversation(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    workspace_id: str | None = None,
    create_inbox_entry: bool = True,
) -> dict[str, str]:
    response = client.post(
        "/admin/conversations",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "workspace_id": workspace_id,
            "subject": "Tasking root conversation",
            "summary": "Conversation used to anchor reminders and notifications.",
            "triage_status": "new",
            "priority": "high",
            "initial_thread_title": "Primary thread",
            "initial_session_kind": "operator",
            "initial_message_role": "operator",
            "initial_message_body": "Need the system to follow up on this item.",
            "create_inbox_entry": create_inbox_entry,
        },
    )
    assert response.status_code == 201
    payload = response.json()["conversation"]
    result = {
        "conversation_id": payload["conversation_id"],
        "thread_id": payload["threads"][0]["thread_id"],
    }
    if payload["inbox_items"]:
        result["inbox_id"] = payload["inbox_items"][0]["inbox_id"]
    return result


def _create_channel(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    channel_kind: str,
    label: str,
    target: str,
    fallback_channel_id: str | None = None,
) -> str:
    response = client.post(
        "/admin/channels",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "channel_kind": channel_kind,
            "label": label,
            "target": target,
            "fallback_channel_id": fallback_channel_id,
        },
    )
    assert response.status_code == 201
    return response.json()["channel"]["channel_id"]


def test_task_and_reminder_flow_persists_links_and_due_state() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_tasks_alpha", company_id="company_tasks_alpha")
    workspace_id = _create_workspace(
        client,
        headers,
        instance_id=instance_id,
        title="Tasking workspace",
        issue_id="FOR-901",
    )
    conversation = _create_conversation(client, headers, instance_id=instance_id, workspace_id=workspace_id)
    due_at = datetime.now(tz=UTC) - timedelta(minutes=30)

    created_task = client.post(
        "/admin/tasks",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "task_kind": "task",
            "title": "Review outbound message",
            "summary": "Review and confirm the outbound follow-up.",
            "priority": "high",
            "conversation_id": conversation["conversation_id"],
            "inbox_id": conversation["inbox_id"],
            "workspace_id": workspace_id,
        },
    )
    assert created_task.status_code == 201
    task_id = created_task.json()["task"]["task_id"]

    created_reminder = client.post(
        "/admin/reminders",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "task_id": task_id,
            "title": "Follow up now",
            "summary": "This reminder should already be due.",
            "due_at": due_at.isoformat(),
        },
    )
    assert created_reminder.status_code == 201
    reminder = created_reminder.json()["reminder"]
    assert reminder["status"] == "due"
    assert reminder["task"]["task_id"] == task_id

    listed_reminders = client.get(
        "/admin/reminders",
        headers=headers,
        params={**_instance_scope(instance_id), "status": "due"},
    )
    assert listed_reminders.status_code == 200
    assert listed_reminders.json()["reminders"][0]["reminder_id"] == reminder["reminder_id"]

    task_detail = client.get(
        f"/admin/tasks/{task_id}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert task_detail.status_code == 200
    payload = task_detail.json()["task"]
    assert payload["conversation_id"] == conversation["conversation_id"]
    assert payload["inbox_id"] == conversation["inbox_id"]
    assert payload["workspace_id"] == workspace_id
    assert payload["reminder_count"] == 1
    assert payload["reminders"][0]["reminder_id"] == reminder["reminder_id"]


def test_notification_preview_reject_retry_and_fallback_truth() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_notify_alpha", company_id="company_notify_alpha")
    primary_channel_id = _create_channel(
        client,
        headers,
        instance_id=instance_id,
        channel_kind="email",
        label="Primary mail",
        target="alerts@example.com",
    )
    fallback_channel_id = _create_channel(
        client,
        headers,
        instance_id=instance_id,
        channel_kind="slack",
        label="Fallback Slack",
        target="#ops-room",
    )

    created_preview = client.post(
        "/admin/notifications",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "title": "Preview before send",
            "body": "The operator must approve this message first.",
            "channel_id": primary_channel_id,
            "fallback_channel_id": fallback_channel_id,
            "preview_required": True,
            "max_retries": 1,
        },
    )
    assert created_preview.status_code == 201
    notification_id = created_preview.json()["notification"]["notification_id"]
    assert created_preview.json()["notification"]["delivery_status"] == "preview"

    rejected = client.post(
        f"/admin/notifications/{notification_id}/reject",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert rejected.status_code == 200
    assert rejected.json()["notification"]["delivery_status"] == "rejected"
    assert rejected.json()["notification"]["rejected_at"] is not None

    confirmed = client.post(
        f"/admin/notifications/{notification_id}/confirm",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["notification"]["delivery_status"] == "queued"
    assert confirmed.json()["notification"]["next_attempt_at"] is not None

    first_retry = client.post(
        f"/admin/notifications/{notification_id}/retry",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert first_retry.status_code == 200
    first_payload = first_retry.json()["notification"]
    assert first_payload["delivery_status"] == "fallback_queued"
    assert first_payload["channel_id"] == fallback_channel_id
    assert first_payload["retry_count"] == 1

    second_retry = client.post(
        f"/admin/notifications/{notification_id}/retry",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert second_retry.status_code == 200
    second_payload = second_retry.json()["notification"]
    assert second_payload["delivery_status"] == "failed"
    assert second_payload["next_attempt_at"] is None
    assert second_payload["retry_count"] == 2


def test_automation_trigger_materializes_follow_up_and_notification_records() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_auto_alpha", company_id="company_auto_alpha")
    workspace_id = _create_workspace(
        client,
        headers,
        instance_id=instance_id,
        title="Automation workspace",
        issue_id="FOR-902",
    )
    conversation = _create_conversation(client, headers, instance_id=instance_id, workspace_id=workspace_id)
    channel_id = _create_channel(
        client,
        headers,
        instance_id=instance_id,
        channel_kind="email",
        label="Automation mail",
        target="automation@example.com",
    )

    root_task = client.post(
        "/admin/tasks",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "title": "Base task",
            "summary": "The automation will reference this task.",
            "workspace_id": workspace_id,
        },
    )
    assert root_task.status_code == 201
    root_task_id = root_task.json()["task"]["task_id"]
    next_run_at = (datetime.now(tz=UTC) + timedelta(minutes=5)).isoformat()

    follow_up_automation = client.post(
        "/admin/automations",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "title": "Create follow-up",
            "summary": "Create a follow-up task anchored to the conversation.",
            "action_kind": "create_follow_up",
            "cadence_minutes": 60,
            "next_run_at": next_run_at,
            "target_conversation_id": conversation["conversation_id"],
            "target_inbox_id": conversation["inbox_id"],
            "target_workspace_id": workspace_id,
            "task_template_title": "Automation follow-up",
            "task_template_summary": "Generated by the automation trigger.",
        },
    )
    assert follow_up_automation.status_code == 201
    follow_up_automation_id = follow_up_automation.json()["automation"]["automation_id"]

    triggered_follow_up = client.post(
        f"/admin/automations/{follow_up_automation_id}/trigger",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert triggered_follow_up.status_code == 200
    triggered_follow_up_payload = triggered_follow_up.json()["automation"]
    assert triggered_follow_up_payload["last_task_id"] is not None
    assert triggered_follow_up_payload["last_run_at"] is not None

    follow_up_task = client.get(
        f"/admin/tasks/{triggered_follow_up_payload['last_task_id']}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert follow_up_task.status_code == 200
    follow_up_task_payload = follow_up_task.json()["task"]
    assert follow_up_task_payload["task_kind"] == "follow_up"
    assert follow_up_task_payload["conversation_id"] == conversation["conversation_id"]
    assert follow_up_task_payload["inbox_id"] == conversation["inbox_id"]

    notification_automation = client.post(
        "/admin/automations",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "title": "Create notification",
            "summary": "Generate a preview notification for the operator.",
            "action_kind": "create_notification",
            "cadence_minutes": 30,
            "next_run_at": next_run_at,
            "target_task_id": root_task_id,
            "target_conversation_id": conversation["conversation_id"],
            "target_inbox_id": conversation["inbox_id"],
            "target_workspace_id": workspace_id,
            "channel_id": channel_id,
            "preview_required": True,
            "notification_title": "Automation preview",
            "notification_body": "Automation generated this message for review.",
        },
    )
    assert notification_automation.status_code == 201
    notification_automation_id = notification_automation.json()["automation"]["automation_id"]

    triggered_notification = client.post(
        f"/admin/automations/{notification_automation_id}/trigger",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert triggered_notification.status_code == 200
    triggered_notification_payload = triggered_notification.json()["automation"]
    assert triggered_notification_payload["last_notification_id"] is not None

    notification = client.get(
        f"/admin/notifications/{triggered_notification_payload['last_notification_id']}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert notification.status_code == 200
    notification_payload = notification.json()["notification"]
    assert notification_payload["task_id"] == root_task_id
    assert notification_payload["channel_id"] == channel_id
    assert notification_payload["delivery_status"] == "preview"
