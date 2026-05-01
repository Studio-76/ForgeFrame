"""Test setup for ForgeFrame backend tests."""

import os
from collections.abc import Iterator

_EARLY_TEST_BOOTSTRAP_ADMIN_PASSWORD = "ForgeFrame-Test-Admin-Secret-123"


def _set_brand_env_default(suffix: str, value: str) -> None:
    os.environ.setdefault(f"FORGEFRAME_{suffix}", value)
    os.environ.setdefault(f"FORGEGATE_{suffix}", value)


_set_brand_env_default("BOOTSTRAP_ADMIN_PASSWORD", _EARLY_TEST_BOOTSTRAP_ADMIN_PASSWORD)
_set_brand_env_default("HARNESS_STORAGE_BACKEND", "file")
_set_brand_env_default("CONTROL_PLANE_STORAGE_BACKEND", "file")
_set_brand_env_default("GOVERNANCE_STORAGE_BACKEND", "file")
_set_brand_env_default("OBSERVABILITY_STORAGE_BACKEND", "file")
_set_brand_env_default("INSTANCES_STORAGE_BACKEND", "file")
_set_brand_env_default("RUNTIME_AUTH_REQUIRED", "false")

import pytest
from fastapi.testclient import TestClient

from app.agents.dependencies import clear_agent_admin_service_cache
from app.api.admin.control_plane import get_control_plane_service
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.assistant_profiles.dependencies import (
    clear_assistant_profile_admin_service_cache,
)
from app.conversations.dependencies import clear_conversation_inbox_admin_service_cache
from app.execution.dependencies import clear_execution_dependency_caches
from app.governance.service import get_governance_service
from app.harness.service import get_harness_service
from app.instances.service import clear_instance_service_cache
from app.knowledge.dependencies import clear_knowledge_context_admin_service_cache
from app.learning.dependencies import clear_learning_admin_service_cache
from app.main import app
from app.plugins.dependencies import clear_plugin_catalog_service_cache
from app.readiness import reset_runtime_readiness_state
from app.recovery.dependencies import clear_recovery_admin_service_cache
from app.settings.config import get_settings
from app.skills.dependencies import clear_skill_admin_service_cache
from app.tasks.dependencies import clear_task_automation_admin_service_cache
from app.usage.analytics import get_usage_analytics_store
from app.workspaces.dependencies import clear_work_interaction_admin_service_cache

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
            json={
                "current_password": active_password,
                "new_password": rotated_password,
            },
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


@pytest.fixture(autouse=True, scope="module")
def _reset_runtime_caches() -> Iterator[None]:
    """Module-level hook retained for cache lifecycle coordination."""
    yield


@pytest.fixture(autouse=True)
def _reset_runtime_storage_paths(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Configure per-test storage paths to preserve test isolation."""

    def set_brand_env(suffix: str, value: str) -> None:
        monkeypatch.setenv(f"FORGEFRAME_{suffix}", value)
        monkeypatch.setenv(f"FORGEGATE_{suffix}", value)

    events_path = tmp_path / "events.jsonl"
    set_brand_env("OBSERVABILITY_EVENTS_PATH", str(events_path))
    set_brand_env("OBSERVABILITY_STORAGE_BACKEND", "file")
    set_brand_env("OAUTH_OPERATIONS_PATH", str(tmp_path / "oauth_operations.jsonl"))
    set_brand_env("HARNESS_STORAGE_BACKEND", "file")
    set_brand_env("HARNESS_PROFILES_PATH", str(tmp_path / "harness_profiles.json"))
    set_brand_env("HARNESS_RUNS_PATH", str(tmp_path / "harness_runs.json"))
    set_brand_env("CONTROL_PLANE_STORAGE_BACKEND", "file")
    set_brand_env("CONTROL_PLANE_STATE_PATH", str(tmp_path / "control_plane_state.json"))
    set_brand_env("INSTANCES_STORAGE_BACKEND", "file")
    set_brand_env("INSTANCES_STATE_PATH", str(tmp_path / "instances_state.json"))
    set_brand_env("GOVERNANCE_STORAGE_BACKEND", "file")
    set_brand_env("GOVERNANCE_STATE_PATH", str(tmp_path / "governance_state.json"))
    set_brand_env("EXECUTION_SQLITE_PATH", str(tmp_path / "execution.sqlite"))
    set_brand_env("BOOTSTRAP_ADMIN_PASSWORD", TEST_BOOTSTRAP_ADMIN_PASSWORD)
    set_brand_env("RUNTIME_AUTH_REQUIRED", "false")
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
