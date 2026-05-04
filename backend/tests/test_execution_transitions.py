from __future__ import annotations

import logging
import threading
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest
from sqlalchemy import create_engine, func, select, update
from sqlalchemy.orm import Session, sessionmaker

from app.execution import dependencies as execution_dependencies
from app.execution.admin_service import ExecutionAdminService
from app.execution.service import (
    ExecutionTransitionService,
    RunCommandIdempotencyConflictError,
    RunTransitionConflictError,
    StaleWorkerClaimError,
    StateMachineValidatorFactory,
)
from app.execution.state_machine import (
    MISMATCH_CATEGORY_APPROVAL_LINK_MISMATCH,
    MISMATCH_CATEGORY_INVALID_TRIGGER,
    MISMATCH_CATEGORY_RUN_STATE_MISMATCH,
    MISMATCH_CATEGORY_VALIDATOR_EXCEPTION,
    ExecutionStateDecision,
    ExecutionStateSnapshot,
    ExecutionTransitionContext,
    ExecutionValidationResult,
)
from app.instances.models import InstanceRecord
from app.settings.config import Settings
from app.storage.execution_repository import (
    RunApprovalLinkORM,
    RunAttemptORM,
    RunCommandORM,
    RunORM,
    RunOutboxORM,
)
from app.storage.models import Base


def _service(
    tmp_path: Path,
    *,
    state_machine_validation_enabled: bool = False,
    state_machine_validator_factory: StateMachineValidatorFactory | None = None,
) -> tuple[ExecutionTransitionService, sessionmaker[Session]]:
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'execution.sqlite'}")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(engine, autoflush=False, expire_on_commit=False)
    return (
        ExecutionTransitionService(
            session_factory,
            state_machine_validation_enabled=state_machine_validation_enabled,
            state_machine_validator_factory=state_machine_validator_factory,
        ),
        session_factory,
    )


class _ValidationSpy:
    """Test double that records advisory validation calls."""

    def __init__(
        self,
        calls: list[tuple[str, ExecutionTransitionContext]],
        *,
        result: ExecutionValidationResult | None = None,
        exception: Exception | None = None,
    ) -> None:
        self._calls = calls
        self._result = result or ExecutionValidationResult(valid=True, validated=True)
        self._exception = exception

    def validate_run_transition(
        self,
        trigger: str,
        context: ExecutionTransitionContext,
    ) -> ExecutionValidationResult:
        self._calls.append((trigger, context))
        if self._exception is not None:
            raise self._exception
        return self._result

    def validate_operator_transition(
        self,
        trigger: str,
        context: ExecutionTransitionContext,
    ) -> ExecutionValidationResult:
        return self.validate_run_transition(trigger, context)

    def validate_creation(
        self,
        operation: str,
        before_snapshot: ExecutionStateSnapshot,
        after_snapshot: ExecutionStateSnapshot,
    ) -> ExecutionValidationResult:
        return ExecutionValidationResult(valid=True, validated=True)

    def validate_non_state_operation(
        self,
        before_snapshot: ExecutionStateSnapshot,
        after_snapshot: ExecutionStateSnapshot,
    ) -> ExecutionValidationResult:
        return ExecutionValidationResult(valid=True, validated=True)

    def check_transition_allowed(
        self,
        trigger: str,
        context: ExecutionTransitionContext,
    ) -> tuple[bool, str | None]:
        return True, None


class _TriggerValidationSpy:
    """Test double that returns a special result for one trigger."""

    def __init__(
        self,
        calls: list[tuple[str, ExecutionTransitionContext]],
        *,
        target_trigger: str,
        result: ExecutionValidationResult,
    ) -> None:
        self._calls = calls
        self._target_trigger = target_trigger
        self._result = result

    def validate_run_transition(
        self,
        trigger: str,
        context: ExecutionTransitionContext,
    ) -> ExecutionValidationResult:
        self._calls.append((trigger, context))
        if trigger == self._target_trigger:
            return self._result
        return ExecutionValidationResult(valid=True, validated=True)

    def validate_operator_transition(
        self,
        trigger: str,
        context: ExecutionTransitionContext,
    ) -> ExecutionValidationResult:
        return self.validate_run_transition(trigger, context)

    def validate_creation(
        self,
        operation: str,
        before_snapshot: ExecutionStateSnapshot,
        after_snapshot: ExecutionStateSnapshot,
    ) -> ExecutionValidationResult:
        return ExecutionValidationResult(valid=True, validated=True)

    def validate_non_state_operation(
        self,
        before_snapshot: ExecutionStateSnapshot,
        after_snapshot: ExecutionStateSnapshot,
    ) -> ExecutionValidationResult:
        return ExecutionValidationResult(valid=True, validated=True)

    def check_transition_allowed(
        self,
        trigger: str,
        context: ExecutionTransitionContext,
    ) -> tuple[bool, str | None]:
        if trigger == self._target_trigger and not self._result.valid:
            return False, self._result.error_message or "simulated block"
        return True, None


def _validation_records(caplog) -> list[logging.LogRecord]:
    """Return structured state-machine validation log records."""

    return [record for record in caplog.records if hasattr(record, "state_machine_validation")]


def _validation_payload(record: logging.LogRecord) -> dict[str, Any]:
    """Return the structured state-machine payload from a log record."""

    return cast("dict[str, Any]", getattr(record, "state_machine_validation"))


def _count(session: Session, orm_type: type[object]) -> int:
    return int(session.scalar(select(func.count()).select_from(orm_type)) or 0)


