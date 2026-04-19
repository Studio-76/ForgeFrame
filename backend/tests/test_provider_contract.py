from app.auth.oauth.openai import resolve_codex_auth_state
from app.auth.oauth.gemini import resolve_gemini_auth_state
from app.providers.base import (
    ProviderCapabilities,
    ProviderConfigurationError,
    ProviderNotImplementedError,
    ProviderNotReadyError,
    ProviderStreamInterruptedError,
    ProviderUnsupportedFeatureError,
)
from app.providers.forgegate_baseline import ForgeGateBaselineAdapter
from app.providers.openai_api.adapter import OpenAIAPIAdapter
from app.providers.openai_codex.adapter import OpenAICodexAdapter
from app.settings.config import Settings
from app.usage.models import TokenUsage
from app.usage.service import UsageAccountingService


def test_baseline_provider_capabilities_are_declared() -> None:
    adapter = ForgeGateBaselineAdapter()
    assert isinstance(adapter.capabilities, ProviderCapabilities)
    assert adapter.capabilities.streaming is True
    assert adapter.capabilities.external is False


def test_openai_provider_capabilities_and_readiness() -> None:
    adapter = OpenAIAPIAdapter(Settings(openai_api_key="abc"))
    assert adapter.capabilities.external is True
    assert adapter.capabilities.streaming is True
    assert adapter.is_ready() is True


def test_not_implemented_error_has_structured_metadata() -> None:
    error = ProviderNotImplementedError("openai_api")
    assert error.provider == "openai_api"
    assert error.error_type == "provider_not_implemented"


def test_provider_error_types_for_new_semantics() -> None:
    assert ProviderUnsupportedFeatureError("openai", "stream").error_type == "provider_unsupported_feature"
    assert ProviderNotReadyError("openai").error_type == "provider_not_ready"
    assert ProviderStreamInterruptedError("openai", "boom").error_type == "provider_stream_interrupted"


def test_codex_auth_state_resolution() -> None:
    settings = Settings(
        openai_codex_auth_mode="oauth",
        openai_codex_oauth_mode="device_hosted_code",
        openai_codex_oauth_access_token="token",
    )
    state = resolve_codex_auth_state(settings)
    assert state.auth_mode == "oauth"
    assert state.oauth_mode == "device_hosted_code"
    assert state.ready is True
    assert state.credential_type == "oauth_access_token"


def test_codex_adapter_reports_not_ready_without_credentials() -> None:
    adapter = OpenAICodexAdapter(Settings(openai_codex_auth_mode="oauth", openai_codex_oauth_access_token=""))
    assert adapter.is_ready() is False
    assert "requires OAuth access token" in (adapter.readiness_reason() or "")


def test_usage_accounting_service_supports_actual_and_avoided_cost_axes() -> None:
    usage_service = UsageAccountingService(Settings())
    usage = TokenUsage(input_tokens=1000, output_tokens=500, total_tokens=1500)

    openai_cost = usage_service.costs_for_provider(provider="openai_api", usage=usage)
    codex_cost = usage_service.costs_for_provider(provider="openai_codex", usage=usage, oauth_mode=True)

    assert openai_cost.actual_cost > 0
    assert codex_cost.actual_cost == 0
    assert codex_cost.hypothetical_cost > 0
    assert codex_cost.avoided_cost == codex_cost.hypothetical_cost


def test_provider_configuration_error_type() -> None:
    error = ProviderConfigurationError("openai_api", "missing key")
    assert error.error_type == "provider_configuration_error"


def test_gemini_auth_state_resolution() -> None:
    settings = Settings(gemini_auth_mode="oauth", gemini_oauth_access_token="token")
    state = resolve_gemini_auth_state(settings)
    assert state.auth_mode == "oauth"
    assert state.ready is True
    assert state.credential_type == "oauth_access_token"
