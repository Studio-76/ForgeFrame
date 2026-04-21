"""Admin auth dependencies."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.local_auth import role_allows
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service

_bearer = HTTPBearer(auto_error=False)


def require_admin_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    service: GovernanceService = Depends(get_governance_service),
) -> AuthenticatedAdmin:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin authentication required.")
    try:
        return service.authenticate_admin_token(credentials.credentials)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


def require_admin_role(required_role: str) -> Callable[[AuthenticatedAdmin], AuthenticatedAdmin]:
    def _dependency(admin: AuthenticatedAdmin = Depends(require_admin_session)) -> AuthenticatedAdmin:
        if not role_allows(admin.role, required_role):  # type: ignore[arg-type]
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"{required_role}_role_required")
        return admin

    return _dependency
