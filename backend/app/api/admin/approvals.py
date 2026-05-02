"""Shared approvals queue/detail endpoints."""

from __future__ import annotations

from hashlib import sha256

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.api.admin.idempotency import unsupported_idempotency_response
from app.api.admin.security import require_admin_session, require_admin_write_session
from app.approvals.models import parse_shared_approval_id
from app.approvals.service import ApprovalAdminService
from app.execution.dependencies import (
    get_execution_session_factory,
    get_execution_transition_service,
)
from app.execution.service import (
    RunCommandIdempotencyConflictError,
    RunTransitionConflictError,
)
from app.governance.errors import GovernanceConflictError, GovernanceNotFoundError
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service
from app.idempotency import build_request_fingerprint, get_request_envelope
from app.instances.models import InstanceRecord
from app.instances.service import InstanceService, get_instance_service

router = APIRouter(prefix="/approvals", tags=["admin-approvals"])
_ELEVATED_ACCESS_APPROVAL_IDEMPOTENCY_MESSAGE = (
    "Idempotency-Key is not supported for elevated-access approval decisions until ForgeFrame persists replay-safe governance approval outcomes for that branch."
)
_SHARED_APPROVAL_COMPANY_SCOPE_MESSAGE = "companyId is not supported on /admin/approvals because elevated-access approvals are not company-scoped."
_SHARED_APPROVAL_TENANT_SCOPE_MESSAGE = "tenantId is not supported on /admin/approvals because approvals are instance-scoped, not tenant-primary."


class ApprovalDecisionRequest(BaseModel):
    decision_note: str | None = Field(default=None, max_length=500)


def _approval_error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"type": error_type, "message": message}},
    )


def _get_approval_admin_service(
    governance: GovernanceService = Depends(get_governance_service),
) -> ApprovalAdminService:
    return ApprovalAdminService(
        session_factory=get_execution_session_factory(),
        governance=governance,
        execution=get_execution_transition_service(),
    )


def _resolve_shared_approval_instance_scope(
    *,
    instance_id: str | None,
    tenant_id: str | None,
    company_id: str | None,
    service: InstanceService,
) -> tuple[InstanceRecord | None, JSONResponse | None]:
    if tenant_id is not None and tenant_id.strip():
        return None, _approval_error(
            status.HTTP_400_BAD_REQUEST,
            "approval_tenant_scope_unsupported",
            _SHARED_APPROVAL_TENANT_SCOPE_MESSAGE,
        )
    if company_id is not None and company_id.strip():
        return None, _approval_error(
            status.HTTP_400_BAD_REQUEST,
            "approval_company_scope_unsupported",
            _SHARED_APPROVAL_COMPANY_SCOPE_MESSAGE,
        )
    normalized_instance_id = instance_id.strip() if instance_id else None
    if normalized_instance_id is None:
        return None, None
    try:
        return (
            service.resolve_instance(
                instance_id=normalized_instance_id,
                allow_default=False,
                allow_legacy_backfill=False,
            ),
            None,
        )
    except ValueError as exc:
        return None, _approval_error(status.HTTP_404_NOT_FOUND, "instance_scope_not_found", str(exc))


@router.get("")
def list_approvals(
    status_filter: str | None = Query(default=None, alias="status"),
    approval_type_filter: str | None = Query(default=None, alias="approvalType"),
    risk_filter: str | None = Query(default=None, alias="risk"),
    due_filter: str | None = Query(default=None, alias="due"),
    approval_class_filter: str | None = Query(default=None, alias="approvalClass"),
    instance_id: str | None = Query(default=None, alias="instanceId"),
    tenant_id: str | None = Query(default=None, alias="tenantId"),
    company_id: str | None = Query(default=None, alias="companyId"),
    limit: int = 100,
    admin: AuthenticatedAdmin = Depends(require_admin_session),
    service: ApprovalAdminService = Depends(_get_approval_admin_service),
    instances: InstanceService = Depends(get_instance_service),
) -> object:
    """
    List approvals with optional filtering.

    Supports filtering by status, approval type, risk level, due state,
    approval class, and instance scope.

    :param status_filter: Filter by approval status
    :type status_filter: str | None
    :param approval_type_filter: Filter by approval type
    :type approval_type_filter: str | None
    :param risk_filter: Filter by risk level
    :type risk_filter: str | None
    :param due_filter: Filter by due state
    :type due_filter: str | None
    :param approval_class_filter: Filter by approval class
    :type approval_class_filter: str | None
    :param instance_id: Optional instance ID for scope resolution
    :type instance_id: str | None
    :param tenant_id: Optional tenant ID (not supported for approvals)
    :type tenant_id: str | None
    :param company_id: Optional company ID (not supported for approvals)
    :type company_id: str | None
    :param limit: Maximum number of approvals to return
    :type limit: int
    :param admin: Authenticated admin session
    :type admin: AuthenticatedAdmin
    :param service: Approval admin service
    :type service: ApprovalAdminService
    :param instances: Instance service for scope resolution
    :type instances: InstanceService
    :return: List of approval records
    :rtype: object
    :raises ValueError: If an invalid filter is provided
    :raises PermissionError: If admin lacks approval read access
    """
    instance, scope_error = _resolve_shared_approval_instance_scope(
        instance_id=instance_id,
        tenant_id=tenant_id,
        company_id=company_id,
        service=instances,
    )
    if scope_error is not None:
        return scope_error
    try:
        approvals = service.list_approvals(
            actor=admin,
            status=status_filter,
            approval_type=approval_type_filter,
            risk_level=risk_filter,
            due_state=due_filter,
            approval_class=approval_class_filter,
            limit=limit,
            instance=instance,
        )
    except ValueError as exc:
        return _approval_error(status.HTTP_400_BAD_REQUEST, "approval_filter_invalid", str(exc))
    except PermissionError as exc:
        return _approval_error(status.HTTP_403_FORBIDDEN, "approval_forbidden", str(exc))
    return {
        "status": "ok",
        "approvals": [item.model_dump(mode="json") for item in approvals],
    }


