"""Dependency wiring for runtime API layer."""

from functools import lru_cache
from uuid import uuid4

from fastapi import Depends, Request, status

from app.authz import ActorScope, PolicyEvaluator, RequestActor, TenantBoundTarget, get_route_policy
from app.authz.route_guards import raise_route_guard_violation
from app.api.runtime.errors import public_runtime_auth_message
from app.core.dispatch import DispatchService
from app.core.model_registry import ModelRegistry
from app.core.routing import RoutingService
from app.execution.dependencies import (
    clear_execution_dependency_caches,
    get_execution_responses_service,
    get_execution_session_factory,
    get_execution_transition_service,
)
from app.governance.errors import RuntimeAuthorizationError
from app.governance.models import RuntimeGatewayIdentity, RuntimeRequestPathDecision
from app.governance.service import GovernanceService, get_governance_service
from app.providers import ProviderRegistry
from app.settings.config import Settings, get_settings
from app.tenancy import normalize_tenant_id


@lru_cache(maxsize=1)
def get_provider_registry() -> ProviderRegistry:
    return ProviderRegistry(get_settings())


def get_runtime_gateway_identity(
    request: Request,
    settings: Settings = Depends(get_settings),
    governance: GovernanceService = Depends(get_governance_service),
) -> RuntimeGatewayIdentity | None:
    authorization = request.headers.get("authorization", "")
    bearer_token = ""
    if authorization.lower().startswith("bearer "):
        bearer_token = authorization.split(" ", 1)[1].strip()
    request_id = _request_id(request)
    if settings.runtime_auth_required and not bearer_token:
        raise_route_guard_violation(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="missing_bearer",
            message=public_runtime_auth_message("missing_bearer"),
            details={},
            request_id=request_id,
        )
    try:
        identity = governance.authenticate_runtime_key(bearer_token) if bearer_token else None
    except RuntimeAuthorizationError as exc:
        raise_route_guard_violation(
            status_code=exc.status_code,
            code=exc.error_type,
            message=public_runtime_auth_message(exc.error_type),
            details={},
            request_id=request_id,
        )
    if bearer_token and identity is None:
        raise_route_guard_violation(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="invalid_runtime_key",
            message="Runtime key is invalid or expired.",
            details={},
            request_id=request_id,
        )
    if settings.runtime_auth_required and identity is None:
        raise_route_guard_violation(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="runtime_auth_required",
            message="Runtime authentication is required.",
            details={},
            request_id=request_id,
        )
    return identity


def get_runtime_request_path_decision(
    request: Request,
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
    governance: GovernanceService = Depends(get_governance_service),
) -> RuntimeRequestPathDecision | None:
    if gateway_identity is None:
        return None
    requested_path = (
        request.headers.get("x-forgeframe-request-path", "").strip()
        or request.headers.get("x-forgegate-request-path", "").strip()
        or None
    )
    try:
        return governance.resolve_runtime_request_path(
            identity=gateway_identity,
            requested_path=requested_path,
            runtime_route=request.url.path,
        )
    except RuntimeAuthorizationError as exc:
        raise_route_guard_violation(
            status_code=exc.status_code,
            code=exc.error_type,
            message=public_runtime_auth_message(exc.error_type),
            details={},
            request_id=_request_id(request),
        )


def runtime_request_path_metadata(
    decision: RuntimeRequestPathDecision | None,
) -> dict[str, str]:
    if decision is None:
        return {}
    metadata = {
        "request_path_policy": decision.request_path,
        "default_request_path": decision.default_request_path,
        "request_path_selected_via": decision.selected_via,
    }
    if decision.pinned_target_key:
        metadata["pinned_target_key"] = decision.pinned_target_key
    return metadata


def _request_id(request: Request) -> str:
    envelope = getattr(request.state, "request_envelope", None)
    envelope_request_id = getattr(envelope, "request_id", None)
    if isinstance(envelope_request_id, str) and envelope_request_id.strip():
        return envelope_request_id.strip()
    raw_request_id = (
        request.headers.get("x-request-id", "").strip()
        or request.headers.get("x-forgeframe-request-id", "").strip()
        or request.headers.get("x-forgegate-request-id", "").strip()
    )
    return raw_request_id or f"req_{uuid4().hex[:12]}"


