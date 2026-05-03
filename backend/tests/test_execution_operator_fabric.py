from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.execution.admin_service import ExecutionAdminService
from app.execution.service import ExecutionTransitionService, StateMachineValidatorFactory
from app.execution.state_machine import (
    MISMATCH_CATEGORY_RUN_STATE_MISMATCH,
    ExecutionStateDecision,
    ExecutionTransitionContext,
    ExecutionValidationResult,
)
from app.instances.models import InstanceRecord
from app.storage.execution_repository import RunAttemptORM, RunORM
from app.storage.models import Base


def _services(
    tmp_path: Path,
    *,
    state_machine_validation_enabled: bool = False,
    state_machine_validator_factory: StateMachineValidatorFactory | None = None,
) -> tuple[ExecutionTransitionService, ExecutionAdminService, sessionmaker[Session]]:
    """Build transition/admin services sharing one test database.

    :param tmp_path: Temporary directory for SQLite storage.
    :type tmp_path: Path
    :param state_machine_validation_enabled: Whether advisory validation is enabled.
    :type state_machine_validation_enabled: bool
    :param state_machine_validator_factory: Optional validator factory for tests.
    :type state_machine_validator_factory: StateMachineValidatorFactory | None
    :return: Transition service, admin service, and session factory.
    :rtype: tuple[ExecutionTransitionService, ExecutionAdminService, sessionmaker[Session]]
    """
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'execution-operator.sqlite'}")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(engine, autoflush=False, expire_on_commit=False)
    transitions = ExecutionTransitionService(
        session_factory,
        state_machine_validation_enabled=state_machine_validation_enabled,
        state_machine_validator_factory=state_machine_validator_factory,
    )
    admin = ExecutionAdminService(session_factory)
    admin._transitions = transitions
    return transitions, admin, session_factory


def _validation_records(caplog) -> list[logging.LogRecord]:
    """Return structured state-machine validation log records."""

    return [record for record in caplog.records if hasattr(record, "state_machine_validation")]


def _validation_payload(record: logging.LogRecord) -> dict[str, Any]:
    """Return the structured state-machine payload from a log record."""

    return cast("dict[str, Any]", getattr(record, "state_machine_validation"))


class _ReconcileValidationSpy:
    """Validator spy that only forces lease-expiry mismatches."""

    def __init__(self, calls: list[tuple[str, ExecutionTransitionContext]]) -> None:
        self._calls = calls

    def validate_run_transition(
        self,
        trigger: str,
        context: ExecutionTransitionContext,
    ) -> ExecutionValidationResult:
        self._calls.append((trigger, context))
        if trigger == "expire_lease":
            return ExecutionValidationResult(
                valid=True,
                validated=True,
                decision=ExecutionStateDecision(target_run_state="succeeded"),
            )
        return ExecutionValidationResult(valid=True, validated=True)


def _instance(company_id: str = "company_alpha") -> InstanceRecord:
    now = datetime(2026, 4, 23, 8, 0, tzinfo=UTC).isoformat()
    return InstanceRecord(
        instance_id="instance_alpha",
        slug="instance-alpha",
        display_name="Alpha Instance",
        description="Execution operator scope",
        status="active",
        tenant_id="tenant_alpha",
        company_id=company_id,
        deployment_mode="restricted_eval",
        exposure_mode="local_only",
        is_default=True,
        metadata={},
        created_at=now,
        updated_at=now,
    )


def test_pause_resume_and_escalate_persist_operator_fabric(tmp_path: Path) -> None:
    transitions, admin, session_factory = _services(tmp_path)
    created = transitions.admit_create(
        company_id="company_alpha",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_operator_pause",
        request_fingerprint_hash="fp_create_operator_pause",
        run_kind="provider_dispatch",
    )

    paused = admin.perform_operator_action(
        instance=_instance(),
        run_id=created.run_id,
        actor_id="operator_alpha",
        action="pause",
        reason="Pause while waiting for human review.",
    )
    assert paused.operator_state == "paused"

    resumed = admin.perform_operator_action(
        instance=_instance(),
        run_id=created.run_id,
        actor_id="operator_alpha",
        action="resume",
        reason="Resume after review completed.",
    )
    assert resumed.operator_state == "admitted"

    escalated = admin.perform_operator_action(
        instance=_instance(),
        run_id=created.run_id,
        actor_id="operator_alpha",
        action="escalate",
        reason="Escalate to a heavier lane for deeper inspection.",
        execution_lane="interactive_heavy",
    )
    assert escalated.execution_lane == "interactive_heavy"

    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        attempt = session.get(RunAttemptORM, created.attempt_id)
        assert run is not None
        assert attempt is not None
        assert run.operator_state == "admitted"
        assert run.execution_lane == "interactive_heavy"
        assert attempt.operator_state == "admitted"


def test_lease_renewal_and_expiry_reconciliation_are_durable(tmp_path: Path) -> None:
    transitions, admin, session_factory = _services(tmp_path)
    created = transitions.admit_create(
        company_id="company_alpha",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_operator_lease",
        request_fingerprint_hash="fp_create_operator_lease",
        run_kind="provider_dispatch",
    )
    claim = transitions.claim_next_attempt(company_id="company_alpha", worker_key="worker_alpha", lease_ttl_seconds=30)
    assert claim is not None
    transitions.mark_attempt_executing(
        company_id="company_alpha",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_call",
    )

    heartbeat = transitions.renew_attempt_lease(
        company_id="company_alpha",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        lease_ttl_seconds=45,
    )
    assert heartbeat.lease_expires_at > heartbeat.last_heartbeat_at

    with session_factory() as session:
        attempt = session.get(RunAttemptORM, claim.attempt_id)
        assert attempt is not None
        attempt.lease_expires_at = datetime.now(tz=UTC) - timedelta(seconds=5)
        session.commit()

    reconciled = admin.reconcile_expired_leases(instance=_instance())
    assert len(reconciled) == 1
    assert reconciled[0].dead_letter_reason == "lease_expired"

    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        attempt = session.get(RunAttemptORM, claim.attempt_id)
        assert run is not None
        assert attempt is not None
        assert run.operator_state == "quarantined"
        assert run.state == "timed_out"
        assert attempt.lease_status == "expired"
        assert attempt.operator_state == "interrupted"


