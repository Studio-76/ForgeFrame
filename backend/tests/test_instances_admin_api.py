import os

from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers, login_headers_allowing_password_rotation
from app.main import app


def _login_headers(client: TestClient, *, username: str, password: str) -> dict[str, str]:
    return login_headers_allowing_password_rotation(client, username=username, password=password)


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


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

    listing = client.get("/admin/instances/", headers=headers)
    assert listing.status_code == 200
    assert any(item["is_default"] is True for item in listing.json()["instances"])

    created = client.post(
        "/admin/instances/",
        headers=headers,
        json={
            "instance_id": "instance_alpha",
            "display_name": "Alpha Instance",
            "description": "Primary alpha instance",
            "tenant_id": "tenant_alpha",
            "company_id": "company_alpha",
            "deployment_mode": "linux_host_native",
            "exposure_mode": "same_origin",
        },
    )
    assert created.status_code == 201
    payload = created.json()["instance"]
    assert payload["instance_id"] == "instance_alpha"
    assert payload["tenant_id"] == "tenant_alpha"
    assert payload["company_id"] == "company_alpha"
    assert payload["deployment_mode"] == "linux_host_native"
    assert payload["exposure_mode"] == "same_origin"

    detail = client.get("/admin/instances/instance_alpha", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["instance"]["display_name"] == "Alpha Instance"

    updated = client.patch(
        "/admin/instances/instance_alpha",
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
            "tenant_id": "tenant_alpha",
            "company_id": "company_beta",
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
            "tenant_id": "tenant_gamma",
            "company_id": "company_alpha",
        },
    )
    assert duplicate_company.status_code == 409
    assert duplicate_company.json()["error"]["type"] == "instance_conflict"


def test_instances_admin_api_requires_explicit_instance_membership_for_listing_and_mutation_scope() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
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
            "instance_id": "instance_alpha",
            "display_name": "Alpha Instance",
            "tenant_id": "tenant_alpha",
            "company_id": "company_alpha",
        },
    )
    assert created.status_code == 201

    listing = client.get("/admin/instances/", headers=operator_headers)
    assert listing.status_code == 200
    assert all(item["instance_id"] != "instance_alpha" for item in listing.json()["instances"])

    hidden_detail = client.get("/admin/instances/instance_alpha", headers=operator_headers)
    assert hidden_detail.status_code == 403
    assert hidden_detail.json()["detail"] == "instance_membership_required"

    granted = client.put(
        f"/admin/security/users/{operator_user_id}/memberships/instance_alpha",
        headers=admin_headers,
        json={"role": "operator", "status": "active"},
    )
    assert granted.status_code == 200

    operator_headers = _login_headers(client, username="instance-operator", password=operator_password)
    listing = client.get("/admin/instances/", headers=operator_headers)
    assert listing.status_code == 200
    assert any(item["instance_id"] == "instance_alpha" for item in listing.json()["instances"])

    denied_create = client.post(
        "/admin/instances/",
        headers=operator_headers,
        json={
            "instance_id": "instance_beta",
            "display_name": "Beta Instance",
            "tenant_id": "tenant_beta",
            "company_id": "company_beta",
        },
    )
    assert denied_create.status_code == 403
    assert denied_create.json()["detail"] == "missing_instance_permission:instance.write"
