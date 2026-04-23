import os

from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers
from app.api.admin.control_plane import get_control_plane_service
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.instances.service import clear_instance_service_cache
from app.readiness import reset_runtime_readiness_state
from app.settings.config import get_settings
from app.main import app


def _client() -> TestClient:
    return TestClient(app)


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _rebuild_admin_services() -> None:
    get_settings.cache_clear()
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()
    clear_instance_service_cache()
    reset_runtime_readiness_state(app)


def _configure_fast_routing_test_env(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_ENABLED", "false")
    monkeypatch.setenv("FORGEGATE_GEMINI_ENABLED", "false")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_ENABLED", "false")
    monkeypatch.setenv("FORGEGATE_GENERIC_HARNESS_ENABLED", "false")
    monkeypatch.setenv("FORGEGATE_OLLAMA_ENABLED", "false")
    _rebuild_admin_services()


def test_routing_snapshot_and_policy_state_persist_across_reload(monkeypatch) -> None:
    _configure_fast_routing_test_env(monkeypatch)
    client = _client()
    headers = _admin_headers(client)

    initial = client.get("/admin/routing/", headers=headers)
    assert initial.status_code == 200
    payload = initial.json()
    assert payload["object"] == "routing_control_plane"
    assert {policy["classification"] for policy in payload["policies"]} == {"simple", "non_simple"}

    baseline_target = next(
        target["target_key"]
        for target in payload["targets"]
        if target["provider"] == "forgeframe_baseline"
    )

    policy_update = client.patch(
        "/admin/routing/policies/simple",
        headers=headers,
        json={
            "allow_premium": True,
            "preferred_target_keys": [baseline_target],
        },
    )
    assert policy_update.status_code == 200
    assert policy_update.json()["policy"]["allow_premium"] is True

    budget_update = client.patch(
        "/admin/routing/budget",
        headers=headers,
        json={
            "hard_blocked": False,
            "blocked_cost_classes": ["premium"],
            "reason": "operator budget posture",
            "scopes": [
                {
                    "scope_type": "agent",
                    "scope_key": "assistant-alpha",
                    "window": "24h",
                    "enabled": True,
                    "soft_cost_limit": 5,
                    "hard_cost_limit": 8,
                    "soft_blocked_cost_classes": ["high", "premium"],
                    "note": "agent budget",
                }
            ],
        },
    )
    assert budget_update.status_code == 200
    assert budget_update.json()["budget"]["blocked_cost_classes"] == ["premium"]
    assert budget_update.json()["budget"]["scopes"][0]["scope_key"] == "assistant-alpha"

    circuit_update = client.patch(
        f"/admin/routing/circuits/{baseline_target}",
        headers=headers,
        json={"state": "open", "reason": "operator isolation"},
    )
    assert circuit_update.status_code == 200
    assert circuit_update.json()["circuit"]["state"] == "open"

    get_control_plane_service.cache_clear()

    reloaded_client = _client()
    reloaded = reloaded_client.get("/admin/routing/", headers=_admin_headers(reloaded_client))
    assert reloaded.status_code == 200
    refreshed = reloaded.json()
    simple_policy = next(policy for policy in refreshed["policies"] if policy["classification"] == "simple")
    circuit = next(item for item in refreshed["circuits"] if item["target_key"] == baseline_target)
    assert simple_policy["allow_premium"] is True
    assert simple_policy["preferred_target_keys"] == [baseline_target]
    assert refreshed["budget"]["blocked_cost_classes"] == ["premium"]
    assert refreshed["budget"]["reason"] == "operator budget posture"
    assert refreshed["budget"]["scopes"][0]["scope_type"] == "agent"
    assert refreshed["summary"]["budget_scope_count"] == 1
    assert refreshed["summary"]["budget_anomaly_count"] == 0
    assert circuit["state"] == "open"
    assert refreshed["summary"]["open_circuits"] >= 1


def test_routing_simulation_returns_non_simple_explainability_for_tool_requests(monkeypatch) -> None:
    _configure_fast_routing_test_env(monkeypatch)
    client = _client()
    headers = _admin_headers(client)

    response = client.post(
        "/admin/routing/simulate",
        headers=headers,
        json={
            "prompt": "Plan a multi-step deployment.",
            "tools": [{"type": "function", "function": {"name": "plan_release"}}],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    decision = payload["decision"]
    assert decision["classification"] == "non_simple"
    assert decision["policy_stage"] == "preferred"
    assert decision["execution_lane"] == "queued_background"
    assert decision["resolved_target"]["provider"] == "openai_api"
    assert "tool_calling_requires_non_simple" in decision["classification_rules"]
    assert any(candidate["selected"] for candidate in decision["considered_candidates"])


def test_routing_simulation_surfaces_budget_block_with_admin_decision_ledger(monkeypatch) -> None:
    _configure_fast_routing_test_env(monkeypatch)
    client = _client()
    headers = _admin_headers(client)

    budget_update = client.patch(
        "/admin/routing/budget",
        headers=headers,
        json={"hard_blocked": True, "reason": "operator freeze"},
    )
    assert budget_update.status_code == 200

    response = client.post(
        "/admin/routing/simulate",
        headers=headers,
        json={"prompt": "This simulation should be blocked."},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "blocked"
    assert payload["error"]["type"] == "routing_budget_exceeded"
    assert payload["decision"]["source"] == "admin_simulation"
    assert payload["decision"]["policy_stage"] == "blocked"
    assert payload["decision"]["error_type"] == "routing_budget_exceeded"
