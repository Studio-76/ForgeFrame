"""Admin execution run inspection and replay endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import require_admin_instance_scope
from app.api.admin.security import require_admin_instance_permission
from app.execution.admin_models import (
    ExecutionReplayAuditReference,
    RunOperatorActionRequest,
    RunReplayRequest,
)
from app.execution.admin_service import ExecutionAdminService
from app.execution.dependencies import (
    get_execution_admin_service,
    get_execution_session_factory,
)
from app.execution.service import (
    RunCommandIdempotencyConflictError,
    RunNotFoundError,
    RunTransitionConflictError,
)
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service
from app.idempotency import (
    IdempotencyFingerprintMismatchError,
    IdempotencyRequestInProgressError,
    InvalidIdempotencyKeyError,
    RequestIdempotencyService,
    StoredResponseSnapshot,
    build_request_fingerprint,
    get_request_envelope,
)
from app.instances.models import InstanceRecord

router = APIRouter(prefix="/execution", tags=["admin-execution"])


def _admin_error_payload(error_type: str, message: str) -> dict[str, object]:
    return {"error": {"type": error_type, "message": message}}


def _admin_error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=_admin_error_payload(error_type, message))


def _replay_snapshot_response(snapshot: StoredResponseSnapshot) -> JSONResponse:
    response = JSONResponse(status_code=snapshot.status_code, content=snapshot.body)
    response.headers["X-ForgeFrame-Idempotent-Replay"] = "true"
    for key, value in snapshot.headers.items():
        response.headers[key] = value
    return response


def _record_operator_audit(
    *,
    governance: GovernanceService,
    admin: AuthenticatedAdmin,
    instance: InstanceRecord,
    action: str,
    run_id: str | None,
    reason: str,
    metadata: dict[str, object],
) -> None:
    governance.record_admin_audit_event(
        actor=admin,
        action=action,
        target_type="execution_run" if run_id else "execution_dispatch",
        target_id=run_id,
        status="ok",
        details=reason,
        metadata={**metadata, "instance_id": instance.instance_id},
        instance_id=instance.instance_id,
        tenant_id=instance.tenant_id,
        company_id=instance.company_id,
    )


@router.get("/runs")
def list_execution_runs(
    state: str | None = None,
    execution_lane: str | None = None,
    target: str | None = None,
    approval_wait: bool | None = None,
    has_error: bool | None = None,
    window: str | None = None,
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("execution.read", explicit_scope=True)),
    instance: InstanceRecord = Depends(require_admin_instance_scope),
    service: ExecutionAdminService = Depends(get_execution_admin_service),
) -> dict[str, object]:
    """
    List execution runs with optional filtering by state, lane, target, and other criteria.

    :param state: Filter by run state
    :type state: str | None
    :param execution_lane: Filter by execution lane
    :type execution_lane: str | None
    :param target: Filter by target
    :type target: str | None
    :param approval_wait: Filter by approval-wait status
    :type approval_wait: bool | None
    :param has_error: Filter by error presence
    :type has_error: bool | None
    :param window: Time window filter
    :type window: str | None
    :param limit: Maximum number of runs to return
    :type limit: int
    :param _admin: Injected admin permission dependency
    :type _admin: AuthenticatedAdmin
    :param instance: Resolved instance record
    :type instance: InstanceRecord
    :param service: Execution admin service
    :type service: ExecutionAdminService
    :return: List of execution run records
    :rtype: dict[str, object]
    """
    runs = service.list_runs(
        instance=instance,
        state=state,
        execution_lane=execution_lane,
        target=target,
        approval_wait=approval_wait,
        has_error=has_error,
        window=window,
        limit=limit,
    )
    return {"status": "ok", "runs": [item.model_dump(mode="json") for item in runs]}


@router.get("/queues")
def list_execution_queues(
    execution_lane: str | None = None,
    state: str | None = None,
    target: str | None = None,
    age: str | None = None,
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("execution.read", explicit_scope=True)),
    instance: InstanceRecord = Depends(require_admin_instance_scope),
    service: ExecutionAdminService = Depends(get_execution_admin_service),
) -> dict[str, object]:
    """
    List execution queue lanes and their runs.

    :param execution_lane: Filter by execution lane
    :type execution_lane: str | None
    :param state: Filter by run state
    :type state: str | None
    :param target: Filter by target
    :type target: str | None
    :param age: Filter by age
    :type age: str | None
    :param limit: Maximum number of runs to return
    :type limit: int
    :param _admin: Injected admin permission dependency
    :type _admin: AuthenticatedAdmin
    :param instance: Resolved instance record
    :type instance: InstanceRecord
    :param service: Execution admin service
    :type service: ExecutionAdminService
    :return: Queue lanes and runs
    :rtype: dict[str, object]
    """
    lanes, runs = service.list_queue_view(
        instance=instance,
        execution_lane=execution_lane,
        state=state,
        target=target,
        age=age,
        limit=limit,
    )
    return {
        "status": "ok",
        "lanes": [item.model_dump(mode="json") for item in lanes],
        "runs": [item.model_dump(mode="json") for item in runs],
    }


@router.get("/dispatch")
def get_execution_dispatch(
    _admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("execution.read", explicit_scope=True)),
    instance: InstanceRecord = Depends(require_admin_instance_scope),
    service: ExecutionAdminService = Depends(get_execution_admin_service),
) -> dict[str, object]:
    """
    Return a snapshot of the current dispatch state including stalled attempts,
    leased attempts, and quarantined runs.

    :param _admin: Injected admin permission dependency
    :type _admin: AuthenticatedAdmin
    :param instance: Resolved instance record
    :type instance: InstanceRecord
    :param service: Execution admin service
    :type service: ExecutionAdminService
    :return: Dispatch snapshot
    :rtype: dict[str, object]
    """
    snapshot = service.get_dispatch_snapshot(instance=instance)
    return {"status": "ok", "dispatch": snapshot.model_dump(mode="json")}


@router.get("/runs/{run_id}")
def execution_run_detail(
    run_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("execution.read", explicit_scope=True)),
    instance: InstanceRecord = Depends(require_admin_instance_scope),
    service: ExecutionAdminService = Depends(get_execution_admin_service),
) -> object:
    """
    Get full detail for a single execution run.

    :param run_id: Execution run identifier
    :type run_id: str
    :param _admin: Injected admin permission dependency
    :type _admin: AuthenticatedAdmin
    :param instance: Resolved instance record
    :type instance: InstanceRecord
    :param service: Execution admin service
    :type service: ExecutionAdminService
    :return: Full execution run detail
    :rtype: object
    :raises ValueError: If run is not found
    """
    try:
        detail = service.get_run_detail(instance=instance, run_id=run_id)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "run_not_found", str(exc))
    return {"status": "ok", "run": detail.model_dump(mode="json")}


@router.post("/runs/{run_id}/replay")
def replay_execution_run(
    run_id: str,
    payload: RunReplayRequest,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("execution.operate", allow_impersonation=False, explicit_scope=True)),
    instance: InstanceRecord = Depends(require_admin_instance_scope),
    execution: ExecutionAdminService = Depends(get_execution_admin_service),
    governance: GovernanceService = Depends(get_governance_service),
) -> object:
    """
    Replay an execution run with idempotency support.

    Validates the request against the idempotency service, replays the run,
    and records an audit event for the operation.

    :param run_id: Execution run identifier to replay
    :type run_id: str
    :param payload: Replay request payload with reason
    :type payload: RunReplayRequest
    :param request: Incoming HTTP request
    :type request: Request
    :param admin: Authenticated admin with operate permission
    :type admin: AuthenticatedAdmin
    :param instance: Resolved instance record
    :type instance: InstanceRecord
    :param execution: Execution admin service
    :type execution: ExecutionAdminService
    :param governance: Governance service for audit recording
    :type governance: GovernanceService
    :return: Replay result with audit reference
    :rtype: object
    :raises RunNotFoundError: If run is not found
    :raises RunTransitionConflictError: If run cannot be replayed due to state
    :raises RunCommandIdempotencyConflictError: If idempotency key conflicts
    """
    idempotency = RequestIdempotencyService(get_execution_session_factory())
    envelope = get_request_envelope(request)
    reservation = None
    try:
        reservation = idempotency.reserve(
            scope_key=f"admin.execution.run_replay:{instance.instance_id}:{run_id}",
            request_path=request.url.path,
            envelope=envelope,
            fallback_idempotency_key=payload.idempotency_key,
            request_fingerprint_hash=build_request_fingerprint(
                request,
                payload.model_dump(mode="json"),
                content_type="application/json",
            ),
        )
    except InvalidIdempotencyKeyError as exc:
        return _admin_error(status.HTTP_400_BAD_REQUEST, "invalid_idempotency_key", str(exc))
    except IdempotencyFingerprintMismatchError as exc:
        return _admin_error(status.HTTP_409_CONFLICT, "idempotency_fingerprint_mismatch", str(exc))
    except IdempotencyRequestInProgressError as exc:
        return _admin_error(status.HTTP_409_CONFLICT, "idempotency_in_progress", str(exc))

    if reservation is not None and reservation.replay is not None:
        return _replay_snapshot_response(reservation.replay)

    try:
        result = execution.replay_run(
            instance=instance,
            run_id=run_id,
            actor_id=admin.user_id,
            reason=payload.reason,
            idempotency_key=reservation.idempotency_key if reservation is not None else payload.idempotency_key,
        )
    except RunNotFoundError as exc:
        body = _admin_error_payload("run_not_found", str(exc))
        idempotency.complete(reservation=reservation, status_code=status.HTTP_404_NOT_FOUND, body=body)
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=body)
    except RunTransitionConflictError as exc:
        body = _admin_error_payload("run_transition_conflict", str(exc))
        idempotency.complete(reservation=reservation, status_code=status.HTTP_409_CONFLICT, body=body)
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=body)
    except RunCommandIdempotencyConflictError as exc:
        body = _admin_error_payload("idempotency_fingerprint_mismatch", str(exc))
        idempotency.complete(reservation=reservation, status_code=status.HTTP_409_CONFLICT, body=body)
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=body)
    except ValueError as exc:
        body = _admin_error_payload("run_replay_invalid", str(exc))
        idempotency.complete(reservation=reservation, status_code=status.HTTP_400_BAD_REQUEST, body=body)
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=body)
    except Exception:
        idempotency.abandon(reservation=reservation)
        raise

    audit_event = governance.record_admin_audit_event(
        actor=admin,
        action="execution_run_replay",
        target_type="execution_run",
        target_id=run_id,
        status="ok",
        details=f"Replay admitted for run '{run_id}'.",
        metadata={
            "reason": payload.reason.strip(),
            "command_id": result.command_id,
            "attempt_id": result.attempt_id,
            "deduplicated": result.deduplicated,
            "instance_id": instance.instance_id,
        },
        instance_id=instance.instance_id,
        tenant_id=instance.tenant_id,
        company_id=instance.company_id,
    )
    replay_payload = result.model_copy(
        update={
            "audit": ExecutionReplayAuditReference(
                event_id=audit_event.event_id,
                action=audit_event.action,
                target_type=audit_event.target_type,
                target_id=audit_event.target_id,
                status=audit_event.status,
                instance_id=instance.instance_id,
                tenant_id=audit_event.tenant_id,
                company_id=audit_event.company_id,
            ),
        }
    )
    body = {"status": "ok", "replay": replay_payload.model_dump(mode="json")}
    idempotency.complete(
        reservation=reservation,
        status_code=status.HTTP_200_OK,
        body=body,
        resource_type="execution_run",
        resource_id=run_id,
    )
    return JSONResponse(status_code=status.HTTP_200_OK, content=body)


def _run_operator_action(
    *,
    run_id: str,
    payload: RunOperatorActionRequest,
    action: str,
    admin: AuthenticatedAdmin,
    instance: InstanceRecord,
    execution: ExecutionAdminService,
    governance: GovernanceService,
) -> object:
    try:
        result = execution.perform_operator_action(
            instance=instance,
            run_id=run_id,
            actor_id=admin.user_id,
            action=action,
            reason=payload.reason,
            execution_lane=payload.execution_lane,
            idempotency_key=payload.idempotency_key,
        )
    except RunNotFoundError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "run_not_found", str(exc))
    except RunTransitionConflictError as exc:
        return _admin_error(status.HTTP_409_CONFLICT, "run_transition_conflict", str(exc))
    except RunCommandIdempotencyConflictError as exc:
        return _admin_error(status.HTTP_409_CONFLICT, "idempotency_fingerprint_mismatch", str(exc))
    except ValueError as exc:
        return _admin_error(status.HTTP_400_BAD_REQUEST, "execution_operator_action_invalid", str(exc))

    _record_operator_audit(
        governance=governance,
        admin=admin,
        instance=instance,
        action=f"execution_run_{action}",
        run_id=run_id,
        reason=payload.reason.strip(),
        metadata={
            "command_id": result.command_id,
            "attempt_id": result.attempt_id,
            "related_run_id": result.related_run_id,
            "run_state": result.run_state,
            "operator_state": result.operator_state,
            "execution_lane": result.execution_lane,
        },
    )
    return {"status": "ok", "action": result.model_dump(mode="json")}


@router.post("/runs/{run_id}/pause")
def pause_execution_run(
    run_id: str,
    payload: RunOperatorActionRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("execution.operate", allow_impersonation=False, explicit_scope=True)),
    instance: InstanceRecord = Depends(require_admin_instance_scope),
    execution: ExecutionAdminService = Depends(get_execution_admin_service),
    governance: GovernanceService = Depends(get_governance_service),
) -> object:
    """
    Pause an execution run. Delegates to the shared operator action flow.

    :param run_id: Execution run identifier
    :type run_id: str
    :param payload: Operator action request with reason
    :type payload: RunOperatorActionRequest
    :param admin: Authenticated admin with operate permission
    :type admin: AuthenticatedAdmin
    :param instance: Resolved instance record
    :type instance: InstanceRecord
    :param execution: Execution admin service
    :type execution: ExecutionAdminService
    :param governance: Governance service for audit recording
    :type governance: GovernanceService
    :return: Operator action result
    :rtype: object
    """
    return _run_operator_action(
        run_id=run_id,
        payload=payload,
        action="pause",
        admin=admin,
        instance=instance,
        execution=execution,
        governance=governance,
    )


@router.post("/runs/{run_id}/resume")
def resume_execution_run(
    run_id: str,
    payload: RunOperatorActionRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("execution.operate", allow_impersonation=False, explicit_scope=True)),
    instance: InstanceRecord = Depends(require_admin_instance_scope),
    execution: ExecutionAdminService = Depends(get_execution_admin_service),
    governance: GovernanceService = Depends(get_governance_service),
) -> object:
    """
    Resume a paused execution run. Delegates to the shared operator action flow.

    :param run_id: Execution run identifier
    :type run_id: str
    :param payload: Operator action request with reason
    :type payload: RunOperatorActionRequest
    :param admin: Authenticated admin with operate permission
    :type admin: AuthenticatedAdmin
    :param instance: Resolved instance record
    :type instance: InstanceRecord
    :param execution: Execution admin service
    :type execution: ExecutionAdminService
    :param governance: Governance service for audit recording
    :type governance: GovernanceService
    :return: Operator action result
    :rtype: object
    """
    return _run_operator_action(
        run_id=run_id,
        payload=payload,
        action="resume",
        admin=admin,
        instance=instance,
        execution=execution,
        governance=governance,
    )


@router.post("/runs/{run_id}/interrupt")
def interrupt_execution_run(
    run_id: str,
    payload: RunOperatorActionRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("execution.operate", allow_impersonation=False, explicit_scope=True)),
    instance: InstanceRecord = Depends(require_admin_instance_scope),
    execution: ExecutionAdminService = Depends(get_execution_admin_service),
    governance: GovernanceService = Depends(get_governance_service),
) -> object:
    """
    Interrupt an execution run. Delegates to the shared operator action flow.

    :param run_id: Execution run identifier
    :type run_id: str
    :param payload: Operator action request with reason
    :type payload: RunOperatorActionRequest
    :param admin: Authenticated admin with operate permission
    :type admin: AuthenticatedAdmin
    :param instance: Resolved instance record
    :type instance: InstanceRecord
    :param execution: Execution admin service
    :type execution: ExecutionAdminService
    :param governance: Governance service for audit recording
    :type governance: GovernanceService
    :return: Operator action result
    :rtype: object
    """
    return _run_operator_action(
        run_id=run_id,
        payload=payload,
        action="interrupt",
        admin=admin,
        instance=instance,
        execution=execution,
        governance=governance,
    )


@router.post("/runs/{run_id}/quarantine")
def quarantine_execution_run(
    run_id: str,
    payload: RunOperatorActionRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("execution.operate", allow_impersonation=False, explicit_scope=True)),
    instance: InstanceRecord = Depends(require_admin_instance_scope),
    execution: ExecutionAdminService = Depends(get_execution_admin_service),
    governance: GovernanceService = Depends(get_governance_service),
) -> object:
    """
    Quarantine an execution run. Delegates to the shared operator action flow.

    :param run_id: Execution run identifier
    :type run_id: str
    :param payload: Operator action request with reason
    :type payload: RunOperatorActionRequest
    :param admin: Authenticated admin with operate permission
    :type admin: AuthenticatedAdmin
    :param instance: Resolved instance record
    :type instance: InstanceRecord
    :param execution: Execution admin service
    :type execution: ExecutionAdminService
    :param governance: Governance service for audit recording
    :type governance: GovernanceService
    :return: Operator action result
    :rtype: object
    """
    return _run_operator_action(
        run_id=run_id,
        payload=payload,
        action="quarantine",
        admin=admin,
        instance=instance,
        execution=execution,
        governance=governance,
    )


@router.post("/runs/{run_id}/restart")
def restart_execution_run(
    run_id: str,
    payload: RunOperatorActionRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("execution.operate", allow_impersonation=False, explicit_scope=True)),
    instance: InstanceRecord = Depends(require_admin_instance_scope),
    execution: ExecutionAdminService = Depends(get_execution_admin_service),
    governance: GovernanceService = Depends(get_governance_service),
) -> object:
    """
    Restart an execution run. Delegates to the shared operator action flow.

    :param run_id: Execution run identifier
    :type run_id: str
    :param payload: Operator action request with reason
    :type payload: RunOperatorActionRequest
    :param admin: Authenticated admin with operate permission
    :type admin: AuthenticatedAdmin
    :param instance: Resolved instance record
    :type instance: InstanceRecord
    :param execution: Execution admin service
    :type execution: ExecutionAdminService
    :param governance: Governance service for audit recording
    :type governance: GovernanceService
    :return: Operator action result
    :rtype: object
    """
    return _run_operator_action(
        run_id=run_id,
        payload=payload,
        action="restart",
        admin=admin,
        instance=instance,
        execution=execution,
        governance=governance,
    )


@router.post("/runs/{run_id}/escalate")
def escalate_execution_run(
    run_id: str,
    payload: RunOperatorActionRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("execution.operate", allow_impersonation=False, explicit_scope=True)),
    instance: InstanceRecord = Depends(require_admin_instance_scope),
    execution: ExecutionAdminService = Depends(get_execution_admin_service),
    governance: GovernanceService = Depends(get_governance_service),
) -> object:
    """
    Escalate an execution run. Delegates to the shared operator action flow.

    :param run_id: Execution run identifier
    :type run_id: str
    :param payload: Operator action request with reason
    :type payload: RunOperatorActionRequest
    :param admin: Authenticated admin with operate permission
    :type admin: AuthenticatedAdmin
    :param instance: Resolved instance record
    :type instance: InstanceRecord
    :param execution: Execution admin service
    :type execution: ExecutionAdminService
    :param governance: Governance service for audit recording
    :type governance: GovernanceService
    :return: Operator action result
    :rtype: object
    """
    return _run_operator_action(
        run_id=run_id,
        payload=payload,
        action="escalate",
        admin=admin,
        instance=instance,
        execution=execution,
        governance=governance,
    )


@router.post("/dispatch/reconcile-leases")
def reconcile_execution_leases(
    admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("execution.operate", allow_impersonation=False, explicit_scope=True)),
    instance: InstanceRecord = Depends(require_admin_instance_scope),
    execution: ExecutionAdminService = Depends(get_execution_admin_service),
    governance: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    """
    Reconcile expired execution leases.

    Finds and reconciles stale dispatch leases, recording an audit event.

    :param admin: Authenticated admin with operate permission
    :type admin: AuthenticatedAdmin
    :param instance: Resolved instance record
    :type instance: InstanceRecord
    :param execution: Execution admin service
    :type execution: ExecutionAdminService
    :param governance: Governance service for audit recording
    :type governance: GovernanceService
    :return: List of reconciled runs
    :rtype: dict[str, object]
    """
    results = execution.reconcile_expired_leases(instance=instance)
    _record_operator_audit(
        governance=governance,
        admin=admin,
        instance=instance,
        action="execution_dispatch_reconcile_leases",
        run_id=None,
        reason="Expired execution leases reconciled.",
        metadata={"reconciled_runs": len(results)},
    )
    return {
        "status": "ok",
        "reconciled": [item.model_dump(mode="json") for item in results],
    }
