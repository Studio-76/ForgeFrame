"""Admin-facing helpers for execution run inspection and replay."""

from __future__ import annotations

import hashlib
from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.execution.admin_models import (
    ExecutionReplayResult,
    ExecutionRunAttemptView,
    ExecutionRunCommandView,
    ExecutionRunDetail,
    ExecutionRunOutboxView,
    ExecutionRunSummary,
)
from app.execution.service import ExecutionTransitionService
from app.storage.execution_repository import RunAttemptORM, RunCommandORM, RunORM, RunOutboxORM

SessionFactory = Callable[[], Session]
_REPLAYABLE_STATES = {"failed", "timed_out", "compensated", "dead_lettered"}


class ExecutionAdminService:
    def __init__(self, session_factory: SessionFactory):
        self._session_factory = session_factory
        self._transitions = ExecutionTransitionService(session_factory)

    @staticmethod
    def _map_attempt(attempt: RunAttemptORM) -> ExecutionRunAttemptView:
        return ExecutionRunAttemptView(
            id=attempt.id,
            attempt_no=attempt.attempt_no,
            attempt_state=attempt.attempt_state,
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

    def _map_run_summary(self, session: Session, run: RunORM) -> ExecutionRunSummary:
        current_attempt = session.get(RunAttemptORM, run.current_attempt_id) if run.current_attempt_id else None
        return ExecutionRunSummary(
            run_id=run.id,
            run_kind=run.run_kind,
            state=run.state,
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

    def list_runs(self, *, company_id: str, state: str | None = None, limit: int = 100) -> list[ExecutionRunSummary]:
        with self._session_factory() as session:
            stmt = select(RunORM).where(RunORM.company_id == company_id)
            if state is not None:
                stmt = stmt.where(RunORM.state == state)
            rows = session.execute(stmt.order_by(RunORM.updated_at.desc()).limit(max(1, min(limit, 200)))).scalars().all()
            return [self._map_run_summary(session, row) for row in rows]

    def get_run_detail(self, *, company_id: str, run_id: str) -> ExecutionRunDetail:
        with self._session_factory() as session:
            run = session.get(RunORM, run_id)
            if run is None or run.company_id != company_id:
                raise ValueError(f"Run '{run_id}' not found.")

            attempts = session.execute(
                select(RunAttemptORM)
                .where(RunAttemptORM.company_id == company_id, RunAttemptORM.run_id == run_id)
                .order_by(RunAttemptORM.attempt_no.desc())
            ).scalars().all()
            commands = session.execute(
                select(RunCommandORM)
                .where(RunCommandORM.company_id == company_id, RunCommandORM.run_id == run_id)
                .order_by(RunCommandORM.issued_at.desc())
            ).scalars().all()
            outbox = session.execute(
                select(RunOutboxORM)
                .where(RunOutboxORM.company_id == company_id, RunOutboxORM.run_id == run_id)
                .order_by(RunOutboxORM.created_at.desc())
            ).scalars().all()

            summary = self._map_run_summary(session, run)
            return ExecutionRunDetail(
                **summary.model_dump(),
                attempts=[self._map_attempt(item) for item in attempts],
                commands=[self._map_command(item) for item in commands],
                outbox=[self._map_outbox(item) for item in outbox],
            )

    def replay_run(
        self,
        *,
        company_id: str,
        run_id: str,
        actor_id: str,
        reason: str,
        idempotency_key: str | None = None,
    ) -> ExecutionReplayResult:
        replay_reason = reason.strip()
        if not replay_reason:
            raise ValueError("Replay reason is required.")

        run = self._transitions.fetch_run(company_id=company_id, run_id=run_id)
        latest_command: RunCommandORM | None = None
        if run.state not in _REPLAYABLE_STATES and run.latest_command_id is not None:
            with self._session_factory() as session:
                command = session.get(RunCommandORM, run.latest_command_id)
                if command is not None and command.company_id == company_id:
                    latest_command = command

        replay_attempt_no = self._replay_target_attempt_no(run, latest_command, replay_reason=replay_reason)
        request_basis = f"replay|{run_id}|{replay_attempt_no}|{replay_reason}"
        derived_fingerprint = hashlib.sha256(request_basis.encode("utf-8")).hexdigest()
        derived_idempotency = hashlib.sha256(request_basis.encode("utf-8")).hexdigest()[:24]
        result = self._transitions.admit_retry(
            company_id=company_id,
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
            outbox_event=result.outbox_event,
            deduplicated=result.deduplicated,
            replay_reason=replay_reason,
        )