def test_state_machine_validation_disabled_does_not_construct_validator(
    tmp_path: Path,
    caplog,
) -> None:
    calls: list[tuple[str, ExecutionTransitionContext]] = []

    def validator_factory() -> _ValidationSpy:
        raise AssertionError("disabled validation must not construct validators")

    service, _session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=False,
        state_machine_validator_factory=validator_factory,
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")
    service.admit_create(
        company_id="cmp_123",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_disabled_create",
        request_fingerprint_hash="fp_disabled_create",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(
        company_id="cmp_123",
        worker_key="worker_alpha",
    )

    assert claim is not None
    assert calls == []
    assert _validation_records(caplog) == []


def test_state_machine_validation_logs_mismatch_without_changing_claim(
    tmp_path: Path,
    caplog,
) -> None:
    calls: list[tuple[str, ExecutionTransitionContext]] = []
    mismatch = ExecutionValidationResult(
        valid=True,
        validated=True,
        decision=ExecutionStateDecision(target_run_state="succeeded"),
    )

    service, _session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
        state_machine_validator_factory=lambda: _ValidationSpy(calls, result=mismatch),
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")
    created = service.admit_create(
        company_id="cmp_123",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_mismatch_create",
        request_fingerprint_hash="fp_mismatch_create",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(
        company_id="cmp_123",
        worker_key="worker_alpha",
    )

    assert claim is not None
    assert claim.run_id == created.run_id
    assert calls[0][0] == "claim_attempt"
    records = _validation_records(caplog)
    assert len(records) == 1
    payload = _validation_payload(records[0])
    assert payload["trigger"] == "claim_attempt"
    assert payload["mismatch_category"] == MISMATCH_CATEGORY_RUN_STATE_MISMATCH
    assert payload["after"]["run_state"] == "dispatching"


def test_state_machine_validator_exception_is_non_fatal(
    tmp_path: Path,
    caplog,
) -> None:
    calls: list[tuple[str, ExecutionTransitionContext]] = []

    service, _session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
        state_machine_validator_factory=lambda: _ValidationSpy(
            calls,
            exception=RuntimeError("validator exploded"),
        ),
    )
    caplog.set_level(logging.ERROR, logger="app.execution.service")
    service.admit_create(
        company_id="cmp_123",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_exception_create",
        request_fingerprint_hash="fp_exception_create",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(
        company_id="cmp_123",
        worker_key="worker_alpha",
    )

    assert claim is not None
    assert calls[0][0] == "claim_attempt"
    records = _validation_records(caplog)
    assert len(records) == 1
    payload = _validation_payload(records[0])
    assert payload["mismatch_category"] == MISMATCH_CATEGORY_VALIDATOR_EXCEPTION
    assert payload["exception_class"] == "RuntimeError"


def test_state_machine_validation_preserves_successful_worker_hot_path(
    tmp_path: Path,
    caplog,
) -> None:
    service, session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")
    created = service.admit_create(
        company_id="cmp_123",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_success_create",
        request_fingerprint_hash="fp_success_create",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(
        company_id="cmp_123",
        worker_key="worker_alpha",
    )
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_123",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_call",
    )
    service.complete_attempt_success(
        company_id="cmp_123",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        result_summary={"worker": "ok"},
    )

    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        attempt = session.get(RunAttemptORM, created.attempt_id)

    assert run is not None
    assert attempt is not None
    assert run.state == "succeeded"
    assert run.operator_state == "completed"
    assert attempt.attempt_state == "succeeded"
    assert attempt.operator_state == "completed"
    assert _validation_records(caplog) == []


def test_state_machine_validation_preserves_failure_hot_paths(
    tmp_path: Path,
    caplog,
) -> None:
    service, _session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")

    retryable_run = service.admit_create(
        company_id="cmp_retry",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_retryable_validation_create",
        request_fingerprint_hash="fp_retryable_validation_create",
        run_kind="provider_dispatch",
    )
    retryable_claim = service.claim_next_attempt(
        company_id="cmp_retry",
        worker_key="worker_retry",
    )
    assert retryable_claim is not None
    service.mark_attempt_executing(
        company_id="cmp_retry",
        run_id=retryable_claim.run_id,
        attempt_id=retryable_claim.attempt_id,
        lease_token=retryable_claim.lease_token,
        step_key="provider_call",
    )
    retryable_failure = service.record_attempt_failure(
        company_id="cmp_retry",
        run_id=retryable_claim.run_id,
        attempt_id=retryable_claim.attempt_id,
        lease_token=retryable_claim.lease_token,
        failure_class="provider_transient",
        error_code="provider_timeout",
        error_detail="upstream timed out",
        retryable=True,
        max_attempts=3,
        backoff_base_seconds=30,
        backoff_max_seconds=30,
        backoff_jitter_ratio=0.0,
    )

    terminal_run = service.admit_create(
        company_id="cmp_terminal",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_terminal_validation_create",
        request_fingerprint_hash="fp_terminal_validation_create",
        run_kind="provider_dispatch",
    )
    terminal_claim = service.claim_next_attempt(
        company_id="cmp_terminal",
        worker_key="worker_terminal",
    )
    assert terminal_claim is not None
    service.mark_attempt_executing(
        company_id="cmp_terminal",
        run_id=terminal_claim.run_id,
        attempt_id=terminal_claim.attempt_id,
        lease_token=terminal_claim.lease_token,
        step_key="provider_call",
    )
    terminal_failure = service.record_attempt_failure(
        company_id="cmp_terminal",
        run_id=terminal_claim.run_id,
        attempt_id=terminal_claim.attempt_id,
        lease_token=terminal_claim.lease_token,
        failure_class="provider_terminal",
        error_code="provider_authentication_error",
        error_detail="credentials rejected",
        retryable=False,
        max_attempts=3,
    )

    assert retryable_run.run_state == "queued"
    assert retryable_failure.retry_scheduled is True
    assert retryable_failure.run_state == "retry_backoff"
    assert retryable_failure.next_attempt_id is not None
    assert terminal_run.run_state == "queued"
    assert terminal_failure.retry_scheduled is False
    assert terminal_failure.run_state == "dead_lettered"
    assert _validation_records(caplog) == []


def test_state_machine_validation_skips_idempotent_cancel_replay(
    tmp_path: Path,
) -> None:
    calls: list[tuple[str, ExecutionTransitionContext]] = []
    service, _session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
        state_machine_validator_factory=lambda: _ValidationSpy(calls),
    )
    created = service.admit_create(
        company_id="cmp_123",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_replay_create",
        request_fingerprint_hash="fp_replay_create",
        run_kind="provider_dispatch",
    )

    first = service.request_cancel(
        company_id="cmp_123",
        run_id=created.run_id,
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_cancel_replay",
        request_fingerprint_hash="fp_cancel_replay",
    )
    second = service.request_cancel(
        company_id="cmp_123",
        run_id=created.run_id,
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_cancel_replay",
        request_fingerprint_hash="fp_cancel_replay",
    )

    assert first.deduplicated is False
    assert second.deduplicated is True
    assert second.command_id == first.command_id
    assert [call[0] for call in calls] == ["request_cancel"]


def test_state_machine_validation_logs_approval_mismatch_without_changing_open(
    tmp_path: Path,
    caplog,
) -> None:
    """Approval validation mismatches must be non-fatal."""
    calls: list[tuple[str, ExecutionTransitionContext]] = []
    mismatch = ExecutionValidationResult(
        valid=True,
        validated=True,
        decision=ExecutionStateDecision(target_run_state="failed"),
    )
    service, session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
        state_machine_validator_factory=lambda: _TriggerValidationSpy(
            calls,
            target_trigger="open_approval",
            result=mismatch,
        ),
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")

    created = service.admit_create(
        company_id="cmp_approval_mismatch",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_approval_mismatch_create",
        request_fingerprint_hash="fp_approval_mismatch_create",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(
        company_id="cmp_approval_mismatch",
        worker_key="worker_approval_mismatch",
    )
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_approval_mismatch",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="approval_gate",
    )
    approval = service.open_approval(
        company_id="cmp_approval_mismatch",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        approval_id="approval_mismatch_1",
        gate_key="approval_gate",
    )

    assert approval.run_id == created.run_id
    assert [call[0] for call in calls][-1] == "open_approval"
    records = _validation_records(caplog)
    assert len(records) == 1
    payload = _validation_payload(records[0])
    assert payload["trigger"] == "open_approval"
    assert payload["mismatch_category"] == MISMATCH_CATEGORY_RUN_STATE_MISMATCH
    assert payload["after"]["run_state"] == "waiting_on_approval"
    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        assert run is not None
        assert run.state == "waiting_on_approval"
        assert run.current_approval_link_id == approval.approval_link_id


def test_state_machine_validation_logs_stale_current_approval_warning(
    tmp_path: Path,
    caplog,
) -> None:
    """Approval decisions should warn without clearing retained links."""
    service, session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")

    created = service.admit_create(
        company_id="cmp_approval_stale",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_approval_stale_create",
        request_fingerprint_hash="fp_approval_stale_create",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(
        company_id="cmp_approval_stale",
        worker_key="worker_approval_stale",
    )
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_approval_stale",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="approval_gate",
    )
    approval = service.open_approval(
        company_id="cmp_approval_stale",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        approval_id="approval_stale_1",
        gate_key="approval_gate",
    )
    assert _validation_records(caplog) == []

    result = service.decide_approval(
        company_id="cmp_approval_stale",
        approval_id="approval_stale_1",
        actor_type="user",
        actor_id="approver_stale",
        idempotency_key="idem_approval_stale_decide",
        request_fingerprint_hash="fp_approval_stale_decide",
        approved=True,
    )

    assert result.run_state == "queued"
    records = _validation_records(caplog)
    assert len(records) == 1
    payload = _validation_payload(records[0])
    assert payload["trigger"] == "resume_after_approval"
    assert payload["mismatch_category"] == MISMATCH_CATEGORY_APPROVAL_LINK_MISMATCH
    assert payload["before"]["approval_gate_status"] == "open"
    assert payload["after"]["approval_gate_status"] == "approved"
    assert payload["after"]["current_approval_link_id"] == approval.approval_link_id
    assert payload["command_id"] == result.command_id
    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        link = session.get(RunApprovalLinkORM, approval.approval_link_id)
        assert run is not None
        assert link is not None
        assert run.current_approval_link_id == approval.approval_link_id
        assert link.gate_status == "approved"


def test_state_machine_validation_logs_open_approval_cancel_warning(
    tmp_path: Path,
    caplog,
) -> None:
    """Cancelling from an open approval should warn without closing it."""
    service, session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")

    created = service.admit_create(
        company_id="cmp_approval_cancel",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_approval_cancel_create",
        request_fingerprint_hash="fp_approval_cancel_create",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(
        company_id="cmp_approval_cancel",
        worker_key="worker_approval_cancel",
    )
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_approval_cancel",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="approval_gate",
    )
    approval = service.open_approval(
        company_id="cmp_approval_cancel",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        approval_id="approval_cancel_1",
        gate_key="approval_gate",
    )
    assert _validation_records(caplog) == []

    result = service.request_cancel(
        company_id="cmp_approval_cancel",
        run_id=created.run_id,
        actor_type="user",
        actor_id="operator_cancel",
        idempotency_key="idem_approval_cancel_request",
        request_fingerprint_hash="fp_approval_cancel_request",
    )

    assert result.run_state == "cancel_requested"
    records = _validation_records(caplog)
    assert len(records) == 1
    payload = _validation_payload(records[0])
    assert payload["trigger"] == "request_cancel"
    assert payload["mismatch_category"] == MISMATCH_CATEGORY_APPROVAL_LINK_MISMATCH
    assert payload["before"]["approval_gate_status"] == "open"
    assert payload["after"]["approval_gate_status"] == "open"
    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        link = session.get(RunApprovalLinkORM, approval.approval_link_id)
        assert run is not None
        assert link is not None
        assert run.current_approval_link_id == approval.approval_link_id
        assert link.gate_status == "open"


def test_dependency_wires_state_machine_validation_flag(
    tmp_path: Path,
    monkeypatch,
) -> None:
    settings = Settings(
        admin_auth_enabled=False,
        harness_storage_backend="file",
        control_plane_storage_backend="file",
        observability_storage_backend="file",
        governance_storage_backend="file",
        instances_storage_backend="file",
        execution_sqlite_path=str(tmp_path / "dependency-execution.sqlite"),
        execution_state_machine_validation_enabled=True,
    )
    monkeypatch.setattr(execution_dependencies, "get_settings", lambda: settings)
    execution_dependencies.clear_execution_dependency_caches()
    try:
        service = execution_dependencies.get_execution_transition_service()
        assert service._state_machine_validation_enabled is True
    finally:
        execution_dependencies.clear_execution_dependency_caches()


def test_duplicate_create_command_returns_original_admission_snapshot(
    tmp_path: Path,
) -> None:
    service, session_factory = _service(tmp_path)

    first = service.admit_create(
        company_id="cmp_123",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_1",
        request_fingerprint_hash="fp_create_1",
        run_kind="provider_dispatch",
        issue_id="FOR-38",
    )
    duplicate = service.admit_create(
        company_id="cmp_123",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_1",
        request_fingerprint_hash="fp_create_1",
        run_kind="provider_dispatch",
        issue_id="FOR-38",
    )

    assert duplicate.deduplicated is True
    assert duplicate.command_id == first.command_id
    assert duplicate.run_id == first.run_id
    assert duplicate.attempt_id == first.attempt_id
    assert duplicate.outbox_event == "run_dispatch"
    assert duplicate.run_state == "queued"

    with session_factory() as session:
        outbox = (
            session
            .execute(
                select(RunOutboxORM)
                .where(
                    RunOutboxORM.run_id == first.run_id,
                    RunOutboxORM.event_type == "run_dispatch",
                )
                .order_by(RunOutboxORM.created_at.desc())
            )
            .scalars()
            .first()
        )

        assert _count(session, RunCommandORM) == 1
        assert _count(session, RunORM) == 1
        assert _count(session, RunAttemptORM) == 1
        assert _count(session, RunOutboxORM) == 1
        assert outbox is not None
        assert outbox.dedupe_key == f"run:{first.run_id}:command:{first.command_id}:dispatch"


def test_admin_replay_without_idempotency_key_recovers_from_concurrent_insert_race(
    tmp_path: Path,
) -> None:
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'execution-threaded.sqlite'}",
        connect_args={"check_same_thread": False, "timeout": 5},
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(engine, autoflush=False, expire_on_commit=False)
    transitions = ExecutionTransitionService(session_factory)

    created = transitions.admit_create(
        company_id="cmp_123",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_replay_race",
        request_fingerprint_hash="fp_create_replay_race",
        run_kind="provider_dispatch",
        issue_id="FOR-91",
    )
    claim = transitions.claim_next_attempt(company_id="cmp_123", worker_key="worker_alpha")
    assert claim is not None
    transitions.mark_attempt_executing(
        company_id="cmp_123",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_call",
    )
    transitions.record_attempt_failure(
        company_id="cmp_123",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        failure_class="provider_terminal",
        error_code="provider_authentication_error",
        error_detail="credentials rejected by upstream",
        retryable=False,
    )

    class CoordinatedExecutionTransitionService(ExecutionTransitionService):
        def __init__(self, session_factory: sessionmaker[Session], barrier: threading.Barrier):
            super().__init__(session_factory)
            self._barrier = barrier

        def _find_command_or_raise_conflict(
            self,
            session: Session,
            *,
            company_id: str,
            command_type: str,
            actor_type: str,
            actor_id: str,
            idempotency_key: str,
            request_fingerprint_hash: str,
        ) -> RunCommandORM | None:
            existing = super()._find_command_or_raise_conflict(
                session,
                company_id=company_id,
                command_type=command_type,
                actor_type=actor_type,
                actor_id=actor_id,
                idempotency_key=idempotency_key,
                request_fingerprint_hash=request_fingerprint_hash,
            )
            if existing is None and command_type == "retry" and actor_type == "user" and actor_id == "operator_alpha":
                self._barrier.wait(timeout=5)
            return existing

    instance = InstanceRecord(
        company_id="cmp_123",
        instance_id="default",
        tenant_id="default",
        created_at=datetime.now(UTC).isoformat(),
        updated_at=datetime.now(UTC).isoformat(),
    )

    start_barrier = threading.Barrier(2)
    insert_barrier = threading.Barrier(2)
    admin_service = ExecutionAdminService(session_factory)
    admin_service._transitions = CoordinatedExecutionTransitionService(session_factory, insert_barrier)

    reason = "Replay after provider credentials were rotated and verified."
    results = []
    errors = []
    lock = threading.Lock()

    def invoke() -> None:
        try:
            start_barrier.wait(timeout=5)
            result = admin_service.replay_run(
                instance=instance,
                run_id=created.run_id,
                actor_id="operator_alpha",
                reason=reason,
            )
            with lock:
                results.append(result)
        except BaseException as exc:  # pragma: no cover - assertion below is the contract
            with lock:
                errors.append(exc)

    threads = [threading.Thread(target=invoke), threading.Thread(target=invoke)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=5)

    assert all(not thread.is_alive() for thread in threads)
    assert not errors, [repr(error) for error in errors]
    assert len(results) == 2
    assert sorted(result.deduplicated for result in results) == [False, True]
    assert len({result.command_id for result in results}) == 1
    assert len({result.attempt_id for result in results}) == 1

    with session_factory() as session:
        commands = (
            session
            .execute(
                select(RunCommandORM)
                .where(
                    RunCommandORM.company_id == "cmp_123",
                    RunCommandORM.run_id == created.run_id,
                )
                .order_by(RunCommandORM.issued_at.desc())
            )
            .scalars()
            .all()
        )
        attempts = (
            session
            .execute(
                select(RunAttemptORM)
                .where(
                    RunAttemptORM.company_id == "cmp_123",
                    RunAttemptORM.run_id == created.run_id,
                )
                .order_by(RunAttemptORM.attempt_no.asc())
            )
            .scalars()
            .all()
        )

        assert [command.command_type for command in commands] == ["retry", "create"]
        assert commands[0].response_snapshot is not None
        assert commands[0].response_snapshot["replay_reason"] == reason
        assert [attempt.attempt_no for attempt in attempts] == [1, 2]


