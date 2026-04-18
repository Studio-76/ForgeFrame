from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_admin_providers_control_plane_endpoint_available() -> None:
    response = client.get("/admin/providers/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["object"] == "provider_control_plane"


def test_admin_providers_create_update_activate_deactivate_and_sync() -> None:
    create_response = client.post(
        "/admin/providers/",
        json={"provider": "custom_provider", "label": "Custom Provider", "config": {"endpoint": "https://example"}},
    )
    assert create_response.status_code == 201

    patch_response = client.patch(
        "/admin/providers/custom_provider",
        json={"label": "Custom Provider 2"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["provider"]["label"] == "Custom Provider 2"

    deactivate_response = client.post("/admin/providers/custom_provider/deactivate", json={})
    assert deactivate_response.status_code == 200
    assert deactivate_response.json()["provider"]["enabled"] is False

    activate_response = client.post("/admin/providers/custom_provider/activate", json={})
    assert activate_response.status_code == 200
    assert activate_response.json()["provider"]["enabled"] is True

    sync_response = client.post("/admin/providers/sync", json={"provider": "custom_provider"})
    assert sync_response.status_code == 200
    assert "custom_provider" in sync_response.json()["synced_providers"]


def test_admin_provider_beta_targets_endpoint_available() -> None:
    response = client.get("/admin/providers/beta-targets")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    targets = payload["targets"]
    assert any(item["provider_key"] == "ollama" for item in targets)
    assert any(item["provider_key"] == "openai_codex" for item in targets)
