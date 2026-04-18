"""Anthropic adapter scaffold for ForgeGate phase-5 core."""

from collections.abc import Iterator

from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderCapabilities,
    ProviderNotImplementedError,
    ProviderStreamEvent,
)


class AnthropicAdapter:
    provider_name = "anthropic"
    capabilities = ProviderCapabilities(streaming=True, tool_calling=True, vision=True, external=True)

    def is_ready(self) -> bool:
        return False

    def readiness_reason(self) -> str | None:
        return "Anthropic provider is not configured in phase 5."

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        raise ProviderNotImplementedError(self.provider_name)

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        raise ProviderNotImplementedError(self.provider_name)
