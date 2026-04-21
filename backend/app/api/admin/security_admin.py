"""Admin security and user-management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.api.admin.security import require_admin_role, require_admin_session
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service

router = APIRouter(prefix="/security", tags=["admin-security"])


class AdminUserCreateRequest(BaseModel):
    username: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    role: str = Field(default="operator")
    password: str = Field(min_length=8)


class AdminUserUpdateRequest(BaseModel):
    display_name: str | None = None
    role: str | None = None
    status: str | None = None
    must_rotate_password: bool | None = None


class AdminPasswordRotateRequest(BaseModel):
    new_password: str = Field(min_length=8)
    must_rotate_password: bool = False


def _security_error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("/bootstrap")
def security_bootstrap(
    _admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    return {
        "status": "ok",
        "bootstrap": service.bootstrap_status(),
        "secret_posture": service.provider_secret_posture(),
    }


@router.get("/users")
def list_admin_users(
    _admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    return {"status": "ok", "users": [item.model_dump() for item in service.list_admin_users()]}


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_admin_user(
    payload: AdminUserCreateRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    try:
        user = service.create_admin_user(
            username=payload.username,
            display_name=payload.display_name,
            role=payload.role,
            password=payload.password,
            actor=admin,
        )
    except ValueError as exc:
        return _security_error(status.HTTP_409_CONFLICT, "admin_user_create_failed", str(exc))
    return {"status": "ok", "user": user.model_dump()}


@router.patch("/users/{user_id}")
def update_admin_user(
    user_id: str,
    payload: AdminUserUpdateRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    try:
        user = service.update_admin_user(
            user_id,
            display_name=payload.display_name,
            role=payload.role,
            status=payload.status,
            must_rotate_password=payload.must_rotate_password,
            actor=admin,
        )
    except ValueError as exc:
        return _security_error(status.HTTP_400_BAD_REQUEST, "admin_user_update_failed", str(exc))
    return {"status": "ok", "user": user.model_dump()}


@router.post("/users/{user_id}/rotate-password")
def rotate_admin_password(
    user_id: str,
    payload: AdminPasswordRotateRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    try:
        user = service.rotate_admin_password(
            user_id,
            new_password=payload.new_password,
            actor=admin,
            must_rotate_password=payload.must_rotate_password,
        )
    except ValueError as exc:
        return _security_error(status.HTTP_404_NOT_FOUND, "admin_password_rotation_failed", str(exc))
    return {"status": "ok", "user": user.model_dump()}


@router.get("/sessions")
def list_admin_sessions(
    _admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    return {"status": "ok", "sessions": service.list_admin_sessions(include_revoked=True)}


@router.post("/sessions/{session_id}/revoke")
def revoke_admin_session_by_id(
    session_id: str,
    admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    try:
        session = service.revoke_admin_session_by_id(session_id, actor=admin)
    except ValueError as exc:
        return _security_error(status.HTTP_404_NOT_FOUND, "admin_session_revoke_failed", str(exc))
    return {"status": "ok", "session": session.model_dump()}


@router.get("/secret-posture")
def secret_posture(
    _admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    return {"status": "ok", "providers": service.provider_secret_posture()}

