from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def _admin_headers() -> dict[str, str]:
    response = client.post("/admin/auth/login", json={"username": "admin", "password": "forgegate-admin"})
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_admin_providers_control_plane_endpoint_available() -> None:
    response = client.get("/admin/providers/", headers=_admin_headers())
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["object"] == "provider_control_plane"
    assert "truth_axes" in payload
    assert isinstance(payload["truth_axes"], list)
    assert any({"provider", "runtime", "harness", "ui"} <= set(item.keys()) for item in payload["truth_axes"])


def test_admin_providers_create_update_activate_deactivate_and_sync() -> None:
    headers = _admin_headers()
    create_response = client.post(
        "/admin/providers/",
        json={"provider": "custom_provider", "label": "Custom Provider", "config": {"endpoint": "https://example"}},
        headers=headers,
    )
    assert create_response.status_code == 201

    patch_response = client.patch(
        "/admin/providers/custom_provider",
        json={"label": "Custom Provider 2"},
        headers=headers,
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["provider"]["label"] == "Custom Provider 2"

    deactivate_response = client.post("/admin/providers/custom_provider/deactivate", json={}, headers=headers)
    assert deactivate_response.status_code == 200
    assert deactivate_response.json()["provider"]["enabled"] is False

    activate_response = client.post("/admin/providers/custom_provider/activate", json={}, headers=headers)
    assert activate_response.status_code == 200
    assert activate_response.json()["provider"]["enabled"] is True

    sync_response = client.post("/admin/providers/sync", json={"provider": "custom_provider"}, headers=headers)
    assert sync_response.status_code == 200
    assert "custom_provider" in sync_response.json()["synced_providers"]


def test_admin_provider_beta_targets_endpoint_available() -> None:
    response = client.get("/admin/providers/beta-targets", headers=_admin_headers())
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    targets = payload["targets"]
    assert any(item["provider_key"] == "ollama" for item in targets)
    assert any(item["provider_key"] == "openai_codex" for item in targets)
    codex = next(item for item in targets if item["provider_key"] == "openai_codex")
    antigravity = next(item for item in targets if item["provider_key"] == "antigravity")
    client_axis = next(item for item in targets if item["provider_key"] == "openai_client_compat")
    assert codex["product_axis"] == "oauth_account_providers"
    assert "readiness_score" in codex
    assert antigravity["runtime_readiness"] == "planned"
    assert client_axis["beta_tier"] == "beta"


def test_admin_oauth_account_probe_endpoint_available() -> None:
    response = client.post("/admin/providers/oauth-account/probe/gemini", json={}, headers=_admin_headers())
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["probe"]["provider_key"] == "gemini"


def test_admin_oauth_account_targets_and_bridge_sync_endpoints_available() -> None:
    headers = _admin_headers()
    targets_response = client.get("/admin/providers/oauth-account/targets", headers=headers)
    assert targets_response.status_code == 200
    targets_payload = targets_response.json()
    assert targets_payload["status"] == "ok"
    assert any(item["provider_key"] == "antigravity" for item in targets_payload["targets"])

    sync_response = client.post("/admin/providers/oauth-account/bridge-profiles/sync", json={}, headers=headers)
    assert sync_response.status_code == 200
    sync_payload = sync_response.json()
    assert sync_payload["status"] == "ok"
    assert "upserted_profiles" in sync_payload


def test_admin_dashboard_and_security_modules_available() -> None:
    headers = _admin_headers()
    dashboard = client.get("/admin/dashboard/", headers=headers)
    assert dashboard.status_code == 200
    assert "kpis" in dashboard.json()

    accounts = client.get("/admin/accounts/", headers=headers)
    assert accounts.status_code == 200
    assert "accounts" in accounts.json()

    keys = client.get("/admin/keys/", headers=headers)
    assert keys.status_code == 200
    assert "keys" in keys.json()

    settings = client.get("/admin/settings/", headers=headers)
    assert settings.status_code == 200
    assert "settings" in settings.json()

    logs = client.get("/admin/logs/", headers=headers)
    assert logs.status_code == 200
    assert "audit_events" in logs.json()
