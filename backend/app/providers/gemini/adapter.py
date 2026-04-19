"""Gemini adapter with explicit OAuth/account readiness semantics."""

from collections.abc import Iterator

from app.auth.oauth.gemini import resolve_gemini_auth_state
from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderCapabilities,
    ProviderConfigurationError,
    ProviderNotImplementedError,
    ProviderStreamEvent,
)
from app.settings.config import Settings


class GeminiAdapter:
    provider_name = "gemini"

    def __init__(self, settings: Settings):
        self._settings = settings
        self.capabilities = ProviderCapabilities(
            streaming=True,
            tool_calling=True,
            vision=True,
            external=True,
            oauth_required=True,
            discovery_support=True,
            provider_axis="oauth_account",
            auth_mechanism="hybrid_oauth_api_key",
            verify_support=True,
            probe_support=True,
        )

    def is_ready(self) -> bool:
        return self.readiness_reason() is None

    def readiness_reason(self) -> str | None:
        auth_state = resolve_gemini_auth_state(self._settings)
        if auth_state.ready:
            return "Gemini account/auth is configured; runtime bridge remains beta-scaffold."
        if auth_state.auth_mode == "oauth":
            return (
                "Gemini OAuth/account mode requires FORGEGATE_GEMINI_OAUTH_ACCESS_TOKEN. "
                "Only auth/readiness semantics are currently implemented."
            )
        return "Gemini API-key mode selected but FORGEGATE_GEMINI_API_KEY is missing."

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        if not self.is_ready():
            raise ProviderConfigurationError(self.provider_name, self.readiness_reason() or "Gemini not ready")
        raise ProviderNotImplementedError(self.provider_name)

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        if not self.is_ready():
            raise ProviderConfigurationError(self.provider_name, self.readiness_reason() or "Gemini not ready")
        raise ProviderNotImplementedError(self.provider_name)
