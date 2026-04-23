"""Admin auth dependencies."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.local_auth import role_allows
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service
from app.instances.models import InstanceRecord
from app.api.admin.instance_scope import require_admin_instance_scope, resolve_admin_instance_scope

_bearer = HTTPBearer(auto_error=False)


def authenticate_admin_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    service: GovernanceService = Depends(get_governance_service),
) -> AuthenticatedAdmin:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin authentication required.")
    try:
        return service.authenticate_admin_token(credentials.credentials)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


def _ensure_password_rotation_complete(
    admin: AuthenticatedAdmin,
    *,
    allow_password_rotation_required: bool = False,
) -> AuthenticatedAdmin:
    if admin.session_type == "impersonation":
        return admin
    if admin.must_rotate_password and not allow_password_rotation_required:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="password_rotation_required",
        )
    return admin


def _ensure_write_capable_session(admin: AuthenticatedAdmin) -> AuthenticatedAdmin:
    if admin.session_type == "impersonation":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="impersonation_session_read_only",
        )
    return admin


def require_admin_session(
    admin: AuthenticatedAdmin = Depends(authenticate_admin_session),
) -> AuthenticatedAdmin:
    return _ensure_password_rotation_complete(admin)


def require_admin_session_allowing_password_rotation(
    admin: AuthenticatedAdmin = Depends(authenticate_admin_session),
) -> AuthenticatedAdmin:
    return _ensure_password_rotation_complete(admin, allow_password_rotation_required=True)


def require_admin_write_session(
    admin: AuthenticatedAdmin = Depends(authenticate_admin_session),
) -> AuthenticatedAdmin:
    return _ensure_password_rotation_complete(_ensure_write_capable_session(admin))


def require_admin_write_session_allowing_password_rotation(
    admin: AuthenticatedAdmin = Depends(authenticate_admin_session),
) -> AuthenticatedAdmin:
    return _ensure_password_rotation_complete(
        _ensure_write_capable_session(admin),
        allow_password_rotation_required=True,
    )


def require_admin_role(
    required_role: str,
    *,
    allow_impersonation: bool = True,
) -> Callable[[AuthenticatedAdmin], AuthenticatedAdmin]:
    def _dependency(admin: AuthenticatedAdmin = Depends(authenticate_admin_session)) -> AuthenticatedAdmin:
        if not allow_impersonation:
            admin = _ensure_write_capable_session(admin)
        admin = _ensure_password_rotation_complete(admin)
        if not role_allows(admin.role, required_role):  # type: ignore[arg-type]
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"{required_role}_role_required")
        return admin

    return _dependency


def require_admin_mutation_role(required_role: str) -> Callable[[AuthenticatedAdmin], AuthenticatedAdmin]:
    return require_admin_role(required_role, allow_impersonation=False)


def require_admin_instance_permission(
    permission_key: str,
    *,
    allow_impersonation: bool = True,
    explicit_scope: bool = False,
) -> Callable[[AuthenticatedAdmin], AuthenticatedAdmin]:
    instance_dependency = require_admin_instance_scope if explicit_scope else resolve_admin_instance_scope

    def _dependency(
        admin: AuthenticatedAdmin = Depends(authenticate_admin_session),
        instance: InstanceRecord = Depends(instance_dependency),
        service: GovernanceService = Depends(get_governance_service),
    ) -> AuthenticatedAdmin:
        if not allow_impersonation:
            admin = _ensure_write_capable_session(admin)
        admin = _ensure_password_rotation_complete(admin)
        try:
            service.authorize_admin_instance_permission(
                actor=admin,
                instance=instance,
                permission_key=permission_key,
            )
        except PermissionError as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
        return admin

    return _dependency