@router.get("/{approval_id}")
def approval_detail(
    approval_id: str,
    instance_id: str | None = Query(default=None, alias="instanceId"),
    tenant_id: str | None = Query(default=None, alias="tenantId"),
    company_id: str | None = Query(default=None, alias="companyId"),
    admin: AuthenticatedAdmin = Depends(require_admin_session),
    service: ApprovalAdminService = Depends(_get_approval_admin_service),
    instances: InstanceService = Depends(get_instance_service),
) -> object:
    """
    Get a single approval's full detail.

    :param approval_id: Approval identifier
    :type approval_id: str
    :param instance_id: Optional instance ID for scope resolution
    :type instance_id: str | None
    :param tenant_id: Optional tenant ID (not supported for approvals)
    :type tenant_id: str | None
    :param company_id: Optional company ID (not supported for approvals)
    :type company_id: str | None
    :param admin: Authenticated admin session
    :type admin: AuthenticatedAdmin
    :param service: Approval admin service
    :type service: ApprovalAdminService
    :param instances: Instance service for scope resolution
    :type instances: InstanceService
    :return: Approval detail record
    :rtype: object
    :raises LookupError: If approval is not found
    :raises GovernanceNotFoundError: If approval governance record is not found
    :raises PermissionError: If admin lacks approval read access
    """
    instance, scope_error = _resolve_shared_approval_instance_scope(
        instance_id=instance_id,
        tenant_id=tenant_id,
        company_id=company_id,
        service=instances,
    )
    if scope_error is not None:
        return scope_error
    try:
        detail = service.get_approval_detail(actor=admin, approval_id=approval_id, instance=instance)
    except ValueError as exc:
        return _approval_error(status.HTTP_400_BAD_REQUEST, "approval_invalid", str(exc))
    except LookupError as exc:
        return _approval_error(status.HTTP_404_NOT_FOUND, "approval_not_found", str(exc))
    except GovernanceNotFoundError as exc:
        return _approval_error(status.HTTP_404_NOT_FOUND, "approval_not_found", str(exc))
    except PermissionError as exc:
        return _approval_error(status.HTTP_403_FORBIDDEN, "approval_forbidden", str(exc))
    return {"status": "ok", "approval": detail.model_dump(mode="json")}


def _decision_idempotency_key(*, request: Request, approval_id: str, approved: bool) -> str:
    envelope = get_request_envelope(request)
    if envelope.idempotency_key is not None:
        return envelope.idempotency_key
    basis = f"{approval_id}|{'approve' if approved else 'reject'}|{envelope.request_id}"
    return f"approval:{sha256(basis.encode('utf-8')).hexdigest()[:24]}"


