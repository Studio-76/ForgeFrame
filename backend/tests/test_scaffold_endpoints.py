from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_admin_providers_control_plane_endpoint_available() -> None:
    response = client.get("/admin/providers/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["object"] == "provider_control_plane"
