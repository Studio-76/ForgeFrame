import os

from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers
from app.api.admin.control_plane import get_control_plane_service
from app.main import app


def _client() -> TestClient:
    return TestClient(app)


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def test_model_and_provider_target_register_endpoints_expose_productive_registry_truth() -> None:
    client = _client()
    headers = _admin_headers(client)

    models = client.get("/admin/models/", headers=headers)
    targets = client.get("/admin/provider-targets/", headers=headers)

    assert models.status_code == 200
    assert targets.status_code == 200
    assert models.json()["object"] == "model_register"
    assert targets.json()["object"] == "provider_target_register"
    assert any(model["routing_key"] == "forgeframe_baseline/forgeframe-baseline-chat-v1" for model in models.json()["models"])
    assert any(target["target_key"] == "forgeframe_baseline::forgeframe-baseline-chat-v1" for target in targets.json()["targets"])


def test_provider_target_updates_persist_across_control_plane_reload() -> None:
    client = _client()
    headers = _admin_headers(client)

    initial_targets = client.get("/admin/provider-targets/", headers=headers)
    assert initial_targets.status_code == 200
    target_key = initial_targets.json()["targets"][0]["target_key"]

    update = client.patch(
        f"/admin/provider-targets/{target_key}",
        headers=headers,
        json={"enabled": False, "priority": 250},
    )
    assert update.status_code == 200

    get_control_plane_service.cache_clear()

    reloaded_client = _client()
    reloaded = reloaded_client.get("/admin/provider-targets/", headers=_admin_headers(reloaded_client))
    assert reloaded.status_code == 200
    target = next(item for item in reloaded.json()["targets"] if item["target_key"] == target_key)
    assert target["enabled"] is False
    assert target["priority"] == 250