def test_create_admission_recovers_from_concurrent_insert_race(tmp_path: Path) -> None:
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'execution-create-threaded.sqlite'}",
        connect_args={"check_same_thread": False, "timeout": 5},
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(engine, autoflush=False, expire_on_commit=False)

    class CoordinatedExecutionTransitionService(ExecutionTransitionService):
        def __init__(self, session_factory: sessionmaker[Session], barrier: threading.Barrier):
            super().__init__(session_factory)
            self._barrier = barrier

        def _find_command_or_raise_conflict(
            self,
            session: Session,
            *,
            company_id: str,
            command_type: str,
            actor_type: str,
            actor_id: str,
            idempotency_key: str,
            request_fingerprint_hash: str,
        ) -> RunCommandORM | None:
            existing = super()._find_command_or_raise_conflict(
                session,
                company_id=company_id,
                command_type=command_type,
                actor_type=actor_type,
                actor_id=actor_id,
                idempotency_key=idempotency_key,
                request_fingerprint_hash=request_fingerprint_hash,
            )
            if existing is None and command_type == "create" and actor_type == "agent" and actor_id == "agent_backend":
                self._barrier.wait(timeout=5)
            return existing

    start_barrier = threading.Barrier(2)
    insert_barrier = threading.Barrier(2)
    transitions = CoordinatedExecutionTransitionService(session_factory, insert_barrier)
    results = []
    errors = []
    lock = threading.Lock()

    def invoke() -> None:
        try:
            start_barrier.wait(timeout=5)
            result = transitions.admit_create(
                company_id="cmp_123",
                actor_type="agent",
                actor_id="agent_backend",
                idempotency_key="idem_create_insert_race",
                request_fingerprint_hash="fp_create_insert_race",
                run_kind="provider_dispatch",
                issue_id="FOR-149",
            )
            with lock:
                results.append(result)
        except BaseException as exc:  # pragma: no cover - assertion below is the contract
            with lock:
                errors.append(exc)

    threads = [threading.Thread(target=invoke), threading.Thread(target=invoke)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=5)

    assert all(not thread.is_alive() for thread in threads)
    assert not errors, [repr(error) for error in errors]
    assert len(results) == 2
    assert sorted(result.deduplicated for result in results) == [False, True]
    assert len({result.command_id for result in results}) == 1
    assert len({result.run_id for result in results}) == 1
    assert len({result.attempt_id for result in results}) == 1

    primary = results[0]
    with session_factory() as session:
        outbox = (
            session
            .execute(
                select(RunOutboxORM)
                .where(
                    RunOutboxORM.run_id == primary.run_id,
                    RunOutboxORM.event_type == "run_dispatch",
                )
                .order_by(RunOutboxORM.created_at.desc())
            )
            .scalars()
            .first()
        )

        assert _count(session, RunCommandORM) == 1
        assert _count(session, RunORM) == 1
        assert _count(session, RunAttemptORM) == 1
        assert _count(session, RunOutboxORM) == 1
        assert outbox is not None
        assert outbox.dedupe_key == f"run:{primary.run_id}:command:{primary.command_id}:dispatch"


