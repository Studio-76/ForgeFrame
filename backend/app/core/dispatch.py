"""Runtime dispatch service tying routing and provider adapters together."""

from collections.abc import Iterator

from app.core.routing import RoutingService
from app.providers import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderNotReadyError,
    ProviderRegistry,
    ProviderStreamEvent,
    ProviderUnsupportedFeatureError,
)


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

        if not adapter.is_ready():
            raise ProviderNotReadyError(adapter.provider_name, adapter.readiness_reason())

        if stream:
            raise ProviderUnsupportedFeatureError(adapter.provider_name, "streaming via dispatch_chat")

        return adapter.create_chat_completion(request)

    def dispatch_chat_stream(self, requested_model: str | None, messages: list[dict]) -> tuple[str, str, Iterator[ProviderStreamEvent]]:
        decision = self._routing.resolve_model(requested_model)
        adapter = self._providers.get(decision.resolved_model.provider)

        if not adapter.capabilities.streaming:
            raise ProviderUnsupportedFeatureError(adapter.provider_name, "streaming")

        if not adapter.is_ready():
            raise ProviderNotReadyError(adapter.provider_name, adapter.readiness_reason())

        request = ChatDispatchRequest(
            model=decision.resolved_model.id,
            messages=messages,
            stream=True,
        )
        return decision.resolved_model.id, adapter.provider_name, adapter.stream_chat_completion(request)
