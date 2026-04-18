"""Provider adapter contracts for ForgeGate runtime dispatch."""

from typing import Protocol

from pydantic import BaseModel


class ProviderCapabilities(BaseModel):
    streaming: bool = False
    tool_calling: bool = False
    vision: bool = False
    external: bool = True


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

    def is_ready(self) -> bool:
        """Return whether this adapter is currently configured for runtime use."""


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


class ProviderConfigurationError(ProviderError):
    def __init__(self, provider: str, message: str):
        super().__init__(provider=provider, error_type="provider_configuration_error", message=message)


class ProviderAuthenticationError(ProviderError):
    def __init__(self, provider: str, message: str):
        super().__init__(provider=provider, error_type="provider_authentication_error", message=message)


class ProviderBadRequestError(ProviderError):
    def __init__(self, provider: str, message: str):
        super().__init__(provider=provider, error_type="provider_bad_request", message=message)


class ProviderUpstreamError(ProviderError):
    def __init__(self, provider: str, message: str):
        super().__init__(provider=provider, error_type="provider_upstream_error", message=message)
