"""Gemini adapter scaffold for ForgeGate phase-4 core."""

from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderCapabilities,
    ProviderNotImplementedError,
)


class GeminiAdapter:
    provider_name = "gemini"
    capabilities = ProviderCapabilities(streaming=True, tool_calling=True, vision=True, external=True)

    def is_ready(self) -> bool:
        return False

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        raise ProviderNotImplementedError(self.provider_name)
