"""Test setup for ForgeGate backend tests."""

import pytest
from fastapi.testclient import TestClient

from app.api.admin.control_plane import get_control_plane_service
from app.execution.dependencies import clear_execution_dependency_caches
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.governance.service import get_governance_service
from app.harness.service import get_harness_service
from app.readiness import reset_runtime_readiness_state
from app.usage.analytics import get_usage_analytics_store
from app.main import app

TEST_BOOTSTRAP_ADMIN_PASSWORD = "ForgeGate-Test-Admin-Secret-123"


@pytest.fixture(autouse=True)
def _reset_runtime_caches(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    events_path = tmp_path / "events.jsonl"
    monkeypatch.setenv("FORGEGATE_OBSERVABILITY_EVENTS_PATH", str(events_path))
    monkeypatch.setenv("FORGEGATE_OBSERVABILITY_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_OAUTH_OPERATIONS_PATH", str(tmp_path / "oauth_operations.jsonl"))
    monkeypatch.setenv("FORGEGATE_HARNESS_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_HARNESS_PROFILES_PATH", str(tmp_path / "harness_profiles.json"))
    monkeypatch.setenv("FORGEGATE_HARNESS_RUNS_PATH", str(tmp_path / "harness_runs.json"))
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STATE_PATH", str(tmp_path / "control_plane_state.json"))
    monkeypatch.setenv("FORGEGATE_GOVERNANCE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_GOVERNANCE_STATE_PATH", str(tmp_path / "governance_state.json"))
    monkeypatch.setenv("FORGEGATE_EXECUTION_SQLITE_PATH", str(tmp_path / "execution.sqlite"))
    monkeypatch.setenv("FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD", TEST_BOOTSTRAP_ADMIN_PASSWORD)
    clear_runtime_dependency_caches()
    clear_execution_dependency_caches()
    get_control_plane_service.cache_clear()
    get_governance_service.cache_clear()
    get_harness_service.cache_clear()
    get_usage_analytics_store.cache_clear()
    reset_runtime_readiness_state(app)


def make_client() -> TestClient:
    return TestClient(app)
