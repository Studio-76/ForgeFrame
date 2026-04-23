from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.execution.admin_service import ExecutionAdminService
from app.execution.service import ExecutionTransitionService
from app.instances.models import InstanceRecord
from app.storage.execution_repository import RunAttemptORM, RunORM
from app.storage.models import Base


def _services(tmp_path: Path) -> tuple[ExecutionTransitionService, ExecutionAdminService, sessionmaker[Session]]:
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'execution-operator.sqlite'}")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(engine, autoflush=False, expire_on_commit=False)
    return ExecutionTransitionService(session_factory), ExecutionAdminService(session_factory), session_factory


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