def test_reconciliation_validation_is_per_attempt(
    tmp_path: Path,
    caplog,
) -> None:
    """Lease reconciliation should validate and log each attempt independently."""
    calls: list[tuple[str, ExecutionTransitionContext]] = []
    transitions, admin, session_factory = _services(
        tmp_path,
        state_machine_validation_enabled=True,
        state_machine_validator_factory=lambda: _ReconcileValidationSpy(calls),
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")
    expired_at = datetime(2026, 4, 23, 8, 1, tzinfo=UTC)
    attempt_ids: list[str] = []

    for suffix in ("alpha", "bravo"):
        created = transitions.admit_create(
            company_id="company_alpha",
            actor_type="agent",
            actor_id="agent_backend",
            idempotency_key=f"idem_create_reconcile_{suffix}",
            request_fingerprint_hash=f"fp_create_reconcile_{suffix}",
            run_kind="provider_dispatch",
        )
        claim = transitions.claim_next_attempt(
            company_id="company_alpha",
            worker_key=f"worker_{suffix}",
            lease_ttl_seconds=30,
        )
        assert claim is not None
        transitions.mark_attempt_executing(
            company_id="company_alpha",
            run_id=claim.run_id,
            attempt_id=claim.attempt_id,
            lease_token=claim.lease_token,
            step_key="provider_call",
        )
        assert claim.run_id == created.run_id
        attempt_ids.append(claim.attempt_id)

    with session_factory() as session:
        for attempt_id in attempt_ids:
            attempt = session.get(RunAttemptORM, attempt_id)
            assert attempt is not None
            attempt.lease_expires_at = expired_at - timedelta(seconds=1)
        session.commit()

    caplog.clear()
    reconciled = admin.reconcile_expired_leases(instance=_instance())

    assert {item.attempt_id for item in reconciled} == set(attempt_ids)
    expire_calls = [call for call in calls if call[0] == "expire_lease"]
    assert len(expire_calls) == 2
    assert {call[1].attempt_id for call in expire_calls} == set(attempt_ids)
    records = _validation_records(caplog)
    assert len(records) == 2
    payloads = [_validation_payload(record) for record in records]
    assert {payload["attempt_id"] for payload in payloads} == set(attempt_ids)
    assert {payload["trigger"] for payload in payloads} == {"expire_lease"}
    assert {payload["mismatch_category"] for payload in payloads} == {MISMATCH_CATEGORY_RUN_STATE_MISMATCH}


def test_quarantine_validation_preserves_completed_operator_compatibility(
    tmp_path: Path,
    caplog,
) -> None:
    """Quarantine remains operator-state compatible for completed runs."""
    transitions, admin, session_factory = _services(
        tmp_path,
        state_machine_validation_enabled=True,
    )
    caplog.set_level(logging.WARNING, logger="app.execution.service")
    created = transitions.admit_create(
        company_id="company_alpha",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_quarantine_completed",
        request_fingerprint_hash="fp_create_quarantine_completed",
        run_kind="provider_dispatch",
    )
    claim = transitions.claim_next_attempt(company_id="company_alpha", worker_key="worker_alpha")
    assert claim is not None
    transitions.mark_attempt_executing(
        company_id="company_alpha",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_call",
    )
    transitions.complete_attempt_success(
        company_id="company_alpha",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
    )
    assert _validation_records(caplog) == []

    quarantined = admin.perform_operator_action(
        instance=_instance(),
        run_id=created.run_id,
        actor_id="operator_alpha",
        action="quarantine",
        reason="Quarantine completed run for forensic review.",
    )

    assert quarantined.run_state == "dead_lettered"
    assert quarantined.operator_state == "quarantined"
    assert _validation_records(caplog) == []
    with session_factory() as session:
        run = session.get(RunORM, created.run_id)
        attempt = session.get(RunAttemptORM, claim.attempt_id)
        assert run is not None
        assert attempt is not None
        assert run.state == "dead_lettered"
        assert run.operator_state == "quarantined"
        assert attempt.attempt_state == "dead_lettered"
        assert attempt.operator_state == "quarantined"


def test_queue_and_dispatch_views_surface_lane_and_lease_truth(tmp_path: Path) -> None:
    transitions, admin, _ = _services(tmp_path)
    created = transitions.admit_create(
        company_id="company_alpha",
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_create_operator_queue",
        request_fingerprint_hash="fp_create_operator_queue",
        run_kind="provider_dispatch",
    )
    claim = transitions.claim_next_attempt(company_id="company_alpha", worker_key="worker_alpha")
    assert claim is not None
    transitions.mark_attempt_executing(
        company_id="company_alpha",
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_call",
    )

    lanes, runs = admin.list_queue_view(instance=_instance())
    dispatch = admin.get_dispatch_snapshot(instance=_instance())

    background_lane = next(item for item in lanes if item.execution_lane == "background_agentic")
    assert background_lane.total_runs == 1
    assert runs[0].execution_lane == "background_agentic"
    assert runs[0].operator_state == "waiting_external"
    assert dispatch.leased_attempts[0].worker_key == "worker_alpha"
    assert dispatch.workers[0].leased_runs == [created.run_id]