def test_duplicate_create_command_rejects_fingerprint_mismatch(tmp_path: Path) -> None:
    service, session_factory = _service(tmp_path)

    service.admit_create(
        company_id="cmp_123",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_conflict",
        request_fingerprint_hash="fp_create_conflict_v1",
        run_kind="provider_dispatch",
        issue_id="FOR-25",
    )

    try:
        service.admit_create(
            company_id="cmp_123",
            actor_type="agent",
            actor_id="agent_backend",
            idempotency_key="idem_create_conflict",
            request_fingerprint_hash="fp_create_conflict_v2",
            run_kind="provider_dispatch",
            issue_id="FOR-25",
        )
    except RunCommandIdempotencyConflictError as exc:
        assert "different create command" in str(exc)
    else:  # pragma: no cover - the failure branch is the real assertion
        raise AssertionError("Expected reused create idempotency key to reject mismatched fingerprints.")

    with session_factory() as session:
        assert _count(session, RunCommandORM) == 1
        assert _count(session, RunORM) == 1
        assert _count(session, RunAttemptORM) == 1
        assert _count(session, RunOutboxORM) == 1


def test_worker_claim_uses_compare_and_set_versions(tmp_path: Path) -> None:
    service, session_factory = _service(tmp_path)

    created = service.admit_create(
        company_id="cmp_123",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_claim",
        request_fingerprint_hash="fp_create_claim",
        run_kind="provider_dispatch",
    )
    candidate = service.peek_claimable_attempt(company_id="cmp_123")
    assert candidate is not None
    assert candidate.run_id == created.run_id
    assert candidate.attempt_id == created.attempt_id

    claim = service.claim_attempt(
        company_id="cmp_123",
        run_id=candidate.run_id,
        attempt_id=candidate.attempt_id,
        expected_run_version=candidate.run_version,
        expected_attempt_version=candidate.attempt_version,
        worker_key="worker_alpha",
    )

    assert claim.run_version == 1
    assert claim.attempt_version == 1

    try:
        service.claim_attempt(
            company_id="cmp_123",
            run_id=candidate.run_id,
            attempt_id=candidate.attempt_id,
            expected_run_version=candidate.run_version,
            expected_attempt_version=candidate.attempt_version,
            worker_key="worker_bravo",
        )
    except StaleWorkerClaimError:
        pass
    else:  # pragma: no cover - the failure branch is the real assertion
        raise AssertionError("Expected stale worker claim to fail compare-and-set.")

    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        attempt = session.get(RunAttemptORM, created.attempt_id)
        assert run is not None
        assert attempt is not None
        assert run.state == "dispatching"
        assert run.version == 1
        assert attempt.attempt_state == "dispatching"
        assert attempt.worker_key == "worker_alpha"
        assert attempt.version == 1


def test_cancel_during_execution_persists_command_run_attempt_and_outbox(
    tmp_path: Path,
) -> None:
    service, session_factory = _service(tmp_path)

    created = service.admit_create(
        company_id="cmp_123",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_cancel",
        request_fingerprint_hash="fp_create_cancel",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(company_id="cmp_123", worker_key="worker_alpha")
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_123",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_call",
    )

    cancel = service.request_cancel(
        company_id="cmp_123",
        run_id=created.run_id,
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_cancel_1",
        request_fingerprint_hash="fp_cancel_1",
    )

    assert cancel.outbox_event == "run_cancel"
    assert cancel.run_state == "cancel_requested"

    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        attempt = session.get(RunAttemptORM, created.attempt_id)
        command = session.get(RunCommandORM, cancel.command_id)
        outbox = (
            session
            .execute(
                select(RunOutboxORM)
                .where(
                    RunOutboxORM.run_id == created.run_id,
                    RunOutboxORM.event_type == "run_cancel",
                )
                .order_by(RunOutboxORM.created_at.desc())
            )
            .scalars()
            .first()
        )

        assert run is not None
        assert attempt is not None
        assert command is not None
        assert outbox is not None
        assert run.state == "cancel_requested"
        assert attempt.attempt_state == "cancel_requested"
        assert command.command_type == "cancel"
        assert command.command_status == "completed"
        assert outbox.publish_state == "pending"
        assert outbox.dedupe_key == f"run:{created.run_id}:command:{cancel.command_id}:cancel"


def test_retryable_failure_schedules_backoff_attempt_and_dispatch_outbox(
    tmp_path: Path,
) -> None:
    service, session_factory = _service(tmp_path)

    created = service.admit_create(
        company_id="cmp_123",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_retryable_failure",
        request_fingerprint_hash="fp_create_retryable_failure",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(company_id="cmp_123", worker_key="worker_alpha")
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_123",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_call",
    )

    result = service.record_attempt_failure(
        company_id="cmp_123",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        failure_class="provider_transient",
        error_code="provider_rate_limited",
        error_detail="rate limit reached",
        retryable=True,
        max_attempts=3,
        backoff_base_seconds=10,
        backoff_max_seconds=60,
        backoff_jitter_ratio=0.2,
    )

    assert result.retry_scheduled is True
    assert result.run_state == "retry_backoff"
    assert result.outbox_event == "run_dispatch"
    assert result.next_attempt_id is not None
    assert result.retry_delay_seconds is not None
    assert 10 <= result.retry_delay_seconds <= 12

    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        first_attempt = session.get(RunAttemptORM, created.attempt_id)
        retry_attempt = session.get(RunAttemptORM, result.next_attempt_id)
        outbox = (
            session
            .execute(
                select(RunOutboxORM)
                .where(
                    RunOutboxORM.run_id == created.run_id,
                    RunOutboxORM.attempt_id == result.next_attempt_id,
                )
                .order_by(RunOutboxORM.created_at.desc())
            )
            .scalars()
            .first()
        )

        assert run is not None
        assert first_attempt is not None
        assert retry_attempt is not None
        assert outbox is not None
        assert first_attempt.attempt_state == "failed"
        assert first_attempt.last_error_code == "provider_rate_limited"
        assert first_attempt.last_error_detail == "rate limit reached"
        assert first_attempt.finished_at is not None
        assert retry_attempt.attempt_no == 2
        assert retry_attempt.retry_count == 1
        assert retry_attempt.attempt_state == "retry_backoff"
        assert retry_attempt.backoff_until == retry_attempt.scheduled_at
        assert run.state == "retry_backoff"
        assert run.status_reason == "retry_scheduled"
        assert run.active_attempt_no == 2
        assert run.current_attempt_id == retry_attempt.id
        assert run.next_wakeup_at == retry_attempt.scheduled_at
        assert run.failure_class == "provider_transient"
        assert run.result_summary is not None
        assert run.result_summary["last_failure"]["retryable"] is True
        assert run.result_summary["next_attempt_id"] == retry_attempt.id
        assert run.result_summary["wake_gate"]["spurious_wake_blocked"] is True
        assert run.result_summary["dispatch"]["stage"] == "retry_scheduled"
        assert outbox.event_type == "run_dispatch"
        assert outbox.payload["retry_of_attempt_id"] == created.attempt_id
        assert outbox.dedupe_key == f"run:{created.run_id}:attempt:{retry_attempt.id}:dispatch"


def test_terminal_failure_dead_letters_run_and_preserves_diagnostics(
    tmp_path: Path,
) -> None:
    service, session_factory = _service(tmp_path)

    created = service.admit_create(
        company_id="cmp_123",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_dead_letter",
        request_fingerprint_hash="fp_create_dead_letter",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(company_id="cmp_123", worker_key="worker_alpha")
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_123",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_call",
    )

    result = service.record_attempt_failure(
        company_id="cmp_123",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        failure_class="provider_terminal",
        error_code="provider_authentication_error",
        error_detail="credentials rejected by upstream",
        retryable=False,
        max_attempts=3,
    )

    assert result.retry_scheduled is False
    assert result.run_state == "dead_lettered"
    assert result.outbox_event == "dead_letter"
    assert result.dead_letter_reason == "terminal_failure"

    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        attempt = session.get(RunAttemptORM, created.attempt_id)
        outbox = (
            session
            .execute(
                select(RunOutboxORM)
                .where(
                    RunOutboxORM.run_id == created.run_id,
                    RunOutboxORM.event_type == "dead_letter",
                )
                .order_by(RunOutboxORM.created_at.desc())
            )
            .scalars()
            .first()
        )

        assert run is not None
        assert attempt is not None
        assert outbox is not None
        assert run.state == "dead_lettered"
        assert run.status_reason == "terminal_failure"
        assert run.failure_class == "provider_terminal"
        assert run.terminal_at is not None
        assert run.result_summary is not None
        assert run.result_summary["error_code"] == "provider_authentication_error"
        assert run.result_summary["dispatch"]["stage"] == "dead_lettered"
        assert attempt.attempt_state == "dead_lettered"
        assert attempt.last_error_code == "provider_authentication_error"
        assert attempt.last_error_detail == "credentials rejected by upstream"
        assert attempt.finished_at is not None
        assert outbox.publish_state == "pending"
        assert outbox.payload["dead_letter_reason"] == "terminal_failure"
        assert outbox.dedupe_key == f"run:{created.run_id}:attempt:{created.attempt_id}:dead_letter"


