from pathlib import Path

from app.control_plane import ControlPlaneStateRecord
from app.core.model_registry import ModelRegistry
from app.settings.config import Settings
from app.storage.control_plane_repository import FileControlPlaneStateRepository, ControlPlaneStatePaths


def test_model_registry_default_model_is_available() -> None:
    settings = Settings()
    registry = ModelRegistry(settings)

    default_model = registry.default_model()
    assert default_model.id == settings.default_model
    assert registry.has_model(default_model.id)


def test_model_registry_lists_active_models() -> None:
    settings = Settings()
    registry = ModelRegistry(settings)

    models = registry.list_active_models()
    assert len(models) >= 1
    assert all(model.active for model in models)


def test_model_registry_keeps_anthropic_out_of_runtime_truth_while_disabled() -> None:
    settings = Settings()
    registry = ModelRegistry(settings)

    assert registry.has_model("claude-3-5-sonnet-latest") is False


def test_model_registry_seeds_anthropic_into_runtime_truth_when_enabled() -> None:
    settings = Settings(
        default_model="claude-3-5-sonnet-latest",
        default_provider="anthropic",
        forgeframe_baseline_enabled=False,
        openai_api_enabled=False,
        openai_codex_enabled=False,
        gemini_enabled=False,
        anthropic_enabled=True,
        generic_harness_enabled=False,
        ollama_enabled=False,
    )
    registry = ModelRegistry(settings)

    assert registry.has_model("claude-3-5-sonnet-latest") is True
    assert registry.default_model().provider == "anthropic"


def test_model_registry_falls_back_to_anthropic_probe_model_when_catalog_seed_is_empty() -> None:
    settings = Settings(
        default_model="claude-sonnet-bootstrap",
        default_provider="anthropic",
        forgeframe_baseline_enabled=False,
        openai_api_enabled=False,
        openai_codex_enabled=False,
        gemini_enabled=False,
        anthropic_enabled=True,
        anthropic_probe_model="claude-sonnet-bootstrap",
        anthropic_discovered_models=(),
        generic_harness_enabled=False,
        ollama_enabled=False,
    )
    registry = ModelRegistry(settings)

    assert registry.has_model("claude-sonnet-bootstrap") is True
    assert registry.default_model().id == "claude-sonnet-bootstrap"


def test_model_registry_repairs_persisted_state_with_new_anthropic_bootstrap_models(tmp_path: Path) -> None:
    state_path = tmp_path / "control_plane_state.json"
    state_path.write_text(ControlPlaneStateRecord(providers=[]).model_dump_json(indent=2) + "\n", encoding="utf-8")
    settings = Settings(
        default_model="claude-3-5-sonnet-latest",
        default_provider="anthropic",
        forgeframe_baseline_enabled=False,
        openai_api_enabled=False,
        openai_codex_enabled=False,
        gemini_enabled=False,
        anthropic_enabled=True,
        generic_harness_enabled=False,
        ollama_enabled=False,
        control_plane_storage_backend="file",
        control_plane_state_path=str(state_path),
    )

    registry = ModelRegistry(settings)

    assert registry.has_model("claude-3-5-sonnet-latest") is True
    repaired_state = FileControlPlaneStateRepository(
        paths=ControlPlaneStatePaths(state_path=state_path),
    ).load_state()
    assert repaired_state is not None
    anthropic_provider = next(provider for provider in repaired_state.providers if provider.provider == "anthropic")
    assert {model.id for model in anthropic_provider.managed_models} == {"claude-3-5-sonnet-latest"}


def test_model_registry_prefers_default_provider_when_default_model_missing() -> None:
    settings = Settings(default_model="missing-model", default_provider="openai_api")
    registry = ModelRegistry(settings)
    assert registry.default_model().provider == "openai_api"


def test_model_registry_includes_discovered_codex_models_when_enabled() -> None:
    settings = Settings(
        openai_codex_discovery_enabled=True,
        openai_codex_discovered_models=("gpt-5.3-codex-preview",),
    )
    registry = ModelRegistry(settings)
    assert registry.has_model("gpt-5.3-codex-preview")
    discovered = registry.get_model("gpt-5.3-codex-preview")
    assert discovered is not None
    assert discovered.source == "discovered"


def test_model_registry_builds_runtime_targets_for_active_models() -> None:
    settings = Settings()
    registry = ModelRegistry(settings)

    targets = registry.list_active_targets()

    assert any(target.target_key == "forgeframe_baseline::forgeframe-baseline-chat-v1" for target in targets)
    baseline_target = next(target for target in targets if target.target_key == "forgeframe_baseline::forgeframe-baseline-chat-v1")
    assert baseline_target.model.routing_key == "forgeframe_baseline/forgeframe-baseline-chat-v1"
    assert baseline_target.product_axis == "openai_compatible_clients"
