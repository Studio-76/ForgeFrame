"""Provider adapter contracts for ForgeGate runtime dispatch."""

from typing import Protocol

from pydantic import BaseModel


class ChatDispatchRequest(BaseModel):
    model: str
    messages: list[dict]
    stream: bool = False


class ChatDispatchResult(BaseModel):
    model: str
    provider: str
    content: str


class ProviderAdapter(Protocol):
    provider_name: str

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        """Dispatch a chat completion request to an upstream provider."""


class ProviderNotImplementedError(NotImplementedError):
    """Raised when adapter exists but no runtime implementation is available yet."""
