"""Provider adapter contracts for ForgeGate runtime dispatch."""

from typing import Protocol

from pydantic import BaseModel


class ProviderCapabilities(BaseModel):
    streaming: bool = False
    tool_calling: bool = False
    vision: bool = False


class ChatDispatchRequest(BaseModel):
    model: str
    messages: list[dict]
    stream: bool = False


class ChatDispatchResult(BaseModel):
    model: str
    provider: str
    content: str
    finish_reason: str = "stop"


class ProviderAdapter(Protocol):
    provider_name: str
    capabilities: ProviderCapabilities

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        """Dispatch a chat completion request to an upstream provider."""


class ProviderError(RuntimeError):
    def __init__(self, *, provider: str, error_type: str, message: str):
        self.provider = provider
        self.error_type = error_type
        super().__init__(message)


class ProviderNotImplementedError(ProviderError):
    """Raised when adapter exists but no runtime implementation is available yet."""

    def __init__(self, provider: str):
        super().__init__(
            provider=provider,
            error_type="provider_not_implemented",
            message=f"Provider '{provider}' dispatch is not implemented yet.",
        )
