"""Gemini adapter scaffold for ForgeGate phase-3 core."""

from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderCapabilities,
    ProviderNotImplementedError,
)


class GeminiAdapter:
    provider_name = "gemini"
    capabilities = ProviderCapabilities(streaming=True, tool_calling=True, vision=True)

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        raise ProviderNotImplementedError(self.provider_name)
