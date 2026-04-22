import pytest

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
    assert settings.openai_codex_oauth_mode == "manual_redirect_completion"


def test_bridge_only_oauth_targets_do_not_expose_dead_provider_enabled_flags() -> None:
    fields = set(Settings.model_fields)

    assert {"antigravity_enabled", "github_copilot_enabled", "claude_code_enabled"}.isdisjoint(fields)
    assert {
        "antigravity_probe_enabled",
        "antigravity_bridge_profile_enabled",
        "github_copilot_probe_enabled",
        "github_copilot_bridge_profile_enabled",
        "claude_code_probe_enabled",
        "claude_code_bridge_profile_enabled",
    } <= fields


def test_pricing_settings_are_operationalized() -> None:
    settings = Settings()
    assert settings.pricing_openai_input_per_1m_tokens > 0
    assert settings.pricing_internal_hypothetical_output_per_1m_tokens > 0


def test_security_lifecycle_defaults_are_bounded() -> None:
    settings = Settings()
    assert settings.runtime_key_ttl_days >= 30
    assert settings.impersonation_session_max_minutes <= settings.break_glass_session_max_minutes
    assert settings.admin_login_rate_limit_attempts >= 1


def test_postgres_storage_requires_postgresql_url() -> None:
    with pytest.raises(ValueError, match="FORGEGATE_HARNESS_POSTGRES_URL"):
        Settings(harness_storage_backend="postgresql", harness_postgres_url="sqlite:///tmp/forgegate.db")


def test_admin_auth_requires_bootstrap_password() -> None:
    with pytest.raises(ValueError, match="FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"):
        Settings(admin_auth_enabled=True, bootstrap_admin_password="   ")
