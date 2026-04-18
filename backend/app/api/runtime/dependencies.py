"""Dependency wiring for runtime API layer."""

from functools import lru_cache

from app.core.dispatch import DispatchService
from app.core.model_registry import ModelRegistry
from app.core.routing import RoutingService
from app.providers import ProviderRegistry
from app.settings.config import Settings, get_settings


@lru_cache(maxsize=1)
def get_model_registry() -> ModelRegistry:
    settings = get_settings()
    return ModelRegistry(settings)


@lru_cache(maxsize=1)
def get_routing_service() -> RoutingService:
    registry = get_model_registry()
    return RoutingService(registry)


@lru_cache(maxsize=1)
def get_provider_registry() -> ProviderRegistry:
    return ProviderRegistry(get_settings())


@lru_cache(maxsize=1)
def get_dispatch_service() -> DispatchService:
    return DispatchService(get_routing_service(), get_provider_registry())


__all__ = [
    "Settings",
    "get_settings",
    "get_model_registry",
    "get_routing_service",
    "get_provider_registry",
    "get_dispatch_service",
]
