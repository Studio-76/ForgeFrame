from uuid import uuid4

from conftest import admin_headers as shared_admin_headers
from conftest import login_headers_allowing_password_rotation
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.execution.dependencies import get_execution_session_factory
from app.main import app
from app.storage.agent_repository import AgentORM


def _login_headers(client: TestClient, *, username: str, password: str) -> dict[str, str]:
    return login_headers_allowing_password_rotation(client, username=username, password=password)


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _unique_suffix() -> str:
    return uuid4().hex[:8]


def _create_user_headers(
    client: TestClient,
    *,
    role: str,
    username: str,
    display_name: str,
    password: str,
) -> tuple[str, dict[str, str]]:
    admin_headers = _admin_headers(client)
    created = client.post(
        "/admin/security/users",
        headers=admin_headers,
        json={
            "username": username,
            "display_name": display_name,
            "role": role,
            "password": password,
        },
    )
    assert created.status_code == 201
    return created.json()["user"]["user_id"], _login_headers(client, username=username, password=password)


def test_instances_admin_api_supports_real_crud_and_unique_scope_bindings() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    suffix = _unique_suffix()
    instance_id = f"instance_alpha_{suffix}"
    tenant_id = f"tenant_alpha_{suffix}"
    company_id = f"company_alpha_{suffix}"

    listing = client.get("/admin/instances/", headers=headers)
    assert listing.status_code == 200
    assert any(item["is_default"] is True for item in listing.json()["instances"])

    created = client.post(
        "/admin/instances/",
        headers=headers,
        json={
            "instance_id": instance_id,
            "display_name": "Alpha Instance",
            "description": "Primary alpha instance",
            "tenant_id": tenant_id,
            "company_id": company_id,
            "deployment_mode": "linux_host_native",
            "exposure_mode": "same_origin",
        },
    )
    assert created.status_code == 201
    created_payload = created.json()
    payload = created_payload["instance"]
    assert payload["instance_id"] == instance_id
    assert payload["tenant_id"] == tenant_id
    assert payload["company_id"] == company_id
    assert payload["deployment_mode"] == "linux_host_native"
    assert payload["exposure_mode"] == "same_origin"
    assert created_payload["operator_agent_created"] is True
    assert created_payload["operator_agent"]["display_name"] == "Operator"
    assert payload["operator_agent"]["display_name"] == "Operator"
    assert payload["readiness"]["status"] == "onboarding-only"

    detail = client.get(f"/admin/instances/{instance_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["instance"]["display_name"] == "Alpha Instance"
    assert detail.json()["instance"]["operator_agent"]["display_name"] == "Operator"

    updated = client.patch(
        f"/admin/instances/{instance_id}",
        headers=headers,
        json={
            "display_name": "Alpha Instance Updated",
            "description": "Updated alpha instance",
            "status": "disabled",
            "deployment_mode": "container_optional",
            "exposure_mode": "edge_admission",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["instance"]["display_name"] == "Alpha Instance Updated"
    assert updated.json()["instance"]["status"] == "disabled"
    assert updated.json()["instance"]["deployment_mode"] == "container_optional"
    assert updated.json()["instance"]["exposure_mode"] == "edge_admission"

    duplicate_tenant = client.post(
        "/admin/instances/",
        headers=headers,
        json={
            "instance_id": "instance_beta",
            "display_name": "Beta Instance",
            "tenant_id": tenant_id,
            "company_id": f"company_beta_{suffix}",
        },
    )
    assert duplicate_tenant.status_code == 409
    assert duplicate_tenant.json()["error"]["type"] == "instance_conflict"

    duplicate_company = client.post(
        "/admin/instances/",
        headers=headers,
        json={
            "instance_id": "instance_gamma",
            "display_name": "Gamma Instance",
            "tenant_id": f"tenant_gamma_{suffix}",
            "company_id": company_id,
        },
    )
    assert duplicate_company.status_code == 409
    assert duplicate_company.json()["error"]["type"] == "instance_conflict"


def test_instances_admin_api_requires_explicit_instance_membership_for_listing_and_mutation_scope() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    suffix = _unique_suffix()
    instance_id = f"instance_alpha_{suffix}"
    tenant_id = f"tenant_alpha_{suffix}"
    company_id = f"company_alpha_{suffix}"
    next_instance_id = f"instance_beta_{suffix}"
    operator_password = "Instance-Operator-123"
    operator_user_id, operator_headers = _create_user_headers(
        client,
        role="operator",
        username="instance-operator",
        display_name="Instance Operator",
        password=operator_password,
    )

    created = client.post(
        "/admin/instances/",
        headers=admin_headers,
        json={
            "instance_id": instance_id,
            "display_name": "Alpha Instance",
            "tenant_id": tenant_id,
            "company_id": company_id,
        },
    )
    assert created.status_code == 201

    listing = client.get("/admin/instances/", headers=operator_headers)
    assert listing.status_code == 200
    assert all(item["instance_id"] != instance_id for item in listing.json()["instances"])

    hidden_detail = client.get(f"/admin/instances/{instance_id}", headers=operator_headers)
    assert hidden_detail.status_code == 403
    assert hidden_detail.json()["detail"] == "instance_membership_required"

    granted = client.put(
        f"/admin/security/users/{operator_user_id}/memberships/{instance_id}",
        headers=admin_headers,
        json={"role": "operator", "status": "active"},
    )
    assert granted.status_code == 200

    operator_headers = _login_headers(client, username="instance-operator", password=operator_password)
    listing = client.get("/admin/instances/", headers=operator_headers)
    assert listing.status_code == 200
    assert any(item["instance_id"] == instance_id for item in listing.json()["instances"])

    denied_create = client.post(
        "/admin/instances/",
        headers=operator_headers,
        json={
            "instance_id": next_instance_id,
            "display_name": "Beta Instance",
            "tenant_id": f"tenant_beta_{suffix}",
            "company_id": f"company_beta_{suffix}",
        },
    )
    assert denied_create.status_code == 403
    assert denied_create.json()["detail"] == "missing_instance_permission:instance.write"


def test_instances_inventory_reports_missing_operator_without_healing_listing_reads() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    suffix = _unique_suffix()
    instance_id = f"instance_missing_operator_{suffix}"
    tenant_id = f"tenant_missing_operator_{suffix}"
    company_id = f"company_missing_operator_{suffix}"

    created = client.post(
        "/admin/instances/",
        headers=headers,
        json={
            "instance_id": instance_id,
            "display_name": "Missing Operator Instance",
            "tenant_id": tenant_id,
            "company_id": company_id,
        },
    )
    assert created.status_code == 201
    operator_agent_id = created.json()["operator_agent"]["agent_id"]

    session_factory = get_execution_session_factory()
    with session_factory() as session, session.begin():
        operator_row = session.execute(select(AgentORM).where(AgentORM.id == operator_agent_id)).scalar_one()
        session.delete(operator_row)

    detail = client.get(f"/admin/instances/{instance_id}", headers=headers)
    assert detail.status_code == 200
    payload = detail.json()["instance"]
    assert payload["operator_agent"]["status"] == "not-ready"
    assert payload["operator_agent"]["agent_id"] is None
    assert payload["readiness"]["status"] == "not-ready"

    default_agents = client.get(
        "/admin/agents",
        headers=headers,
        params={"instanceId": instance_id},
    )
    assert default_agents.status_code == 200
    assert default_agents.json()["agents"] == []

    repaired_agents = client.get(
        "/admin/agents",
        headers=headers,
        params={"instanceId": instance_id, "ensureDefaultOperator": "true"},
    )
    assert repaired_agents.status_code == 200
    assert any(item["is_default_operator"] for item in repaired_agents.json()["agents"])
