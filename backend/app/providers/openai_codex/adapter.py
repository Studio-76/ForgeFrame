"""OpenAI Codex adapter scaffold for ForgeGate phase-3 core."""

from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderCapabilities,
    ProviderNotImplementedError,
)


class OpenAICodexAdapter:
    provider_name = "openai_codex"
    capabilities = ProviderCapabilities(streaming=True, tool_calling=True, vision=False)

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        raise ProviderNotImplementedError(self.provider_name)
