"""Admin-facing helpers for execution run inspection and replay."""

from __future__ import annotations

import hashlib
from collections import Counter, defaultdict
from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.execution.admin_models import (
    ExecutionDispatchAttemptView,
    ExecutionDispatchSnapshot,
    ExecutionDispatchWorkerView,
    ExecutionLeaseReconcileResult,
    ExecutionOperatorActionResult,
    ExecutionQueueLaneSummary,
    ExecutionQueueRunView,
    ExecutionReplayResult,
    ExecutionRunAttemptView,
    ExecutionRunCommandView,
    ExecutionRunDetail,
    ExecutionRunOutboxView,
    ExecutionRunSummary,
)
from app.instances.models import InstanceRecord
from app.execution.service import ExecutionTransitionService
from app.storage.execution_repository import ExecutionWorkerORM, RunAttemptORM, RunCommandORM, RunORM, RunOutboxORM
from app.workspaces.service import WorkInteractionAdminService

SessionFactory = Callable[[], Session]
_REPLAYABLE_STATES = {"failed", "timed_out", "compensated", "dead_lettered"}
_LANE_LABELS = {
    "interactive_low_latency": "Interactive Low Latency",
    "interactive_heavy": "Interactive Heavy",
    "background_agentic": "Background Agentic",
    "oauth_serialized": "OAuth Serialized",
}


