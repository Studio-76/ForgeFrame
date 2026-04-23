from pathlib import Path
import os

from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers
from app.api.admin.control_plane import get_control_plane_service
from app.control_plane import ControlPlaneStateRecord
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.main import app
from app.providers import ChatDispatchResult, ProviderStreamEvent
from app.usage.analytics import get_usage_analytics_store
from app.usage.events import ClientIdentity
from app.usage.models import CostBreakdown, TokenUsage


client = TestClient(app)


def _admin_headers() -> dict[str, str]:
    return shared_admin_headers(client)


def test_admin_providers_control_plane_endpoint_available() -> None:
    response = client.get("/admin/providers/", headers=_admin_headers())
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["object"] == "provider_control_plane"
    assert "truth_axes" in payload
    assert isinstance(payload["truth_axes"], list)
    assert any({"provider", "runtime", "harness", "ui"} <= set(item.keys()) for item in payload["truth_axes"])


def test_anthropic_only_bootstrap_keeps_runtime_and_provider_control_plane_available(
    monkeypatch,
) -> None:
    for env_name in (
        "FORGEGATE_FORGEGATE_BASELINE_ENABLED",
        "FORGEGATE_OPENAI_API_ENABLED",
        "FORGEGATE_OPENAI_CODEX_ENABLED",
        "FORGEGATE_GEMINI_ENABLED",
        "FORGEGATE_GENERIC_HARNESS_ENABLED",
        "FORGEGATE_OLLAMA_ENABLED",
    ):
        monkeypatch.setenv(env_name, "false")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_API_KEY", "anthropic-key")
    monkeypatch.setenv("FORGEGATE_DEFAULT_PROVIDER", "anthropic")
    monkeypatch.setenv("FORGEGATE_DEFAULT_MODEL", "claude-3-5-sonnet-latest")
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    health_response = client.get("/health")
    assert health_response.status_code == 200
    health_payload = health_response.json()
    assert health_payload["status"] == "ok"
    assert health_payload["readiness"]["state"] == "degraded"
    assert health_payload["readiness"]["accepting_traffic"] is True
    readiness_checks = {item["id"]: item for item in health_payload["readiness"]["checks"]}
    assert readiness_checks["runtime_model_configuration"]["ok"] is True
    assert readiness_checks["public_origin_contract"]["ok"] is False

    models_response = client.get("/v1/models")
    assert models_response.status_code == 200
    assert models_response.json()["data"] == []

    headers = _admin_headers()
    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    payload = providers_response.json()
    anthropic_provider = next(item for item in payload["providers"] if item["provider"] == "anthropic")
    anthropic_truth = next(
        item["runtime"] for item in payload["truth_axes"] if item["provider"]["provider"] == "anthropic"
    )

    assert anthropic_provider["model_count"] == 1
    assert anthropic_provider["models"][0]["id"] == "claude-3-5-sonnet-latest"
    assert anthropic_truth["wired"] is True
    assert anthropic_truth["provider_axis"] == "unmapped_native_runtime"
    assert anthropic_truth["runtime_readiness"] == "partial"
    assert "outside the current product-axis taxonomy" in anthropic_truth["readiness_reason"]

    matrix_response = client.get("/admin/providers/compatibility-matrix", headers=headers)
    assert matrix_response.status_code == 200
    anthropic_matrix_row = next(item for item in matrix_response.json()["matrix"] if item["provider"] == "anthropic")
    assert anthropic_matrix_row["provider_axis"] == "unmapped_native_runtime"
    assert anthropic_matrix_row["compatibility_depth"] == "limited"
    assert "outside the current product-axis taxonomy" in anthropic_matrix_row["notes"]

    axis_targets_response = client.get("/admin/providers/product-axis-targets", headers=headers)
    assert axis_targets_response.status_code == 200
    assert all(item["provider_key"] != "anthropic" for item in axis_targets_response.json()["targets"])

    sync_response = client.post("/admin/providers/sync", json={"provider": "anthropic"}, headers=headers)
    assert sync_response.status_code == 200
    assert sync_response.json()["synced_providers"] == ["anthropic"]


