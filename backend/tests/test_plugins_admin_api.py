from fastapi.testclient import TestClient

from app.main import app
from conftest import admin_headers as shared_admin_headers, login_headers_allowing_password_rotation


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _operator_headers(client: TestClient) -> dict[str, str]:
    admin_headers = _admin_headers(client)
    password = "Plugin-Operator-123"
    created = client.post(
        "/admin/security/users",
        headers=admin_headers,
        json={
            "username": "plugin-operator",
            "display_name": "Plugin Operator",
            "role": "operator",
            "password": password,
        },
    )
    assert created.status_code == 201
    return login_headers_allowing_password_rotation(client, username="plugin-operator", password=password)


def _instance_scope(instance_id: str) -> dict[str, str]:
    return {"instanceId": instance_id}


def _create_instance(client: TestClient, headers: dict[str, str], *, instance_id: str, company_id: str) -> str:
    created = client.post(
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
    assert created.status_code == 201
    return created.json()["instance"]["instance_id"]


def test_plugins_admin_api_persists_manifest_registry_and_instance_scoped_bindings() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_alpha = _create_instance(client, headers, instance_id="instance_plugin_alpha", company_id="company_plugin_alpha")
    instance_beta = _create_instance(client, headers, instance_id="instance_plugin_beta", company_id="company_plugin_beta")

    created = client.post(
        "/admin/plugins",
        headers=headers,
        json={
            "plugin_id": "plugin_review_bridge",
            "display_name": "Review Bridge",
            "summary": "Adds a review panel and artifact hook for human-in-the-loop analysis.",
            "vendor": "customer",
            "version": "1.2.3",
            "capabilities": ["review.panel", "artifact.render"],
            "ui_slots": ["workspaces.detail", "artifacts.sidebar"],
            "api_mounts": ["/plugins/review-bridge/hooks"],
            "runtime_surfaces": ["workspace_artifact_pipeline"],
            "config_schema": {
                "type": "object",
                "properties": {
                    "mode": {"type": "string"},
                    "max_items": {"type": "integer"},
                },
            },
            "default_config": {"mode": "preview", "max_items": 25},
            "security_posture": {
                "allowed_roles": ["admin", "owner"],
                "admin_approval_required": True,
                "network_access": False,
                "writes_external_state": False,
                "secret_refs": ["forgeframe/review-bridge/token"],
            },
            "metadata": {"category": "review"},
        },
    )
    assert created.status_code == 201
    assert created.json()["plugin"]["plugin_id"] == "plugin_review_bridge"
    assert created.json()["plugin"]["effective_status"] == "available"

    listing_alpha = client.get("/admin/plugins", headers=headers, params=_instance_scope(instance_alpha))
    assert listing_alpha.status_code == 200
    listing_payload = listing_alpha.json()
    assert listing_payload["summary"]["registered_plugins"] == 1
    plugin_alpha = listing_payload["plugins"][0]
    assert plugin_alpha["plugin_id"] == "plugin_review_bridge"
    assert plugin_alpha["effective_status"] == "available"
    assert plugin_alpha["binding"] is None
    assert plugin_alpha["capabilities"] == ["review.panel", "artifact.render"]
    assert plugin_alpha["status_summary"] == "Registered but not yet activated for this instance."

    bound = client.put(
        "/admin/plugins/plugin_review_bridge/binding",
        headers=headers,
        params=_instance_scope(instance_alpha),
        json={
            "enabled": True,
            "config": {"mode": "enforce", "max_items": 10},
            "enabled_capabilities": ["review.panel"],
            "enabled_ui_slots": ["workspaces.detail"],
            "enabled_api_mounts": ["/plugins/review-bridge/hooks"],
            "notes": "Enabled for alpha instance only.",
        },
    )
    assert bound.status_code == 200
    bound_payload = bound.json()["plugin"]
    assert bound_payload["effective_status"] == "enabled"
    assert bound_payload["binding"]["instance_id"] == instance_alpha
    assert bound_payload["binding"]["company_id"] == "company_plugin_alpha"
    assert bound_payload["binding"]["enabled_capabilities"] == ["review.panel"]
    assert bound_payload["effective_config"] == {"mode": "enforce", "max_items": 10}

    detail_alpha = client.get(
        "/admin/plugins/plugin_review_bridge",
        headers=headers,
        params=_instance_scope(instance_alpha),
    )
    assert detail_alpha.status_code == 200
    detail_payload = detail_alpha.json()["plugin"]
    assert detail_payload["binding"]["notes"] == "Enabled for alpha instance only."
    assert detail_payload["security_posture"]["allowed_roles"] == ["admin", "owner"]
    assert detail_payload["ui_slots"] == ["workspaces.detail", "artifacts.sidebar"]

    listing_beta = client.get("/admin/plugins", headers=headers, params=_instance_scope(instance_beta))
    assert listing_beta.status_code == 200
    plugin_beta = listing_beta.json()["plugins"][0]
    assert plugin_beta["effective_status"] == "available"
    assert plugin_beta["binding"] is None
    assert listing_beta.json()["summary"]["bound_plugins"] == 0


def test_plugins_admin_api_validates_binding_contract_against_manifest_schema_and_extension_points() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_plugin_contract", company_id="company_plugin_contract")

    created = client.post(
        "/admin/plugins",
        headers=headers,
        json={
            "plugin_id": "plugin_contract_guard",
            "display_name": "Contract Guard",
            "capabilities": ["dispatch.audit"],
            "ui_slots": ["dispatch.panel"],
            "api_mounts": ["/plugins/contract-guard/checks"],
            "config_schema": {
                "type": "object",
                "properties": {
                    "mode": {"type": "string"},
                },
            },
        },
    )
    assert created.status_code == 201

    invalid_config = client.put(
        "/admin/plugins/plugin_contract_guard/binding",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "enabled": True,
            "config": {"unknown_key": "boom"},
        },
    )
    assert invalid_config.status_code == 400
    assert invalid_config.json()["error"]["type"] == "plugin_binding_invalid"

    invalid_capability = client.put(
        "/admin/plugins/plugin_contract_guard/binding",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "enabled": True,
            "config": {"mode": "strict"},
            "enabled_capabilities": ["dispatch.audit", "nonexistent.capability"],
        },
    )
    assert invalid_capability.status_code == 400
    assert invalid_capability.json()["error"]["type"] == "plugin_binding_invalid"

    valid_binding = client.put(
        "/admin/plugins/plugin_contract_guard/binding",
        headers=headers,
        params=_instance_scope(instance_id),
        json={
            "enabled": True,
            "config": {"mode": "strict"},
            "enabled_capabilities": ["dispatch.audit"],
            "enabled_ui_slots": ["dispatch.panel"],
            "enabled_api_mounts": ["/plugins/contract-guard/checks"],
        },
    )
    assert valid_binding.status_code == 200

    invalid_manifest_update = client.patch(
        "/admin/plugins/plugin_contract_guard",
        headers=headers,
        json={
            "capabilities": ["dispatch.summary_only"],
        },
    )
    assert invalid_manifest_update.status_code == 400
    assert invalid_manifest_update.json()["error"]["type"] == "plugin_invalid"


