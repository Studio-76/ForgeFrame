"""Generic harness-backed provider adapter for simple OpenAI-compatible or templated providers."""

from __future__ import annotations

from collections.abc import Iterator
from inspect import Parameter, signature
from typing import Any

from app.harness.service import HarnessService
from app.core.message_features import messages_require_vision
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
    ProviderRequestTimeoutError,
    ProviderResourceGoneError,
    ProviderStreamEvent,
    ProviderUnsupportedFeatureError,
    ProviderUnavailableError,
    ProviderUnsupportedMediaTypeError,
    ProviderAuthenticationError,
    ProviderModelNotFoundError,
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
        auth_mechanism="unknown",
        verify_support=True,
        probe_support=True,
    )

    def __init__(self, settings: Settings, harness: HarnessService):
        self._settings = settings
        self._harness = harness
        self._usage = UsageAccountingService(settings)

    def is_ready(self) -> bool:
        runtime_profiles = self._runtime_profiles()
        return bool(self._settings.generic_harness_enabled and runtime_profiles)

    def readiness_reason(self) -> str | None:
        if not self._settings.generic_harness_enabled:
            return "FORGEGATE_GENERIC_HARNESS_ENABLED=false"
        if not self._harness.list_profiles():
            return "No harness provider profile configured in control plane."
        if not self._active_profiles():
            return "Harness profiles exist but all are disabled."
        if not self._runtime_profiles():
            return "Harness profiles exist, but no enabled profile owns any models."
        return None

    def status_capabilities(self) -> dict[str, object]:
        capabilities = self.capabilities.model_dump()
        runtime_profiles = self._capability_truth_profiles()
        active_profiles = self._active_profiles()
        supports_streaming = any(self._profile_supports_streaming(profile) for profile in runtime_profiles)
        supports_tool_calling = any(self._profile_supports_tool_calling(profile) for profile in runtime_profiles)
        supports_vision = any(self._profile_supports_vision(profile) for profile in runtime_profiles)
        supports_discovery = any(self._profile_supports_discovery(profile) for profile in active_profiles)
        auth_truth_profiles = runtime_profiles or active_profiles
        auth_mechanisms = self._active_auth_mechanisms(auth_truth_profiles)
        capabilities.update(
            {
                "streaming": supports_streaming,
                "streaming_level": "partial" if supports_streaming else "none",
                "tool_calling": supports_tool_calling,
                "tool_calling_level": "partial" if supports_tool_calling else "none",
                "vision": supports_vision,
                "vision_level": "partial" if supports_vision else "none",
                "discovery_support": supports_discovery,
                "auth_mechanism": self._aggregate_auth_mechanism(auth_mechanisms),
                "auth_mechanisms": auth_mechanisms,
                "active_profile_count": len(active_profiles),
                "streaming_profile_count": sum(1 for profile in runtime_profiles if self._profile_supports_streaming(profile)),
                "tool_calling_profile_count": sum(1 for profile in runtime_profiles if self._profile_supports_tool_calling(profile)),
                "vision_profile_count": sum(1 for profile in runtime_profiles if self._profile_supports_vision(profile)),
            }
        )
        return capabilities

    def can_dispatch_model(
        self,
        model: str,
        *,
        require_streaming: bool = False,
        require_tool_calling: bool = False,
        require_vision: bool = False,
    ) -> tuple[bool, str | None]:
        if not self.is_ready():
            return False, self.readiness_reason() or "harness_not_ready"
        try:
            profile = self._profile_for_model(model)
        except ProviderNotReadyError:
            return False, "model_not_owned_by_enabled_profile"
        if require_streaming and not self._profile_supports_streaming(profile):
            return False, "streaming_not_enabled_in_profile"
        if require_tool_calling and not self._profile_supports_tool_calling(profile):
            return False, "tool_calling_not_enabled_in_profile"
        if require_vision and not self._profile_supports_vision(profile):
            return False, "vision_not_enabled_in_profile"
        return True, None

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        if not self.is_ready():
            raise ProviderConfigurationError(self.provider_name, self.readiness_reason() or "Harness not ready")
        profile = self._profile_for_model(request.model)
        if getattr(request, "tools", []) and not self._profile_supports_tool_calling(profile):
            raise ProviderUnsupportedFeatureError(self.provider_name, "tool_calling")
        if messages_require_vision(request.messages) and not self._profile_supports_vision(profile):
            raise ProviderUnsupportedFeatureError(self.provider_name, "vision")
        response_controls = getattr(request, "response_controls", {}) or {}
        try:
            parsed = self._harness.execute_non_stream(
                profile.provider_key,
                model=request.model,
                messages=request.messages,
                **self._harness_execution_kwargs(
                    self._harness.execute_non_stream,
                    tools=getattr(request, "tools", []),
                    tool_choice=getattr(request, "tool_choice", None),
                    temperature=response_controls.get("temperature"),
                    max_output_tokens=response_controls.get("max_output_tokens"),
                    metadata=response_controls.get("metadata"),
                    request_metadata=getattr(request, "request_metadata", {}),
                ),
            )
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
        if getattr(request, "tools", []) and not self._profile_supports_tool_calling(profile):
            raise ProviderUnsupportedFeatureError(self.provider_name, "tool_calling")
        if messages_require_vision(request.messages) and not self._profile_supports_vision(profile):
            raise ProviderUnsupportedFeatureError(self.provider_name, "vision")
        if not self._profile_supports_streaming(profile):
            raise ProviderUnsupportedFeatureError(self.provider_name, "streaming_not_enabled_in_profile")
        response_controls = getattr(request, "response_controls", {}) or {}

        try:
            stream_iter = self._harness.execute_stream(
                profile.provider_key,
                model=request.model,
                messages=request.messages,
                **self._harness_execution_kwargs(
                    self._harness.execute_stream,
                    tools=getattr(request, "tools", []),
                    tool_choice=getattr(request, "tool_choice", None),
                    temperature=response_controls.get("temperature"),
                    max_output_tokens=response_controls.get("max_output_tokens"),
                    metadata=response_controls.get("metadata"),
                    request_metadata=getattr(request, "request_metadata", {}),
                ),
            )
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
                yield ProviderStreamEvent(
                    event="done",
                    finish_reason=str(item.get("finish_reason", "stop")),
                    usage=usage,
                    cost=cost,
                    credential_type="harness_template",
                    auth_source=profile.integration_class,
                    tool_calls=item.get("tool_calls", []) if isinstance(item.get("tool_calls", []), list) else [],
                )
        except RuntimeError as exc:
            mapped = self._map_harness_error(str(exc))
            yield ProviderStreamEvent(event="error", error_type=mapped.error_type)
            return

    @staticmethod
    def _harness_execution_kwargs(method: object, **kwargs: Any) -> dict[str, Any]:
        try:
            parameters = signature(method).parameters.values()
        except (TypeError, ValueError):
            return kwargs
        if any(parameter.kind is Parameter.VAR_KEYWORD for parameter in parameters):
            return kwargs
        supported = {parameter.name for parameter in parameters}
        return {name: value for name, value in kwargs.items() if name in supported}

    def _active_profiles(self) -> list[Any]:
        return [profile for profile in self._harness.list_profiles() if profile.enabled]

    @staticmethod
    def _profile_has_owned_models(profile: Any) -> bool:
        return any(str(model).strip() for model in getattr(profile, "models", []))

    def _runtime_profiles(self) -> list[Any]:
        active_profiles = self._active_profiles()
        if self._settings.generic_harness_allow_model_fallback:
            return active_profiles
        return [profile for profile in active_profiles if self._profile_has_owned_models(profile)]

    def _capability_truth_profiles(self) -> list[Any]:
        return self._runtime_profiles()

    @staticmethod
    def _profile_supports_streaming(profile: Any) -> bool:
        return bool(profile.capabilities.streaming and profile.stream_mapping.enabled)

    @staticmethod
    def _profile_supports_tool_calling(profile: Any) -> bool:
        return bool(profile.capabilities.tool_calling)

    @staticmethod
    def _profile_supports_vision(profile: Any) -> bool:
        return bool(profile.capabilities.vision)

    @staticmethod
    def _profile_supports_discovery(profile: Any) -> bool:
        return bool(profile.capabilities.discovery_support and profile.discovery_enabled)

    @staticmethod
    def _active_auth_mechanisms(profiles: list[Any]) -> list[str]:
        return sorted({str(getattr(profile, "auth_scheme", "unknown") or "unknown") for profile in profiles})

    @staticmethod
    def _aggregate_auth_mechanism(auth_mechanisms: list[str]) -> str:
        if not auth_mechanisms:
            return "unknown"
        if len(auth_mechanisms) == 1:
            return auth_mechanisms[0]
        return "mixed"

    def _profile_for_model(self, model: str):
        enabled = self._active_profiles()
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
        if "(408)" in lower:
            return ProviderRequestTimeoutError(self.provider_name, message)
        if "(429)" in lower or "rate limit" in lower:
            return ProviderRateLimitError(self.provider_name, message)
        if "(409)" in lower or "conflict" in lower:
            return ProviderConflictError(self.provider_name, message)
        if "decode" in lower or "invalid json" in lower:
            return ProviderProtocolError(self.provider_name, message)
        if "(404)" in lower:
            return ProviderModelNotFoundError(self.provider_name, message=message)
        if "(400)" in lower or "(422)" in lower:
            return ProviderBadRequestError(self.provider_name, message)
        if "(401)" in lower or "(403)" in lower:
            return ProviderAuthenticationError(self.provider_name, message)
        if "(410)" in lower:
            return ProviderResourceGoneError(self.provider_name, message)
        if "(413)" in lower:
            return ProviderPayloadTooLargeError(self.provider_name, message)
        if "(415)" in lower:
            return ProviderUnsupportedMediaTypeError(self.provider_name, message)
        if "(503)" in lower:
            return ProviderUnavailableError(self.provider_name, message)
        return ProviderUpstreamError(self.provider_name, message)
