"""Execution domain contracts for transactional run persistence.

Lightweight import surface.  Heavy modules (``service.py``) are loaded lazily
to minimise startup-time import chain cost.
"""

from __future__ import annotations

from app.execution.models import (
    EXECUTION_WORKER_STATES,
    RUN_APPROVAL_GATE_STATUSES,
    RUN_ATTEMPT_STATES,
    RUN_COMMAND_ACTOR_TYPES,
    RUN_COMMAND_STATUSES,
    RUN_COMMAND_TYPES,
    RUN_EXECUTION_LANES,
    RUN_EXTERNAL_CALL_STATUSES,
    RUN_FAILURE_CLASSES,
    RUN_LEASE_STATUSES,
    RUN_OPERATOR_STATES,
    RUN_OUTBOX_EVENT_TYPES,
    RUN_OUTBOX_PUBLISH_STATES,
    RUN_RESUME_DISPOSITIONS,
    RUN_SECRET_BINDING_STATUSES,
    RUN_STATES,
    SECRET_PURPOSES,
    SECRET_REFERENCE_ROTATION_STATUSES,
    SECRET_REFERENCE_VERIFICATION_STATUSES,
    CreateExecutionWorker,
    CreateRun,
    CreateRunApprovalLink,
    CreateRunAttempt,
    CreateRunCommand,
    CreateRunExternalCall,
    CreateRunOutboxEntry,
    CreateRunSecretBinding,
    CreateSecretReference,
    ExecutionWorkerRecord,
    RunApprovalLinkRecord,
    RunAttemptRecord,
    RunCommandRecord,
    RunExternalCallRecord,
    RunOutboxEntryRecord,
    RunRecord,
    RunSecretBindingRecord,
    SecretReferenceRecord,
)

# Re-exported from ``service.py`` — loaded lazily to avoid pulling in
# ``transitions``, SQLAlchemy, and the full state-machine machinery at
# package-import time.  Consumers that need these types should import
# directly from ``app.execution.service`` for best startup performance.

__lazy_service_names: frozenset[str] = frozenset({
    "ApprovalOpenResult",
    "AttemptFailureResult",
    "ClaimCandidate",
    "ClaimResult",
    "CommandTransitionResult",
    "ExecutionTransitionError",
    "ExecutionTransitionService",
    "LeaseHeartbeatResult",
    "LeaseReconcileResult",
    "RunNotFoundError",
    "RunTransitionConflictError",
    "StaleWorkerClaimError",
})


def __getattr__(name: str):
    if name in __lazy_service_names:
        import importlib

        svc = importlib.import_module("app.execution.service")
        return getattr(svc, name)
    msg = f"module {__name__!r} has no attribute {name!r}"
    raise AttributeError(msg)


__all__ = [
    "CreateRun",
    "CreateRunApprovalLink",
    "CreateRunAttempt",
    "CreateRunCommand",
    "CreateExecutionWorker",
    "CreateRunExternalCall",
    "CreateRunOutboxEntry",
    "CreateRunSecretBinding",
    "CreateSecretReference",
    "ApprovalOpenResult",
    "AttemptFailureResult",
    "ClaimCandidate",
    "ClaimResult",
    "CommandTransitionResult",
    "ExecutionTransitionError",
    "ExecutionTransitionService",
    "LeaseHeartbeatResult",
    "LeaseReconcileResult",
    "EXECUTION_WORKER_STATES",
    "RUN_APPROVAL_GATE_STATUSES",
    "RUN_ATTEMPT_STATES",
    "RUN_COMMAND_ACTOR_TYPES",
    "RUN_COMMAND_STATUSES",
    "RUN_COMMAND_TYPES",
    "RUN_EXECUTION_LANES",
    "RUN_EXTERNAL_CALL_STATUSES",
    "RUN_FAILURE_CLASSES",
    "RUN_LEASE_STATUSES",
    "RUN_OUTBOX_EVENT_TYPES",
    "RUN_OUTBOX_PUBLISH_STATES",
    "RUN_OPERATOR_STATES",
    "RUN_RESUME_DISPOSITIONS",
    "RUN_SECRET_BINDING_STATUSES",
    "RUN_STATES",
    "RunNotFoundError",
    "SECRET_PURPOSES",
    "SECRET_REFERENCE_ROTATION_STATUSES",
    "SECRET_REFERENCE_VERIFICATION_STATUSES",
    "ExecutionWorkerRecord",
    "RunApprovalLinkRecord",
    "RunAttemptRecord",
    "RunCommandRecord",
    "RunExternalCallRecord",
    "RunOutboxEntryRecord",
    "RunRecord",
    "RunTransitionConflictError",
    "RunSecretBindingRecord",
    "SecretReferenceRecord",
    "StaleWorkerClaimError",
]