def test_plugins_admin_api_keeps_read_truth_open_to_operators_but_blocks_mutations() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    operator_headers = _operator_headers(client)
    instance_id = _create_instance(client, admin_headers, instance_id="instance_plugin_operator", company_id="company_plugin_operator")

    created = client.post(
        "/admin/plugins",
        headers=admin_headers,
        json={
            "plugin_id": "plugin_operator_visible",
            "display_name": "Operator Visible Plugin",
            "capabilities": ["logs.panel"],
        },
    )
    assert created.status_code == 201

    listing = client.get("/admin/plugins", headers=operator_headers, params=_instance_scope(instance_id))
    assert listing.status_code == 200
    assert any(item["plugin_id"] == "plugin_operator_visible" for item in listing.json()["plugins"])

    denied_create = client.post(
        "/admin/plugins",
        headers=operator_headers,
        json={
            "plugin_id": "plugin_operator_denied",
            "display_name": "Denied Plugin",
        },
    )
    assert denied_create.status_code == 403
    assert denied_create.json()["detail"] == "admin_role_required"

    denied_binding = client.put(
        "/admin/plugins/plugin_operator_visible/binding",
        headers=operator_headers,
        params=_instance_scope(instance_id),
        json={"enabled": True},
    )
    assert denied_binding.status_code == 403
    assert denied_binding.json()["detail"] == "admin_role_required"
