"""Runtime dispatch service tying routing and provider adapters together."""

from app.core.routing import RoutingService
from app.providers import ChatDispatchRequest, ChatDispatchResult, ProviderRegistry


class DispatchService:
    def __init__(self, routing: RoutingService, providers: ProviderRegistry):
        self._routing = routing
        self._providers = providers

    def dispatch_chat(self, requested_model: str | None, messages: list[dict], stream: bool = False) -> ChatDispatchResult:
        decision = self._routing.resolve_model(requested_model)
        adapter = self._providers.get(decision.resolved_model.provider)
        request = ChatDispatchRequest(
            model=decision.resolved_model.id,
            messages=messages,
            stream=stream,
        )
        return adapter.create_chat_completion(request)
