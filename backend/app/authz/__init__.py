"""ForgeFrame authz foundation exports."""

from app.authz.catalog import (
    ALL_ROUTE_POLICIES,
    FORGEGATE_V1_ROUTE_POLICIES,
    ROLE_PERMISSION_KEYS,
    RUNTIME_ROUTE_POLICIES,
    TENANT_PERMISSION_KEYS,
    get_route_policy,
)
from app.authz.evaluator import PolicyEvaluator
from app.authz.models import (
    ActorScope,
    AuthorizationContext,
    AuthorizationDecision,
    BreakGlassContext,
    ImpersonationContext,
    RequestActor,
    RoutePolicy,
    TenantBoundTarget,
)
from app.authz.route_guards import build_route_guard

__all__ = [
    "ALL_ROUTE_POLICIES",
    "ActorScope",
    "AuthorizationContext",
    "AuthorizationDecision",
    "BreakGlassContext",
    "FORGEGATE_V1_ROUTE_POLICIES",
    "ImpersonationContext",
    "PolicyEvaluator",
    "ROLE_PERMISSION_KEYS",
    "RUNTIME_ROUTE_POLICIES",
    "RequestActor",
    "RoutePolicy",
    "TENANT_PERMISSION_KEYS",
    "TenantBoundTarget",
    "build_route_guard",
    "get_route_policy",
]