def test_replay_reason_is_persisted_on_retry_command(tmp_path: Path) -> None:
    service, session_factory = _service(tmp_path)

    created = service.admit_create(
        company_id="cmp_123",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_replay_reason",
        request_fingerprint_hash="fp_create_replay_reason",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(company_id="cmp_123", worker_key="worker_alpha")
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_123",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_call",
    )
    service.record_attempt_failure(
        company_id="cmp_123",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        failure_class="provider_terminal",
        error_code="provider_unavailable",
        error_detail="upstream unavailable",
        retryable=False,
    )

    replay = service.admit_retry(
        company_id="cmp_123",
        run_id=created.run_id,
        actor_type="user",
        actor_id="admin_1",
        idempotency_key="idem_replay_reason_1",
        request_fingerprint_hash="fp_replay_reason_1",
        replay_reason="Operator replay after provider credentials were rotated.",
    )

    assert replay.run_state == "queued"
    assert replay.outbox_event == "run_dispatch"

    with session_factory() as session:
        command = session.get(RunCommandORM, replay.command_id)
        outbox = (
            session
            .execute(
                select(RunOutboxORM)
                .where(
                    RunOutboxORM.run_id == created.run_id,
                    RunOutboxORM.attempt_id == replay.attempt_id,
                )
                .order_by(RunOutboxORM.created_at.desc())
            )
            .scalars()
            .first()
        )

        assert command is not None
        assert outbox is not None
        assert command.response_snapshot is not None
        assert command.response_snapshot["replay_reason"] == "Operator replay after provider credentials were rotated."
        assert outbox.payload["replay_reason"] == "Operator replay after provider credentials were rotated."


def test_approval_resume_and_reject_transitions_are_durable(tmp_path: Path) -> None:
    service, session_factory = _service(tmp_path)

    resumed = service.admit_create(
        company_id="cmp_123",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_resume",
        request_fingerprint_hash="fp_create_resume",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(company_id="cmp_123", worker_key="worker_alpha")
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_123",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="approval_gate",
    )
    approval = service.open_approval(
        company_id="cmp_123",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        approval_id="approval_resume_1",
        gate_key="approval_gate",
    )

    resume_result = service.decide_approval(
        company_id="cmp_123",
        approval_id="approval_resume_1",
        actor_type="user",
        actor_id="approver_1",
        idempotency_key="idem_approval_resume_1",
        request_fingerprint_hash="fp_approval_resume_1",
        approved=True,
    )

    assert resume_result.approval_link_id == approval.approval_link_id
    assert resume_result.outbox_event == "run_resume"
    assert resume_result.run_state == "queued"

    rejected = service.admit_create(
        company_id="cmp_456",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_reject",
        request_fingerprint_hash="fp_create_reject",
        run_kind="provider_dispatch",
    )
    reject_claim = service.claim_next_attempt(company_id="cmp_456", worker_key="worker_bravo")
    assert reject_claim is not None
    service.mark_attempt_executing(
        company_id="cmp_456",
        run_id=reject_claim.run_id,
        attempt_id=reject_claim.attempt_id,
        lease_token=reject_claim.lease_token,
        step_key="approval_gate",
    )
    reject_approval = service.open_approval(
        company_id="cmp_456",
        run_id=reject_claim.run_id,
        attempt_id=reject_claim.attempt_id,
        approval_id="approval_reject_1",
        gate_key="approval_gate",
        resume_disposition="cancel",
    )

    reject_result = service.decide_approval(
        company_id="cmp_456",
        approval_id="approval_reject_1",
        actor_type="user",
        actor_id="approver_2",
        idempotency_key="idem_approval_reject_1",
        request_fingerprint_hash="fp_approval_reject_1",
        approved=False,
    )

    assert reject_result.approval_link_id == reject_approval.approval_link_id
    assert reject_result.outbox_event == "run_cancel"
    assert reject_result.run_state == "cancel_requested"

    with session_factory() as session:
        resume_run = session.get(RunORM, resumed.run_id)
        resume_attempt = session.get(RunAttemptORM, resumed.attempt_id)
        resume_link = session.get(RunApprovalLinkORM, approval.approval_link_id)
        resume_outboxes = session.execute(select(RunOutboxORM).where(RunOutboxORM.run_id == resumed.run_id).order_by(RunOutboxORM.created_at.asc())).scalars().all()
        reject_run = session.get(RunORM, rejected.run_id)
        reject_attempt = session.get(RunAttemptORM, rejected.attempt_id)
        reject_link = session.get(RunApprovalLinkORM, reject_approval.approval_link_id)
        reject_outboxes = session.execute(select(RunOutboxORM).where(RunOutboxORM.run_id == rejected.run_id).order_by(RunOutboxORM.created_at.asc())).scalars().all()

        assert resume_run is not None
        assert resume_attempt is not None
        assert resume_link is not None
        assert resume_run.state == "queued"
        assert resume_attempt.attempt_state == "queued"
        assert resume_link.gate_status == "approved"
        assert resume_link.resume_enqueued_at is not None
        resume_notify = next(outbox for outbox in resume_outboxes if outbox.event_type == "approval_notify")
        resume_dispatch = next(outbox for outbox in resume_outboxes if outbox.event_type == "run_resume")
        assert resume_notify.dedupe_key == "approval:approval_resume_1:notify"
        assert resume_dispatch.dedupe_key == (f"approval:{approval.approval_link_id}:command:{resume_result.command_id}:run_resume")

        assert reject_run is not None
        assert reject_attempt is not None
        assert reject_link is not None
        assert reject_run.state == "cancel_requested"
        assert reject_attempt.attempt_state == "cancel_requested"
        assert reject_link.gate_status == "rejected"
        assert reject_link.decision_actor_id == "approver_2"
        reject_notify = next(outbox for outbox in reject_outboxes if outbox.event_type == "approval_notify")
        reject_cancel = next(outbox for outbox in reject_outboxes if outbox.event_type == "run_cancel")
        assert reject_notify.dedupe_key == "approval:approval_reject_1:notify"
        assert reject_cancel.dedupe_key == (f"approval:{reject_approval.approval_link_id}:command:{reject_result.command_id}:run_cancel")


def test_resume_does_not_force_spurious_wakeup_before_retry_window(
    tmp_path: Path,
) -> None:
    """Resuming during retry backoff must not wake work early."""
    service, session_factory = _service(tmp_path)
    claimed_at = datetime(2026, 4, 23, 12, 0, tzinfo=UTC)
    admitted = service.admit_create(
        company_id="cmp_789",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_retry_resume",
        request_fingerprint_hash="fp_create_retry_resume",
        run_kind="provider_dispatch",
        now=claimed_at,
    )
    claim = service.claim_next_attempt(
        company_id="cmp_789",
        worker_key="worker_alpha",
        now=claimed_at,
    )
    assert claim is not None

    service.mark_attempt_executing(
        company_id="cmp_789",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_dispatch",
        now=claimed_at + timedelta(seconds=1),
    )
    failure = service.record_attempt_failure(
        company_id="cmp_789",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        failure_class="provider_transient",
        error_code="provider_timeout",
        error_detail="upstream timed out",
        retryable=True,
        max_attempts=3,
        backoff_base_seconds=60,
        backoff_max_seconds=60,
        backoff_jitter_ratio=0.0,
        now=claimed_at + timedelta(seconds=2),
    )
    assert failure.retry_scheduled is True
    assert failure.next_attempt_id is not None

    pause_result = service.pause_run(
        company_id="cmp_789",
        run_id=admitted.run_id,
        actor_type="user",
        actor_id="operator_1",
        idempotency_key="idem_pause_retry_resume",
        request_fingerprint_hash="fp_pause_retry_resume",
        reason="operator hold",
        now=claimed_at + timedelta(seconds=3),
    )
    assert pause_result.operator_state == "paused"

    resume_result = service.resume_run(
        company_id="cmp_789",
        run_id=admitted.run_id,
        actor_type="user",
        actor_id="operator_1",
        idempotency_key="idem_resume_retry_resume",
        request_fingerprint_hash="fp_resume_retry_resume",
        reason="resume requested",
        now=claimed_at + timedelta(seconds=10),
    )
    assert resume_result.operator_state == "retry_scheduled"

    with session_factory() as session:
        run = session.get(RunORM, admitted.run_id)
        attempt = session.get(RunAttemptORM, failure.next_attempt_id)

        assert run is not None
        assert attempt is not None
        assert run.state == "retry_backoff"
        assert run.operator_state == "retry_scheduled"
        assert run.status_reason == "retry_scheduled"
        assert attempt.operator_state == "retry_scheduled"
        assert run.next_wakeup_at is not None
        wakeup_at = run.next_wakeup_at if run.next_wakeup_at.tzinfo is not None else run.next_wakeup_at.replace(tzinfo=UTC)
        assert wakeup_at > claimed_at + timedelta(seconds=10)
        assert run.result_summary is not None
        assert run.result_summary["wake_gate"]["spurious_wake_blocked"] is True
        assert run.result_summary["wake_gate"]["next_wakeup_at"] == wakeup_at.isoformat()
        assert run.result_summary["dispatch"]["stage"] == "resume_blocked_until_wakeup"


