from fastapi.testclient import TestClient

from app.main import app
from conftest import admin_headers as shared_admin_headers


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _instance_scope(instance_id: str) -> dict[str, str]:
    return {"instanceId": instance_id}


def _create_instance(client: TestClient, headers: dict[str, str], *, instance_id: str, company_id: str) -> str:
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


def _create_source(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    source_kind: str,
    label: str,
) -> str:
    response = client.post(
        "/admin/knowledge-sources",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "source_kind": source_kind,
            "label": label,
            "description": f"{label} source",
            "connection_target": f"{source_kind}://{label.lower().replace(' ', '-')}",
            "visibility_scope": "personal",
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
            "primary_email": "profile@example.com",
            "visibility_scope": "personal",
        },
    )
    assert response.status_code == 201
    return response.json()["contact"]["contact_id"]


def _create_channel(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    label: str,
    target: str,
) -> str:
    response = client.post(
        "/admin/channels",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "channel_kind": "email",
            "label": label,
            "target": target,
        },
    )
    assert response.status_code == 201
    return response.json()["channel"]["channel_id"]


def test_assistant_profiles_persist_and_link_shared_core_truth() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_assistant_alpha", company_id="company_assistant_alpha")
    mail_source_id = _create_source(client, headers, instance_id=instance_id, source_kind="mail", label="Private mailbox")
    calendar_source_id = _create_source(client, headers, instance_id=instance_id, source_kind="calendar", label="Primary calendar")
    preferred_contact_id = _create_contact(
        client,
        headers,
        instance_id=instance_id,
        source_id=mail_source_id,
        display_name="Jordan Contact",
        contact_ref="contact://assistant/jordan",
    )
    delegate_contact_id = _create_contact(
        client,
        headers,
        instance_id=instance_id,
        source_id=mail_source_id,
        display_name="Morgan Delegate",
        contact_ref="contact://assistant/morgan",
    )
    primary_channel_id = _create_channel(client, headers, instance_id=instance_id, label="Personal email", target="me@example.com")
    fallback_channel_id = _create_channel(client, headers, instance_id=instance_id, label="Backup email", target="backup@example.com")

    created = client.post(
        "/admin/assistant-profiles",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "assistant_profile_id": "assistant_profile_primary",
            "display_name": "Primary assistant profile",
            "summary": "Personal assistant mode for the instance owner.",
            "assistant_mode_enabled": True,
            "is_default": True,
            "timezone": "UTC",
            "locale": "de-DE",
            "tone": "warm",
            "preferred_contact_id": preferred_contact_id,
            "mail_source_id": mail_source_id,
            "calendar_source_id": calendar_source_id,
            "preferences": {"language": "de", "working_style": "proactive"},
            "communication_rules": {"tone": "warm", "locale": "de-DE", "signature": "Jordan"},
            "quiet_hours": {"enabled": True, "timezone": "UTC", "start_minute": 1320, "end_minute": 420, "days": ["mon", "tue", "wed", "thu", "fri"]},
            "delivery_preferences": {
                "primary_channel_id": primary_channel_id,
                "fallback_channel_id": fallback_channel_id,
                "allowed_channel_ids": [primary_channel_id, fallback_channel_id],
                "preview_by_default": True,
            },
            "action_policies": {
                "direct_action_policy": "preview_required",
                "direct_channel_ids": [primary_channel_id],
            },
            "delegation_rules": {
                "delegate_contact_id": delegate_contact_id,
                "allow_external_delegation": True,
            },
        },
    )
    assert created.status_code == 201

    detail = client.get(
        "/admin/assistant-profiles/assistant_profile_primary",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert detail.status_code == 200
    payload = detail.json()["profile"]
    assert payload["assistant_profile_id"] == "assistant_profile_primary"
    assert payload["preferred_contact"]["record_id"] == preferred_contact_id
    assert payload["delegate_contact"]["record_id"] == delegate_contact_id
    assert payload["primary_channel"]["record_id"] == primary_channel_id
    assert payload["fallback_channel"]["record_id"] == fallback_channel_id
    assert payload["mail_source"]["record_id"] == mail_source_id
    assert payload["calendar_source"]["record_id"] == calendar_source_id
    assert payload["delivery_preferences"]["preview_by_default"] is True
    assert payload["action_policies"]["direct_action_policy"] == "preview_required"
    assert payload["delegation_rules"]["allow_external_delegation"] is True


def test_assistant_action_evaluation_enforces_quiet_hours_preview_and_approval_truth() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_assistant_eval", company_id="company_assistant_eval")
    mail_source_id = _create_source(client, headers, instance_id=instance_id, source_kind="mail", label="Mailbox")
    preferred_contact_id = _create_contact(
        client,
        headers,
        instance_id=instance_id,
        source_id=mail_source_id,
        display_name="Jordan Contact",
        contact_ref="contact://assistant/eval",
    )
    primary_channel_id = _create_channel(client, headers, instance_id=instance_id, label="Personal email", target="me@example.com")

    created = client.post(
        "/admin/assistant-profiles",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "assistant_profile_id": "assistant_profile_eval",
            "display_name": "Evaluation profile",
            "preferred_contact_id": preferred_contact_id,
            "delivery_preferences": {
                "primary_channel_id": primary_channel_id,
                "allowed_channel_ids": [primary_channel_id],
                "preview_by_default": True,
                "mute_during_quiet_hours": True,
            },
            "quiet_hours": {
                "enabled": True,
                "timezone": "UTC",
                "start_minute": 0,
                "end_minute": 0,
                "days": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
                "allow_priority_override": False,
                "override_min_priority": "critical",
            },
            "action_policies": {
                "direct_action_policy": "preview_required",
                "direct_channel_ids": [primary_channel_id],
            },
        },
    )
    assert created.status_code == 201

    blocked = client.post(
        "/admin/assistant-profiles/assistant_profile_eval/evaluate-action",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "action_mode": "direct",
            "action_kind": "send_notification",
            "priority": "normal",
            "channel_id": primary_channel_id,
            "occurred_at": "2026-04-23T02:00:00Z",
            "requires_external_delivery": True,
        },
    )
    assert blocked.status_code == 200
    blocked_payload = blocked.json()["evaluation"]
    assert blocked_payload["decision"] == "blocked"
    assert "quiet_hours_active" in blocked_payload["reasons"]

    updated = client.patch(
        "/admin/assistant-profiles/assistant_profile_eval",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "quiet_hours": {
                "enabled": True,
                "timezone": "UTC",
                "start_minute": 0,
                "end_minute": 0,
                "days": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
                "allow_priority_override": True,
                "override_min_priority": "critical",
            },
            "action_policies": {
                "direct_action_policy": "preview_required",
                "direct_channel_ids": [primary_channel_id],
            },
        },
    )
    assert updated.status_code == 200

    preview = client.post(
        "/admin/assistant-profiles/assistant_profile_eval/evaluate-action",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "action_mode": "direct",
            "action_kind": "send_notification",
            "priority": "critical",
            "channel_id": primary_channel_id,
            "occurred_at": "2026-04-23T02:00:00Z",
            "requires_external_delivery": True,
        },
    )
    assert preview.status_code == 200
    preview_payload = preview.json()["evaluation"]
    assert preview_payload["decision"] == "requires_preview"
    assert preview_payload["quiet_hours_active"] is True

    approval_update = client.patch(
        "/admin/assistant-profiles/assistant_profile_eval",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "action_policies": {
                "direct_action_policy": "approval_required",
                "direct_channel_ids": [primary_channel_id],
                "require_approval_reference": True,
            },
        },
    )
    assert approval_update.status_code == 200

    approval = client.post(
        "/admin/assistant-profiles/assistant_profile_eval/evaluate-action",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "action_mode": "direct",
            "action_kind": "send_notification",
            "priority": "critical",
            "channel_id": primary_channel_id,
            "occurred_at": "2026-04-23T02:00:00Z",
            "requires_external_delivery": True,
        },
    )
    assert approval.status_code == 200
    approval_payload = approval.json()["evaluation"]
    assert approval_payload["decision"] == "requires_approval"
    assert approval_payload["approval_required"] is True
    assert "approval_reference_required" in approval_payload["reasons"]


