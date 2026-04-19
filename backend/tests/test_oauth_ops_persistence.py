from pathlib import Path

from fastapi.testclient import TestClient

from app.api.admin.control_plane import get_control_plane_service
from app.main import app


def test_oauth_operations_are_persisted(monkeypatch, tmp_path: Path) -> None:
    path = tmp_path / "oauth_ops.jsonl"
    monkeypatch.setenv("FORGEGATE_OAUTH_OPERATIONS_PATH", str(path))
    get_control_plane_service.cache_clear()

    client = TestClient(app)
    probe = client.post("/admin/providers/oauth-account/probe/antigravity", json={})
    assert probe.status_code == 200

    summary = client.get("/admin/providers/oauth-account/operations")
    assert summary.status_code == 200
    payload = summary.json()
    assert payload["total_operations"] >= 1
    assert path.exists()
    assert len(path.read_text(encoding="utf-8").strip().splitlines()) >= 1

    get_control_plane_service.cache_clear()
