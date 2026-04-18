"""Routing service baseline for phase-3 ForgeGate core."""

from app.core.model_registry import ModelRegistry
from app.core.routing.types import RouteDecision


class RoutingService:
    def __init__(self, registry: ModelRegistry):
        self._registry = registry

    def resolve_model(self, requested_model: str | None) -> RouteDecision:
        if requested_model:
            model = self._registry.get_model(requested_model)
            if not model:
                raise ValueError(f"Unknown or inactive model: {requested_model}")
            return RouteDecision(
                requested_model=requested_model,
                resolved_model=model,
                reason="requested_model",
            )

        default_model = self._registry.default_model()
        return RouteDecision(
            requested_model=None,
            resolved_model=default_model,
            reason="default_model",
        )