# ---------------------------------------------------------------------------
# Wave 3 — operator-only, creation/retry/restart, and non-state validation
# ---------------------------------------------------------------------------


def test_wave3_validation_disabled_does_not_construct_for_operator_ops(
    tmp_path: Path,
) -> None:
    """Disabled validation must not construct validators for pause/resume."""

    def validator_factory() -> object:
        raise AssertionError("disabled validation must not construct validators")

    service, _session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=False,
        state_machine_validator_factory=validator_factory,
    )
    created = service.admit_create(
        company_id="cmp_w3_off",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_w3_off_create",
        request_fingerprint_hash="fp_w3_off_create",
        run_kind="provider_dispatch",
    )

    # Pause (operator-only) with disabled validation.
    pause = service.pause_run(
        company_id="cmp_w3_off",
        run_id=created.run_id,
        actor_type="user",
        actor_id="operator_1",
        idempotency_key="idem_pause_off",
        request_fingerprint_hash="fp_pause_off",
        reason="hold",
    )
    assert pause.operator_state == "paused"

    # Resume (operator-only) with disabled validation.
    resume = service.resume_run(
        company_id="cmp_w3_off",
        run_id=created.run_id,
        actor_type="user",
        actor_id="operator_1",
        idempotency_key="idem_resume_off",
        request_fingerprint_hash="fp_resume_off",
        reason="release",
    )
    assert resume.operator_state == "admitted"


def test_wave3_pause_resume_validation_preserves_behavior(
    tmp_path: Path,
    caplog,
) -> None:
    """Pause/resume with validation enabled must be clean and preserve state."""
    service, session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")

    created = service.admit_create(
        company_id="cmp_w3_pr",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_w3_pr_create",
        request_fingerprint_hash="fp_w3_pr_create",
        run_kind="provider_dispatch",
    )

    # Pause with validation.
    pause = service.pause_run(
        company_id="cmp_w3_pr",
        run_id=created.run_id,
        actor_type="user",
        actor_id="operator_1",
        idempotency_key="idem_pause_w3",
        request_fingerprint_hash="fp_pause_w3",
        reason="operator hold",
    )
    assert pause.operator_state == "paused"

    # Resume with validation.
    resume = service.resume_run(
        company_id="cmp_w3_pr",
        run_id=created.run_id,
        actor_type="user",
        actor_id="operator_1",
        idempotency_key="idem_resume_w3",
        request_fingerprint_hash="fp_resume_w3",
        reason="release",
    )
    assert resume.operator_state == "admitted"

    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        assert run is not None
        assert run.state == "queued"  # run.state preserved
        assert run.operator_state == "admitted"

    # No validation mismatches logged.
    records = _validation_records(caplog)
    assert records == [], f"Expected no validation records, got {len(records)}"


def test_wave3_pause_resume_idempotent_skip_validation(
    tmp_path: Path,
    caplog,
) -> None:
    """Idempotent pause/resume must skip fresh validation."""
    calls: list[tuple[str, ExecutionTransitionContext]] = []
    mismatch = ExecutionValidationResult(
        valid=True,
        validated=True,
        decision=ExecutionStateDecision(target_operator_state="quarantined"),
    )

    service, session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
        state_machine_validator_factory=lambda: _ValidationSpy(calls, result=mismatch),
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")

    created = service.admit_create(
        company_id="cmp_w3_idem",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_w3_idem_create",
        request_fingerprint_hash="fp_w3_idem_create",
        run_kind="provider_dispatch",
    )

    # First pause — goes through validation.
    pause1 = service.pause_run(
        company_id="cmp_w3_idem",
        run_id=created.run_id,
        actor_type="user",
        actor_id="operator_1",
        idempotency_key="idem_pause_once",
        request_fingerprint_hash="fp_pause_once",
        reason="hold",
    )
    assert pause1.operator_state == "paused"

    # Idempotent pause — must skip validation (no new calls).
    pause2 = service.pause_run(
        company_id="cmp_w3_idem",
        run_id=created.run_id,
        actor_type="user",
        actor_id="operator_1",
        idempotency_key="idem_pause_once",
        request_fingerprint_hash="fp_pause_once",
        reason="hold",
    )
    assert pause2.deduplicated is True

    # Pause was validated once (first call) but idempotent replay did
    # not add a second validation call.
    pause_calls = [(t, c) for t, c in calls if t == "pause"]
    assert len(pause_calls) == 1, f"Expected 1 pause validation call, got {len(pause_calls)}"


def test_wave3_admit_retry_validation_preserves_behavior(
    tmp_path: Path,
    caplog,
) -> None:
    """Admit_retry with validation enabled must be clean."""
    service, session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")

    claimed_at = datetime(2026, 5, 3, 12, 0, tzinfo=UTC)
    created = service.admit_create(
        company_id="cmp_w3_retry",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_w3_retry_create",
        request_fingerprint_hash="fp_w3_retry_create",
        run_kind="provider_dispatch",
        now=claimed_at,
    )
    claim = service.claim_next_attempt(
        company_id="cmp_w3_retry",
        worker_key="worker_alpha",
        now=claimed_at,
    )
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_w3_retry",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_dispatch",
        now=claimed_at + timedelta(seconds=1),
    )

    # Terminal failure so we can admit_retry.
    failure = service.record_attempt_failure(
        company_id="cmp_w3_retry",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        failure_class="provider_terminal",
        error_code="fatal",
        error_detail="cannot proceed",
        retryable=False,
        max_attempts=3,
        now=claimed_at + timedelta(seconds=2),
    )
    assert failure.run_state == "dead_lettered"

    # Admit_retry with validation.
    retry = service.admit_retry(
        company_id="cmp_w3_retry",
        run_id=created.run_id,
        actor_type="agent",
        actor_id="agent_retry",
        idempotency_key="idem_retry_w3",
        request_fingerprint_hash="fp_retry_w3",
        now=claimed_at + timedelta(seconds=5),
    )
    assert retry.run_state == "queued"
    assert retry.outbox_event == "run_dispatch"

    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        assert run is not None
        assert run.state == "queued"
        assert run.operator_state == "admitted"

    # No validation mismatches.
    records = _validation_records(caplog)
    assert records == [], f"Expected no validation records, got {len(records)}"


def test_wave3_admit_retry_idempotent_skip_validation(
    tmp_path: Path,
    caplog,
) -> None:
    """Idempotent admit_retry must skip fresh validation."""
    calls: list[tuple[str, ExecutionTransitionContext]] = []
    service, session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
        state_machine_validator_factory=lambda: _TriggerValidationSpy(
            calls,
            target_trigger="admit_retry",
            result=ExecutionValidationResult(valid=True, validated=True),
        ),
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")

    claimed_at = datetime(2026, 5, 3, 12, 0, tzinfo=UTC)
    created = service.admit_create(
        company_id="cmp_w3_rskip",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_w3_rskip_create",
        request_fingerprint_hash="fp_w3_rskip_create",
        run_kind="provider_dispatch",
        now=claimed_at,
    )
    claim = service.claim_next_attempt(
        company_id="cmp_w3_rskip",
        worker_key="worker_alpha",
        now=claimed_at,
    )
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_w3_rskip",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_dispatch",
        now=claimed_at + timedelta(seconds=1),
    )
    service.record_attempt_failure(
        company_id="cmp_w3_rskip",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        failure_class="provider_terminal",
        error_code="fatal",
        error_detail="cannot proceed",
        retryable=False,
        max_attempts=3,
        now=claimed_at + timedelta(seconds=2),
    )

    # First admit_retry — goes through validation.
    retry1 = service.admit_retry(
        company_id="cmp_w3_rskip",
        run_id=created.run_id,
        actor_type="agent",
        actor_id="agent_retry",
        idempotency_key="idem_retry_skip",
        request_fingerprint_hash="fp_retry_skip",
        now=claimed_at + timedelta(seconds=5),
    )
    assert retry1.run_state == "queued"

    # Idempotent admit_retry — must skip validation.
    retry2 = service.admit_retry(
        company_id="cmp_w3_rskip",
        run_id=created.run_id,
        actor_type="agent",
        actor_id="agent_retry",
        idempotency_key="idem_retry_skip",
        request_fingerprint_hash="fp_retry_skip",
        now=claimed_at + timedelta(seconds=5),
    )
    assert retry2.deduplicated is True

    admit_retry_calls = [(t, c) for t, c in calls if t == "admit_retry"]
    assert len(admit_retry_calls) == 1, f"Expected 1 admit_retry call, got {len(admit_retry_calls)}"


def test_wave3_creation_validation_admit_create(
    tmp_path: Path,
    caplog,
) -> None:
    """admit_create with validation enabled validates initial state."""
    service, session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")

    created = service.admit_create(
        company_id="cmp_w3_create",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_w3_create_val",
        request_fingerprint_hash="fp_w3_create_val",
        run_kind="provider_dispatch",
    )
    assert created.run_state == "queued"

    # No creation mismatches.
    records = _validation_records(caplog)
    assert records == []

    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        attempt = session.get(RunAttemptORM, created.attempt_id)
        assert run is not None
        assert attempt is not None
        assert run.state == "queued"
        assert run.operator_state == "admitted"
        assert attempt.attempt_state == "queued"
        assert attempt.operator_state == "admitted"
        assert attempt.lease_status == "not_leased"


