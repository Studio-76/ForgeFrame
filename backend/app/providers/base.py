"""Provider adapter contracts for ForgeFrame runtime dispatch."""

from __future__ import annotations

import base64
import struct
from collections.abc import Iterator, Mapping
from typing import Literal, Protocol

from pydantic import BaseModel, Field

from app.providers.axes import AuthMechanism, ProviderAxis
from app.usage.models import CostBreakdown, TokenUsage


class ProviderCapabilities(BaseModel):
    streaming: bool = False
    tool_calling: bool = False
    vision: bool = False
    embeddings: bool = False
    external: bool = True
    oauth_required: bool = False
    discovery_support: bool = False
    provider_axis: ProviderAxis = "openai_compatible_provider"
    auth_mechanism: AuthMechanism = "api_key"
    verify_support: bool = False
    probe_support: bool = False
    tool_calling_level: Literal["none", "partial", "full"] = "none"


class ChatDispatchRequest(BaseModel):
    model: str
    messages: list[dict]
    stream: bool = False
    tools: list[dict] = Field(default_factory=list)
    tool_choice: str | dict | None = None
    request_metadata: dict[str, str] = Field(default_factory=dict)
    response_controls: dict[str, object] = Field(default_factory=dict)


class ChatDispatchResult(BaseModel):
    model: str
    provider: str
    content: str
    finish_reason: str = "stop"
    usage: TokenUsage = Field(default_factory=TokenUsage)
    cost: CostBreakdown = Field(default_factory=CostBreakdown)
    credential_type: str = "internal"
    auth_source: str = "internal"
    tool_calls: list[dict] = Field(default_factory=list)


class EmbeddingDispatchRequest(BaseModel):
    model: str
    input_items: list[object] = Field(default_factory=list)
    encoding_format: Literal["float", "base64"] = "float"
    dimensions: int | None = None
    request_metadata: dict[str, str] = Field(default_factory=dict)


class EmbeddingDispatchResult(BaseModel):
    model: str
    provider: str
    embeddings: list[object] = Field(default_factory=list)
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
    tool_calls: list[dict] = Field(default_factory=list)
    credential_type: str | None = None
    auth_source: str | None = None


def openai_compatible_response_controls(response_controls: Mapping[str, object] | None) -> dict[str, object]:
    """Map response-style controls into chat-completions-compatible fields."""

    if not response_controls:
        return {}

    controls: dict[str, object] = {}
    if response_controls.get("temperature") is not None:
        controls["temperature"] = response_controls["temperature"]
    if response_controls.get("max_output_tokens") is not None:
        controls["max_tokens"] = response_controls["max_output_tokens"]
    metadata = response_controls.get("metadata")
    if isinstance(metadata, dict) and metadata:
        controls["metadata"] = metadata
    response_format = response_controls.get("response_format")
    if isinstance(response_format, dict) and response_format:
        controls["response_format"] = dict(response_format)
    return controls


def floats_to_base64_embedding(values: list[float]) -> str:
    """Encode an embedding vector into an OpenAI-style base64 payload."""

    packed = struct.pack(f"<{len(values)}f", *values)
    return base64.b64encode(packed).decode("ascii")


class ProviderAdapter(Protocol):
    provider_name: str
    capabilities: ProviderCapabilities

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        """Dispatch a non-stream chat completion request to an upstream provider."""

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        """Dispatch a stream chat completion request to an upstream provider."""

    def create_embeddings(self, request: EmbeddingDispatchRequest) -> EmbeddingDispatchResult:
        """Dispatch an embeddings request to an upstream provider."""

    def is_ready(self) -> bool:
        """Return whether this adapter is currently configured for runtime use."""

    def readiness_reason(self) -> str | None:
        """Return the current not-ready reason if known."""


class ProviderError(RuntimeError):
    def __init__(
        self,
        *,
        provider: str,
        error_type: str,
        message: str,
        upstream_status_code: int | None = None,
        retryable: bool = False,
    ):
        self.provider = provider
        self.error_type = error_type
        self.upstream_status_code = upstream_status_code
        self.retryable = retryable
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


class ProviderModelNotFoundError(ProviderError):
    def __init__(self, provider: str, model: str | None = None, message: str | None = None):
        if not message:
            message = f"Provider '{provider}' could not find requested model."
            if model:
                message = f"Provider '{provider}' could not find requested model '{model}'."
        super().__init__(provider=provider, error_type="provider_model_not_found", message=message, upstream_status_code=404)


class ProviderValidationError(ProviderError):
    def __init__(self, provider: str, message: str):
        super().__init__(provider=provider, error_type="provider_validation_error", message=message)


class ProviderUpstreamError(ProviderError):
    def __init__(self, provider: str, message: str):
        super().__init__(provider=provider, error_type="provider_upstream_error", message=message, retryable=True)


class ProviderRateLimitError(ProviderError):
    def __init__(self, provider: str, message: str, *, upstream_status_code: int = 429, retry_after_seconds: int | None = None):
        self.retry_after_seconds = retry_after_seconds
        super().__init__(provider=provider, error_type="provider_rate_limited", message=message, upstream_status_code=upstream_status_code, retryable=True)


class ProviderConflictError(ProviderError):
    def __init__(self, provider: str, message: str, *, upstream_status_code: int = 409):
        super().__init__(provider=provider, error_type="provider_conflict", message=message, upstream_status_code=upstream_status_code)


class ProviderTimeoutError(ProviderError):
    def __init__(self, provider: str, message: str):
        super().__init__(provider=provider, error_type="provider_timeout", message=message, retryable=True)


class ProviderRequestTimeoutError(ProviderError):
    def __init__(self, provider: str, message: str):
        super().__init__(provider=provider, error_type="provider_request_timeout", message=message, upstream_status_code=408, retryable=True)


class ProviderProtocolError(ProviderError):
    def __init__(self, provider: str, message: str):
        super().__init__(provider=provider, error_type="provider_protocol_error", message=message)


class ProviderResourceGoneError(ProviderError):
    def __init__(self, provider: str, message: str):
        super().__init__(provider=provider, error_type="provider_resource_gone", message=message, upstream_status_code=410)


class ProviderPayloadTooLargeError(ProviderError):
    def __init__(self, provider: str, message: str):
        super().__init__(provider=provider, error_type="provider_payload_too_large", message=message, upstream_status_code=413)


class ProviderUnsupportedMediaTypeError(ProviderError):
    def __init__(self, provider: str, message: str):
        super().__init__(provider=provider, error_type="provider_unsupported_media_type", message=message, upstream_status_code=415)


class ProviderUnavailableError(ProviderError):
    def __init__(self, provider: str, message: str):
        super().__init__(provider=provider, error_type="provider_unavailable", message=message, upstream_status_code=503, retryable=True)


class ProviderStreamInterruptedError(ProviderError):
    def __init__(self, provider: str, message: str):
        super().__init__(provider=provider, error_type="provider_stream_interrupted", message=message)
