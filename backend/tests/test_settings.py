import pytest

from app.core.model_registry import ModelRegistry
from app.settings.config import Settings, get_settings


def _clear_default_setting_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in (
        "FORGEGATE_RUNTIME_AUTH_REQUIRED",
        "FORGEFRAME_RUNTIME_AUTH_REQUIRED",
        "FORGEGATE_HARNESS_STORAGE_BACKEND",
        "FORGEFRAME_HARNESS_STORAGE_BACKEND",
        "FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND",
        "FORGEFRAME_CONTROL_PLANE_STORAGE_BACKEND",
        "FORGEGATE_OBSERVABILITY_STORAGE_BACKEND",
        "FORGEFRAME_OBSERVABILITY_STORAGE_BACKEND",
        "FORGEGATE_GOVERNANCE_STORAGE_BACKEND",
        "FORGEFRAME_GOVERNANCE_STORAGE_BACKEND",
        "FORGEGATE_INSTANCES_STORAGE_BACKEND",
        "FORGEFRAME_INSTANCES_STORAGE_BACKEND",
        "FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD",
        "FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD",
        "FORGEGATE_HARNESS_POSTGRES_URL",
        "FORGEFRAME_HARNESS_POSTGRES_URL",
    ):
        monkeypatch.delenv(key, raising=False)


def _build_default_settings(monkeypatch: pytest.MonkeyPatch, **overrides) -> Settings:
    _clear_default_setting_overrides(monkeypatch)
    return Settings(
        bootstrap_admin_password="ForgeFrame-Settings-Secret-123",
        harness_postgres_url="postgresql+psycopg://forgeframe:secret@localhost:5432/forgeframe",
        **overrides,
    )


def test_settings_load_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = _build_default_settings(monkeypatch)
    assert settings.app_name.startswith("ForgeFrame")
    assert settings.api_base == "/v1"
    assert settings.runtime_auth_required is True


def test_get_settings_is_cached() -> None:
    a = get_settings()
    b = get_settings()
    assert a is b


def test_provider_enabled_flag_filters_catalog(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = _build_default_settings(monkeypatch, openai_api_enabled=False)
    registry = ModelRegistry(settings)
    assert not registry.has_model("gpt-4.1-mini")


def test_default_model_is_baseline_phase5(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = _build_default_settings(monkeypatch)
    assert settings.default_model == "forgeframe-baseline-chat-v1"


def test_codex_auth_mode_defaults_to_oauth(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = _build_default_settings(monkeypatch)
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


def test_pricing_settings_are_operationalized(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = _build_default_settings(monkeypatch)
    assert settings.pricing_openai_input_per_1m_tokens > 0
    assert settings.pricing_internal_hypothetical_output_per_1m_tokens > 0


def test_security_lifecycle_defaults_are_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = _build_default_settings(monkeypatch)
    assert settings.runtime_key_ttl_days >= 30
    assert settings.impersonation_session_max_minutes <= settings.break_glass_session_max_minutes
    assert settings.admin_login_rate_limit_attempts >= 1


def test_governance_postgres_defaults_to_relational_reads(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = _build_default_settings(monkeypatch)
    assert settings.harness_storage_backend == "postgresql"
    assert settings.governance_storage_backend == "postgresql"
    assert settings.governance_relational_dual_write_enabled is True
    assert settings.governance_relational_reads_enabled is True


def test_postgres_storage_requires_postgresql_url() -> None:
    with pytest.raises(ValueError, match="FORGEFRAME_HARNESS_POSTGRES_URL"):
        Settings(harness_storage_backend="postgresql", harness_postgres_url="sqlite:///tmp/forgegate.db")


def test_admin_auth_requires_bootstrap_password() -> None:
    with pytest.raises(ValueError, match="FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD"):
        Settings(admin_auth_enabled=True, bootstrap_admin_password="   ")
