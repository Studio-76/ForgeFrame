from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_runtime_chat_placeholder() -> None:
    response = client.post("/runtime/chat/")
    assert response.status_code == 200
    assert response.json()["status"] == "scaffold"


def test_runtime_models_placeholder() -> None:
    response = client.get("/runtime/models/")
    assert response.status_code == 200
    assert response.json()["status"] == "scaffold"


def test_admin_providers_placeholder() -> None:
    response = client.get("/admin/providers/")
    assert response.status_code == 200
    assert response.json()["status"] == "scaffold"
