"""Dependency wiring for runtime API layer."""

from functools import lru_cache

from fastapi import Depends, HTTPException, Request, status

from app.core.dispatch import DispatchService
from app.core.model_registry import ModelRegistry
from app.core.routing import RoutingService
from app.governance.models import RuntimeGatewayIdentity
from app.governance.service import GovernanceService, get_governance_service
from app.providers import ProviderRegistry
from app.settings.config import Settings, get_settings


@lru_cache(maxsize=1)
def get_model_registry() -> ModelRegistry:
    settings = get_settings()
    return ModelRegistry(settings)


@lru_cache(maxsize=1)
def get_routing_service() -> RoutingService:
    settings = get_settings()
    registry = get_model_registry()
    providers = get_provider_registry()
    return RoutingService(registry, providers, settings)


@lru_cache(maxsize=1)
def get_provider_registry() -> ProviderRegistry:
    return ProviderRegistry(get_settings())


@lru_cache(maxsize=1)
def get_dispatch_service() -> DispatchService:
    return DispatchService(get_routing_service(), get_provider_registry())


def get_runtime_gateway_identity(
    request: Request,
    settings: Settings = Depends(get_settings),
    governance: GovernanceService = Depends(get_governance_service),
) -> RuntimeGatewayIdentity | None:
    authorization = request.headers.get("authorization", "")
    bearer_token = ""
    if authorization.lower().startswith("bearer "):
        bearer_token = authorization.split(" ", 1)[1].strip()
    token = bearer_token or request.headers.get("x-api-key", "").strip()
    identity = governance.authenticate_runtime_key(token) if token else None
    if token and identity is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_runtime_key")
    if settings.runtime_auth_required and identity is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="runtime_auth_required")
    return identity


def clear_runtime_dependency_caches() -> None:
    get_settings.cache_clear()
    get_model_registry.cache_clear()
    get_routing_service.cache_clear()
    get_provider_registry.cache_clear()
    get_dispatch_service.cache_clear()


__all__ = [
    "Settings",
    "get_settings",
    "get_model_registry",
    "get_routing_service",
    "get_provider_registry",
    "get_dispatch_service",
    "get_runtime_gateway_identity",
    "clear_runtime_dependency_caches",
]
