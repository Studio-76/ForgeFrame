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


def _create_conversation(client: TestClient, headers: dict[str, str], *, instance_id: str) -> str:
    response = client.post(
        "/admin/conversations",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "subject": "Learning conversation",
            "summary": "Conversation used for learning-event linkage.",
            "triage_status": "relevant",
            "priority": "normal",
            "initial_thread_title": "Primary",
            "initial_session_kind": "operator",
            "initial_message_role": "operator",
            "initial_message_body": "Seed conversation for learning persistence.",
            "create_inbox_entry": False,
        },
    )
    assert response.status_code == 201
    return response.json()["conversation"]["conversation_id"]


def _create_memory(client: TestClient, headers: dict[str, str], *, instance_id: str, title: str) -> str:
    response = client.post(
        "/admin/memory",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "memory_kind": "fact",
            "title": title,
            "body": f"Body for {title}.",
            "visibility_scope": "team",
            "sensitivity": "normal",
        },
    )
    assert response.status_code == 201
    return response.json()["memory"]["memory_id"]


def test_learning_event_can_promote_durable_memory_with_provenance() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_learning_memory", company_id="company_learning_memory")
    conversation_id = _create_conversation(client, headers, instance_id=instance_id)

    created = client.post(
        "/admin/learning",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "trigger_kind": "operator_action",
            "suggested_decision": "durable_memory",
            "summary": "Promote pricing review insight",
            "explanation": "Operators repeatedly retain the same review rule and want durable context.",
            "conversation_id": conversation_id,
            "proposed_memory": {
                "memory_kind": "constraint",
                "title": "Pricing review must stay enabled",
                "body": "Keep reviewed pricing responses enabled for this workflow.",
            },
        },
    )
    assert created.status_code == 201
    event_id = created.json()["event"]["learning_event_id"]

    decided = client.post(
        f"/admin/learning/{event_id}/decide",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "decision": "durable_memory",
            "decision_note": "Promote after operator confirmation.",
            "human_override": True,
            "memory_payload": {
                "visibility_scope": "restricted",
                "source_trust_class": "human_verified",
            },
        },
    )
    assert decided.status_code == 200
    decided_payload = decided.json()["event"]
    assert decided_payload["status"] == "applied"
    assert decided_payload["promoted_memory"]["status"] == "active"
    promoted_memory_id = decided_payload["promoted_memory_id"]

    memory_detail = client.get(
        f"/admin/memory/{promoted_memory_id}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert memory_detail.status_code == 200
    memory_payload = memory_detail.json()["memory"]
    assert memory_payload["learned_from_event_id"] == event_id
    assert memory_payload["human_override"] is True
    assert memory_payload["source_trust_class"] == "human_verified"
    assert memory_payload["visibility_scope"] == "restricted"


def test_learning_pattern_scan_detects_repeat_corrections_and_can_create_skill_draft() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_learning_patterns", company_id="company_learning_patterns")

    first_memory_id = _create_memory(client, headers, instance_id=instance_id, title="Repeated pricing correction")
    second_memory_id = _create_memory(client, headers, instance_id=instance_id, title="Repeated pricing correction")

    for memory_id in (first_memory_id, second_memory_id):
        corrected = client.post(
            f"/admin/memory/{memory_id}/correct",
            headers=headers,
            params=_instance_scope(instance_id),
            json={
                "title": "Repeated pricing correction normalized",
                "body": "Corrected after operator review.",
                "correction_note": "Normalize repeated correction.",
            },
        )
        assert corrected.status_code == 200

    scanned = client.post(
        "/admin/learning/pattern-scan",
        headers=headers,
        params=_instance_scope(instance_id),
        json={},
    )
    assert scanned.status_code == 200
    event = scanned.json()["events"][0]
    assert event["trigger_kind"] == "pattern_detected"
    assert event["summary"] == "Repeated correction pattern: Repeated pricing correction"
    event_id = event["learning_event_id"]

    decided = client.post(
        f"/admin/learning/{event_id}/decide",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "decision": "skill_draft",
            "decision_note": "Escalate repeated corrections into a draft skill.",
            "skill_payload": {
                "display_name": "Repeated pricing correction skill",
                "summary": "Draft skill from repeated corrections.",
                "instruction_core": "Review repeated pricing corrections and normalize the outgoing response.",
            },
        },
    )
    assert decided.status_code == 200
    decided_payload = decided.json()["event"]
    assert decided_payload["status"] == "applied"
    assert decided_payload["promoted_skill"]["label"] == "Repeated pricing correction skill"

    skill_detail = client.get(
        f"/admin/skills/{decided_payload['promoted_skill_id']}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert skill_detail.status_code == 200
    assert skill_detail.json()["skill"]["status"] == "draft"