def _decide_approval(
    *,
    approval_id: str,
    payload: ApprovalDecisionRequest,
    request: Request,
    admin: AuthenticatedAdmin,
    service: ApprovalAdminService,
    instance: InstanceRecord | None,
    approved: bool,
) -> object:
    try:
        source_kind, _ = parse_shared_approval_id(approval_id)
    except ValueError as exc:
        return _approval_error(status.HTTP_400_BAD_REQUEST, "approval_invalid", str(exc))

    if source_kind == "elevated_access":
        unsupported = unsupported_idempotency_response(
            request,
            message=_ELEVATED_ACCESS_APPROVAL_IDEMPOTENCY_MESSAGE,
        )
        if unsupported is not None:
            return unsupported

    try:
        detail = service.decide_approval(
            actor=admin,
            approval_id=approval_id,
            approved=approved,
            decision_note=(payload.decision_note or "").strip(),
            idempotency_key=_decision_idempotency_key(request=request, approval_id=approval_id, approved=approved),
            request_fingerprint_hash=build_request_fingerprint(
                request,
                payload.model_dump(),
                content_type="application/json",
            )
            or "",
            instance=instance,
        )
    except ValueError as exc:
        return _approval_error(status.HTTP_400_BAD_REQUEST, "approval_invalid", str(exc))
    except LookupError as exc:
        return _approval_error(status.HTTP_404_NOT_FOUND, "approval_not_found", str(exc))
    except GovernanceNotFoundError as exc:
        return _approval_error(status.HTTP_404_NOT_FOUND, "approval_not_found", str(exc))
    except (
        GovernanceConflictError,
        RunTransitionConflictError,
        RunCommandIdempotencyConflictError,
    ) as exc:
        return _approval_error(status.HTTP_409_CONFLICT, "approval_conflict", str(exc))
    except PermissionError as exc:
        return _approval_error(status.HTTP_403_FORBIDDEN, "approval_forbidden", str(exc))
    return {"status": "ok", "approval": detail.model_dump(mode="json")}


@router.post("/{approval_id}/approve")
def approve_approval(
    approval_id: str,
    payload: ApprovalDecisionRequest,
    request: Request,
    instance_id: str | None = Query(default=None, alias="instanceId"),
    tenant_id: str | None = Query(default=None, alias="tenantId"),
    company_id: str | None = Query(default=None, alias="companyId"),
    admin: AuthenticatedAdmin = Depends(require_admin_write_session),
    service: ApprovalAdminService = Depends(_get_approval_admin_service),
    instances: InstanceService = Depends(get_instance_service),
) -> object:
    """
    Approve a pending approval.

    Requires a write session. Delegates to the shared approval decision
    flow with approved=True.

    :param approval_id: Approval identifier
    :type approval_id: str
    :param payload: Decision note payload
    :type payload: ApprovalDecisionRequest
    :param request: Incoming HTTP request
    :type request: Request
    :param instance_id: Optional instance ID for scope resolution
    :type instance_id: str | None
    :param tenant_id: Optional tenant ID (not supported for approvals)
    :type tenant_id: str | None
    :param company_id: Optional company ID (not supported for approvals)
    :type company_id: str | None
    :param admin: Authenticated admin with write session
    :type admin: AuthenticatedAdmin
    :param service: Approval admin service
    :type service: ApprovalAdminService
    :param instances: Instance service for scope resolution
    :type instances: InstanceService
    :return: Updated approval detail
    :rtype: object
    """
    instance, scope_error = _resolve_shared_approval_instance_scope(
        instance_id=instance_id,
        tenant_id=tenant_id,
        company_id=company_id,
        service=instances,
    )
    if scope_error is not None:
        return scope_error
    return _decide_approval(
        approval_id=approval_id,
        payload=payload,
        request=request,
        admin=admin,
        service=service,
        instance=instance,
        approved=True,
    )


@router.post("/{approval_id}/reject")
def reject_approval(
    approval_id: str,
    payload: ApprovalDecisionRequest,
    request: Request,
    instance_id: str | None = Query(default=None, alias="instanceId"),
    tenant_id: str | None = Query(default=None, alias="tenantId"),
    company_id: str | None = Query(default=None, alias="companyId"),
    admin: AuthenticatedAdmin = Depends(require_admin_write_session),
    service: ApprovalAdminService = Depends(_get_approval_admin_service),
    instances: InstanceService = Depends(get_instance_service),
) -> object:
    """
    Reject a pending approval.

    Requires a write session. Delegates to the shared approval decision
    flow with approved=False.

    :param approval_id: Approval identifier
    :type approval_id: str
    :param payload: Decision note payload
    :type payload: ApprovalDecisionRequest
    :param request: Incoming HTTP request
    :type request: Request
    :param instance_id: Optional instance ID for scope resolution
    :type instance_id: str | None
    :param tenant_id: Optional tenant ID (not supported for approvals)
    :type tenant_id: str | None
    :param company_id: Optional company ID (not supported for approvals)
    :type company_id: str | None
    :param admin: Authenticated admin with write session
    :type admin: AuthenticatedAdmin
    :param service: Approval admin service
    :type service: ApprovalAdminService
    :param instances: Instance service for scope resolution
    :type instances: InstanceService
    :return: Updated approval detail
    :rtype: object
    """
    instance, scope_error = _resolve_shared_approval_instance_scope(
        instance_id=instance_id,
        tenant_id=tenant_id,
        company_id=company_id,
        service=instances,
    )
    if scope_error is not None:
        return scope_error
    return _decide_approval(
        approval_id=approval_id,
        payload=payload,
        request=request,
        admin=admin,
        service=service,
        instance=instance,
        approved=False,
    )