def test_wave3_restart_from_scratch_validation(
    tmp_path: Path,
    caplog,
) -> None:
    """restart_run_from_scratch with validation enabled validates source invariants."""
    service, session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    from app.execution.admin_service import ExecutionAdminService

    admin = ExecutionAdminService(session_factory)
    admin._transitions = service

    caplog.set_level(logging.WARNING, logger="app.execution.service")

    created = service.admit_create(
        company_id="cmp_w3_restart",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_w3_restart_create",
        request_fingerprint_hash="fp_w3_restart_create",
        run_kind="provider_dispatch",
    )

    # Restart from scratch via admin service.
    from app.instances.models import InstanceRecord

    instance = InstanceRecord(
        instance_id="instance_w3",
        slug="instance-w3",
        display_name="W3 Instance",
        description="Test",
        status="active",
        tenant_id="tenant_w3",
        company_id="cmp_w3_restart",
        deployment_mode="restricted_eval",
        exposure_mode="local_only",
        is_default=True,
        metadata={},
        created_at=datetime(2026, 5, 3, 12, 0, tzinfo=UTC).isoformat(),
        updated_at=datetime(2026, 5, 3, 12, 0, tzinfo=UTC).isoformat(),
    )
    restarted = admin.perform_operator_action(
        instance=instance,
        run_id=created.run_id,
        actor_id="operator_1",
        action="restart",
        reason="full restart",
    )
    assert restarted.related_run_id == created.run_id
    assert restarted.run_state == "queued"

    # No validation mismatches (new run correctly initialized, source unchanged).
    records = _validation_records(caplog)
    assert records == [], f"Expected no validation records, got {len(records)}"


def test_wave3_renew_lease_non_state_validation(
    tmp_path: Path,
    caplog,
) -> None:
    """renew_attempt_lease with validation must not log mismatches."""
    service, session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")

    claimed_at = datetime(2026, 5, 3, 12, 0, tzinfo=UTC)
    created = service.admit_create(
        company_id="cmp_w3_lease",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_w3_lease_create",
        request_fingerprint_hash="fp_w3_lease_create",
        run_kind="provider_dispatch",
        now=claimed_at,
    )
    claim = service.claim_next_attempt(
        company_id="cmp_w3_lease",
        worker_key="worker_alpha",
        now=claimed_at,
    )
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_w3_lease",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_dispatch",
        now=claimed_at + timedelta(seconds=1),
    )

    # Renew lease — non-state operation, must not change state.
    heartbeat = service.renew_attempt_lease(
        company_id="cmp_w3_lease",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        lease_ttl_seconds=45,
        now=claimed_at + timedelta(seconds=10),
    )
    assert heartbeat.lease_expires_at > heartbeat.last_heartbeat_at

    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        attempt = session.get(RunAttemptORM, created.attempt_id)
        assert run is not None
        assert attempt is not None
        assert run.state == "executing"  # unchanged
        assert attempt.attempt_state == "executing"  # unchanged

    # No mismatches logged.
    records = _validation_records(caplog)
    assert records == [], f"Expected no validation records, got {len(records)}"


def test_wave3_escalate_non_state_validation(
    tmp_path: Path,
    caplog,
) -> None:
    """escalate_run with validation must not log mismatches."""
    from app.execution.admin_service import ExecutionAdminService

    service, session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    admin = ExecutionAdminService(session_factory)
    admin._transitions = service

    caplog.set_level(logging.WARNING, logger="app.execution.service")

    from app.instances.models import InstanceRecord

    instance = InstanceRecord(
        instance_id="instance_esc",
        slug="instance-esc",
        display_name="Esc Instance",
        description="Test",
        status="active",
        tenant_id="tenant_esc",
        company_id="cmp_w3_esc",
        deployment_mode="restricted_eval",
        exposure_mode="local_only",
        is_default=True,
        metadata={},
        created_at=datetime(2026, 5, 3, 12, 0, tzinfo=UTC).isoformat(),
        updated_at=datetime(2026, 5, 3, 12, 0, tzinfo=UTC).isoformat(),
    )

    created = service.admit_create(
        company_id="cmp_w3_esc",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_w3_esc_create",
        request_fingerprint_hash="fp_w3_esc_create",
        run_kind="provider_dispatch",
    )

    # Escalate — non-state operation.
    escalated = admin.perform_operator_action(
        instance=instance,
        run_id=created.run_id,
        actor_id="operator_1",
        action="escalate",
        reason="needs heavier lane",
        execution_lane="interactive_heavy",
    )
    assert escalated.execution_lane == "interactive_heavy"
    assert escalated.run_state == "queued"  # state unchanged

    # No mismatches.
    records = _validation_records(caplog)
    assert records == [], f"Expected no validation records, got {len(records)}"


# ---------------------------------------------------------------------------
# SPEC §5 compatibility tests — resolve "Decision required" findings
# before Phase 1c authority transfer
# ---------------------------------------------------------------------------
def test_spec5_finding2_stale_run_complete_success_now_blocked(
    tmp_path: Path,
) -> None:
    """SPEC §5 finding #2: complete_attempt_success now blocked by pre-check.

    The state machine pre-check (Phase 1c) rejects ``complete_success`` from a
    ``dead_lettered`` run.  The ad-hoc service checks are bypassed when
    validation is enabled and the authoritative guard takes over.
    """
    service, session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )

    # Set up a run with an in-flight executing attempt.
    created = service.admit_create(
        company_id="cmp_s5_f2",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_s5_f2_create",
        request_fingerprint_hash="fp_s5_f2_create",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(
        company_id="cmp_s5_f2",
        worker_key="worker_s5_f2",
    )
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_s5_f2",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_call",
    )

    # Manipulate the run into a stale state via direct DB access.
    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        assert run is not None
        run.state = "dead_lettered"
        session.commit()

    # The state machine pre-check now blocks complete_success from
    # dead_lettered — service raises RunTransitionConflictError.
    with pytest.raises(
        RunTransitionConflictError,
        match="not allowed",
    ):
        service.complete_attempt_success(
            company_id="cmp_s5_f2",
            run_id=claim.run_id,
            attempt_id=claim.attempt_id,
            lease_token=claim.lease_token,
            result_summary={"note": "stale run completion"},
        )


def test_spec5_finding3_stale_approval_decision_flagged_by_validator(
    tmp_path: Path,
    caplog,
) -> None:
    """SPEC §5 finding #3: decide_approval accepts stale run/attempt state.

    The existing service only checks ``approval_link.gate_status == "open"``
    and does NOT require the run or attempt to still be in
    ``waiting_on_approval`` state.  The validator detects this divergence
    because ``resume_after_approval`` is only valid from source state
    ``waiting_on_approval``.

    This test confirms the compatibility behaviour is preserved (service
    outcome is unaffected) and the validator flags the mismatch, making the
    finding explicit before any Phase 1c authority transfer.
    """
    service, session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")

    # Set up a run waiting on approval.
    created = service.admit_create(
        company_id="cmp_s5_f3",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_s5_f3_create",
        request_fingerprint_hash="fp_s5_f3_create",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(
        company_id="cmp_s5_f3",
        worker_key="worker_s5_f3",
    )
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_s5_f3",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="approval_gate",
    )
    service.open_approval(
        company_id="cmp_s5_f3",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        approval_id="approval_s5_f3",
        gate_key="approval_gate",
    )
    caplog.clear()

    # Manipulate the run into a stale state via direct DB access.  The
    # approval link remains open so the service accepts the decision.
    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        assert run is not None
        run.state = "queued"
        session.commit()

    # Service accepts decide_approval with approved=True because the
    # approval link is still open — it does NOT check run/attempt state.
    result = service.decide_approval(
        company_id="cmp_s5_f3",
        approval_id="approval_s5_f3",
        actor_type="user",
        actor_id="approver_s5_f3",
        idempotency_key="idem_s5_f3_decide",
        request_fingerprint_hash="fp_s5_f3_decide",
        approved=True,
    )
    assert result.run_state == "queued"

    # Validator detected the mismatch: resume_after_approval cannot fire
    # from "queued" (source must be "waiting_on_approval").
    records = _validation_records(caplog)
    assert len(records) >= 1, "Expected at least one validation mismatch record"
    payload = _validation_payload(records[0])
    assert payload["trigger"] == "resume_after_approval"
    assert payload["mismatch_category"] in (
        MISMATCH_CATEGORY_RUN_STATE_MISMATCH,
        MISMATCH_CATEGORY_INVALID_TRIGGER,
    ), f"Unexpected mismatch category: {payload['mismatch_category']}"
    assert payload["before"]["run_state"] == "queued"
    assert payload["after"]["run_state"] == "queued"


# ---------------------------------------------------------------------------
# Phase 1c: authoritative pre-check tests
# ---------------------------------------------------------------------------


