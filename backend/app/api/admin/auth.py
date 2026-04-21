"""Admin auth endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.api.admin.security import require_admin_session
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service

router = APIRouter(prefix="/auth", tags=["admin-auth"])
_bearer = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class RotateOwnPasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8)


@router.get("/bootstrap")
def auth_bootstrap_status(service: GovernanceService = Depends(get_governance_service)) -> dict[str, object]:
    return {"status": "ok", "bootstrap": service.bootstrap_status()}


@router.post("/login", status_code=status.HTTP_201_CREATED)
def login(payload: LoginRequest, service: GovernanceService = Depends(get_governance_service)) -> dict[str, object]:
    try:
        result = service.login(payload.username, payload.password)
    except ValueError:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={
            "status": "error",
            "error": {"type": "invalid_credentials", "message": "Invalid admin credentials."},
        })
    return {"status": "ok", **result.model_dump()}


@router.get("/me")
def me(admin: AuthenticatedAdmin = Depends(require_admin_session)) -> dict[str, object]:
    return {"status": "ok", "user": admin.model_dump()}


@router.post("/logout")
def logout(
    admin: AuthenticatedAdmin = Depends(require_admin_session),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    del admin
    if credentials and credentials.scheme.lower() == "bearer":
        service.revoke_admin_session(credentials.credentials)
    return {"status": "ok", "message": "Admin session revoked."}


@router.post("/rotate-password")
def rotate_own_password(
    payload: RotateOwnPasswordRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_session),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
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