class ExecutionAdminService:
    def __init__(self, session_factory: SessionFactory):
        self._session_factory = session_factory
        self._transitions = ExecutionTransitionService(session_factory)
        self._work = WorkInteractionAdminService(session_factory)

    @staticmethod
    def _as_utc(value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    @staticmethod
    def _map_attempt(attempt: RunAttemptORM) -> ExecutionRunAttemptView:
        return ExecutionRunAttemptView(
            id=attempt.id,
            attempt_no=attempt.attempt_no,
            attempt_state=attempt.attempt_state,
            operator_state=attempt.operator_state,
            lease_status=attempt.lease_status,
            worker_key=attempt.worker_key,
            retry_count=attempt.retry_count,
            scheduled_at=attempt.scheduled_at,
            started_at=attempt.started_at,
            finished_at=attempt.finished_at,
            backoff_until=attempt.backoff_until,
            last_error_code=attempt.last_error_code,
            last_error_detail=attempt.last_error_detail,
            version=attempt.version,
        )

    @staticmethod
    def _map_command(command: RunCommandORM) -> ExecutionRunCommandView:
        return ExecutionRunCommandView(
            id=command.id,
            command_type=command.command_type,
            command_status=command.command_status,
            actor_type=command.actor_type,
            actor_id=command.actor_id,
            idempotency_key=command.idempotency_key,
            accepted_transition=command.accepted_transition,
            response_snapshot=command.response_snapshot,
            issued_at=command.issued_at,
            completed_at=command.completed_at,
        )

    @staticmethod
    def _map_outbox(entry: RunOutboxORM) -> ExecutionRunOutboxView:
        return ExecutionRunOutboxView(
            id=entry.id,
            event_type=entry.event_type,
            publish_state=entry.publish_state,
            available_at=entry.available_at,
            publish_attempts=entry.publish_attempts,
            published_at=entry.published_at,
            dead_lettered_at=entry.dead_lettered_at,
            last_publish_error=entry.last_publish_error,
            payload=entry.payload,
        )

    @staticmethod
    def _replay_target_attempt_no(
        run: RunORM,
        latest_command: RunCommandORM | None,
        *,
        replay_reason: str,
    ) -> int:
        if run.state in _REPLAYABLE_STATES:
            return run.active_attempt_no
        if (
            latest_command is not None
            and latest_command.company_id == run.company_id
            and latest_command.run_id == run.id
            and latest_command.command_type == "retry"
            and isinstance(latest_command.response_snapshot, dict)
            and latest_command.response_snapshot.get("replay_reason") == replay_reason
            and run.active_attempt_no > 1
        ):
            return run.active_attempt_no - 1
        return run.active_attempt_no

    def _map_run_summary(self, session: Session, run: RunORM, *, instance: InstanceRecord) -> ExecutionRunSummary:
        current_attempt = session.get(RunAttemptORM, run.current_attempt_id) if run.current_attempt_id else None
        return ExecutionRunSummary(
            instance_id=instance.instance_id,
            run_id=run.id,
            workspace_id=run.workspace_id,
            run_kind=run.run_kind,
            state=run.state,
            operator_state=run.operator_state,
            execution_lane=run.execution_lane,
            issue_id=run.issue_id,
            active_attempt_no=run.active_attempt_no,
            failure_class=run.failure_class,
            status_reason=run.status_reason,
            current_attempt=self._map_attempt(current_attempt) if current_attempt is not None else None,
            next_wakeup_at=run.next_wakeup_at,
            terminal_at=run.terminal_at,
            result_summary=run.result_summary,
            replayable=run.state in _REPLAYABLE_STATES,
            created_at=run.created_at,
            updated_at=run.updated_at,
        )

    def list_runs(self, *, instance: InstanceRecord, state: str | None = None, limit: int = 100) -> list[ExecutionRunSummary]:
        with self._session_factory() as session:
            stmt = select(RunORM).where(RunORM.company_id == instance.company_id)
            if state is not None:
                stmt = stmt.where(RunORM.state == state)
            rows = session.execute(stmt.order_by(RunORM.updated_at.desc()).limit(max(1, min(limit, 200)))).scalars().all()
            return [self._map_run_summary(session, row, instance=instance) for row in rows]

    def get_run_detail(self, *, instance: InstanceRecord, run_id: str) -> ExecutionRunDetail:
        with self._session_factory() as session:
            run = session.get(RunORM, run_id)
            if run is None or run.company_id != instance.company_id:
                raise ValueError(f"Run '{run_id}' not found.")

            attempts = session.execute(
                select(RunAttemptORM)
                .where(RunAttemptORM.company_id == instance.company_id, RunAttemptORM.run_id == run_id)
                .order_by(RunAttemptORM.attempt_no.desc())
            ).scalars().all()
            commands = session.execute(
                select(RunCommandORM)
                .where(RunCommandORM.company_id == instance.company_id, RunCommandORM.run_id == run_id)
                .order_by(RunCommandORM.issued_at.desc())
            ).scalars().all()
            outbox = session.execute(
                select(RunOutboxORM)
                .where(RunOutboxORM.company_id == instance.company_id, RunOutboxORM.run_id == run_id)
                .order_by(RunOutboxORM.created_at.desc())
            ).scalars().all()

            summary = self._map_run_summary(session, run, instance=instance)
            return ExecutionRunDetail(
                **summary.model_dump(),
                attempts=[self._map_attempt(item) for item in attempts],
                commands=[self._map_command(item) for item in commands],
                outbox=[self._map_outbox(item) for item in outbox],
                workspace=(
                    self._work.get_workspace_summary(company_id=instance.company_id, workspace_id=run.workspace_id)
                    if run.workspace_id
                    else None
                ),
                artifacts=self._work.list_artifacts_for_target(
                    company_id=instance.company_id,
                    target_kind="run",
                    target_id=run_id,
                ),
            )

    def list_queue_view(
        self,
        *,
        instance: InstanceRecord,
        limit: int = 100,
    ) -> tuple[list[ExecutionQueueLaneSummary], list[ExecutionQueueRunView]]:
        with self._session_factory() as session:
            runs = session.execute(
                select(RunORM)
                .where(RunORM.company_id == instance.company_id)
                .order_by(RunORM.updated_at.desc())
                .limit(max(1, min(limit, 200)))
            ).scalars().all()
            attempts_by_id = {
                attempt.id: attempt
                for attempt in session.execute(
                    select(RunAttemptORM).where(RunAttemptORM.company_id == instance.company_id)
                ).scalars().all()
            }

            queue_rows: list[ExecutionQueueRunView] = []
            lane_counters: dict[str, Counter[str]] = defaultdict(Counter)
            lane_oldest_schedule: dict[str, datetime | None] = {key: None for key in _LANE_LABELS}
            lane_longest_wait_seconds: dict[str, int | None] = {key: None for key in _LANE_LABELS}
            now = datetime.now(tz=UTC)

            for run in runs:
                attempt = attempts_by_id.get(run.current_attempt_id or "")
                queue_rows.append(
                    ExecutionQueueRunView(
                        run_id=run.id,
                        workspace_id=run.workspace_id,
                        run_kind=run.run_kind,
                        state=run.state,
                        operator_state=run.operator_state,
                        execution_lane=run.execution_lane,
                        issue_id=run.issue_id,
                        attempt_id=attempt.id if attempt is not None else None,
                        attempt_state=attempt.attempt_state if attempt is not None else None,
                        lease_status=attempt.lease_status if attempt is not None else None,
                        scheduled_at=attempt.scheduled_at if attempt is not None else None,
                        next_wakeup_at=run.next_wakeup_at,
                        status_reason=run.status_reason,
                        updated_at=run.updated_at,
                    )
                )
                counters = lane_counters[run.execution_lane]
                counters["total_runs"] += 1
                if run.operator_state in {"admitted", "leased"}:
                    counters["runnable_runs"] += 1
                if run.operator_state == "paused":
                    counters["paused_runs"] += 1
                if run.operator_state == "waiting_on_approval":
                    counters["waiting_on_approval_runs"] += 1
                if run.operator_state == "retry_scheduled":
                    counters["retry_scheduled_runs"] += 1
                if run.operator_state == "quarantined":
                    counters["quarantined_runs"] += 1
                if attempt is not None and attempt.scheduled_at is not None:
                    scheduled_at = self._as_utc(attempt.scheduled_at)
                    oldest = lane_oldest_schedule[run.execution_lane]
                    lane_oldest_schedule[run.execution_lane] = (
                        scheduled_at if scheduled_at is not None and (oldest is None or scheduled_at < oldest) else oldest
                    )
                    if attempt.operator_state in {"admitted", "retry_scheduled"} and scheduled_at is not None:
                        waited = max(0, int((now - scheduled_at).total_seconds()))
                        current_longest = lane_longest_wait_seconds[run.execution_lane]
                        if current_longest is None or waited > current_longest:
                            lane_longest_wait_seconds[run.execution_lane] = waited

            lane_summaries = [
                ExecutionQueueLaneSummary(
                    execution_lane=lane_key, 
                    display_name=_LANE_LABELS[lane_key],
                    total_runs=lane_counters[lane_key]["total_runs"],
                    runnable_runs=lane_counters[lane_key]["runnable_runs"],
                    paused_runs=lane_counters[lane_key]["paused_runs"],
                    waiting_on_approval_runs=lane_counters[lane_key]["waiting_on_approval_runs"],
                    retry_scheduled_runs=lane_counters[lane_key]["retry_scheduled_runs"],
                    quarantined_runs=lane_counters[lane_key]["quarantined_runs"],
                    oldest_scheduled_at=lane_oldest_schedule[lane_key],
                    longest_wait_seconds=lane_longest_wait_seconds[lane_key],
                )
                for lane_key in _LANE_LABELS
            ]
            return lane_summaries, queue_rows

    def get_dispatch_snapshot(self, *, instance: InstanceRecord) -> ExecutionDispatchSnapshot:
        with self._session_factory() as session:
            runs = {
                run.id: run
                for run in session.execute(select(RunORM).where(RunORM.company_id == instance.company_id)).scalars().all()
            }
            attempts = session.execute(
                select(RunAttemptORM).where(RunAttemptORM.company_id == instance.company_id)
            ).scalars().all()
            worker_rows = session.execute(
                select(ExecutionWorkerORM).where(ExecutionWorkerORM.company_id == instance.company_id)
            ).scalars().all()
            outbox_entries = session.execute(
                select(RunOutboxORM).where(RunOutboxORM.company_id == instance.company_id)
            ).scalars().all()

            outbox_counts = Counter(entry.publish_state for entry in outbox_entries)
            event_counts = Counter(entry.event_type for entry in outbox_entries)

            leased_attempts: list[ExecutionDispatchAttemptView] = []
            stalled_attempts: list[ExecutionDispatchAttemptView] = []
            worker_runs: dict[str, list[ExecutionDispatchAttemptView]] = defaultdict(list)
            now = datetime.now(tz=UTC)

            for attempt in attempts:
                run = runs.get(attempt.run_id)
                if run is None:
                    continue
                if attempt.lease_status == "leased":
                    lease_expires_at = self._as_utc(attempt.lease_expires_at)
                    last_heartbeat_at = self._as_utc(attempt.last_heartbeat_at)
                    view = ExecutionDispatchAttemptView(
                        run_id=run.id,
                        attempt_id=attempt.id,
                        run_kind=run.run_kind,
                        state=run.state,
                        operator_state=run.operator_state,
                        execution_lane=run.execution_lane,
                        worker_key=attempt.worker_key,
                        lease_status=attempt.lease_status,
                        lease_expires_at=lease_expires_at,
                        last_heartbeat_at=last_heartbeat_at,
                        next_wakeup_at=run.next_wakeup_at,
                        status_reason=run.status_reason,
                        updated_at=run.updated_at,
                    )
                    leased_attempts.append(view)
                    if attempt.worker_key:
                        worker_runs[attempt.worker_key].append(view)
                    if lease_expires_at is not None and lease_expires_at <= now:
                        stalled_attempts.append(view)

            workers: list[ExecutionDispatchWorkerView] = []
            worker_keys_seen: set[str] = set()

            for row in sorted(worker_rows, key=lambda item: item.worker_key):
                items = worker_runs.get(row.worker_key, [])
                worker_state = row.worker_state
                heartbeat_expires_at = self._as_utc(row.heartbeat_expires_at)
                if (
                    worker_state in {"starting", "idle", "busy"}
                    and heartbeat_expires_at is not None
                    and heartbeat_expires_at <= now
                ):
                    worker_state = "stale"
                workers.append(
                    ExecutionDispatchWorkerView(
                        worker_key=row.worker_key,
                        worker_state=worker_state,
                        instance_id=row.instance_id,
                        execution_lane=row.execution_lane,
                        active_attempts=max(row.active_attempts, len(items)),
                        leased_runs=[item.run_id for item in items],
                        current_run_id=row.current_run_id,
                        current_attempt_id=row.current_attempt_id,
                        oldest_lease_expires_at=min(
                            (item.lease_expires_at for item in items if item.lease_expires_at is not None),
                            default=None,
                        ),
                        heartbeat_expires_at=heartbeat_expires_at,
                        last_heartbeat_at=self._as_utc(row.last_heartbeat_at),
                        last_claimed_at=self._as_utc(row.last_claimed_at),
                        last_completed_at=self._as_utc(row.last_completed_at),
                        last_error_code=row.last_error_code,
                        last_error_detail=row.last_error_detail,
                    )
                )
                worker_keys_seen.add(row.worker_key)

            for worker_key, items in sorted(worker_runs.items()):
                if worker_key in worker_keys_seen:
                    continue
                workers.append(
                    ExecutionDispatchWorkerView(
                        worker_key=worker_key,
                        worker_state="lease_only",
                        instance_id=instance.instance_id,
                        execution_lane=items[0].execution_lane if items else "background_agentic",
                        active_attempts=len(items),
                        leased_runs=[item.run_id for item in items],
                        current_run_id=items[0].run_id if items else None,
                        current_attempt_id=items[0].attempt_id if items else None,
                        oldest_lease_expires_at=min(
                            (item.lease_expires_at for item in items if item.lease_expires_at is not None),
                            default=None,
                        ),
                        heartbeat_expires_at=min(
                            (item.lease_expires_at for item in items if item.lease_expires_at is not None),
                            default=None,
                        ),
                        last_heartbeat_at=max(
                            (item.last_heartbeat_at for item in items if item.last_heartbeat_at is not None),
                            default=None,
                        ),
                        last_claimed_at=None,
                        last_completed_at=None,
                        last_error_code="worker_registry_missing",
                        last_error_detail="A leased attempt exists without a persisted execution worker heartbeat.",
                    )
                )

            return ExecutionDispatchSnapshot(
                outbox_counts={key: int(value) for key, value in outbox_counts.items()},
                event_counts={key: int(value) for key, value in event_counts.items()},
                leased_attempts=leased_attempts,
                stalled_attempts=stalled_attempts,
                workers=workers,
                quarantined_runs=sum(1 for run in runs.values() if run.operator_state == "quarantined"),
                paused_runs=sum(1 for run in runs.values() if run.operator_state == "paused"),
                waiting_on_approval_runs=sum(1 for run in runs.values() if run.operator_state == "waiting_on_approval"),
            )

    def replay_run(
        self,
        *,
        instance: InstanceRecord,
        run_id: str,
        actor_id: str,
        reason: str,
        idempotency_key: str | None = None,
    ) -> ExecutionReplayResult:
        replay_reason = reason.strip()
        if not replay_reason:
            raise ValueError("Replay reason is required.")

        run = self._transitions.fetch_run(company_id=instance.company_id, run_id=run_id)
        latest_command: RunCommandORM | None = None
        if run.state not in _REPLAYABLE_STATES and run.latest_command_id is not None:
            with self._session_factory() as session:
                command = session.get(RunCommandORM, run.latest_command_id)
                if command is not None and command.company_id == instance.company_id:
                    latest_command = command

        replay_attempt_no = self._replay_target_attempt_no(run, latest_command, replay_reason=replay_reason)
        request_basis = f"replay|{run_id}|{replay_attempt_no}|{replay_reason}"
        derived_fingerprint = hashlib.sha256(request_basis.encode("utf-8")).hexdigest()
        derived_idempotency = hashlib.sha256(request_basis.encode("utf-8")).hexdigest()[:24]
        result = self._transitions.admit_retry(
            company_id=instance.company_id,
            run_id=run_id,
            actor_type="user",
            actor_id=actor_id,
            idempotency_key=idempotency_key or f"replay:{run_id}:attempt:{replay_attempt_no}:{derived_idempotency}",
            request_fingerprint_hash=derived_fingerprint,
            replay_reason=replay_reason,
        )
        return ExecutionReplayResult(
            command_id=result.command_id,
            run_id=result.run_id,
            attempt_id=result.attempt_id,
            run_state=result.run_state,
            operator_state=result.operator_state,
            execution_lane=result.execution_lane,
            outbox_event=result.outbox_event,
            deduplicated=result.deduplicated,
            replay_reason=replay_reason,
        )

    def perform_operator_action(
        self,
        *,
        instance: InstanceRecord,
        run_id: str,
        actor_id: str,
        action: str,
        reason: str,
        execution_lane: str | None = None,
        idempotency_key: str | None = None,
    ) -> ExecutionOperatorActionResult:
        normalized_reason = reason.strip()
        if not normalized_reason:
            raise ValueError("Operator reason is required.")

        request_basis = f"{action}|{run_id}|{normalized_reason}|{execution_lane or ''}"
        derived_fingerprint = hashlib.sha256(request_basis.encode("utf-8")).hexdigest()
        derived_idempotency = hashlib.sha256(request_basis.encode("utf-8")).hexdigest()[:24]
        command_idempotency = idempotency_key or f"{action}:{run_id}:{derived_idempotency}"

        if action == "pause":
            result = self._transitions.pause_run(
                company_id=instance.company_id,
                run_id=run_id,
                actor_type="user",
                actor_id=actor_id,
                idempotency_key=command_idempotency,
                request_fingerprint_hash=derived_fingerprint,
                reason=normalized_reason,
            )
        elif action == "resume":
            result = self._transitions.resume_run(
                company_id=instance.company_id,
                run_id=run_id,
                actor_type="user",
                actor_id=actor_id,
                idempotency_key=command_idempotency,
                request_fingerprint_hash=derived_fingerprint,
                reason=normalized_reason,
            )
        elif action == "interrupt":
            result = self._transitions.interrupt_run(
                company_id=instance.company_id,
                run_id=run_id,
                actor_type="user",
                actor_id=actor_id,
                idempotency_key=command_idempotency,
                request_fingerprint_hash=derived_fingerprint,
                reason=normalized_reason,
            )
        elif action == "quarantine":
            result = self._transitions.quarantine_run(
                company_id=instance.company_id,
                run_id=run_id,
                actor_type="user",
                actor_id=actor_id,
                idempotency_key=command_idempotency,
                request_fingerprint_hash=derived_fingerprint,
                reason=normalized_reason,
            )
        elif action == "restart":
            result = self._transitions.restart_run_from_scratch(
                company_id=instance.company_id,
                run_id=run_id,
                actor_type="user",
                actor_id=actor_id,
                idempotency_key=command_idempotency,
                request_fingerprint_hash=derived_fingerprint,
                reason=normalized_reason,
                execution_lane=execution_lane,
            )
        elif action == "escalate":
            if not execution_lane:
                raise ValueError("Escalation requires a target execution lane.")
            result = self._transitions.escalate_run(
                company_id=instance.company_id,
                run_id=run_id,
                actor_type="user",
                actor_id=actor_id,
                idempotency_key=command_idempotency,
                request_fingerprint_hash=derived_fingerprint,
                target_execution_lane=execution_lane,
                reason=normalized_reason,
            )
        else:
            raise ValueError(f"Unsupported execution operator action '{action}'.")

        return ExecutionOperatorActionResult(
            command_id=result.command_id,
            run_id=result.run_id,
            attempt_id=result.attempt_id,
            related_run_id=result.related_run_id,
            run_state=result.run_state,
            operator_state=result.operator_state,
            execution_lane=result.execution_lane,
            outbox_event=result.outbox_event,
            reason=normalized_reason,
        )

    def reconcile_expired_leases(self, *, instance: InstanceRecord) -> list[ExecutionLeaseReconcileResult]:
        return [
            ExecutionLeaseReconcileResult(
                run_id=item.run_id,
                attempt_id=item.attempt_id,
                reconciled_to_state=item.reconciled_to_state,
                dead_letter_reason=item.dead_letter_reason,
            )
            for item in self._transitions.reconcile_expired_leases(company_id=instance.company_id)
        ]
