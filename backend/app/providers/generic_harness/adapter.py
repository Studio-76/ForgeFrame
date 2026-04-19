"""Generic harness-backed provider adapter for simple OpenAI-compatible or templated providers."""

from __future__ import annotations

from collections.abc import Iterator

from app.harness.service import HarnessService
from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderBadRequestError,
    ProviderCapabilities,
    ProviderConflictError,
    ProviderConfigurationError,
    ProviderNotReadyError,
    ProviderPayloadTooLargeError,
    ProviderProtocolError,
    ProviderRateLimitError,
    ProviderResourceGoneError,
    ProviderStreamEvent,
    ProviderStreamInterruptedError,
    ProviderUnsupportedFeatureError,
    ProviderUnavailableError,
    ProviderUnsupportedMediaTypeError,
    ProviderAuthenticationError,
    ProviderTimeoutError,
    ProviderUpstreamError,
)
from app.settings.config import Settings
from app.usage.models import TokenUsage
from app.usage.service import UsageAccountingService


class GenericHarnessAdapter:
    provider_name = "generic_harness"
    capabilities = ProviderCapabilities(
        streaming=True,
        tool_calling=True,
        tool_calling_level="partial",
        vision=False,
        external=True,
        discovery_support=True,
        provider_axis="openai_compatible_provider",
        auth_mechanism="api_key",
        verify_support=True,
        probe_support=True,
    )

    def __init__(self, settings: Settings, harness: HarnessService):
        self._settings = settings
        self._harness = harness
        self._usage = UsageAccountingService(settings)

    def is_ready(self) -> bool:
        active_profiles = [profile for profile in self._harness.list_profiles() if profile.enabled]
        return bool(self._settings.generic_harness_enabled and active_profiles)

    def readiness_reason(self) -> str | None:
        if not self._settings.generic_harness_enabled:
            return "FORGEGATE_GENERIC_HARNESS_ENABLED=false"
        if not self._harness.list_profiles():
            return "No harness provider profile configured in control plane."
        if not [profile for profile in self._harness.list_profiles() if profile.enabled]:
            return "Harness profiles exist but all are disabled."
        return None

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        if not self.is_ready():
            raise ProviderConfigurationError(self.provider_name, self.readiness_reason() or "Harness not ready")
        profile = self._profile_for_model(request.model)
        if getattr(request, "tools", []) and not profile.capabilities.tool_calling:
            raise ProviderUnsupportedFeatureError(self.provider_name, "tool_calling")
        try:
            try:
                parsed = self._harness.execute_non_stream(
                    profile.provider_key,
                    model=request.model,
                    messages=request.messages,
                    tools=getattr(request, "tools", []),
                    tool_choice=getattr(request, "tool_choice", None),
                )
            except TypeError:
                parsed = self._harness.execute_non_stream(profile.provider_key, model=request.model, messages=request.messages)
        except RuntimeError as exc:
            raise self._map_harness_error(str(exc)) from exc
        usage = TokenUsage(
            input_tokens=parsed["prompt_tokens"],
            output_tokens=parsed["completion_tokens"],
            total_tokens=parsed["total_tokens"] or parsed["prompt_tokens"] + parsed["completion_tokens"],
        )
        if usage.total_tokens == 0:
            usage = self._usage.usage_from_prompt_completion(request.messages, parsed["content"])
        cost = self._usage.costs_for_provider(provider=self.provider_name, usage=usage)
        return ChatDispatchResult(
            model=str(parsed["model"]),
            provider=self.provider_name,
            content=str(parsed["content"]),
            finish_reason=str(parsed["finish_reason"]),
            usage=usage,
            cost=cost,
            credential_type="harness_template",
            auth_source=profile.integration_class,
            tool_calls=parsed.get("tool_calls", []) if isinstance(parsed.get("tool_calls", []), list) else [],
        )

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        if not self.is_ready():
            raise ProviderConfigurationError(self.provider_name, self.readiness_reason() or "Harness not ready")
        profile = self._profile_for_model(request.model)
        if getattr(request, "tools", []) and not profile.capabilities.tool_calling:
            raise ProviderUnsupportedFeatureError(self.provider_name, "tool_calling")
        if not profile.stream_mapping.enabled:
            raise ProviderUnsupportedFeatureError(self.provider_name, "streaming_not_enabled_in_profile")

        try:
            try:
                stream_iter = self._harness.execute_stream(
                    profile.provider_key,
                    model=request.model,
                    messages=request.messages,
                    tools=getattr(request, "tools", []),
                    tool_choice=getattr(request, "tool_choice", None),
                )
            except TypeError:
                stream_iter = self._harness.execute_stream(profile.provider_key, model=request.model, messages=request.messages)
            for item in stream_iter:
                if item.get("event") == "delta":
                    yield ProviderStreamEvent(event="delta", delta=str(item.get("delta", "")))
                    continue

                usage_payload = item.get("usage", {})
                usage = TokenUsage(
                    input_tokens=int(usage_payload.get("prompt_tokens", 0)),
                    output_tokens=int(usage_payload.get("completion_tokens", 0)),
                    total_tokens=int(usage_payload.get("total_tokens", 0)),
                )
                if usage.total_tokens == 0:
                    usage = self._usage.usage_from_prompt_completion(request.messages, str(item.get("content", "")))
                cost = self._usage.costs_for_provider(provider=self.provider_name, usage=usage)
                yield ProviderStreamEvent(event="done", finish_reason=str(item.get("finish_reason", "stop")), usage=usage, cost=cost)
        except RuntimeError as exc:
            mapped = self._map_harness_error(str(exc))
            raise ProviderStreamInterruptedError(self.provider_name, str(mapped)) from exc

    def _profile_for_model(self, model: str):
        enabled = [profile for profile in self._harness.list_profiles() if profile.enabled]
        for profile in enabled:
            if model in profile.models:
                return profile
        if not enabled:
            raise ProviderConfigurationError(self.provider_name, "No enabled harness profile configured.")
        if not self._settings.generic_harness_allow_model_fallback:
            raise ProviderNotReadyError(self.provider_name, f"No enabled harness profile owns model '{model}'.")
        return enabled[0]

    def _map_harness_error(self, message: str):
        lower = message.lower()
        if "timeout" in lower:
            return ProviderTimeoutError(self.provider_name, message)
        if "(429)" in lower or "rate limit" in lower:
            return ProviderRateLimitError(self.provider_name, message)
        if "(409)" in lower or "conflict" in lower:
            return ProviderConflictError(self.provider_name, message)
        if "decode" in lower or "invalid json" in lower:
            return ProviderProtocolError(self.provider_name, message)
        if "rejected request (400)" in lower or "rejected request (404)" in lower or "rejected request (422)" in lower:
            return ProviderBadRequestError(self.provider_name, message)
        if "rejected request (401)" in lower or "rejected request (403)" in lower:
            return ProviderAuthenticationError(self.provider_name, message)
        if "rejected request (410)" in lower:
            return ProviderResourceGoneError(self.provider_name, message)
        if "rejected request (413)" in lower:
            return ProviderPayloadTooLargeError(self.provider_name, message)
        if "rejected request (415)" in lower:
            return ProviderUnsupportedMediaTypeError(self.provider_name, message)
        if "rejected request (503)" in lower:
            return ProviderUnavailableError(self.provider_name, message)
        return ProviderUpstreamError(self.provider_name, message)
