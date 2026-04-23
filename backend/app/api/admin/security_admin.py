"""Admin security and user-management endpoints."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.api.admin.idempotency import unsupported_idempotency_response
from app.api.admin.security import (
    require_admin_mutation_role,
    require_admin_role,
    require_admin_write_session,
)
from app.auth.local_auth import role_allows
from app.governance.errors import GovernanceConflictError, GovernanceEligibilityError, GovernanceNotFoundError
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service
from app.instances.service import InstanceService, get_instance_service

router = APIRouter(prefix="/security", tags=["admin-security"])
_SECURITY_IDEMPOTENCY_MESSAGE = (
    "Idempotency-Key is not supported for admin security mutations until ForgeFrame can persist replay-safe security "
    "outcomes without storing credentials or minting duplicate privileged sessions."
)


class AdminUserCreateRequest(BaseModel):
    username: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    role: str = Field(default="operator")
    password: str = Field(min_length=8)


class AdminUserUpdateRequest(BaseModel):
    display_name: str | None = None
    role: str | None = None
    status: str | None = None
    must_rotate_password: Literal[True] | None = None


class AdminInstanceMembershipRequest(BaseModel):
    role: Literal["owner", "admin", "operator", "viewer"]
    status: Literal["active", "disabled"] = "active"


class AdminPasswordRotateRequest(BaseModel):
    new_password: str = Field(min_length=8)
    must_rotate_password: Literal[True] = True


class ElevatedSessionRequest(BaseModel):
    approval_reference: str = Field(min_length=3)
    justification: str = Field(min_length=8)
    notification_targets: list[str] = Field(min_length=1)
    duration_minutes: int = Field(ge=1)


class ImpersonationRequest(ElevatedSessionRequest):
    target_user_id: str = Field(min_length=1)


class ElevatedAccessDecisionRequest(BaseModel):
    decision_note: str = Field(min_length=8, max_length=500)


class SecretRotationRecordRequest(BaseModel):
    target_type: str = Field(default="provider", min_length=1)
    target_id: str = Field(min_length=1)
    kind: str = Field(min_length=3)
    reference: str | None = Field(default=None, min_length=3)
    notes: str | None = None


def _security_error(
    status_code: int,
    error_type: str,
    message: str,
    *,
    details: dict[str, object] | None = None,
) -> JSONResponse:
    error: dict[str, object] = {"type": error_type, "message": message}
    if details:
        error["details"] = details
    return JSONResponse(status_code=status_code, content={"error": error})


@router.get("/bootstrap")
def security_bootstrap(
    admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    response: dict[str, object] = {
        "status": "ok",
        "credential_policy": service.credential_lifecycle_policy(actor=admin),
        "elevated_access_approver_posture": service.elevated_access_approver_posture(actor=admin),
    }
    # Operators need pre-submit elevated-access posture, but secret/bootstrap governance
    # details remain limited to full admin sessions.
    if role_allows(admin.role, "admin"):
        response.update(
            {
                "bootstrap": service.bootstrap_status(),
                "secret_posture": service.provider_secret_posture(),
                "harness_profiles": service.harness_secret_posture(),
                "recent_rotations": service.list_secret_rotation_events(limit=20),
                "secret_storage_controls": service.secret_storage_controls(),
            }
        )
    return response


@router.get("/users")
def list_admin_users(
    _admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    return {"status": "ok", "users": [item.model_dump() for item in service.list_admin_users()]}


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_admin_user(
    payload: AdminUserCreateRequest,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    unsupported = unsupported_idempotency_response(request, message=_SECURITY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
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
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    unsupported = unsupported_idempotency_response(request, message=_SECURITY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
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
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    unsupported = unsupported_idempotency_response(request, message=_SECURITY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        user = service.rotate_admin_password(
            user_id,
            new_password=payload.new_password,
            actor=admin,
        )
    except ValueError as exc:
        error_type = "admin_user_not_found" if str(exc) == "admin_user_not_found" else "admin_password_rotation_failed"
        error_status = status.HTTP_404_NOT_FOUND if error_type == "admin_user_not_found" else status.HTTP_400_BAD_REQUEST
        return _security_error(error_status, error_type, str(exc))
    return {"status": "ok", "user": user.model_dump()}


@router.get("/users/{user_id}/memberships")
def list_admin_user_memberships(
    user_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    try:
        memberships = service.list_admin_instance_memberships(user_id)
    except ValueError as exc:
        return _security_error(status.HTTP_404_NOT_FOUND, "admin_user_not_found", str(exc))
    return {"status": "ok", "memberships": [item.model_dump(mode="json") for item in memberships]}


@router.put("/users/{user_id}/memberships/{instance_id}")
def upsert_admin_user_membership(
    user_id: str,
    instance_id: str,
    payload: AdminInstanceMembershipRequest,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
    instances: InstanceService = Depends(get_instance_service),
) -> object:
    unsupported = unsupported_idempotency_response(request, message=_SECURITY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        instance = instances.get_instance(instance_id)
    except ValueError as exc:
        return _security_error(status.HTTP_404_NOT_FOUND, "instance_not_found", str(exc))
    try:
        membership = service.upsert_admin_instance_membership(
            user_id=user_id,
            instance=instance,
            role=payload.role,
            status=payload.status,
            actor=admin,
        )
    except ValueError as exc:
        error_type = "admin_user_not_found" if str(exc) == "admin_user_not_found" else "admin_instance_membership_invalid"
        error_status = status.HTTP_404_NOT_FOUND if error_type == "admin_user_not_found" else status.HTTP_400_BAD_REQUEST
        return _security_error(error_status, error_type, str(exc))
    return {"status": "ok", "membership": membership.model_dump(mode="json")}


@router.delete("/users/{user_id}/memberships/{instance_id}")
def delete_admin_user_membership(
    user_id: str,
    instance_id: str,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
    instances: InstanceService = Depends(get_instance_service),
) -> object:
    unsupported = unsupported_idempotency_response(request, message=_SECURITY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        instance = instances.get_instance(instance_id)
    except ValueError as exc:
        return _security_error(status.HTTP_404_NOT_FOUND, "instance_not_found", str(exc))
    try:
        service.remove_admin_instance_membership(
            user_id=user_id,
            instance=instance,
            actor=admin,
        )
    except ValueError as exc:
        error_type = str(exc)
        if error_type == "admin_user_not_found":
            return _security_error(status.HTTP_404_NOT_FOUND, error_type, error_type)
        if error_type == "admin_instance_membership_not_found":
            return _security_error(status.HTTP_404_NOT_FOUND, error_type, error_type)
        return _security_error(status.HTTP_400_BAD_REQUEST, error_type, error_type)
    return {"status": "ok", "deleted": {"user_id": user_id, "instance_id": instance_id}}


@router.get("/sessions")
def list_admin_sessions(
    _admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    return {"status": "ok", "sessions": service.list_admin_sessions(include_revoked=True)}


@router.post("/sessions/{session_id}/revoke")
def revoke_admin_session_by_id(
    session_id: str,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    unsupported = unsupported_idempotency_response(request, message=_SECURITY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
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
    return {
        "status": "ok",
        "providers": service.provider_secret_posture(),
        "harness_profiles": service.harness_secret_posture(),
        "recent_rotations": service.list_secret_rotation_events(limit=20),
        "controls": service.secret_storage_controls(),
    }


@router.get("/credential-policy")
def credential_policy(
    admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    return {"status": "ok", "policy": service.credential_lifecycle_policy(actor=admin)}


@router.get("/secret-rotations")
def list_secret_rotations(
    limit: int = 200,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    return {"status": "ok", "rotations": service.list_secret_rotation_events(limit=limit)}


@router.post("/secret-rotations", status_code=status.HTTP_201_CREATED)
def record_secret_rotation(
    payload: SecretRotationRecordRequest,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    unsupported = unsupported_idempotency_response(request, message=_SECURITY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        rotation = service.record_secret_rotation(
            target_type=payload.target_type,
            target_id=payload.target_id,
            kind=payload.kind,
            actor=admin,
            reference=payload.reference,
            notes=payload.notes,
        )
    except ValueError as exc:
        return _security_error(status.HTTP_400_BAD_REQUEST, "secret_rotation_record_failed", str(exc))
    return {"status": "ok", "rotation": rotation.model_dump()}


@router.get("/elevated-access-requests")
def list_elevated_access_requests(
    gate_status: str | None = None,
    admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    return {"status": "ok", "requests": service.list_elevated_access_requests(actor=admin, gate_status=gate_status)}


@router.post("/impersonations", status_code=status.HTTP_202_ACCEPTED)
def create_impersonation_request(
    payload: ImpersonationRequest,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    unsupported = unsupported_idempotency_response(request, message=_SECURITY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        access_request = service.request_impersonation_session(
            target_user_id=payload.target_user_id,
            actor=admin,
            justification=payload.justification,
            approval_reference=payload.approval_reference,
            notification_targets=payload.notification_targets,
            duration_minutes=payload.duration_minutes,
        )
    except GovernanceConflictError as exc:
        return _security_error(status.HTTP_409_CONFLICT, "elevated_access_request_conflict", str(exc))
    except GovernanceEligibilityError as exc:
        return _security_error(
            status.HTTP_409_CONFLICT,
            "elevated_access_recovery_required",
            str(exc),
            details=exc.details,
        )
    except PermissionError as exc:
        return _security_error(status.HTTP_403_FORBIDDEN, "impersonation_forbidden", str(exc))
    except ValueError as exc:
        return _security_error(status.HTTP_400_BAD_REQUEST, "impersonation_failed", str(exc))
    return {"status": "ok", "request": access_request}


@router.post("/break-glass", status_code=status.HTTP_202_ACCEPTED)
def create_break_glass_request(
    payload: ElevatedSessionRequest,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_write_session),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    unsupported = unsupported_idempotency_response(request, message=_SECURITY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        access_request = service.request_break_glass_session(
            actor=admin,
            justification=payload.justification,
            approval_reference=payload.approval_reference,
            notification_targets=payload.notification_targets,
            duration_minutes=payload.duration_minutes,
        )
    except GovernanceConflictError as exc:
        return _security_error(status.HTTP_409_CONFLICT, "elevated_access_request_conflict", str(exc))
    except GovernanceEligibilityError as exc:
        return _security_error(
            status.HTTP_409_CONFLICT,
            "elevated_access_recovery_required",
            str(exc),
            details=exc.details,
        )
    except PermissionError as exc:
        return _security_error(status.HTTP_403_FORBIDDEN, "break_glass_forbidden", str(exc))
    except ValueError as exc:
        return _security_error(status.HTTP_400_BAD_REQUEST, "break_glass_failed", str(exc))
    return {"status": "ok", "request": access_request}


@router.post("/elevated-access-requests/{request_id}/approve")
def approve_elevated_access_request(
    request_id: str,
    payload: ElevatedAccessDecisionRequest,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    unsupported = unsupported_idempotency_response(request, message=_SECURITY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        access_request = service.approve_elevated_access_request(
            request_id=request_id,
            actor=admin,
            decision_note=payload.decision_note,
        )
    except GovernanceNotFoundError as exc:
        return _security_error(status.HTTP_404_NOT_FOUND, "elevated_access_request_not_found", str(exc))
    except GovernanceConflictError as exc:
        return _security_error(status.HTTP_409_CONFLICT, "elevated_access_request_conflict", str(exc))
    except PermissionError as exc:
        return _security_error(status.HTTP_403_FORBIDDEN, "elevated_access_request_forbidden", str(exc))
    return {"status": "ok", "request": access_request}


@router.post("/elevated-access-requests/{request_id}/reject")
def reject_elevated_access_request(
    request_id: str,
    payload: ElevatedAccessDecisionRequest,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    unsupported = unsupported_idempotency_response(request, message=_SECURITY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        access_request = service.reject_elevated_access_request(
            request_id=request_id,
            actor=admin,
            decision_note=payload.decision_note,
        )
    except GovernanceNotFoundError as exc:
        return _security_error(status.HTTP_404_NOT_FOUND, "elevated_access_request_not_found", str(exc))
    except GovernanceConflictError as exc:
        return _security_error(status.HTTP_409_CONFLICT, "elevated_access_request_conflict", str(exc))
    except PermissionError as exc:
        return _security_error(status.HTTP_403_FORBIDDEN, "elevated_access_request_forbidden", str(exc))
    return {"status": "ok", "request": access_request}


@router.post("/elevated-access-requests/{request_id}/cancel")
def cancel_elevated_access_request(
    request_id: str,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("operator")),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    unsupported = unsupported_idempotency_response(request, message=_SECURITY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        access_request = service.cancel_elevated_access_request(
            request_id=request_id,
            actor=admin,
        )
    except GovernanceNotFoundError as exc:
        return _security_error(status.HTTP_404_NOT_FOUND, "elevated_access_request_not_found", str(exc))
    except GovernanceConflictError as exc:
        return _security_error(status.HTTP_409_CONFLICT, "elevated_access_request_conflict", str(exc))
    except PermissionError as exc:
        return _security_error(status.HTTP_403_FORBIDDEN, "elevated_access_request_forbidden", str(exc))
    return {"status": "ok", "request": access_request}


@router.post("/elevated-access-requests/{request_id}/issue", status_code=status.HTTP_201_CREATED)
def issue_elevated_access_session(
    request_id: str,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_write_session),
    service: GovernanceService = Depends(get_governance_service),
) -> object:
    unsupported = unsupported_idempotency_response(request, message=_SECURITY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        access_request, issued = service.issue_elevated_access_session(request_id=request_id, actor=admin)
    except GovernanceNotFoundError as exc:
        return _security_error(status.HTTP_404_NOT_FOUND, "elevated_access_request_not_found", str(exc))
    except GovernanceConflictError as exc:
        return _security_error(status.HTTP_409_CONFLICT, "elevated_access_request_conflict", str(exc))
    except PermissionError as exc:
        return _security_error(status.HTTP_403_FORBIDDEN, "elevated_access_request_forbidden", str(exc))
    except ValueError as exc:
        return _security_error(status.HTTP_400_BAD_REQUEST, "elevated_access_request_invalid", str(exc))
    return {"status": "ok", "request": access_request, **issued.model_dump()}
