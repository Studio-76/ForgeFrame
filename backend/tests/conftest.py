"""Test setup for ForgeFrame backend tests."""

import os

_EARLY_TEST_BOOTSTRAP_ADMIN_PASSWORD = "ForgeFrame-Test-Admin-Secret-123"
os.environ.setdefault("FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD", _EARLY_TEST_BOOTSTRAP_ADMIN_PASSWORD)
os.environ.setdefault("FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD", _EARLY_TEST_BOOTSTRAP_ADMIN_PASSWORD)
os.environ.setdefault("FORGEGATE_HARNESS_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEFRAME_HARNESS_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEFRAME_CONTROL_PLANE_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEGATE_GOVERNANCE_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEFRAME_GOVERNANCE_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEGATE_OBSERVABILITY_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEFRAME_OBSERVABILITY_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEGATE_INSTANCES_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEFRAME_INSTANCES_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEGATE_RUNTIME_AUTH_REQUIRED", "false")
os.environ.setdefault("FORGEFRAME_RUNTIME_AUTH_REQUIRED", "false")

import pytest
from fastapi.testclient import TestClient

from app.api.admin.control_plane import get_control_plane_service
from app.agents.dependencies import clear_agent_admin_service_cache
from app.assistant_profiles.dependencies import clear_assistant_profile_admin_service_cache
from app.execution.dependencies import clear_execution_dependency_caches
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.conversations.dependencies import clear_conversation_inbox_admin_service_cache
from app.governance.service import get_governance_service
from app.harness.service import get_harness_service
from app.instances.service import clear_instance_service_cache
from app.knowledge.dependencies import clear_knowledge_context_admin_service_cache
from app.learning.dependencies import clear_learning_admin_service_cache
from app.plugins.dependencies import clear_plugin_catalog_service_cache
from app.readiness import reset_runtime_readiness_state
from app.recovery.dependencies import clear_recovery_admin_service_cache
from app.settings.config import get_settings
from app.skills.dependencies import clear_skill_admin_service_cache
from app.tasks.dependencies import clear_task_automation_admin_service_cache
from app.usage.analytics import get_usage_analytics_store
from app.workspaces.dependencies import clear_work_interaction_admin_service_cache
from app.main import app

TEST_BOOTSTRAP_ADMIN_PASSWORD = _EARLY_TEST_BOOTSTRAP_ADMIN_PASSWORD
_ROTATED_TEST_PASSWORD_SUFFIX = "-rotated"


def rotated_test_password(password: str) -> str:
    normalized = password.strip()
    if normalized.endswith(_ROTATED_TEST_PASSWORD_SUFFIX):
        return normalized
    return f"{normalized}{_ROTATED_TEST_PASSWORD_SUFFIX}"


def login_headers_allowing_password_rotation(
    client: TestClient,
    *,
    username: str,
    password: str,
    persist_password_env_keys: tuple[str, ...] = (),
) -> dict[str, str]:
    active_password = password
    response = client.post(
        "/admin/auth/login",
        json={"username": username, "password": active_password},
    )
    if response.status_code == 401:
        active_password = rotated_test_password(password)
        response = client.post(
            "/admin/auth/login",
            json={"username": username, "password": active_password},
        )
    assert response.status_code == 201
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    if response.json()["user"].get("must_rotate_password") is True:
        rotated_password = rotated_test_password(active_password)
        assert rotated_password != active_password
        rotation = client.post(
            "/admin/auth/rotate-password",
            headers=headers,
            json={"current_password": active_password, "new_password": rotated_password},
        )
        assert rotation.status_code == 200
        for env_key in persist_password_env_keys:
            os.environ[env_key] = rotated_password
        response = client.post(
            "/admin/auth/login",
            json={"username": username, "password": rotated_password},
        )
        assert response.status_code == 201
        headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    return headers