def test_anthropic_only_bootstrap_repairs_persisted_state_before_runtime_readiness(monkeypatch) -> None:
    for env_name in (
        "FORGEGATE_FORGEGATE_BASELINE_ENABLED",
        "FORGEGATE_OPENAI_API_ENABLED",
        "FORGEGATE_OPENAI_CODEX_ENABLED",
        "FORGEGATE_GEMINI_ENABLED",
        "FORGEGATE_GENERIC_HARNESS_ENABLED",
        "FORGEGATE_OLLAMA_ENABLED",
    ):
        monkeypatch.setenv(env_name, "false")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_API_KEY", "anthropic-key")
    monkeypatch.setenv("FORGEGATE_DEFAULT_PROVIDER", "anthropic")
    monkeypatch.setenv("FORGEGATE_DEFAULT_MODEL", "claude-3-5-sonnet-latest")

    state_path = Path(os.environ["FORGEGATE_CONTROL_PLANE_STATE_PATH"])
    state_path.write_text(
        ControlPlaneStateRecord(providers=[]).model_dump_json(indent=2) + "\n",
        encoding="utf-8",
    )

    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    health_response = client.get("/health")
    assert health_response.status_code == 200
    assert health_response.json()["readiness"]["state"] == "degraded"
    readiness_checks = {
        item["id"]: item
        for item in health_response.json()["readiness"]["checks"]
    }
    assert readiness_checks["runtime_model_configuration"]["ok"] is True

    models_response = client.get("/v1/models")
    assert models_response.status_code == 200
    assert models_response.json()["data"] == []

    headers = _admin_headers()
    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    payload = providers_response.json()
    anthropic_provider = next(item for item in payload["providers"] if item["provider"] == "anthropic")
    assert anthropic_provider["model_count"] == 1
    assert anthropic_provider["models"][0]["id"] == "claude-3-5-sonnet-latest"

    repaired_state = ControlPlaneStateRecord.model_validate_json(state_path.read_text(encoding="utf-8"))
    repaired_provider = next(provider for provider in repaired_state.providers if provider.provider == "anthropic")
    assert {model.id for model in repaired_provider.managed_models} == {"claude-3-5-sonnet-latest"}


