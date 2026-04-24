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
    reviewer_id = _create_agent(
        client,
        headers,
        instance_id=instance_id,
        agent_id="agent_skill_reviewer",
        display_name="Skill Reviewer",
        role_kind="reviewer",
    )

    created = client.post(
        "/admin/skills",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "skill_id": "skill_review_alpha",
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
    assert created_payload["current_version_number"] == 1
    assert len(created_payload["versions"]) == 1

    updated = client.patch(
        "/admin/skills/skill_review_alpha",
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
    assert len(updated_payload["versions"]) == 2
    assert updated_payload["versions"][0]["version_number"] == 2

    activated = client.post(
        "/admin/skills/skill_review_alpha/activate",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "scope": "agent",
            "scope_agent_id": reviewer_id,
            "activation_conditions": {"preview_required": True},
            "metadata": {"activation_source": "test"},
        },
    )
    assert activated.status_code == 200
    activated_payload = activated.json()["skill"]
    assert activated_payload["status"] == "active"
    assert activated_payload["activations"][0]["status"] == "active"
    activation_id = activated_payload["activations"][0]["activation_id"]
    version_id = activated_payload["versions"][0]["version_id"]

    usage = client.post(
        "/admin/skills/skill_review_alpha/usage-events",
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
    assert usage_payload["recent_usage"][0]["agent_id"] == reviewer_id
    assert usage_payload["telemetry"]["usage_count"] == 1

    archived = client.post(
        "/admin/skills/skill_review_alpha/archive",
        headers=headers,
        params=_instance_scope(instance_id),
        json={},
    )
    assert archived.status_code == 200
    archived_payload = archived.json()["skill"]
    assert archived_payload["status"] == "archived"
    assert archived_payload["activations"][0]["status"] == "archived"