def test_claim_attempt_happy_path_with_real_validator(
    tmp_path: Path,
) -> None:
    """State machine allows claim_attempt from queued."""
    service, _session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    created = service.admit_create(
        company_id="cmp_f1c_c",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_f1c_cclaim",
        request_fingerprint_hash="fp_f1c_cclaim",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(
        company_id="cmp_f1c_c",
        worker_key="worker_alpha",
    )
    assert claim is not None
    assert claim.run_id == created.run_id


def test_claim_attempt_blocked_by_state_machine(
    tmp_path: Path,
) -> None:
    """Authoritative pre-check blocks claim_attempt with non-claimable context."""
    service, _session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    # Build a context showing the run is already in a terminal state.
    ctx = ExecutionTransitionContext(
        run_id="test_run",
        attempt_id="test_attempt",
        run_state="succeeded",
        operator_state="completed",
        attempt_state="succeeded",
        attempt_operator_state="completed",
        active_attempt_no=1,
    )
    with pytest.raises(RunTransitionConflictError, match="not allowed"):
        service._check_transition_allowed_or_raise("claim_attempt", ctx)


def test_start_execution_blocked_from_wrong_state(
    tmp_path: Path,
) -> None:
    """Authoritative pre-check blocks start_execution when not dispatching."""
    service, _session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    created = service.admit_create(
        company_id="cmp_f1c_se",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_f1c_sestart",
        request_fingerprint_hash="fp_f1c_sestart",
        run_kind="provider_dispatch",
    )
    # Use a snapshot that shows a non-dispatching state to trigger block.
    with _session_factory() as session:
        run = session.get(RunORM, created.run_id)
        attempt = session.execute(select(RunAttemptORM).where(RunAttemptORM.run_id == created.run_id)).scalars().first()
        assert run is not None and attempt is not None
        # Fabricate a snapshot showing 'executing' as current state
        # so start_execution is not valid (source must be dispatching).
        before_snapshot = ExecutionStateSnapshot(
            run_id=run.id,
            attempt_id=attempt.id,
            run_state="executing",
            operator_state="executing",
            attempt_state="executing",
            attempt_operator_state="executing",
            lease_token=attempt.lease_token,
            extra={
                "attempt_no": attempt.attempt_no,
                "active_attempt_no": run.active_attempt_no,
                "scheduled_at": attempt.scheduled_at,
                "lease_expires_at": attempt.lease_expires_at,
                "next_wakeup_at": run.next_wakeup_at,
            },
        )
        ctx = service._state_machine_context(
            before=before_snapshot,
            now=datetime.now(tz=UTC),
            provided_lease_token="fake_token",
            service_chosen_operator_state="executing",
        )
        with pytest.raises(
            RunTransitionConflictError,
            match="not allowed",
        ):
            service._check_transition_allowed_or_raise("start_execution", ctx)


def test_start_execution_blocked_by_wrong_lease_token(
    tmp_path: Path,
) -> None:
    """Authoritative pre-check blocks start_execution with mismatched token."""
    service, _session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    _ = service.admit_create(
        company_id="cmp_f1c_sel",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_f1c_seltoken",
        request_fingerprint_hash="fp_f1c_seltoken",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(
        company_id="cmp_f1c_sel",
        worker_key="worker_alpha",
    )
    assert claim is not None
    # Call mark_attempt_executing with a WRONG lease token.
    # The pre-check should catch this via has_valid_lease_token guard.
    with pytest.raises(
        RunTransitionConflictError,
        match="not allowed",
    ):
        service.mark_attempt_executing(
            company_id="cmp_f1c_sel",
            run_id=claim.run_id,
            attempt_id=claim.attempt_id,
            lease_token="wrong_token",
            step_key="test_step",
        )


def test_complete_success_blocked_by_wrong_lease_token(
    tmp_path: Path,
) -> None:
    """Authoritative pre-check blocks complete_success with mismatched token."""
    service, _session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    _ = service.admit_create(
        company_id="cmp_f1c_cs",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_f1c_cscomplete",
        request_fingerprint_hash="fp_f1c_cscomplete",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(
        company_id="cmp_f1c_cs",
        worker_key="worker_alpha",
    )
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_f1c_cs",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="test_step",
    )
    # Call complete_attempt_success with a WRONG lease token.
    # The pre-check should catch this via has_valid_lease_token guard.
    with pytest.raises(
        RunTransitionConflictError,
        match="not allowed",
    ):
        service.complete_attempt_success(
            company_id="cmp_f1c_cs",
            run_id=claim.run_id,
            attempt_id=claim.attempt_id,
            lease_token="wrong_token",
        )


def test_record_attempt_failure_blocked_by_wrong_lease_token(
    tmp_path: Path,
) -> None:
    """Authoritative pre-check blocks record_attempt_failure with wrong token."""
    service, _session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    _ = service.admit_create(
        company_id="cmp_f1c_rf",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_f1c_rffailure",
        request_fingerprint_hash="fp_f1c_rffailure",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(
        company_id="cmp_f1c_rf",
        worker_key="worker_alpha",
    )
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_f1c_rf",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="test_step",
    )
    # Call record_attempt_failure with a WRONG lease token.
    # The pre-check should block via has_valid_lease_token guard.
    with pytest.raises(
        RunTransitionConflictError,
        match="not allowed",
    ):
        service.record_attempt_failure(
            company_id="cmp_f1c_rf",
            run_id=claim.run_id,
            attempt_id=claim.attempt_id,
            lease_token="wrong_token",
            failure_class="test",
            error_code="ERR_TEST",
            error_detail="test blocking",
            retryable=False,
            max_attempts=3,
        )


def test_request_cancel_blocked_by_state_machine_on_terminal_run(
    tmp_path: Path,
) -> None:
    """Authoritative pre-check blocks request_cancel on terminal run."""
    service, _session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    _ = service.admit_create(
        company_id="cmp_f1c_rc",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_f1c_rccancel",
        request_fingerprint_hash="fp_f1c_rccancel",
        run_kind="provider_dispatch",
    )
    claim = service.claim_next_attempt(
        company_id="cmp_f1c_rc",
        worker_key="worker_alpha",
    )
    assert claim is not None
    service.mark_attempt_executing(
        company_id="cmp_f1c_rc",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="test_step",
    )
    service.complete_attempt_success(
        company_id="cmp_f1c_rc",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
    )
    # Now the run is terminal (succeeded). request_cancel should be blocked
    # by the pre-check (is_cancellable guard).
    with pytest.raises(
        RunTransitionConflictError,
        match="not allowed",
    ):
        service.request_cancel(
            company_id="cmp_f1c_rc",
            run_id=claim.run_id,
            actor_type="agent",
            actor_id="test",
            idempotency_key="cancel_terminal_f1c_rc",
            request_fingerprint_hash="fp_cancel_terminal_f1c_rc",
        )


def test_state_machine_pre_check_happy_path_worker_flow(
    tmp_path: Path,
) -> None:
    """Full worker hot path runs without pre-check errors using real validator."""
    service, session_factory = _service(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    created = service.admit_create(
        company_id="cmp_f1c_hp",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_f1c_hpworker",
        request_fingerprint_hash="fp_f1c_hpworker",
        run_kind="provider_dispatch",
    )

    # Claim attempt
    claim = service.claim_next_attempt(
        company_id="cmp_f1c_hp",
        worker_key="worker_alpha",
    )
    assert claim is not None
    assert claim.run_id == created.run_id

    # Start executing
    service.mark_attempt_executing(
        company_id="cmp_f1c_hp",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="test_step",
    )

    # Record a retryable failure with delay
    failure = service.record_attempt_failure(
        company_id="cmp_f1c_hp",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        failure_class="provider_transient",
        error_code="ERR_TEMP",
        error_detail="temporary issue",
        retryable=True,
        max_attempts=3,
        backoff_base_seconds=10,
    )
    assert failure.retry_scheduled
    assert failure.next_attempt_id is not None

    # Reclaim after retry backoff (manually set scheduled_at in the past)
    with session_factory() as session:
        session.execute(update(RunAttemptORM).where(RunAttemptORM.id == failure.next_attempt_id).values(scheduled_at=datetime.now(tz=UTC) - timedelta(minutes=5)))
        session.commit()

    claim2 = service.claim_next_attempt(
        company_id="cmp_f1c_hp",
        worker_key="worker_alpha",
    )
    assert claim2 is not None
    assert claim2.attempt_id == failure.next_attempt_id

    # Second attempt: failure with no retry budget → dead_letter
    service.mark_attempt_executing(
        company_id="cmp_f1c_hp",
        run_id=claim2.run_id,
        attempt_id=claim2.attempt_id,
        lease_token=claim2.lease_token,
        step_key="test_step2",
    )
    failure2 = service.record_attempt_failure(
        company_id="cmp_f1c_hp",
        run_id=claim2.run_id,
        attempt_id=claim2.attempt_id,
        lease_token=claim2.lease_token,
        failure_class="provider_terminal",
        error_code="ERR_PERM",
        error_detail="non-retryable error",
        retryable=False,
        max_attempts=3,
    )
    assert not failure2.retry_scheduled
    assert failure2.run_state == "dead_lettered"
