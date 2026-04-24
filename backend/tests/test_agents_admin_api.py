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


def test_default_operator_is_autocreated_and_can_be_replaced_when_archived() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_agents_default", company_id="company_agents_default")

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
            "agent_id": "agent_reviewer_default",
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
