from uuid import uuid4

from conftest import admin_headers as shared_admin_headers
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.execution.dependencies import get_execution_session_factory
from app.main import app
from app.storage.agent_repository import AgentORM


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _instance_scope(instance_id: str) -> dict[str, str]:
    return {"instanceId": instance_id}


def _unique_suffix() -> str:
    return uuid4().hex[:8]


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


def _create_agent(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    agent_id: str,
    display_name: str,
    role_kind: str,
    participation_mode: str,
    status: str = "active",
) -> dict[str, object]:
    response = client.post(
        "/admin/agents",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "agent_id": agent_id,
            "display_name": display_name,
            "role_kind": role_kind,
            "participation_mode": participation_mode,
            "status": status,
        },
    )
    assert response.status_code == 201
    return response.json()["agent"]


def test_default_operator_is_autocreated_and_can_be_replaced_when_archived() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    suffix = _unique_suffix()
    instance_id = _create_instance(
        client,
        headers,
        instance_id=f"instance_agents_default_{suffix}",
        company_id=f"company_agents_default_{suffix}",
    )

    listed = client.get("/admin/agents", headers=headers, params=_instance_scope(instance_id))
    assert listed.status_code == 200
    default_operator = next(item for item in listed.json()["agents"] if item["is_default_operator"])
    assert default_operator["display_name"] == "Operator"
    assert default_operator["default_name"] == "Operator"
    assert default_operator["role_kind"] == "operator"

    created = client.post(
        "/admin/agents",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "agent_id": f"agent_reviewer_default_{suffix}",
            "display_name": "Reviewer Default",
            "role_kind": "reviewer",
            "participation_mode": "direct",
            "allowed_targets": ["conversation", "review"],
        },
    )
    assert created.status_code == 201
    reviewer_id = created.json()["agent"]["agent_id"]
    assert created.json()["agent"]["is_default_operator"] is False

    blocked_archive = client.post(
        f"/admin/agents/{default_operator['agent_id']}/archive",
        headers=headers,
        params=_instance_scope(instance_id),
        json={"reason": "Should fail without replacement."},
    )
    assert blocked_archive.status_code == 409

    archived = client.post(
        f"/admin/agents/{default_operator['agent_id']}/archive",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "replacement_agent_id": reviewer_id,
            "reason": "Promote reviewer to operator.",
        },
    )
    assert archived.status_code == 200
    archived_payload = archived.json()["agent"]
    assert archived_payload["status"] == "archived"
    assert archived_payload["metadata"]["replacement_agent_id"] == reviewer_id

    reviewer_detail = client.get(
        f"/admin/agents/{reviewer_id}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert reviewer_detail.status_code == 200
    reviewer_payload = reviewer_detail.json()["agent"]
    assert reviewer_payload["is_default_operator"] is True
    assert reviewer_payload["role_kind"] == "operator"
    assert reviewer_payload["default_name"] == "Operator"


def test_agent_read_endpoints_do_not_repair_missing_default_operator() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    suffix = _unique_suffix()
    instance_id = _create_instance(
        client,
        headers,
        instance_id=f"instance_agents_missing_operator_{suffix}",
        company_id=f"company_agents_missing_operator_{suffix}",
    )

    created = client.post(
        "/admin/agents",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "agent_id": f"agent_reader_{suffix}",
            "display_name": "Reader Agent",
            "role_kind": "reviewer",
            "participation_mode": "direct",
        },
    )
    assert created.status_code == 201

    initial_list = client.get("/admin/agents", headers=headers, params=_instance_scope(instance_id))
    assert initial_list.status_code == 200
    operator_id = next(item["agent_id"] for item in initial_list.json()["agents"] if item["is_default_operator"])

    session_factory = get_execution_session_factory()
    with session_factory() as session, session.begin():
        operator_row = session.execute(select(AgentORM).where(AgentORM.id == operator_id)).scalar_one()
        session.delete(operator_row)

    listed = client.get("/admin/agents", headers=headers, params=_instance_scope(instance_id))
    assert listed.status_code == 200
    listed_agents = listed.json()["agents"]
    assert all(item["agent_id"] != operator_id for item in listed_agents)
    assert all(not item["is_default_operator"] for item in listed_agents)

    missing_detail = client.get(
        f"/admin/agents/{operator_id}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert missing_detail.status_code == 404
    assert missing_detail.json()["error"]["type"] == "agent_not_found"

    listed_again = client.get("/admin/agents", headers=headers, params=_instance_scope(instance_id))
    assert listed_again.status_code == 200
    listed_again_agents = listed_again.json()["agents"]
    assert all(item["agent_id"] != operator_id for item in listed_again_agents)
    assert all(not item["is_default_operator"] for item in listed_again_agents)


def test_agent_registry_reports_real_conversation_activity_and_addressability() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    suffix = _unique_suffix()
    instance_id = _create_instance(
        client,
        headers,
        instance_id=f"instance_agents_activity_{suffix}",
        company_id=f"company_agents_activity_{suffix}",
    )

    initial_list = client.get("/admin/agents", headers=headers, params=_instance_scope(instance_id))
    assert initial_list.status_code == 200
    operator_id = next(item["agent_id"] for item in initial_list.json()["agents"] if item["is_default_operator"])

    reviewer_id = _create_agent(
        client,
        headers,
        instance_id=instance_id,
        agent_id=f"agent_reviewer_{suffix}",
        display_name="Reviewer",
        role_kind="reviewer",
        participation_mode="direct",
    )["agent_id"]
    mention_id = _create_agent(
        client,
        headers,
        instance_id=instance_id,
        agent_id=f"agent_mention_{suffix}",
        display_name="Mention Specialist",
        role_kind="observer",
        participation_mode="mentioned_only",
    )["agent_id"]
    handoff_id = _create_agent(
        client,
        headers,
        instance_id=instance_id,
        agent_id=f"agent_handoff_{suffix}",
        display_name="Worker",
        role_kind="worker",
        participation_mode="handoff_only",
    )["agent_id"]
    roundtable_id = _create_agent(
        client,
        headers,
        instance_id=instance_id,
        agent_id=f"agent_roundtable_{suffix}",
        display_name="Roundtable Facilitator",
        role_kind="specialist",
        participation_mode="roundtable",
    )["agent_id"]
    paused_id = _create_agent(
        client,
        headers,
        instance_id=instance_id,
        agent_id=f"agent_paused_{suffix}",
        display_name="Paused Agent",
        role_kind="specialist",
        participation_mode="direct",
        status="paused",
    )["agent_id"]

    created_conversation = client.post(
        "/admin/conversations",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "subject": "Agent registry verification",
            "summary": "Create a conversation with persisted participation and mention truth.",
            "triage_status": "new",
            "priority": "high",
            "initial_thread_title": "Primary thread",
            "initial_session_kind": "operator",
            "initial_message_role": "operator",
            "initial_message_body": "Operator is opening this thread for routing verification.",
            "participant_agent_ids": [operator_id, roundtable_id],
            "initial_mention_agent_ids": [mention_id],
            "create_inbox_entry": False,
        },
    )
    assert created_conversation.status_code == 201
    conversation_id = created_conversation.json()["conversation"]["conversation_id"]

    appended = client.post(
        f"/admin/conversations/{conversation_id}/messages",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "message_role": "assistant",
            "body": "Route this thread through mention, handoff, review, and roundtable controls.",
            "mention_agent_ids": [mention_id],
            "handoff_to_agent_id": handoff_id,
            "review_request_agent_id": reviewer_id,
            "roundtable_agent_ids": [roundtable_id],
        },
    )
    assert appended.status_code == 200

    listed = client.get("/admin/agents", headers=headers, params=_instance_scope(instance_id))
    assert listed.status_code == 200
    by_id = {item["agent_id"]: item for item in listed.json()["agents"]}

    assert by_id[operator_id]["conversation_count"] == 1
    assert by_id[operator_id]["addressable_in_conversations"] is True

    assert by_id[mention_id]["conversation_count"] >= 1
    assert by_id[mention_id]["mention_count"] == 2
    assert by_id[mention_id]["addressable_in_conversations"] is True
    assert "mention target only" in by_id[mention_id]["addressability_reason"]
    assert by_id[mention_id]["last_activity_at"] is not None

    assert by_id[handoff_id]["conversation_count"] >= 1
    assert by_id[handoff_id]["mention_count"] == 0
    assert by_id[handoff_id]["addressable_in_conversations"] is True
    assert "handoff" in by_id[handoff_id]["addressability_reason"]
    assert by_id[handoff_id]["last_activity_at"] is not None

    assert by_id[reviewer_id]["conversation_count"] >= 1
    assert by_id[reviewer_id]["addressable_in_conversations"] is True

    assert by_id[roundtable_id]["conversation_count"] == 1
    assert by_id[roundtable_id]["addressable_in_conversations"] is True
    assert "broadcast/roundtable" in by_id[roundtable_id]["addressability_reason"]

    assert by_id[paused_id]["addressable_in_conversations"] is False
    assert "Paused or archived agents" in by_id[paused_id]["addressability_reason"]

    mention_detail = client.get(
        f"/admin/agents/{mention_id}",
        headers=headers,
        params=_instance_scope(instance_id),
    )
    assert mention_detail.status_code == 200
    mention_payload = mention_detail.json()["agent"]
    assert mention_payload["mention_count"] == 2
    assert mention_payload["last_activity_at"] is not None
