"""Test setup for ForgeGate backend tests."""

import pytest
from fastapi.testclient import TestClient

from app.api.admin.control_plane import get_control_plane_service
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.usage.analytics import get_usage_analytics_store
from app.main import app


@pytest.fixture(autouse=True)
def _reset_runtime_caches(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    events_path = tmp_path / "events.jsonl"
    monkeypatch.setenv("FORGEGATE_OBSERVABILITY_EVENTS_PATH", str(events_path))
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()


def make_client() -> TestClient:
    return TestClient(app)
