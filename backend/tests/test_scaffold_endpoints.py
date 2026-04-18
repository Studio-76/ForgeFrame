from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_admin_providers_placeholder_still_available() -> None:
    response = client.get("/admin/providers/")
    assert response.status_code == 200
    assert response.json()["status"] == "scaffold"
