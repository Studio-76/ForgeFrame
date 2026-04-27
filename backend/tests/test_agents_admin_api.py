from fastapi.testclient import TestClient
from sqlalchemy import select
from uuid import uuid4

from app.execution.dependencies import get_execution_session_factory
from app.main import app
from app.storage.agent_repository import AgentORM
from conftest import admin_headers as shared_admin_headers


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
        json={"replacement_agent_id": reviewer_id, "reason": "Promote reviewer to operator."},
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
