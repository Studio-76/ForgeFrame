"""Admin execution run inspection and replay endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse

from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.idempotency import (
    IdempotencyFingerprintMismatchError,
    IdempotencyRequestInProgressError,
    InvalidIdempotencyKeyError,
    RequestIdempotencyService,
    StoredResponseSnapshot,
    build_request_fingerprint,
    get_request_envelope,
)
from app.execution.admin_models import ExecutionReplayAuditReference, RunReplayRequest
from app.execution.admin_service import ExecutionAdminService
from app.execution.dependencies import (
    get_execution_admin_service,
    get_execution_session_factory,
    require_execution_company_scope,
)
from app.execution.service import (
    RunCommandIdempotencyConflictError,
    RunNotFoundError,
    RunTransitionConflictError,
)
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service

router = APIRouter(prefix="/execution", tags=["admin-execution"])


def _admin_error_payload(error_type: str, message: str) -> dict[str, object]:
    return {"error": {"type": error_type, "message": message}}


def _admin_error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=_admin_error_payload(error_type, message))


def _replay_snapshot_response(snapshot: StoredResponseSnapshot) -> JSONResponse:
    response = JSONResponse(status_code=snapshot.status_code, content=snapshot.body)
    response.headers["X-ForgeGate-Idempotent-Replay"] = "true"
    for key, value in snapshot.headers.items():
        response.headers[key] = value
    return response


@router.get("/runs")
def list_execution_runs(
    state: str | None = None,
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    company_id: str = Depends(require_execution_company_scope),
    service: ExecutionAdminService = Depends(get_execution_admin_service),
) -> dict[str, object]:
    runs = service.list_runs(company_id=company_id, state=state, limit=limit)
    return {"status": "ok", "runs": [item.model_dump(mode="json") for item in runs]}


@router.get("/runs/{run_id}")
def execution_run_detail(
    run_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    company_id: str = Depends(require_execution_company_scope),
    service: ExecutionAdminService = Depends(get_execution_admin_service),
) -> object:
    try:
        detail = service.get_run_detail(company_id=company_id, run_id=run_id)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "run_not_found", str(exc))
    return {"status": "ok", "run": detail.model_dump(mode="json")}


@router.post("/runs/{run_id}/replay")
def replay_execution_run(
    run_id: str,
    payload: RunReplayRequest,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("operator")),
    company_id: str = Depends(require_execution_company_scope),
    execution: ExecutionAdminService = Depends(get_execution_admin_service),
    governance: GovernanceService = Depends(get_governance_service),
) -> object:
    idempotency = RequestIdempotencyService(get_execution_session_factory())
    envelope = get_request_envelope(request)
    reservation = None
    try:
        reservation = idempotency.reserve(
            scope_key=f"admin.execution.run_replay:{company_id}:{run_id}",
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
            company_id=company_id,
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
        },
        company_id=company_id,
    )
    replay_payload = result.model_copy(
        update={
            "audit": ExecutionReplayAuditReference(
                event_id=audit_event.event_id,
                action=audit_event.action,
                target_type=audit_event.target_type,
                target_id=audit_event.target_id,
                status=audit_event.status,
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