def test_admin_providers_create_update_activate_deactivate_and_sync() -> None:
    headers = _admin_headers()
    create_response = client.post(
        "/admin/providers/",
        json={"provider": "custom_provider", "label": "Custom Provider", "config": {"endpoint": "https://example"}},
        headers=headers,
    )
    assert create_response.status_code == 201

    patch_response = client.patch(
        "/admin/providers/custom_provider",
        json={"label": "Custom Provider 2"},
        headers=headers,
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["provider"]["label"] == "Custom Provider 2"

    deactivate_response = client.post("/admin/providers/custom_provider/deactivate", json={}, headers=headers)
    assert deactivate_response.status_code == 200
    assert deactivate_response.json()["provider"]["enabled"] is False

    activate_response = client.post("/admin/providers/custom_provider/activate", json={}, headers=headers)
    assert activate_response.status_code == 200
    assert activate_response.json()["provider"]["enabled"] is True

    sync_response = client.post("/admin/providers/sync", json={"provider": "custom_provider"}, headers=headers)
    assert sync_response.status_code == 200
    assert "custom_provider" in sync_response.json()["synced_providers"]


def test_admin_provider_product_axis_targets_endpoint_available() -> None:
    response = client.get("/admin/providers/product-axis-targets", headers=_admin_headers())
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    targets = payload["targets"]
    assert any(item["provider_key"] == "ollama" for item in targets)
    assert any(item["provider_key"] == "openai_codex" for item in targets)
    codex = next(item for item in targets if item["provider_key"] == "openai_codex")
    antigravity = next(item for item in targets if item["provider_key"] == "antigravity")
    client_axis = next(item for item in targets if item["provider_key"] == "openai_client_compat")
    assert codex["product_axis"] == "oauth_account_providers"
    assert codex["contract_classification"] in {"partial-runtime", "runtime-ready", "onboarding-only"}
    assert codex["operator_surface"] == "/oauth-targets"
    assert isinstance(codex["technical_requirements"], list)
    assert "readiness_score" in codex
    assert antigravity["runtime_readiness"] == "planned"
    assert antigravity["contract_classification"] in {"bridge-only", "onboarding-only"}
    assert client_axis["contract_classification"] == "partial-runtime"
    assert client_axis["classification_reason"].startswith("The public OpenAI-compatible surface is live")


def test_admin_provider_truth_and_compatibility_matrix_expose_honest_readiness_axes(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_MODE", "device_hosted_code")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_GEMINI_OAUTH_ACCESS_TOKEN", "token")
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    headers = _admin_headers()
    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    payload = providers_response.json()

    codex_truth = next(item["runtime"] for item in payload["truth_axes"] if item["provider"]["provider"] == "openai_codex")
    gemini_truth = next(item["runtime"] for item in payload["truth_axes"] if item["provider"]["provider"] == "gemini")
    codex_ui = next(item for item in payload["providers"] if item["provider"] == "openai_codex")

    assert codex_truth["ready"] is False
    assert codex_truth["runtime_readiness"] == "partial"
    assert codex_truth["streaming_readiness"] == "partial"
    assert codex_truth["oauth_mode"] == "device_hosted_code"
    assert gemini_truth["runtime_readiness"] == "partial"
    assert gemini_truth["streaming_readiness"] == "partial"
    assert gemini_truth["oauth_mode"] is None
    assert codex_ui["ready"] is False
    assert codex_ui["runtime_readiness"] == "partial"
    assert codex_ui["streaming_readiness"] == "partial"
    assert codex_ui["oauth_mode"] == "device_hosted_code"

    compatibility_response = client.get("/admin/providers/compatibility-matrix", headers=headers)
    assert compatibility_response.status_code == 200
    matrix = compatibility_response.json()["matrix"]
    codex_row = next(item for item in matrix if item["provider"] == "openai_codex")
    gemini_row = next(item for item in matrix if item["provider"] == "gemini")
    assert codex_row["runtime_readiness"] == "partial"
    assert codex_row["streaming_readiness"] == "partial"
    assert gemini_row["runtime_readiness"] == "partial"
    assert gemini_row["streaming_readiness"] == "partial"


def test_admin_provider_truth_and_compatibility_matrix_report_gemini_oauth_required_from_active_auth_mode(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_GEMINI_AUTH_MODE", "api_key")
    monkeypatch.setenv("FORGEGATE_GEMINI_API_KEY", "gemini-key")
    monkeypatch.delenv("FORGEGATE_GEMINI_OAUTH_ACCESS_TOKEN", raising=False)
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_ENABLED", "true")
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    headers = _admin_headers()
    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    payload = providers_response.json()

    gemini_provider = next(item for item in payload["providers"] if item["provider"] == "gemini")
    gemini_truth = next(item["runtime"] for item in payload["truth_axes"] if item["provider"]["provider"] == "gemini")

    assert gemini_provider["oauth_required"] is False
    assert gemini_truth["oauth_required"] is False

    compatibility_response = client.get("/admin/providers/compatibility-matrix", headers=headers)
    assert compatibility_response.status_code == 200
    gemini_row = next(item for item in compatibility_response.json()["matrix"] if item["provider"] == "gemini")
    assert gemini_row["oauth_required"] is False


def test_admin_oauth_account_targets_are_read_only_and_keep_native_targets_partial_without_live_evidence(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_MODE", "device_hosted_code")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_GEMINI_OAUTH_ACCESS_TOKEN", "token")
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    def _unexpected_probe(*args, **kwargs):
        raise AssertionError("GET /admin/providers/oauth-account/targets must not trigger live probe HTTP calls.")

    monkeypatch.setattr("app.api.admin.control_plane_oauth_targets_domain.httpx.post", _unexpected_probe)
    response = client.get("/admin/providers/oauth-account/targets", headers=_admin_headers())
    assert response.status_code == 200
    targets = response.json()["targets"]
    codex = next(item for item in targets if item["provider_key"] == "openai_codex")
    gemini = next(item for item in targets if item["provider_key"] == "gemini")
    assert codex["readiness"] == "partial"
    assert codex["contract_classification"] == "partial-runtime"
    assert codex["auth_kind"] == "oauth_account"
    assert codex["oauth_mode"] == "device_hosted_code"
    assert codex["oauth_flow_support"] == "external_token_only"
    assert codex["queue_lane"] == "sync_interactive"
    assert codex["parallelism_mode"] == "not_enforced"
    assert codex["cost_posture"].startswith("avoided-cost")
    assert "pre-issued access token" in codex["operator_truth"]
    assert "pre-issued access token" in codex["readiness_reason"]
    assert codex["evidence"]["live_probe"]["status"] == "missing"
    assert gemini["readiness"] == "partial"
    assert gemini["contract_classification"] == "partial-runtime"
    assert gemini["auth_kind"] == "oauth_account"
    assert gemini["oauth_mode"] is None
    assert gemini["evidence"]["live_probe"]["status"] == "missing"


def test_admin_oauth_account_targets_preserve_native_api_key_auth_kind(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_AUTH_MODE", "api_key")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_API_KEY", "codex-key")
    monkeypatch.delenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", raising=False)
    monkeypatch.setenv("FORGEGATE_GEMINI_AUTH_MODE", "api_key")
    monkeypatch.setenv("FORGEGATE_GEMINI_API_KEY", "gemini-key")
    monkeypatch.delenv("FORGEGATE_GEMINI_OAUTH_ACCESS_TOKEN", raising=False)
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    response = client.get("/admin/providers/oauth-account/targets", headers=_admin_headers())
    assert response.status_code == 200
    targets = response.json()["targets"]
    codex = next(item for item in targets if item["provider_key"] == "openai_codex")
    gemini = next(item for item in targets if item["provider_key"] == "gemini")

    assert codex["configured"] is True
    assert codex["auth_kind"] == "api_key"
    assert codex["oauth_mode"] is None
    assert codex["oauth_flow_support"] is None

    assert gemini["configured"] is True
    assert gemini["auth_kind"] == "api_key"
    assert gemini["oauth_mode"] is None
    assert gemini["oauth_flow_support"] is None


def test_admin_oauth_account_targets_demote_codex_after_bridge_disable_even_with_historical_probe_evidence(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_MODE", "device_hosted_code")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "false")
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    service = get_control_plane_service()
    service._record_oauth_operation(  # type: ignore[attr-defined]
        "openai_codex",
        "probe",
        "ok",
        "Codex bridge probe succeeded.",
        "2026-04-22T00:03:00+00:00",
    )

    targets_response = client.get("/admin/providers/oauth-account/targets", headers=_admin_headers())
    assert targets_response.status_code == 200
    codex_target = next(item for item in targets_response.json()["targets"] if item["provider_key"] == "openai_codex")
    assert codex_target["readiness"] == "partial"
    assert codex_target["runtime_bridge_enabled"] is False
    assert codex_target["probe_enabled"] is False
    assert codex_target["evidence"]["live_probe"]["status"] == "observed"
    assert "native runtime bridge is still disabled" in codex_target["readiness_reason"]
    assert "Historical live probe evidence remains recorded from an earlier enabled state." in codex_target["readiness_reason"]

    onboarding_response = client.get("/admin/providers/oauth-account/onboarding", headers=_admin_headers())
    assert onboarding_response.status_code == 200
    codex_onboarding = next(item for item in onboarding_response.json()["targets"] if item["provider_key"] == "openai_codex")
    assert codex_onboarding["readiness"] == "partial"
    assert codex_onboarding["operational_depth"] == "path_disabled_probe_evidenced"
    assert "Enable native runtime bridge for openai_codex." in codex_onboarding["next_steps"]


def test_admin_oauth_account_targets_demote_gemini_after_probe_disable_even_with_historical_runtime_evidence(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_GEMINI_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_ENABLED", "false")
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    analytics = get_usage_analytics_store()
    analytics.record_non_stream_result(
        ChatDispatchResult(
            model="gemini-2.5-flash",
            provider="gemini",
            content="gemini-ok",
            finish_reason="stop",
            usage=TokenUsage(input_tokens=4, output_tokens=2, total_tokens=6),
            cost=CostBreakdown(),
            credential_type="oauth_access_token",
            auth_source="gemini_oauth_account_bridge",
        ),
        client=ClientIdentity(client_id="proof-suite", consumer="tests", integration="pytest"),
    )

    targets_response = client.get("/admin/providers/oauth-account/targets", headers=_admin_headers())
    assert targets_response.status_code == 200
    gemini_target = next(item for item in targets_response.json()["targets"] if item["provider_key"] == "gemini")
    assert gemini_target["readiness"] == "partial"
    assert gemini_target["runtime_bridge_enabled"] is False
    assert gemini_target["probe_enabled"] is False
    assert gemini_target["evidence"]["runtime"]["status"] == "observed"
    assert "native runtime bridge is still disabled" in gemini_target["readiness_reason"]
    assert "Historical live runtime evidence remains recorded from an earlier enabled state." in gemini_target["readiness_reason"]

    onboarding_response = client.get("/admin/providers/oauth-account/onboarding", headers=_admin_headers())
    assert onboarding_response.status_code == 200
    gemini_onboarding = next(item for item in onboarding_response.json()["targets"] if item["provider_key"] == "gemini")
    assert gemini_onboarding["readiness"] == "partial"
    assert gemini_onboarding["operational_depth"] == "path_disabled_runtime_evidenced"
    assert "Enable native runtime bridge for gemini." in gemini_onboarding["next_steps"]


def test_admin_provider_truth_and_oauth_targets_keep_gemini_non_ready_when_bridge_base_url_is_invalid(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_GEMINI_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_BASE_URL", "not-a-url")
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    analytics = get_usage_analytics_store()
    analytics.record_non_stream_result(
        ChatDispatchResult(
            model="gemini-2.5-flash",
            provider="gemini",
            content="gemini-ok",
            finish_reason="stop",
            usage=TokenUsage(input_tokens=4, output_tokens=2, total_tokens=6),
            cost=CostBreakdown(),
            credential_type="oauth_access_token",
            auth_source="gemini_oauth_account_bridge",
        ),
        client=ClientIdentity(client_id="proof-suite", consumer="tests", integration="pytest"),
    )

    service = get_control_plane_service()
    service._record_oauth_operation(  # type: ignore[attr-defined]
        "gemini",
        "probe",
        "ok",
        "Gemini OAuth/account probe succeeded.",
        "2026-04-22T00:01:00+00:00",
    )

    headers = _admin_headers()
    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    gemini_truth = next(item["runtime"] for item in providers_response.json()["truth_axes"] if item["provider"]["provider"] == "gemini")
    assert gemini_truth["ready"] is False
    assert gemini_truth["runtime_readiness"] == "partial"
    assert gemini_truth["evidence"]["runtime"]["status"] == "observed"
    assert gemini_truth["evidence"]["live_probe"]["status"] == "observed"
    assert gemini_truth["readiness_reason"] == "FORGEGATE_GEMINI_PROBE_BASE_URL must be an absolute http(s) URL."

    targets_response = client.get("/admin/providers/oauth-account/targets", headers=headers)
    assert targets_response.status_code == 200
    gemini_target = next(item for item in targets_response.json()["targets"] if item["provider_key"] == "gemini")
    assert gemini_target["readiness"] == "partial"
    assert gemini_target["runtime_bridge_enabled"] is True
    assert gemini_target["probe_enabled"] is True
    assert gemini_target["evidence"]["runtime"]["status"] == "observed"
    assert gemini_target["evidence"]["live_probe"]["status"] == "observed"
    assert gemini_target["readiness_reason"] == "FORGEGATE_GEMINI_PROBE_BASE_URL must be an absolute http(s) URL."


def test_admin_product_axis_targets_keep_gemini_probe_truth_partial_when_bridge_base_url_is_invalid(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_GEMINI_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_BASE_URL", "not-a-url")
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    analytics = get_usage_analytics_store()
    analytics.record_non_stream_result(
        ChatDispatchResult(
            model="gemini-2.5-flash",
            provider="gemini",
            content="gemini-ok",
            finish_reason="stop",
            usage=TokenUsage(input_tokens=4, output_tokens=2, total_tokens=6),
            cost=CostBreakdown(),
            credential_type="oauth_access_token",
            auth_source="gemini_oauth_account_bridge",
        ),
        client=ClientIdentity(client_id="proof-suite", consumer="tests", integration="pytest"),
    )

    service = get_control_plane_service()
    service._record_oauth_operation(  # type: ignore[attr-defined]
        "gemini",
        "probe",
        "ok",
        "Gemini OAuth/account probe succeeded.",
        "2026-04-22T00:01:00+00:00",
    )

    response = client.get("/admin/providers/product-axis-targets", headers=_admin_headers())
    assert response.status_code == 200
    gemini_target = next(item for item in response.json()["targets"] if item["provider_key"] == "gemini")
    assert gemini_target["readiness"] == "partial"
    assert gemini_target["runtime_readiness"] == "partial"
    assert gemini_target["streaming_readiness"] == "partial"
    assert gemini_target["verify_probe_readiness"] == "partial"
    assert gemini_target["readiness_score"] == 46
    assert gemini_target["evidence"]["runtime"]["status"] == "observed"
    assert gemini_target["evidence"]["live_probe"]["status"] == "observed"
    assert gemini_target["status_summary"] == "FORGEGATE_GEMINI_PROBE_BASE_URL must be an absolute http(s) URL."


def test_admin_gemini_product_axis_and_oauth_targets_honor_tenant_id(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_GEMINI_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_ENABLED", "true")
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    analytics = get_usage_analytics_store()
    analytics.record_non_stream_result(
        ChatDispatchResult(
            model="gemini-2.5-flash",
            provider="gemini",
            content="tenant-a-gemini-ok",
            finish_reason="stop",
            usage=TokenUsage(input_tokens=4, output_tokens=2, total_tokens=6),
            cost=CostBreakdown(),
            credential_type="oauth_access_token",
            auth_source="gemini_oauth_account_bridge",
        ),
        client=ClientIdentity(client_id="tenant-a-proof", consumer="tests", integration="pytest", tenant_id="tenant_a"),
    )

    service = get_control_plane_service()
    service._record_oauth_operation(  # type: ignore[attr-defined]
        "gemini",
        "probe",
        "ok",
        "Tenant A Gemini OAuth/account probe succeeded.",
        "2026-04-22T00:02:00+00:00",
        tenant_id="tenant_a",
    )

    headers = _admin_headers()
    axis_tenant_a = client.get("/admin/providers/product-axis-targets?tenantId=tenant_a", headers=headers)
    axis_tenant_b = client.get("/admin/providers/product-axis-targets?tenantId=tenant_b", headers=headers)
    oauth_tenant_a = client.get("/admin/providers/oauth-account/targets?tenantId=tenant_a", headers=headers)
    oauth_tenant_b = client.get("/admin/providers/oauth-account/targets?tenantId=tenant_b", headers=headers)

    assert axis_tenant_a.status_code == 200
    assert axis_tenant_b.status_code == 200
    assert oauth_tenant_a.status_code == 200
    assert oauth_tenant_b.status_code == 200

    gemini_axis_tenant_a = next(item for item in axis_tenant_a.json()["targets"] if item["provider_key"] == "gemini")
    gemini_axis_tenant_b = next(item for item in axis_tenant_b.json()["targets"] if item["provider_key"] == "gemini")
    assert gemini_axis_tenant_a["runtime_readiness"] == "ready"
    assert gemini_axis_tenant_a["verify_probe_readiness"] == "ready"
    assert gemini_axis_tenant_a["evidence"]["runtime"]["status"] == "observed"
    assert gemini_axis_tenant_a["evidence"]["live_probe"]["status"] == "observed"
    assert gemini_axis_tenant_b["runtime_readiness"] == "partial"
    assert gemini_axis_tenant_b["verify_probe_readiness"] == "partial"
    assert gemini_axis_tenant_b["evidence"]["runtime"]["status"] == "missing"
    assert gemini_axis_tenant_b["evidence"]["live_probe"]["status"] == "missing"

    gemini_oauth_tenant_a = next(item for item in oauth_tenant_a.json()["targets"] if item["provider_key"] == "gemini")
    gemini_oauth_tenant_b = next(item for item in oauth_tenant_b.json()["targets"] if item["provider_key"] == "gemini")
    assert gemini_oauth_tenant_a["readiness"] == "ready"
    assert gemini_oauth_tenant_a["evidence"]["runtime"]["status"] == "observed"
    assert gemini_oauth_tenant_a["evidence"]["live_probe"]["details"] == "Tenant A Gemini OAuth/account probe succeeded."
    assert gemini_oauth_tenant_b["readiness"] == "partial"
    assert gemini_oauth_tenant_b["evidence"]["runtime"]["status"] == "missing"
    assert gemini_oauth_tenant_b["evidence"]["live_probe"]["status"] == "missing"


def test_admin_provider_truth_and_oauth_targets_keep_codex_non_ready_when_bridge_base_url_is_invalid(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BASE_URL", "not-a-url")
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    analytics = get_usage_analytics_store()
    analytics.record_non_stream_result(
        ChatDispatchResult(
            model="gpt-5.3-codex",
            provider="openai_codex",
            content="codex-ok",
            finish_reason="stop",
            usage=TokenUsage(input_tokens=4, output_tokens=2, total_tokens=6),
            cost=CostBreakdown(),
            credential_type="oauth_access_token",
            auth_source="codex_oauth_account_bridge",
        ),
        client=ClientIdentity(client_id="proof-suite", consumer="tests", integration="pytest"),
    )

    service = get_control_plane_service()
    service._record_oauth_operation(  # type: ignore[attr-defined]
        "openai_codex",
        "probe",
        "ok",
        "Codex bridge probe succeeded.",
        "2026-04-22T00:00:00+00:00",
    )

    headers = _admin_headers()
    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    codex_truth = next(item["runtime"] for item in providers_response.json()["truth_axes"] if item["provider"]["provider"] == "openai_codex")
    assert codex_truth["ready"] is False
    assert codex_truth["runtime_readiness"] == "partial"
    assert codex_truth["evidence"]["runtime"]["status"] == "observed"
    assert codex_truth["evidence"]["live_probe"]["status"] == "observed"
    assert codex_truth["readiness_reason"] == "FORGEGATE_OPENAI_CODEX_BASE_URL must be an absolute http(s) URL."

    targets_response = client.get("/admin/providers/oauth-account/targets", headers=headers)
    assert targets_response.status_code == 200
    codex_target = next(item for item in targets_response.json()["targets"] if item["provider_key"] == "openai_codex")
    assert codex_target["readiness"] == "partial"
    assert codex_target["runtime_bridge_enabled"] is True
    assert codex_target["probe_enabled"] is True
    assert codex_target["evidence"]["runtime"]["status"] == "observed"
    assert codex_target["evidence"]["live_probe"]["status"] == "observed"
    assert codex_target["readiness_reason"] == "FORGEGATE_OPENAI_CODEX_BASE_URL must be an absolute http(s) URL."


def test_admin_product_axis_targets_keep_codex_probe_truth_partial_when_bridge_base_url_is_invalid(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BASE_URL", "not-a-url")
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    analytics = get_usage_analytics_store()
    analytics.record_non_stream_result(
        ChatDispatchResult(
            model="gpt-5.3-codex",
            provider="openai_codex",
            content="codex-ok",
            finish_reason="stop",
            usage=TokenUsage(input_tokens=4, output_tokens=2, total_tokens=6),
            cost=CostBreakdown(),
            credential_type="oauth_access_token",
            auth_source="codex_oauth_account_bridge",
        ),
        client=ClientIdentity(client_id="proof-suite", consumer="tests", integration="pytest"),
    )

    service = get_control_plane_service()
    service._record_oauth_operation(  # type: ignore[attr-defined]
        "openai_codex",
        "probe",
        "ok",
        "Codex bridge probe succeeded.",
        "2026-04-22T00:00:00+00:00",
    )

    response = client.get("/admin/providers/product-axis-targets", headers=_admin_headers())
    assert response.status_code == 200
    codex_target = next(item for item in response.json()["targets"] if item["provider_key"] == "openai_codex")
    assert codex_target["readiness"] == "partial"
    assert codex_target["runtime_readiness"] == "partial"
    assert codex_target["streaming_readiness"] == "partial"
    assert codex_target["verify_probe_readiness"] == "partial"
    assert codex_target["readiness_score"] == 48
    assert codex_target["evidence"]["runtime"]["status"] == "observed"
    assert codex_target["evidence"]["live_probe"]["status"] == "observed"
    assert codex_target["status_summary"] == "FORGEGATE_OPENAI_CODEX_BASE_URL must be an absolute http(s) URL."


def test_admin_oauth_account_targets_keep_bridge_only_targets_partial_even_after_probe_evidence(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_ANTIGRAVITY_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_ANTIGRAVITY_PROBE_ENABLED", "true")
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    service = get_control_plane_service()
    service._record_oauth_operation(  # type: ignore[attr-defined]
        "antigravity",
        "probe",
        "ok",
        "Antigravity bridge probe succeeded.",
        "2026-04-22T00:02:00+00:00",
    )

    targets_response = client.get("/admin/providers/oauth-account/targets", headers=_admin_headers())
    assert targets_response.status_code == 200
    antigravity = next(item for item in targets_response.json()["targets"] if item["provider_key"] == "antigravity")
    assert antigravity["readiness"] == "partial"
    assert antigravity["evidence"]["live_probe"]["status"] == "observed"
    assert "bridge-only" in antigravity["readiness_reason"]

    axis_targets_response = client.get("/admin/providers/product-axis-targets", headers=_admin_headers())
    assert axis_targets_response.status_code == 200
    antigravity_target = next(item for item in axis_targets_response.json()["targets"] if item["provider_key"] == "antigravity")
    assert antigravity_target["readiness"] == "partial"
    assert antigravity_target["verify_probe_readiness"] == "ready"


def test_admin_product_axis_targets_keep_bridge_only_probe_truth_planned_without_current_configuration_even_with_historical_probe_evidence(
    monkeypatch,
) -> None:
    for provider_key in ("ANTIGRAVITY", "GITHUB_COPILOT", "CLAUDE_CODE"):
        monkeypatch.delenv(f"FORGEGATE_{provider_key}_OAUTH_ACCESS_TOKEN", raising=False)
        monkeypatch.setenv(f"FORGEGATE_{provider_key}_PROBE_ENABLED", "false")
        monkeypatch.setenv(f"FORGEGATE_{provider_key}_BRIDGE_PROFILE_ENABLED", "false")

    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    service = get_control_plane_service()
    for provider_key, detail in (
        ("antigravity", "Historical Antigravity probe"),
        ("github_copilot", "Historical GitHub Copilot probe"),
        ("claude_code", "Historical Claude Code probe"),
    ):
        service._record_oauth_operation(  # type: ignore[attr-defined]
            provider_key,
            "probe",
            "ok",
            detail,
            "2026-04-22T00:02:00+00:00",
        )

    response = client.get("/admin/providers/product-axis-targets", headers=_admin_headers())
    assert response.status_code == 200
    targets = {item["provider_key"]: item for item in response.json()["targets"]}

    for provider_key in ("antigravity", "github_copilot", "claude_code"):
        target = targets[provider_key]
        assert target["readiness"] == "planned"
        assert target["verify_probe_readiness"] == "planned"
        assert target["evidence"]["live_probe"]["status"] == "observed"
        assert target["status_summary"].startswith("OAuth/account credentials missing.")


def test_admin_oauth_operations_summary_honors_api_key_mode_for_native_targets(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_AUTH_MODE", "api_key")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_API_KEY", "codex-key")
    monkeypatch.delenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", raising=False)
    monkeypatch.setenv("FORGEGATE_GEMINI_AUTH_MODE", "api_key")
    monkeypatch.setenv("FORGEGATE_GEMINI_API_KEY", "gemini-key")
    monkeypatch.delenv("FORGEGATE_GEMINI_OAUTH_ACCESS_TOKEN", raising=False)
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()

    response = client.get("/admin/providers/oauth-account/operations", headers=_admin_headers())
    assert response.status_code == 200
    operations = response.json()["operations"]
    codex = next(item for item in operations if item["provider_key"] == "openai_codex")
    gemini = next(item for item in operations if item["provider_key"] == "gemini")

    assert codex["configured"] is True
    assert gemini["configured"] is True
    assert codex["bridge_profile_enabled"] is False
    assert gemini["bridge_profile_enabled"] is False


def test_admin_provider_truth_and_product_axis_targets_promote_native_oauth_axes_only_after_recorded_evidence(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "token")
    monkeypatch.setenv("FORGEGATE_GEMINI_PROBE_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_GEMINI_OAUTH_ACCESS_TOKEN", "token")
    clear_runtime_dependency_caches()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    service = get_control_plane_service()
    analytics = get_usage_analytics_store()
    proof_client = ClientIdentity(client_id="proof-suite", consumer="tests", integration="pytest")

    analytics.record_non_stream_result(
        ChatDispatchResult(
            model="gpt-5.3-codex",
            provider="openai_codex",
            content="codex-ok",
            finish_reason="tool_calls",
            usage=TokenUsage(input_tokens=5, output_tokens=3, total_tokens=8),
            cost=CostBreakdown(),
            credential_type="oauth_access_token",
            auth_source="codex_oauth_account_bridge",
            tool_calls=[{"id": "call_1", "type": "function", "function": {"name": "lookup", "arguments": "{}"}}],
        ),
        client=proof_client,
    )
    analytics.record_stream_done_event(
        provider="openai_codex",
        model="gpt-5.3-codex",
        event=ProviderStreamEvent(
            event="done",
            finish_reason="tool_calls",
            usage=TokenUsage(input_tokens=5, output_tokens=2, total_tokens=7),
            cost=CostBreakdown(),
            tool_calls=[{"id": "call_1", "type": "function", "function": {"name": "lookup", "arguments": "{}"}}],
            credential_type="oauth_access_token",
            auth_source="codex_oauth_account_bridge",
        ),
        client=proof_client,
    )
    analytics.record_non_stream_result(
        ChatDispatchResult(
            model="gemini-2.5-flash",
            provider="gemini",
            content="gemini-ok",
            finish_reason="tool_calls",
            usage=TokenUsage(input_tokens=4, output_tokens=2, total_tokens=6),
            cost=CostBreakdown(),
            credential_type="oauth_access_token",
            auth_source="gemini_oauth_account_bridge",
            tool_calls=[{"id": "call_1", "type": "function", "function": {"name": "lookup", "arguments": "{}"}}],
        ),
        client=proof_client,
    )
    analytics.record_stream_done_event(
        provider="gemini",
        model="gemini-2.5-flash",
        event=ProviderStreamEvent(
            event="done",
            finish_reason="tool_calls",
            usage=TokenUsage(input_tokens=4, output_tokens=2, total_tokens=6),
            cost=CostBreakdown(),
            tool_calls=[{"id": "call_1", "type": "function", "function": {"name": "lookup", "arguments": "{}"}}],
            credential_type="oauth_access_token",
            auth_source="gemini_oauth_account_bridge",
        ),
        client=proof_client,
    )
    service._record_oauth_operation("openai_codex", "probe", "ok", "Codex bridge probe succeeded.", "2026-04-22T00:00:00+00:00")  # type: ignore[attr-defined]
    service._record_oauth_operation("gemini", "probe", "ok", "Gemini OAuth/account probe succeeded.", "2026-04-22T00:01:00+00:00")  # type: ignore[attr-defined]

    headers = _admin_headers()
    providers_response = client.get("/admin/providers/", headers=headers)
    assert providers_response.status_code == 200
    payload = providers_response.json()

    codex_truth = next(item["runtime"] for item in payload["truth_axes"] if item["provider"]["provider"] == "openai_codex")
    gemini_truth = next(item["runtime"] for item in payload["truth_axes"] if item["provider"]["provider"] == "gemini")
    assert codex_truth["runtime_readiness"] == "ready"
    assert codex_truth["streaming_readiness"] == "ready"
    assert codex_truth["evidence"]["tool_calling"]["status"] == "observed"
    assert gemini_truth["runtime_readiness"] == "ready"
    assert gemini_truth["streaming_readiness"] == "ready"
    assert gemini_truth["evidence"]["tool_calling"]["status"] == "observed"

    axis_targets_response = client.get("/admin/providers/product-axis-targets", headers=headers)
    assert axis_targets_response.status_code == 200
    codex_target = next(item for item in axis_targets_response.json()["targets"] if item["provider_key"] == "openai_codex")
    gemini_target = next(item for item in axis_targets_response.json()["targets"] if item["provider_key"] == "gemini")
    assert codex_target["verify_probe_readiness"] == "ready"
    assert codex_target["evidence"]["live_probe"]["status"] == "observed"
    assert gemini_target["verify_probe_readiness"] == "ready"
    assert gemini_target["evidence"]["live_probe"]["status"] == "observed"

    matrix_response = client.get("/admin/providers/compatibility-matrix", headers=headers)
    assert matrix_response.status_code == 200
    matrix = matrix_response.json()["matrix"]
    codex_row = next(item for item in matrix if item["provider"] == "openai_codex")
    gemini_row = next(item for item in matrix if item["provider"] == "gemini")
    assert codex_row["runtime_readiness"] == "ready"
    assert codex_row["streaming_readiness"] == "ready"
    assert codex_row["evidence"]["tool_calling"]["status"] == "observed"
    assert gemini_row["runtime_readiness"] == "ready"
    assert gemini_row["streaming_readiness"] == "ready"
    assert gemini_row["evidence"]["tool_calling"]["status"] == "observed"


def test_admin_oauth_account_probe_endpoint_available() -> None:
    response = client.post("/admin/providers/oauth-account/probe/gemini", json={}, headers=_admin_headers())
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["probe"]["provider_key"] == "gemini"


def test_admin_oauth_account_targets_and_bridge_sync_endpoints_available() -> None:
    headers = _admin_headers()
    targets_response = client.get("/admin/providers/oauth-account/targets", headers=headers)
    assert targets_response.status_code == 200
    targets_payload = targets_response.json()
    assert targets_payload["status"] == "ok"
    assert any(item["provider_key"] == "antigravity" for item in targets_payload["targets"])

    sync_response = client.post("/admin/providers/oauth-account/bridge-profiles/sync", json={}, headers=headers)
    assert sync_response.status_code == 200
    sync_payload = sync_response.json()
    assert sync_payload["status"] == "ok"
    assert "upserted_profiles" in sync_payload


def test_admin_dashboard_and_security_modules_available() -> None:
    headers = _admin_headers()
    dashboard = client.get("/admin/dashboard/", headers=headers)
    assert dashboard.status_code == 200
    assert "kpis" in dashboard.json()

    accounts = client.get("/admin/accounts/", headers=headers)
    assert accounts.status_code == 200
    assert "accounts" in accounts.json()

    keys = client.get("/admin/keys/", headers=headers)
    assert keys.status_code == 200
    assert "keys" in keys.json()

    settings = client.get("/admin/settings/", headers=headers)
    assert settings.status_code == 200
    assert "settings" in settings.json()

    logs = client.get("/admin/logs/", headers=headers)
    assert logs.status_code == 200
    assert "audit_preview" in logs.json()
