from fastapi.testclient import TestClient

from app.main import app


def test_app_boots_and_root_endpoint_returns_scaffold_status() -> None:
    client = TestClient(app)
    response = client.get("/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "scaffold"
    assert "core implementation pending" in payload["message"]


def test_runtime_and_admin_routes_are_registered() -> None:
    client = TestClient(app)

    runtime_response = client.get("/runtime/health/")
    admin_response = client.get("/admin/settings/")

    assert runtime_response.status_code == 200
    assert admin_response.status_code == 200
