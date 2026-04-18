"""OpenAI Codex adapter scaffold for ForgeGate phase-3 core."""

from app.providers.base import ChatDispatchRequest, ChatDispatchResult, ProviderNotImplementedError


class OpenAICodexAdapter:
    provider_name = "openai_codex"

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        raise ProviderNotImplementedError(
            f"Provider '{self.provider_name}' dispatch is not implemented yet."
        )
