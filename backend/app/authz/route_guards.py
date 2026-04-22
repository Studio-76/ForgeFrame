"""FastAPI-oriented helpers for guarded routes."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import HTTPException, Request

from app.authz.evaluator import PolicyEvaluator
from app.authz.models import AuthorizationContext, RequestActor, RoutePolicy, TenantBoundTarget

ActorResolver = Callable[[Request], RequestActor | None]
TargetResolver = Callable[[Request], TenantBoundTarget | None]


class RouteGuardHTTPException(HTTPException):
    def __init__(
        self,
        *,
        status_code: int,
        code: str | None,
        message: str | None,
        details: dict[str, object],
        request_id: str,
    ) -> None:
        super().__init__(
            status_code=status_code,
            detail={
                "code": code,
                "message": message,
                "details": details,
                "requestId": request_id,
            },
        )


def raise_route_guard_violation(
    *,
    status_code: int,
    code: str | None,
    message: str | None,
    details: dict[str, object],
    request_id: str,
) -> None:
    raise RouteGuardHTTPException(
        status_code=status_code,
        code=code,
        message=message,
        details=details,
        request_id=request_id,
    )


def build_route_guard(
    *,
    policy: RoutePolicy,
    resolve_actor: ActorResolver,
    resolve_target: TargetResolver,
    evaluator: PolicyEvaluator | None = None,
) -> Callable[[Request], AuthorizationContext]:
    """Build a consistent route guard around actor and target resolvers."""

    engine = evaluator or PolicyEvaluator()

    def _dependency(request: Request) -> AuthorizationContext:
        actor = resolve_actor(request)
        target = resolve_target(request)
        decision = engine.authorize(actor=actor, policy=policy, target=target)
        if not decision.allowed:
            request_id = actor.request_id if actor is not None else request.headers.get("x-request-id", "unknown_request")
            raise_route_guard_violation(
                status_code=decision.status_code,
                code=decision.error_code,
                message=decision.message,
                details=decision.details,
                request_id=request_id,
            )
        if actor is None:  # pragma: no cover - guarded by decision above
            raise HTTPException(status_code=500, detail="route_guard_missing_actor")
        return AuthorizationContext(actor=actor, policy=policy, target=target)

    return _dependency
