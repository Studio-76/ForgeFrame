"""Internal deterministic baseline provider for phase-5 runtime proof paths."""

from collections.abc import Iterator

from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderCapabilities,
    ProviderStreamEvent,
)


class ForgeGateBaselineAdapter:
    provider_name = "forgegate_baseline"
    capabilities = ProviderCapabilities(streaming=True, tool_calling=False, vision=False, external=False)

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
        return ChatDispatchResult(
            model=request.model,
            provider=self.provider_name,
            content=self._build_response_text(request),
            finish_reason="stop",
        )

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        text = self._build_response_text(request)
        for token in text.split(" "):
            yield ProviderStreamEvent(event="delta", delta=f"{token} ")
        yield ProviderStreamEvent(event="done", finish_reason="stop")
