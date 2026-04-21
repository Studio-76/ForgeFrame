import os
from pathlib import Path

from fastapi.testclient import TestClient

from app.api.admin.control_plane import get_control_plane_service
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.main import app
from app.usage.analytics import get_usage_analytics_store


def _admin_headers(client: TestClient) -> dict[str, str]:
    response = client.post("/admin/auth/login", json={"username": "admin", "password": "forgegate-admin"})
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_usage_events_are_persisted_across_store_reload() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    chat_response = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "persist runtime event"}]},
    )
    assert chat_response.status_code == 200

    summary_before = client.get("/admin/usage/", headers=headers)
    assert summary_before.status_code == 200
    assert summary_before.json()["metrics"]["recorded_request_count"] >= 1

    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    reloaded_client = TestClient(app)
    summary_after = reloaded_client.get("/admin/usage/", headers=_admin_headers(reloaded_client))
    assert summary_after.status_code == 200
    assert summary_after.json()["metrics"]["recorded_request_count"] >= 1

    events_path = Path(os.environ["FORGEGATE_OBSERVABILITY_EVENTS_PATH"])
    assert events_path.exists()


def test_health_events_are_persisted_across_store_reload() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    health_response = client.post("/admin/providers/health/run", headers=headers)
    assert health_response.status_code == 200

    summary_before = client.get("/admin/usage/", headers=headers)
    assert summary_before.status_code == 200
    assert summary_before.json()["metrics"]["recorded_health_event_count"] >= 1

    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    reloaded_client = TestClient(app)
    summary_after = reloaded_client.get("/admin/usage/", headers=_admin_headers(reloaded_client))
    assert summary_after.status_code == 200
    assert summary_after.json()["metrics"]["recorded_health_event_count"] >= 1
