from fastapi.testclient import TestClient
from uuid import uuid4

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


def _create_agent(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    agent_id: str,
    display_name: str,
    role_kind: str,
) -> str:
    response = client.post(
        "/admin/agents",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "agent_id": agent_id,
            "display_name": display_name,
            "role_kind": role_kind,
            "participation_mode": "direct",
            "allowed_targets": ["conversation", "skill"],
        },
    )
    assert response.status_code == 201
    return response.json()["agent"]["agent_id"]


def test_skill_lifecycle_versions_activation_and_usage_are_persisted() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_skills_alpha", company_id="company_skills_alpha")
    skill_id = f"skill_review_alpha_{uuid4().hex[:8]}"
    reviewer_id = _create_agent(
        client,
        headers,
        instance_id=instance_id,
        agent_id=f"agent_skill_reviewer_{uuid4().hex[:8]}",
        display_name="Skill Reviewer",
        role_kind="reviewer",
    )

    created = client.post(
        "/admin/skills",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "skill_id": skill_id,
            "display_name": "Review Pricing Reply",
            "summary": "Review outbound pricing responses before send.",
            "scope": "agent",
            "scope_agent_id": reviewer_id,
            "status": "draft",
            "instruction_core": "Review the draft pricing reply for policy and tone.",
            "provenance": {"source": "operator"},
            "activation_conditions": {"channel": "email"},
            "metadata": {"tier": "review"},
        },
    )
    assert created.status_code == 201
    created_payload = created.json()["skill"]
    assert created_payload["scope_agent_id"] == reviewer_id
    assert created_payload["scope_label"] == "Agent scope · Skill Reviewer"
    assert created_payload["approval"]["posture"] == "draft"
    assert created_payload["provenance_summary"]["kind"] == "operator"
    assert created_payload["current_version_number"] == 1
    assert len(created_payload["versions"]) == 1

    updated = client.patch(
        f"/admin/skills/{skill_id}",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "summary": "Review pricing responses and block unsafe sends.",
            "instruction_core": "Review the draft pricing reply, block unsafe content, and explain the decision.",
            "activation_conditions": {"channel": "email", "preview_required": True},
            "status": "review",
        },
    )
    assert updated.status_code == 200
    updated_payload = updated.json()["skill"]
    assert updated_payload["current_version_number"] == 2
    assert updated_payload["approval"]["posture"] == "review_required"
    assert len(updated_payload["versions"]) == 2
    assert updated_payload["versions"][0]["version_number"] == 2

    cleared_scope = client.patch(
        f"/admin/skills/{skill_id}",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "scope": "instance",
            "scope_agent_id": None,
        },
    )
    assert cleared_scope.status_code == 200
    cleared_scope_payload = cleared_scope.json()["skill"]
    assert cleared_scope_payload["scope"] == "instance"
    assert cleared_scope_payload["scope_agent_id"] is None
    assert cleared_scope_payload["scope_label"] == "Instance scope"

    activated = client.post(
        f"/admin/skills/{skill_id}/activate",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "scope": "instance",
            "scope_agent_id": None,
            "activation_conditions": {"preview_required": True},
            "metadata": {"activation_source": "test"},
        },
    )
    assert activated.status_code == 200
    activated_payload = activated.json()["skill"]
    assert activated_payload["status"] == "active"
    assert activated_payload["approval"]["posture"] == "approved"
    assert activated_payload["activations"][0]["status"] == "active"
    assert activated_payload["activations"][0]["scope_label"] == "Instance scope"
    assert activated_payload["active_scope_labels"][0] == "Instance scope"
    activation_id = activated_payload["activations"][0]["activation_id"]
    version_id = activated_payload["versions"][0]["version_id"]

    usage = client.post(
        f"/admin/skills/{skill_id}/usage-events",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "version_id": version_id,
            "activation_id": activation_id,
            "agent_id": reviewer_id,
            "conversation_id": "conversation_skill_alpha",
            "outcome": "success",
            "details": {"decision": "allow"},
        },
    )
    assert usage.status_code == 200
    usage_payload = usage.json()["skill"]
    assert usage_payload["recent_usage"][0]["activation_id"] == activation_id
    assert usage_payload["recent_usage"][0]["version_number"] == 2
    assert usage_payload["recent_usage"][0]["agent_id"] == reviewer_id
    assert usage_payload["telemetry"]["usage_count"] == 1
    assert usage_payload["telemetry"]["success_count"] == 1
    assert usage_payload["telemetry_summary"]["last_outcome"] == "success"

    archived = client.post(
        f"/admin/skills/{skill_id}/archive",
        headers=headers,
        params=_instance_scope(instance_id),
        json={},
    )
    assert archived.status_code == 200
    archived_payload = archived.json()["skill"]
    assert archived_payload["status"] == "archived"
    assert archived_payload["approval"]["posture"] == "archived"
    assert archived_payload["activations"][0]["status"] == "archived"
