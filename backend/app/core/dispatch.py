"""Runtime dispatch service tying routing and provider adapters together."""

from collections.abc import Iterator

from app.core.message_features import messages_require_vision
from app.core.routing import RouteDecision, RoutingNoCandidateError, RoutingService
from app.core.tool_calling import validate_tools_and_choice
from app.providers import (
    ChatDispatchRequest,
    ChatDispatchResult,
    EmbeddingDispatchRequest,
    EmbeddingDispatchResult,
    ProviderNotReadyError,
    ProviderRegistry,
    ProviderStreamEvent,
    ProviderUnsupportedFeatureError,
)


class DispatchService:
    def __init__(self, routing: RoutingService, providers: ProviderRegistry):
        self._routing = routing
        self._providers = providers

    def dispatch_chat(
        self,
        requested_model: str | None,
        messages: list[dict],
        stream: bool = False,
        tools: list[dict] | None = None,
        tool_choice: str | dict | None = None,
        allowed_providers: set[str] | None = None,
        request_metadata: dict[str, str] | None = None,
        response_controls: dict[str, object] | None = None,
    ) -> tuple[ChatDispatchResult, RouteDecision]:
        validate_tools_and_choice(tools, tool_choice)
        require_vision = messages_require_vision(messages)
        try:
            decision = self._routing.resolve_model(
                requested_model,
                messages=messages,
                stream=stream,
                tools=tools,
                require_vision=require_vision,
                allowed_providers=allowed_providers,
                route_context=request_metadata,
                response_controls=response_controls,
            )
        except RuntimeError as exc:
            if require_vision and (
                isinstance(exc, RoutingNoCandidateError) or str(exc) == "No active models satisfy current routing requirements."
            ):
                raise ProviderUnsupportedFeatureError("runtime", "vision") from exc
            raise
        adapter = self._providers.get(decision.resolved_model.provider)
        provider_status = self._providers.get_provider_status(adapter.provider_name)
        if require_vision and not bool(provider_status.get("capabilities", {}).get("vision", False)):
            raise ProviderUnsupportedFeatureError(adapter.provider_name, "vision")
        request = ChatDispatchRequest(
            model=decision.resolved_model.id,
            messages=messages,
            stream=stream,
            tools=tools or [],
            tool_choice=tool_choice,
            request_metadata=request_metadata or {},
            response_controls=response_controls or {},
        )

        if not adapter.is_ready():
            raise ProviderNotReadyError(adapter.provider_name, adapter.readiness_reason())

        if stream:
            raise ProviderUnsupportedFeatureError(adapter.provider_name, "streaming via dispatch_chat")
        if tools and not adapter.capabilities.tool_calling:
            raise ProviderUnsupportedFeatureError(adapter.provider_name, "tool_calling")

        return adapter.create_chat_completion(request), decision

    def dispatch_embeddings(
        self,
        requested_model: str | None,
        *,
        input_items: list[object],
        encoding_format: str = "float",
        dimensions: int | None = None,
        allowed_providers: set[str] | None = None,
        request_metadata: dict[str, str] | None = None,
    ) -> tuple[EmbeddingDispatchResult, RouteDecision]:
        decision = self._routing.resolve_model(
            requested_model,
            messages=[],
            stream=False,
            tools=None,
            require_vision=False,
            allowed_providers=allowed_providers,
            route_context=request_metadata,
            required_capabilities={"embeddings"},
            decision_source="runtime_dispatch",
        )
        adapter = self._providers.get(decision.resolved_model.provider)
        if not bool(getattr(adapter.capabilities, "embeddings", False)):
            raise ProviderUnsupportedFeatureError(adapter.provider_name, "embeddings")
        if not adapter.is_ready():
            raise ProviderNotReadyError(adapter.provider_name, adapter.readiness_reason())
        create_embeddings = getattr(adapter, "create_embeddings", None)
        if not callable(create_embeddings):
            raise ProviderUnsupportedFeatureError(adapter.provider_name, "embeddings")
        request = EmbeddingDispatchRequest(
            model=decision.resolved_model.id,
            input_items=list(input_items),
            encoding_format="base64" if encoding_format == "base64" else "float",
            dimensions=dimensions,
            request_metadata=request_metadata or {},
        )
        return create_embeddings(request), decision

    def dispatch_chat_stream(
        self,
        requested_model: str | None,
        messages: list[dict],
        *,
        tools: list[dict] | None = None,
        tool_choice: str | dict | None = None,
        allowed_providers: set[str] | None = None,
        request_metadata: dict[str, str] | None = None,
        response_controls: dict[str, object] | None = None,
    ) -> tuple[str, str, Iterator[ProviderStreamEvent], RouteDecision]:
        validate_tools_and_choice(tools, tool_choice)
        require_vision = messages_require_vision(messages)
        try:
            decision = self._routing.resolve_model(
                requested_model,
                messages=messages,
                stream=True,
                tools=tools,
                require_vision=require_vision,
                allowed_providers=allowed_providers,
                route_context=request_metadata,
                response_controls=response_controls,
            )
        except RuntimeError as exc:
            if require_vision and (
                isinstance(exc, RoutingNoCandidateError) or str(exc) == "No active models satisfy current routing requirements."
            ):
                raise ProviderUnsupportedFeatureError("runtime", "vision") from exc
            raise
        adapter = self._providers.get(decision.resolved_model.provider)
        provider_status = self._providers.get_provider_status(adapter.provider_name)
        if require_vision and not bool(provider_status.get("capabilities", {}).get("vision", False)):
            raise ProviderUnsupportedFeatureError(adapter.provider_name, "vision")

        if not adapter.capabilities.streaming:
            raise ProviderUnsupportedFeatureError(adapter.provider_name, "streaming")
        if tools and not adapter.capabilities.tool_calling:
            raise ProviderUnsupportedFeatureError(adapter.provider_name, "tool_calling")

        if not adapter.is_ready():
            raise ProviderNotReadyError(adapter.provider_name, adapter.readiness_reason())

        request = ChatDispatchRequest(
            model=decision.resolved_model.id,
            messages=messages,
            stream=True,
            tools=tools or [],
            tool_choice=tool_choice,
            request_metadata=request_metadata or {},
            response_controls=response_controls or {},
        )
        return (
            decision.resolved_model.id,
            adapter.provider_name,
            adapter.stream_chat_completion(request),
            decision,
        )
