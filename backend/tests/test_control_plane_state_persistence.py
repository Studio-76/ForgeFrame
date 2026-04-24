import os
import json
from pathlib import Path

from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers
from app.api.admin.control_plane import get_control_plane_service
from app.main import app


def _client() -> TestClient:
    return TestClient(app)


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def test_provider_state_is_persisted_across_control_plane_reload() -> None:
    client = _client()
    headers = _admin_headers(client)
    response = client.post(
        "/admin/providers/",
        headers=headers,
        json={"provider": "persisted_provider", "label": "Persisted Provider", "config": {"endpoint": "https://example.invalid"}},
    )
    assert response.status_code == 201

    response = client.patch("/admin/providers/persisted_provider", headers=headers, json={"label": "Persisted Provider v2"})
    assert response.status_code == 200

    response = client.post("/admin/providers/persisted_provider/deactivate", headers=headers, json={})
    assert response.status_code == 200

    get_control_plane_service.cache_clear()

    payload = _client().get("/admin/providers/", headers=_admin_headers(_client())).json()
    provider = next(item for item in payload["providers"] if item["provider"] == "persisted_provider")
    assert provider["label"] == "Persisted Provider v2"
    assert provider["enabled"] is False

    state_path = Path(os.environ["FORGEGATE_CONTROL_PLANE_STATE_PATH"])
    assert state_path.exists()
    payload = json.loads(state_path.read_text(encoding="utf-8"))
    persisted_states = list((payload.get("states") or {}).values())
    assert persisted_states
    assert any("provider_catalog" in item for item in persisted_states)
    assert any(
        any(catalog_item["provider_id"] == "openai" for catalog_item in item.get("provider_catalog", []))
        for item in persisted_states
    )


def test_health_config_health_records_and_bootstrap_report_are_persisted() -> None:
    client = _client()
    headers = _admin_headers(client)

    patch_response = client.patch(
        "/admin/providers/health/config",
        headers=headers,
        json={"probe_mode": "synthetic_probe", "interval_seconds": 900},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["config"]["probe_mode"] == "synthetic_probe"

    run_response = client.post("/admin/providers/health/run", headers=headers, json={})
    assert run_response.status_code == 200
    assert run_response.json()["health_records"]

    bootstrap_response = client.get("/admin/providers/bootstrap/readiness", headers=headers)
    assert bootstrap_response.status_code == 200
    bootstrap_payload = bootstrap_response.json()
    checked_at = bootstrap_payload["checked_at"]

    get_control_plane_service.cache_clear()

    reloaded_client = _client()
    payload = reloaded_client.get("/admin/providers/", headers=_admin_headers(reloaded_client)).json()
    assert payload["health_config"]["probe_mode"] == "synthetic_probe"
    assert payload["health_config"]["interval_seconds"] == 900
    assert payload["bootstrap_readiness"]["checked_at"] == checked_at

    first_provider = next(item for item in payload["providers"] if item["models"])
    assert any(model["health_status"] != "unknown" for model in first_provider["models"])