@lru_cache(maxsize=32)
def _build_model_registry(instance_id: str) -> ModelRegistry:
    settings = get_settings()
    return ModelRegistry(settings, instance_id=instance_id)


def _runtime_instance_id(identity: RuntimeGatewayIdentity | None) -> str:
    settings = get_settings()
    return normalize_tenant_id(
        identity.instance_id if identity is not None else settings.bootstrap_tenant_id,
        fallback_tenant_id=settings.bootstrap_tenant_id,
    )


def get_model_registry(
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
) -> ModelRegistry:
    return _build_model_registry(_runtime_instance_id(gateway_identity))


@lru_cache(maxsize=32)
def _build_routing_service(instance_id: str) -> RoutingService:
    settings = get_settings()
    registry = _build_model_registry(instance_id)
    providers = get_provider_registry()
    return RoutingService(registry, providers, settings, instance_id=instance_id)


def get_routing_service(
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
) -> RoutingService:
    return _build_routing_service(_runtime_instance_id(gateway_identity))


@lru_cache(maxsize=32)
def _build_dispatch_service(instance_id: str) -> DispatchService:
    return DispatchService(_build_routing_service(instance_id), get_provider_registry())


def get_dispatch_service(
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
) -> DispatchService:
    return _build_dispatch_service(_runtime_instance_id(gateway_identity))


def get_responses_service():
    return get_execution_responses_service()


def get_runtime_request_actor(
    request: Request,
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
) -> RequestActor | None:
    if gateway_identity is None:
        return None
    if gateway_identity.account_id is None:
        raise_route_guard_violation(
            status_code=status.HTTP_403_FORBIDDEN,
            code="runtime_key_unbound",
            message=public_runtime_auth_message("runtime_key_unbound"),
            details={},
            request_id=_request_id(request),
        )
    return RequestActor(
        principal_type="service",
        principal_id=gateway_identity.account_id or gateway_identity.key_id,
        credential_id=gateway_identity.key_id,
        auth_method="bearer_token",
        credential_state="active",
        tenant_id=gateway_identity.account_id,
        role_keys=[],
        scope=ActorScope(permission_keys=list(gateway_identity.scopes)),
        membership_state=None,
        request_id=_request_id(request),
    )


def require_runtime_permission(policy_key: str):
    policy = get_route_policy(policy_key)
    evaluator = PolicyEvaluator()

    def _dependency(
        request: Request,
        actor: RequestActor | None = Depends(get_runtime_request_actor),
    ) -> RequestActor | None:
        if actor is None:
            return None

        decision = evaluator.authorize(
            actor=actor,
            policy=policy,
            target=TenantBoundTarget(
                resource_type="runtime_route",
                resource_id=request.url.path,
                tenant_id=actor.tenant_id,
            ),
        )
        if not decision.allowed:
            raise_route_guard_violation(
                status_code=decision.status_code,
                code=decision.error_code,
                message=public_runtime_auth_message(decision.error_code),
                details={},
                request_id=actor.request_id,
            )
        return actor

    return _dependency


def clear_runtime_dependency_caches() -> None:
    get_settings.cache_clear()
    _build_model_registry.cache_clear()
    _build_routing_service.cache_clear()
    _build_dispatch_service.cache_clear()
    get_provider_registry.cache_clear()
    clear_execution_dependency_caches()


get_model_registry.cache_clear = _build_model_registry.cache_clear  # type: ignore[attr-defined]
get_routing_service.cache_clear = _build_routing_service.cache_clear  # type: ignore[attr-defined]
get_dispatch_service.cache_clear = _build_dispatch_service.cache_clear  # type: ignore[attr-defined]


__all__ = [
    "Settings",
    "get_settings",
    "get_model_registry",
    "get_routing_service",
    "get_provider_registry",
    "get_dispatch_service",
    "get_responses_service",
    "get_runtime_gateway_identity",
    "get_runtime_request_path_decision",
    "get_runtime_request_actor",
    "require_runtime_permission",
    "runtime_request_path_metadata",
    "clear_runtime_dependency_caches",
]
