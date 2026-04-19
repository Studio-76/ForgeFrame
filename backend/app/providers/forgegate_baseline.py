"""Internal deterministic baseline provider for phase-5 runtime proof paths."""

from collections.abc import Iterator

from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderCapabilities,
    ProviderStreamEvent,
    ProviderUnsupportedFeatureError,
)
from app.settings.config import Settings
from app.usage.service import UsageAccountingService


class ForgeGateBaselineAdapter:
    provider_name = "forgegate_baseline"
    capabilities = ProviderCapabilities(streaming=True, tool_calling=False, vision=False, external=False)

    def __init__(self, settings: Settings | None = None):
        self._settings = settings or Settings()
        self._usage_accounting = UsageAccountingService(self._settings)

    def is_ready(self) -> bool:
        return True

    def readiness_reason(self) -> str | None:
        return None

    def _build_response_text(self, request: ChatDispatchRequest) -> str:
        last_user_text = ""
        for message in reversed(request.messages):
            if message.get("role") == "user":
                content = message.get("content")
                if isinstance(content, str):
                    last_user_text = content.strip()
                else:
                    last_user_text = str(content)
                break

        if not last_user_text:
            last_user_text = "(empty user message)"

        return f"ForgeGate baseline response: {last_user_text}"

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        if getattr(request, "tools", []):
            raise ProviderUnsupportedFeatureError(self.provider_name, "tool_calling")
        completion_text = self._build_response_text(request)
        usage = self._usage_accounting.usage_from_prompt_completion(request.messages, completion_text)
        cost = self._usage_accounting.costs_for_provider(provider=self.provider_name, usage=usage)
        return ChatDispatchResult(
            model=request.model,
            provider=self.provider_name,
            content=completion_text,
            finish_reason="stop",
            usage=usage,
            cost=cost,
            credential_type="internal",
            auth_source="internal",
        )

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        if getattr(request, "tools", []):
            raise ProviderUnsupportedFeatureError(self.provider_name, "tool_calling")
        text = self._build_response_text(request)
        usage = self._usage_accounting.usage_from_prompt_completion(request.messages, text)
        cost = self._usage_accounting.costs_for_provider(provider=self.provider_name, usage=usage)

        for token in text.split(" "):
            yield ProviderStreamEvent(event="delta", delta=f"{token} ")
        yield ProviderStreamEvent(event="done", finish_reason="stop", usage=usage, cost=cost)
