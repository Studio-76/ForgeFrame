import os
from pathlib import Path

from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers
from app.api.admin.control_plane import get_control_plane_service
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.main import app
from app.settings.config import get_settings
from app.usage.analytics import get_usage_analytics_store


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


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


def test_responses_usage_events_persist_scope_attributes_from_request_metadata() -> None:
    client = TestClient(app)
    analytics = get_usage_analytics_store()
    repository = analytics._repository  # type: ignore[attr-defined]
    before_count = len(repository.load_usage_events())
    settings = get_settings()

    response = client.post(
        "/v1/responses",
        json={
            "model": "forgeframe-baseline-chat-v1",
            "input": "persist scope metadata",
            "metadata": {
                "agent_id": "assistant-scope-audit",
                "task_id": "task-scope-audit",
            },
        },
    )
    assert response.status_code == 200

    events = repository.load_usage_events()
    assert len(events) >= before_count + 1
    latest = events[-1]
    assert latest.scope_attributes["instance_id"] == settings.bootstrap_tenant_id
    assert latest.scope_attributes["agent_id"] == "assistant-scope-audit"
    assert latest.scope_attributes["task_id"] == "task-scope-audit"


def test_logs_operability_and_bootstrap_readiness_reflect_observability_signal_path() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    chat_response = client.post(
        "/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "operability signal"}],
            "client": {"client_id": "observability-suite", "consumer": "tests", "integration": "pytest"},
        },
    )
    assert chat_response.status_code == 200

    missing_model = client.post(
        "/v1/chat/completions",
        json={
            "model": "missing-operability-model",
            "messages": [{"role": "user", "content": "record an error path"}],
            "client": {"client_id": "observability-suite", "consumer": "tests", "integration": "pytest"},
        },
    )
    assert missing_model.status_code == 404

    health_response = client.post("/admin/providers/health/run", headers=headers)
    assert health_response.status_code == 200

    logs = client.get("/admin/logs/", headers=headers)
    assert logs.status_code == 200
    operability = logs.json()["operability"]
    checks = {item["id"]: item for item in operability["checks"]}
    assert operability["ready"] is True
    assert checks["runtime_signal_path"]["ok"] is True
    assert checks["health_signal_path"]["ok"] is True
    assert checks["audit_signal_path"]["ok"] is True
    assert checks["structured_runtime_context"]["ok"] is True
    assert checks["tracing_scope_declared"]["ok"] is True
    assert checks["routing_decision_signal_path"]["ok"] is True
    assert checks["routing_explainability_path"]["ok"] is True
    assert operability["metrics"]["runtime_errors"] >= 1
    assert operability["metrics"]["red_metrics"]["requests"] >= 2
    assert operability["metrics"]["queue_metrics"]["active_backlog"] >= 0
    assert "run_lanes" in operability["metrics"]["queue_metrics"]
    assert "lease_states" in operability["metrics"]["queue_metrics"]
    assert operability["metrics"]["dependency_metrics"]
    assert operability["metrics"]["routing_metrics"]["decision_count"] >= 1
    assert operability["metrics"]["routing_metrics"]["explainability_coverage"]["structured"] >= 1
    assert operability["metrics"]["routing_metrics"]["explainability_coverage"]["raw"] >= 1
    assert operability["metrics"]["slo_indicators"]["request_volume"] >= 2
    assert "trace_id" in operability["logging"]["structured_fields"]
    assert "span_id" in operability["logging"]["structured_fields"]
    assert operability["tracing"]["configured"] is True
    assert "X-ForgeFrame-Span-Id" in operability["tracing"]["emitted_headers"]

    readiness = client.get("/admin/providers/bootstrap/readiness", headers=headers)
    assert readiness.status_code == 200
    readiness_checks = {item["id"]: item for item in readiness.json()["checks"]}
    assert readiness_checks["observability_signal_path"]["ok"] is True
    assert readiness_checks["observability_error_path"]["ok"] is True