def test_assistant_profiles_are_hard_scoped_and_enforce_action_mode_rules() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_alpha = _create_instance(client, headers, instance_id="instance_assistant_scope_alpha", company_id="company_assistant_scope_alpha")
    instance_beta = _create_instance(client, headers, instance_id="instance_assistant_scope_beta", company_id="company_assistant_scope_beta")
    mail_source_id = _create_source(client, headers, instance_id=instance_alpha, source_kind="mail", label="Mailbox")
    preferred_contact_id = _create_contact(
        client,
        headers,
        instance_id=instance_alpha,
        source_id=mail_source_id,
        display_name="Jordan Contact",
        contact_ref="contact://assistant/rules",
    )

    created = client.post(
        "/admin/assistant-profiles",
        headers=headers,
        params=_instance_scope(instance_alpha),
        json={
            "assistant_profile_id": "assistant_profile_rules",
            "display_name": "Rules profile",
            "preferred_contact_id": preferred_contact_id,
            "action_policies": {
                "suggestions_enabled": False,
                "questions_enabled": False,
                "direct_action_policy": "never",
                "allow_mail_actions": False,
                "allow_calendar_actions": False,
                "allow_task_actions": False,
            },
            "delegation_rules": {
                "allow_external_delegation": False,
            },
        },
    )
    assert created.status_code == 201

    wrong_instance = client.get(
        "/admin/assistant-profiles/assistant_profile_rules",
        headers=headers,
        params=_instance_scope(instance_beta),
    )
    assert wrong_instance.status_code == 404

    suggest = client.post(
        "/admin/assistant-profiles/assistant_profile_rules/evaluate-action",
        headers=headers,
        params=_instance_scope(instance_alpha),
        json={
            "action_mode": "suggest",
            "action_kind": "draft_message",
            "priority": "normal",
            "requires_external_delivery": False,
        },
    )
    assert suggest.status_code == 200
    assert suggest.json()["evaluation"]["decision"] == "blocked"
    assert "suggestions_disabled" in suggest.json()["evaluation"]["reasons"]

    ask = client.post(
        "/admin/assistant-profiles/assistant_profile_rules/evaluate-action",
        headers=headers,
        params=_instance_scope(instance_alpha),
        json={
            "action_mode": "ask",
            "action_kind": "schedule_calendar",
            "priority": "normal",
            "requires_external_delivery": False,
        },
    )
    assert ask.status_code == 200
    ask_payload = ask.json()["evaluation"]
    assert ask_payload["decision"] == "blocked"
    assert "questions_disabled" in ask_payload["reasons"]
    assert "calendar_actions_disabled" in ask_payload["reasons"]

    direct = client.post(
        "/admin/assistant-profiles/assistant_profile_rules/evaluate-action",
        headers=headers,
        params=_instance_scope(instance_alpha),
        json={
            "action_mode": "direct",
            "action_kind": "create_follow_up",
            "priority": "normal",
            "requires_external_delivery": False,
        },
    )
    assert direct.status_code == 200
    direct_payload = direct.json()["evaluation"]
    assert direct_payload["decision"] == "blocked"
    assert "task_actions_disabled" in direct_payload["reasons"]
    assert "direct_actions_disabled" in direct_payload["reasons"]
