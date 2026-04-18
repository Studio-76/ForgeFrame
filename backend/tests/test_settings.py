from app.core.model_registry import ModelRegistry
from app.settings.config import Settings, get_settings


def test_settings_load_defaults() -> None:
    settings = Settings()
    assert settings.app_name.startswith("ForgeGate")
    assert settings.api_base == "/v1"


def test_get_settings_is_cached() -> None:
    a = get_settings()
    b = get_settings()
    assert a is b


def test_provider_enabled_flag_filters_catalog() -> None:
    settings = Settings(openai_api_enabled=False)
    registry = ModelRegistry(settings)
    assert not registry.has_model("gpt-4.1-mini")


def test_default_model_is_baseline_phase5() -> None:
    settings = Settings()
    assert settings.default_model == "forgegate-baseline-chat-v1"


def test_codex_auth_mode_defaults_to_oauth() -> None:
    settings = Settings()
    assert settings.openai_codex_auth_mode == "oauth"
