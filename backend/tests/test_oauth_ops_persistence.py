from pathlib import Path

from fastapi.testclient import TestClient

from app.api.admin.control_plane import get_control_plane_service
from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    response = client.post("/admin/auth/login", json={"username": "admin", "password": "forgegate-admin"})
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_oauth_operations_are_persisted(monkeypatch, tmp_path: Path) -> None:
    path = tmp_path / "oauth_ops.jsonl"
    monkeypatch.setenv("FORGEGATE_OAUTH_OPERATIONS_PATH", str(path))
    get_control_plane_service.cache_clear()

    client = TestClient(app)
    headers = _admin_headers(client)
    probe = client.post("/admin/providers/oauth-account/probe/antigravity", headers=headers, json={})
    assert probe.status_code == 200

    summary = client.get("/admin/providers/oauth-account/operations", headers=headers)
    assert summary.status_code == 200
    payload = summary.json()
    assert payload["total_operations"] >= 1
    assert path.exists()
    assert len(path.read_text(encoding="utf-8").strip().splitlines()) >= 1

    get_control_plane_service.cache_clear()
    reloaded_client = TestClient(app)
    summary_after_reload = reloaded_client.get("/admin/providers/oauth-account/operations", headers=_admin_headers(reloaded_client))
    assert summary_after_reload.status_code == 200
    assert summary_after_reload.json()["total_operations"] >= 1
