"""Internal deterministic baseline provider for phase-4 runtime proof path."""

from app.providers.base import ChatDispatchRequest, ChatDispatchResult, ProviderCapabilities


class ForgeGateBaselineAdapter:
    provider_name = "forgegate_baseline"
    capabilities = ProviderCapabilities(streaming=False, tool_calling=False, vision=False, external=False)

    def is_ready(self) -> bool:
        return True

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
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

        return ChatDispatchResult(
            model=request.model,
            provider=self.provider_name,
            content=f"ForgeGate baseline response: {last_user_text}",
            finish_reason="stop",
        )
