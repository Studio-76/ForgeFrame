"""OpenAI Codex adapter with honest phase-5 readiness/auth/discovery semantics."""

from collections.abc import Iterator

from app.auth.oauth.openai import resolve_codex_auth_state
from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderCapabilities,
    ProviderConfigurationError,
    ProviderNotImplementedError,
    ProviderStreamEvent,
)
from app.settings.config import Settings


class OpenAICodexAdapter:
    provider_name = "openai_codex"

    def __init__(self, settings: Settings):
        self._settings = settings
        oauth_required = settings.openai_codex_auth_mode == "oauth"
        self.capabilities = ProviderCapabilities(
            streaming=False,
            tool_calling=True,
            vision=False,
            external=True,
            oauth_required=oauth_required,
            discovery_support=True,
        )

    def is_ready(self) -> bool:
        return self.readiness_reason() is None

    def readiness_reason(self) -> str | None:
        auth_state = resolve_codex_auth_state(self._settings)
        if not auth_state.ready:
            if auth_state.auth_mode == "oauth":
                return (
                    "OpenAI Codex requires OAuth access token for mode "
                    f"'{auth_state.oauth_mode}'. "
                    "Supported mode naming: browser callback, manual redirect completion, device/hosted code. "
                    "Only credential presence + readiness semantics are implemented in phase 5."
                )
            return "OpenAI Codex API-key mode selected but FORGEGATE_OPENAI_CODEX_API_KEY is missing."

        if self._settings.openai_codex_discovery_required and not self._settings.openai_codex_discovery_enabled:
            return "OpenAI Codex discovery is required but FORGEGATE_OPENAI_CODEX_DISCOVERY_ENABLED is false."
        return None

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        reason = self.readiness_reason()
        if reason:
            raise ProviderConfigurationError(self.provider_name, reason)
        raise ProviderNotImplementedError(self.provider_name)

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        reason = self.readiness_reason()
        if reason:
            raise ProviderConfigurationError(self.provider_name, reason)
        raise ProviderNotImplementedError(self.provider_name)
