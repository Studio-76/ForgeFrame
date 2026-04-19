"""Provider adapter contracts for ForgeGate runtime dispatch."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Literal, Protocol

from pydantic import BaseModel, Field

from app.providers.axes import AuthMechanism, ProviderAxis
from app.usage.models import CostBreakdown, TokenUsage


class ProviderCapabilities(BaseModel):
    streaming: bool = False
    tool_calling: bool = False
    vision: bool = False
    external: bool = True
    oauth_required: bool = False
    discovery_support: bool = False
    provider_axis: ProviderAxis = "openai_compatible_provider"
    auth_mechanism: AuthMechanism = "api_key"
    verify_support: bool = False
    probe_support: bool = False


class ChatDispatchRequest(BaseModel):
    model: str
    messages: list[dict]
    stream: bool = False
    request_metadata: dict[str, str] = Field(default_factory=dict)


class ChatDispatchResult(BaseModel):
    model: str
    provider: str
    content: str
    finish_reason: str = "stop"
    usage: TokenUsage = Field(default_factory=TokenUsage)
    cost: CostBreakdown = Field(default_factory=CostBreakdown)
    credential_type: str = "internal"
    auth_source: str = "internal"


class ProviderStreamEvent(BaseModel):
    event: Literal["delta", "done", "error"]
    delta: str = ""
    finish_reason: str | None = None
    error_type: str | None = None
    error_message: str | None = None
    usage: TokenUsage | None = None
    cost: CostBreakdown | None = None


class ProviderAdapter(Protocol):
    provider_name: str
    capabilities: ProviderCapabilities

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        """Dispatch a non-stream chat completion request to an upstream provider."""

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        """Dispatch a stream chat completion request to an upstream provider."""

    def is_ready(self) -> bool:
        """Return whether this adapter is currently configured for runtime use."""

    def readiness_reason(self) -> str | None:
        """Return the current not-ready reason if known."""


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


class ProviderUnsupportedFeatureError(ProviderError):
    def __init__(self, provider: str, feature: str):
        super().__init__(
            provider=provider,
            error_type="provider_unsupported_feature",
            message=f"Provider '{provider}' does not support feature '{feature}'.",
        )


class ProviderNotReadyError(ProviderError):
    def __init__(self, provider: str, reason: str | None = None):
        message = f"Provider '{provider}' is not ready for runtime use."
        if reason:
            message = f"{message} {reason}"
        super().__init__(provider=provider, error_type="provider_not_ready", message=message)


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


class ProviderStreamInterruptedError(ProviderError):
    def __init__(self, provider: str, message: str):
        super().__init__(provider=provider, error_type="provider_stream_interrupted", message=message)
