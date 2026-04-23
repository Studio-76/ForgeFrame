"""Admin auth endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.api.admin.idempotency import unsupported_idempotency_response
from app.api.admin.security import (
    require_admin_session_allowing_password_rotation,
    require_admin_write_session_allowing_password_rotation,
)
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service
from app.harness.service import HarnessService, get_harness_service
from app.readiness import (
    RuntimeReadinessReport,
    StartupValidationError,
    build_operator_runtime_readiness_payload,
    build_runtime_readiness_report,
    ensure_runtime_startup_validated,
)
from app.settings.config import Settings, get_settings
from app.usage.analytics import UsageAnalyticsStore, get_usage_analytics_store

router = APIRouter(prefix="/auth", tags=["admin-auth"])
_bearer = HTTPBearer(auto_error=False)
_AUTH_IDEMPOTENCY_MESSAGE = (
    "Idempotency-Key is not supported for admin auth mutations because these routes mint or revoke sessions and "
    "rotate passwords."
)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class RotateOwnPasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8)


class SignedOutBootstrapHint(BaseModel):
    message: str = "Sign in to inspect bootstrap posture."


@router.get("/bootstrap")
def auth_bootstrap_status() -> dict[str, object]:
    return {"status": "ok", "bootstrap": SignedOutBootstrapHint().model_dump()}


def _resolve_runtime_readiness(
    request: Request,
    *,
    settings: Settings,
    governance: GovernanceService,
    harness: HarnessService,
    analytics: UsageAnalyticsStore,
) -> RuntimeReadinessReport:
    readiness = getattr(request.app.state, "runtime_readiness", None)
    if isinstance(readiness, RuntimeReadinessReport) and getattr(request.app.state, "runtime_startup_checks", None) is not None:
        startup_checks = request.app.state.runtime_startup_checks
    else:
        try:
            startup_checks = ensure_runtime_startup_validated(request.app)
        except StartupValidationError as exc:
            startup_checks = exc.checks
            request.app.state.runtime_startup_checks = exc.checks
            request.app.state.runtime_readiness = RuntimeReadinessReport.from_checks(exc.checks)
    readiness = build_runtime_readiness_report(
        settings=settings,
        startup_checks=startup_checks,
        governance=governance,
        harness=harness,
        analytics=analytics,
        app=request.app,
    )
    request.app.state.runtime_readiness = readiness
    return readiness


@router.post("/login", status_code=status.HTTP_201_CREATED)
def login(
    payload: LoginRequest,
    request: Request,
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    unsupported = unsupported_idempotency_response(request, message=_AUTH_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        result = service.login(payload.username, payload.password)
    except ValueError as exc:
        if str(exc) == "login_rate_limited":
            return JSONResponse(status_code=status.HTTP_429_TOO_MANY_REQUESTS, content={
                "status": "error",
                "error": {"type": "login_rate_limited", "message": "Too many failed login attempts. Try again later."},
            })
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={
            "status": "error",
            "error": {"type": "invalid_credentials", "message": "Invalid admin credentials."},
        })
    return {"status": "ok", **result.model_dump()}


@router.get("/runtime-readiness")
def runtime_readiness(
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_session_allowing_password_rotation),
    settings: Settings = Depends(get_settings),
    governance: GovernanceService = Depends(get_governance_service),
    harness: HarnessService = Depends(get_harness_service),
    analytics: UsageAnalyticsStore = Depends(get_usage_analytics_store),
) -> dict[str, object]:
    del admin
    return {
        "status": "ok",
        "readiness": build_operator_runtime_readiness_payload(
            _resolve_runtime_readiness(
                request,
                settings=settings,
                governance=governance,
                harness=harness,
                analytics=analytics,
            )
        ),
    }


@router.get("/me")
def me(admin: AuthenticatedAdmin = Depends(require_admin_session_allowing_password_rotation)) -> dict[str, object]:
    return {"status": "ok", "user": admin.model_dump()}


@router.post("/logout")
def logout(
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_session_allowing_password_rotation),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    unsupported = unsupported_idempotency_response(request, message=_AUTH_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    del admin
    if credentials and credentials.scheme.lower() == "bearer":
        service.revoke_admin_session(credentials.credentials)
    return {"status": "ok", "message": "Admin session revoked."}


@router.post("/rotate-password")
def rotate_own_password(
    payload: RotateOwnPasswordRequest,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_write_session_allowing_password_rotation),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    unsupported = unsupported_idempotency_response(request, message=_AUTH_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        user = service.rotate_own_admin_password(
            admin,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
    except ValueError as exc:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"status": "error", "error": {"type": "password_rotation_failed", "message": str(exc)}},
        )
    return {"status": "ok", "user": user.model_dump()}
