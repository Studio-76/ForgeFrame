from pathlib import Path

from app.control_plane.models import ControlPlaneStateRecord, HealthStatusRecord
from app.core.model_registry import ModelRegistry
from app.core.routing import RoutingService
from app.providers import ProviderRegistry
from app.settings.config import Settings


def test_routing_service_uses_smart_default_fallback_when_default_model_provider_not_ready(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STATE_PATH", str(tmp_path / "control_plane_state.json"))

    settings = Settings(default_model="gpt-4.1-mini", default_provider="openai_api", ollama_enabled=False, generic_harness_enabled=False)
    registry = ModelRegistry(settings)
    providers = ProviderRegistry(settings)
    routing = RoutingService(registry, providers, settings)

    decision = routing.resolve_model(None)

    assert decision.fallback_used is True
    assert decision.reason == "smart_default_fallback"
    assert decision.resolved_model.provider == "forgegate_baseline"


def test_routing_service_keeps_requested_model_strict_even_if_not_ready(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STATE_PATH", str(tmp_path / "control_plane_state.json"))

    settings = Settings()
    registry = ModelRegistry(settings)
    providers = ProviderRegistry(settings)
    routing = RoutingService(registry, providers, settings)

    decision = routing.resolve_model("gpt-5.3-codex")

    assert decision.reason == "requested_model_strict"
    assert decision.fallback_used is False
    assert decision.resolved_model.provider == "openai_codex"


def test_routing_service_skips_codex_for_default_selection_when_bridge_is_disabled(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STATE_PATH", str(tmp_path / "control_plane_state.json"))

    settings = Settings(
        default_model="gpt-5.3-codex",
        default_provider="openai_codex",
        openai_codex_oauth_access_token="token",
        openai_codex_bridge_enabled=False,
        ollama_enabled=False,
        generic_harness_enabled=False,
    )
    registry = ModelRegistry(settings)
    providers = ProviderRegistry(settings)
    routing = RoutingService(registry, providers, settings)

    decision = routing.resolve_model(None)

    assert decision.resolved_model.provider == "forgegate_baseline"
    assert decision.reason == "smart_default_fallback"
    assert decision.fallback_used is True


def test_routing_service_uses_capability_match_for_default_selection(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STATE_PATH", str(tmp_path / "control_plane_state.json"))

    settings = Settings(
        default_model="forgegate-baseline-chat-v1",
        default_provider="forgegate_baseline",
        openai_api_key="test-key",
    )
    registry = ModelRegistry(settings)
    providers = ProviderRegistry(settings)
    routing = RoutingService(registry, providers, settings)

    decision = routing.resolve_model(None, tools=[{"type": "function", "function": {"name": "ping"}}])

    assert decision.resolved_model.provider == "openai_api"
    assert decision.reason == "smart_default_fallback"
    assert decision.fallback_used is True


def test_routing_service_uses_capability_match_for_default_selection_when_vision_is_required(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STATE_PATH", str(tmp_path / "control_plane_state.json"))

    settings = Settings(
        default_model="forgegate-baseline-chat-v1",
        default_provider="forgegate_baseline",
        openai_api_key="test-key",
    )
    registry = ModelRegistry(settings)
    providers = ProviderRegistry(settings)
    routing = RoutingService(registry, providers, settings)

    decision = routing.resolve_model(None, require_vision=True)

    assert decision.resolved_model.provider == "openai_api"
    assert decision.reason == "smart_default_fallback"
    assert decision.fallback_used is True
    assert decision.requirement["vision"] is True


def test_routing_service_excludes_anthropic_models_from_runtime_inventory_when_base_url_is_invalid(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STATE_PATH", str(tmp_path / "control_plane_state.json"))

    settings = Settings(
        forgegate_baseline_enabled=False,
        openai_api_enabled=False,
        openai_codex_enabled=False,
        gemini_enabled=False,
        anthropic_enabled=True,
        generic_harness_enabled=False,
        ollama_enabled=False,
        default_model="claude-3-5-sonnet-latest",
        default_provider="anthropic",
        anthropic_api_key="anthropic-key",
        anthropic_base_url="not-a-url",
    )
    registry = ModelRegistry(settings)
    providers = ProviderRegistry(settings)
    routing = RoutingService(registry, providers, settings)

    assert [model.id for model in routing.list_runtime_usable_models()] == []


class _StubStateRepository:
    def __init__(self, statuses: list[tuple[str, str, str]]):
        self._statuses = statuses

    def load_state(self) -> ControlPlaneStateRecord:
        return ControlPlaneStateRecord(
            health_records=[
                HealthStatusRecord(
                    provider=provider,
                    model=model,
                    check_type="provider",
                    status=status,  # type: ignore[arg-type]
                )
                for provider, model, status in self._statuses
            ]
        )


def test_routing_service_respects_health_gate_before_default_preference(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STATE_PATH", str(tmp_path / "control_plane_state.json"))

    settings = Settings(
        default_model="gpt-4.1-mini",
        default_provider="openai_api",
        openai_api_key="test-key",
        routing_require_healthy=True,
        ollama_enabled=False,
        generic_harness_enabled=False,
    )
    registry = ModelRegistry(settings)
    providers = ProviderRegistry(settings)
    routing = RoutingService(
        registry,
        providers,
        settings,
        state_repository=_StubStateRepository(
            [
                ("openai_api", "gpt-4.1-mini", "degraded"),
                ("openai_api", "gpt-4.1", "degraded"),
            ]
        ),
    )

    decision = routing.resolve_model(None)

    assert decision.resolved_model.provider == "forgegate_baseline"
    assert decision.selection_basis["routing_require_healthy"] is True


def test_routing_service_can_fallback_to_degraded_ready_candidate_when_enabled(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STATE_PATH", str(tmp_path / "control_plane_state.json"))

    settings = Settings(
        forgegate_baseline_enabled=False,
        default_model="gpt-4.1-mini",
        default_provider="openai_api",
        openai_api_key="test-key",
        routing_require_healthy=True,
        routing_allow_degraded_fallback=True,
        routing_strategy="cost",
        ollama_enabled=False,
        generic_harness_enabled=False,
    )
    registry = ModelRegistry(settings)
    providers = ProviderRegistry(settings)
    routing = RoutingService(
        registry,
        providers,
        settings,
        state_repository=_StubStateRepository(
            [
                ("openai_api", "gpt-4.1-mini", "degraded"),
                ("openai_api", "gpt-4.1", "degraded"),
            ]
        ),
    )

    decision = routing.resolve_model(None)

    assert decision.resolved_model.provider == "openai_api"
    assert decision.selection_basis["routing_strategy"] == "cost"
