from app.auth.oauth.openai import resolve_codex_auth_state
from app.api.admin.control_plane import get_control_plane_service
from app.auth.oauth.gemini import resolve_gemini_auth_state
from app.providers.base import (
    ChatDispatchRequest,
    ProviderCapabilities,
    ProviderConflictError,
    ProviderConfigurationError,
    ProviderNotImplementedError,
    ProviderNotReadyError,
    ProviderRateLimitError,
    ProviderStreamInterruptedError,
    ProviderTimeoutError,
    ProviderUnsupportedFeatureError,
)
from app.providers.forgegate_baseline import ForgeGateBaselineAdapter
from app.providers.gemini.adapter import GeminiAdapter
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
    assert ProviderRateLimitError("openai", "rl").error_type == "provider_rate_limited"
    assert ProviderConflictError("openai", "conflict").error_type == "provider_conflict"
    assert ProviderTimeoutError("openai", "timeout").error_type == "provider_timeout"


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


def test_codex_bridge_partial_runtime_executes_with_mocked_httpx(monkeypatch) -> None:
    class _MockResponse:
        status_code = 200

        @staticmethod
        def json() -> dict:
            return {
                "model": "gpt-5.3-codex",
                "choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8},
            }

        text = "ok"

    def _mock_post(*args, **kwargs):
        return _MockResponse()

    monkeypatch.setattr("app.providers.openai_codex.adapter.httpx.post", _mock_post)
    adapter = OpenAICodexAdapter(
        Settings(
            openai_codex_auth_mode="oauth",
            openai_codex_oauth_access_token="token",
            openai_codex_bridge_enabled=True,
        )
    )
    result = adapter.create_chat_completion(
        ChatDispatchRequest(model="gpt-5.3-codex", messages=[{"role": "user", "content": "hi"}], stream=False)
    )
    assert result.provider == "openai_codex"
    assert result.content == "ok"


def test_oauth_target_status_for_antigravity_becomes_ready_with_probe_flags() -> None:
    service = get_control_plane_service()
    service._settings.antigravity_oauth_access_token = "token"  # type: ignore[attr-defined]
    service._settings.antigravity_probe_enabled = True  # type: ignore[attr-defined]
    status = service._oauth_target_status("antigravity")
    assert status.configured is True
    assert status.probe_enabled is True
    assert status.readiness == "ready"


def test_gemini_bridge_partial_runtime_executes_with_mocked_httpx(monkeypatch) -> None:
    class _MockResponse:
        status_code = 200
        text = "ok"

        @staticmethod
        def json() -> dict:
            return {
                "model": "gemini-2.5-flash",
                "choices": [{"message": {"content": "gemini-ok"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 4, "completion_tokens": 2, "total_tokens": 6},
            }

    def _mock_post(*args, **kwargs):
        return _MockResponse()

    monkeypatch.setattr("app.providers.gemini.adapter.httpx.post", _mock_post)
    adapter = GeminiAdapter(
        Settings(
            gemini_auth_mode="oauth",
            gemini_oauth_access_token="token",
            gemini_probe_enabled=True,
        )
    )
    result = adapter.create_chat_completion(ChatDispatchRequest(model="gemini-2.5-flash", messages=[{"role": "user", "content": "hi"}], stream=False))
    assert result.provider == "gemini"
    assert result.content == "gemini-ok"