def admin_headers(client: TestClient) -> dict[str, str]:
    bootstrap_password = os.environ.get(
        "FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD",
        os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"],
    )
    return login_headers_allowing_password_rotation(
        client,
        username="admin",
        password=bootstrap_password,
        persist_password_env_keys=(
            "FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD",
            "FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD",
        ),
    )


@pytest.fixture(autouse=True)
def _reset_runtime_caches(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    events_path = tmp_path / "events.jsonl"
    monkeypatch.setenv("FORGEGATE_OBSERVABILITY_EVENTS_PATH", str(events_path))
    monkeypatch.setenv("FORGEFRAME_OBSERVABILITY_EVENTS_PATH", str(events_path))
    monkeypatch.setenv("FORGEGATE_OBSERVABILITY_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEFRAME_OBSERVABILITY_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_OAUTH_OPERATIONS_PATH", str(tmp_path / "oauth_operations.jsonl"))
    monkeypatch.setenv("FORGEFRAME_OAUTH_OPERATIONS_PATH", str(tmp_path / "oauth_operations.jsonl"))
    monkeypatch.setenv("FORGEGATE_HARNESS_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEFRAME_HARNESS_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_HARNESS_PROFILES_PATH", str(tmp_path / "harness_profiles.json"))
    monkeypatch.setenv("FORGEFRAME_HARNESS_PROFILES_PATH", str(tmp_path / "harness_profiles.json"))
    monkeypatch.setenv("FORGEGATE_HARNESS_RUNS_PATH", str(tmp_path / "harness_runs.json"))
    monkeypatch.setenv("FORGEFRAME_HARNESS_RUNS_PATH", str(tmp_path / "harness_runs.json"))
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEFRAME_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STATE_PATH", str(tmp_path / "control_plane_state.json"))
    monkeypatch.setenv("FORGEFRAME_CONTROL_PLANE_STATE_PATH", str(tmp_path / "control_plane_state.json"))
    monkeypatch.setenv("FORGEGATE_INSTANCES_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEFRAME_INSTANCES_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_INSTANCES_STATE_PATH", str(tmp_path / "instances_state.json"))
    monkeypatch.setenv("FORGEFRAME_INSTANCES_STATE_PATH", str(tmp_path / "instances_state.json"))
    monkeypatch.setenv("FORGEGATE_GOVERNANCE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEFRAME_GOVERNANCE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_GOVERNANCE_STATE_PATH", str(tmp_path / "governance_state.json"))
    monkeypatch.setenv("FORGEFRAME_GOVERNANCE_STATE_PATH", str(tmp_path / "governance_state.json"))
    monkeypatch.setenv("FORGEGATE_EXECUTION_SQLITE_PATH", str(tmp_path / "execution.sqlite"))
    monkeypatch.setenv("FORGEFRAME_EXECUTION_SQLITE_PATH", str(tmp_path / "execution.sqlite"))
    monkeypatch.setenv("FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD", TEST_BOOTSTRAP_ADMIN_PASSWORD)
    monkeypatch.setenv("FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD", TEST_BOOTSTRAP_ADMIN_PASSWORD)
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "false")
    monkeypatch.setenv("FORGEFRAME_RUNTIME_AUTH_REQUIRED", "false")
    get_settings.cache_clear()
    clear_runtime_dependency_caches()
    clear_execution_dependency_caches()
    clear_conversation_inbox_admin_service_cache()
    get_control_plane_service.cache_clear()
    get_governance_service.cache_clear()
    get_harness_service.cache_clear()
    get_usage_analytics_store.cache_clear()
    clear_instance_service_cache()
    clear_work_interaction_admin_service_cache()
    clear_task_automation_admin_service_cache()
    clear_knowledge_context_admin_service_cache()
    clear_agent_admin_service_cache()
    clear_skill_admin_service_cache()
    clear_learning_admin_service_cache()
    clear_assistant_profile_admin_service_cache()
    clear_plugin_catalog_service_cache()
    clear_recovery_admin_service_cache()
    reset_runtime_readiness_state(app)


def make_client() -> TestClient:
    return TestClient(app)
