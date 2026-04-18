from fastapi.testclient import TestClient

from app.main import app


def test_app_boots_and_root_endpoint_returns_core_baseline_status() -> None:
    client = TestClient(app)
    response = client.get("/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "core-baseline"
    assert "Runtime target paths enabled" in payload["message"]


def test_target_routes_are_registered() -> None:
    client = TestClient(app)

    health_response = client.get("/health")
    models_response = client.get("/v1/models")
    admin_response = client.get("/admin/settings/")

    assert health_response.status_code == 200
    assert models_response.status_code == 200
    assert admin_response.status_code == 200
