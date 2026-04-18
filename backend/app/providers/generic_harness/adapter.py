"""Generic harness-backed provider adapter for simple OpenAI-compatible or templated providers."""

from __future__ import annotations

from collections.abc import Iterator

from app.harness.service import HarnessService
from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderCapabilities,
    ProviderConfigurationError,
    ProviderStreamEvent,
    ProviderUnsupportedFeatureError,
    ProviderUpstreamError,
)
from app.settings.config import Settings
from app.usage.models import TokenUsage
from app.usage.service import UsageAccountingService


class GenericHarnessAdapter:
    provider_name = "generic_harness"
    capabilities = ProviderCapabilities(streaming=False, tool_calling=False, vision=False, external=True, discovery_support=True)

    def __init__(self, settings: Settings, harness: HarnessService):
        self._settings = settings
        self._harness = harness
        self._usage = UsageAccountingService(settings)

    def is_ready(self) -> bool:
        return bool(self._settings.generic_harness_enabled and self._harness.list_profiles())

    def readiness_reason(self) -> str | None:
        if not self._settings.generic_harness_enabled:
            return "FORGEGATE_GENERIC_HARNESS_ENABLED=false"
        if not self._harness.list_profiles():
            return "No harness provider profile configured in control plane."
        return None

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        if not self.is_ready():
            raise ProviderConfigurationError(self.provider_name, self.readiness_reason() or "Harness not ready")

        profile = self._profile_for_model(request.model)
        try:
            parsed = self._harness.execute_non_stream(profile.provider_key, model=request.model, messages=request.messages)
        except RuntimeError as exc:
            raise ProviderUpstreamError(self.provider_name, str(exc)) from exc
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
        )

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        raise ProviderUnsupportedFeatureError(self.provider_name, "streaming")

    def _profile_for_model(self, model: str):
        for profile in self._harness.list_profiles():
            if model in profile.models:
                return profile
        return self._harness.list_profiles()[0]
