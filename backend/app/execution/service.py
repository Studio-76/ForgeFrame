"""Transactional run-transition service for execution admission and worker claims."""

from __future__ import annotations

import hashlib
from time import monotonic, sleep
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Callable
from uuid import uuid4

from sqlalchemy import Select, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.storage.execution_repository import (
    RunApprovalLinkORM,
    RunAttemptORM,
    RunCommandORM,
    RunORM,
    RunOutboxORM,
)

SessionFactory = Callable[[], Session]

_TERMINAL_RUN_STATES = {"succeeded", "failed", "cancelled", "timed_out", "compensated", "dead_lettered"}
_CLAIMABLE_ATTEMPT_STATES = {"queued", "retry_backoff"}
_RETRYABLE_RUN_STATES = {"failed", "timed_out", "compensated", "dead_lettered"}


class ExecutionTransitionError(RuntimeError):
    """Base error for run transition failures."""


class RunNotFoundError(ExecutionTransitionError):
    """Raised when a run does not exist in the expected company scope."""


class RunTransitionConflictError(ExecutionTransitionError):
    """Raised when a requested transition is not allowed from the current state."""


class StaleWorkerClaimError(ExecutionTransitionError):
    """Raised when a lease claim loses the compare-and-set race."""


class RunCommandIdempotencyConflictError(ExecutionTransitionError):
    """Raised when a command idempotency key is reused for a different payload."""


class _RunCommandInsertRaceError(RuntimeError):
    """Internal signal that a command insert lost the unique-key race."""

    def __init__(
        self,
        *,
        company_id: str,
        command_type: str,
        actor_type: str,
        actor_id: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
        original_error: IntegrityError,
    ) -> None:
        super().__init__(str(original_error))
        self.company_id = company_id
        self.command_type = command_type
        self.actor_type = actor_type
        self.actor_id = actor_id
        self.idempotency_key = idempotency_key
        self.request_fingerprint_hash = request_fingerprint_hash
        self.original_error = original_error


@dataclass(frozen=True)
class CommandTransitionResult:
    command_id: str
    run_id: str
    attempt_id: str | None
    approval_link_id: str | None
    outbox_event: str | None
    run_state: str
    deduplicated: bool = False


@dataclass(frozen=True)
class ApprovalOpenResult:
    approval_link_id: str
    run_id: str
    attempt_id: str
    outbox_event: str


@dataclass(frozen=True)
class ClaimCandidate:
    run_id: str
    attempt_id: str
    attempt_no: int
    run_version: int
    attempt_version: int


@dataclass(frozen=True)
class ClaimResult:
    run_id: str
    attempt_id: str
    lease_token: str
    worker_key: str
    run_version: int
    attempt_version: int


@dataclass(frozen=True)
class AttemptFailureResult:
    run_id: str
    failed_attempt_id: str
    next_attempt_id: str | None
    outbox_event: str
    run_state: str
    retry_scheduled: bool
    retry_delay_seconds: int | None
    dead_letter_reason: str | None = None


class ExecutionTransitionService:
    """Owns transactional run admission and worker-side state transitions."""

    def __init__(self, session_factory: SessionFactory):
        self._session_factory = session_factory

    @staticmethod
    def _now(now: datetime | None = None) -> datetime:
        if now is None:
            return datetime.now(tz=UTC)
        if now.tzinfo is None:
            raise ValueError("timestamps must be timezone-aware")
        return now.astimezone(UTC)

    @staticmethod
    def _new_id(prefix: str) -> str:
        return f"{prefix}_{uuid4().hex}"

    @staticmethod
    def _current_attempt(session: Session, run: RunORM) -> RunAttemptORM:
        if run.current_attempt_id:
            attempt = session.get(RunAttemptORM, run.current_attempt_id)
            if attempt and attempt.company_id == run.company_id:
                return attempt
        attempt = session.execute(
            select(RunAttemptORM)
            .where(RunAttemptORM.company_id == run.company_id, RunAttemptORM.run_id == run.id)
            .order_by(RunAttemptORM.attempt_no.desc())
        ).scalars().first()
        if attempt is None:
            raise RunTransitionConflictError(f"Run '{run.id}' has no attempts to transition.")
        return attempt

    @staticmethod
    def _find_command(
        session: Session,
        *,
        company_id: str,
        command_type: str,
        actor_type: str,
        actor_id: str,
        idempotency_key: str,
    ) -> RunCommandORM | None:
        return session.execute(
            select(RunCommandORM).where(
                RunCommandORM.company_id == company_id,
                RunCommandORM.command_type == command_type,
                RunCommandORM.actor_type == actor_type,
                RunCommandORM.actor_id == actor_id,
                RunCommandORM.idempotency_key == idempotency_key,
            )
        ).scalars().first()

    @staticmethod
    def _find_command_or_raise_conflict(
        session: Session,
        *,
        company_id: str,
        command_type: str,
        actor_type: str,
        actor_id: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
    ) -> RunCommandORM | None:
        existing = ExecutionTransitionService._find_command(
            session,
            company_id=company_id,
            command_type=command_type,
            actor_type=actor_type,
            actor_id=actor_id,
            idempotency_key=idempotency_key,
        )
        if existing is None:
            return None
        return ExecutionTransitionService._validate_existing_command_or_raise_conflict(
            existing=existing,
            request_fingerprint_hash=request_fingerprint_hash,
            idempotency_key=idempotency_key,
            command_type=command_type,
        )

    @staticmethod
    def _command_result(command: RunCommandORM, *, deduplicated: bool = False) -> CommandTransitionResult:
        snapshot = command.response_snapshot or {}
        return CommandTransitionResult(
            command_id=command.id,
            run_id=str(snapshot.get("run_id") or command.run_id or ""),
            attempt_id=snapshot.get("attempt_id"),
            approval_link_id=snapshot.get("approval_link_id"),
            outbox_event=snapshot.get("outbox_event"),
            run_state=str(snapshot.get("run_state") or command.accepted_transition or ""),
            deduplicated=deduplicated,
        )

    @staticmethod
    def _validate_existing_command_or_raise_conflict(
        *,
        existing: RunCommandORM,
        request_fingerprint_hash: str,
        idempotency_key: str,
        command_type: str,
    ) -> RunCommandORM:
        if existing.request_fingerprint_hash != request_fingerprint_hash:
            raise RunCommandIdempotencyConflictError(
                f"Idempotency key '{idempotency_key}' was already used for a different {command_type} command."
            )
        return existing

    @staticmethod
    def _flush_command_or_raise_insert_race(
        session: Session,
        *,
        command: RunCommandORM,
        company_id: str,
        command_type: str,
        actor_type: str,
        actor_id: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
    ) -> None:
        session.add(command)
        try:
            session.flush()
        except IntegrityError as exc:
            raise _RunCommandInsertRaceError(
                company_id=company_id,
                command_type=command_type,
                actor_type=actor_type,
                actor_id=actor_id,
                idempotency_key=idempotency_key,
                request_fingerprint_hash=request_fingerprint_hash,
                original_error=exc,
            ) from exc

    def _recover_command_after_insert_race(
        self,
        *,
        company_id: str,
        command_type: str,
        actor_type: str,
        actor_id: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
        original_error: IntegrityError,
        max_wait_seconds: float = 1.0,
    ) -> CommandTransitionResult:
        deadline = monotonic() + max_wait_seconds
        while True:
            with self._session_factory() as session:
                existing = self._find_command(
                    session,
                    company_id=company_id,
                    command_type=command_type,
                    actor_type=actor_type,
                    actor_id=actor_id,
                    idempotency_key=idempotency_key,
                )
                if existing is not None:
                    existing = self._validate_existing_command_or_raise_conflict(
                        existing=existing,
                        request_fingerprint_hash=request_fingerprint_hash,
                        idempotency_key=idempotency_key,
                        command_type=command_type,
                    )
                    if existing.response_snapshot:
                        return self._command_result(existing, deduplicated=True)
            if monotonic() >= deadline:
                raise original_error
            sleep(0.01)

    @staticmethod
    def _claim_query(company_id: str, now: datetime) -> Select[tuple[RunAttemptORM, RunORM]]:
        return (
            select(RunAttemptORM, RunORM)
            .join(
                RunORM,
                (RunORM.company_id == RunAttemptORM.company_id) & (RunORM.id == RunAttemptORM.run_id),
            )
            .where(
                RunAttemptORM.company_id == company_id,
                RunAttemptORM.attempt_state.in_(_CLAIMABLE_ATTEMPT_STATES),
                RunAttemptORM.scheduled_at <= now,
            )
            .order_by(RunAttemptORM.scheduled_at.asc(), RunAttemptORM.attempt_no.asc(), RunAttemptORM.created_at.asc())
        )

    @staticmethod
    def _clear_attempt_lease(attempt: RunAttemptORM) -> None:
        attempt.worker_key = None
        attempt.lease_token = None
        attempt.lease_acquired_at = None
        attempt.lease_expires_at = None
        attempt.last_heartbeat_at = None

    @staticmethod
    def _retry_backoff_seconds(
        *,
        attempt_id: str,
        retry_count: int,
        base_seconds: int,
        max_seconds: int,
        retry_after_seconds: int | None,
        jitter_ratio: float,
    ) -> int:
        bounded_base = max(1, min(max_seconds, retry_after_seconds or base_seconds * (2 ** max(0, retry_count - 1))))
        if jitter_ratio <= 0:
            return bounded_base

        jitter_window = min(max_seconds - bounded_base, max(0, int(round(bounded_base * jitter_ratio))))
        if jitter_window <= 0:
            return bounded_base

        digest = hashlib.sha256(f"{attempt_id}:{retry_count}".encode("utf-8")).digest()
        jitter_seconds = int.from_bytes(digest[:4], "big") % (jitter_window + 1)
        return min(max_seconds, bounded_base + jitter_seconds)

    @staticmethod
    def _failure_summary(
        *,
        failure_class: str,
        error_code: str,
        error_detail: str,
        retryable: bool,
        attempt_no: int,
        retry_count: int,
        max_attempts: int,
        retry_delay_seconds: int | None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "failure_class": failure_class,
            "error_code": error_code,
            "error_detail": error_detail,
            "retryable": retryable,
            "attempt_no": attempt_no,
            "retry_count": retry_count,
            "max_attempts": max_attempts,
        }
        if retry_delay_seconds is not None:
            payload["retry_delay_seconds"] = retry_delay_seconds
        return payload

    def _select_claim_candidate(self, session: Session, *, company_id: str, now: datetime) -> ClaimCandidate | None:
        query = self._claim_query(company_id, now)
        bind = session.get_bind()
        if bind is not None and bind.dialect.name != "sqlite":
            query = query.with_for_update(skip_locked=True, of=RunAttemptORM)
        row = session.execute(query).first()
        if row is None:
            return None
        attempt, run = row
        return ClaimCandidate(
            run_id=run.id,
            attempt_id=attempt.id,
            attempt_no=attempt.attempt_no,
            run_version=run.version,
            attempt_version=attempt.version,
        )

    def peek_claimable_attempt(self, *, company_id: str, now: datetime | None = None) -> ClaimCandidate | None:
        current_time = self._now(now)
        with self._session_factory() as session:
            return self._select_claim_candidate(session, company_id=company_id, now=current_time)

    def admit_create(
        self,
        *,
        company_id: str,
        actor_type: str,
        actor_id: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
        run_kind: str,
        workspace_id: str | None = None,
        issue_id: str | None = None,
        now: datetime | None = None,
    ) -> CommandTransitionResult:
        current_time = self._now(now)
        try:
            with self._session_factory() as session, session.begin():
                existing = self._find_command_or_raise_conflict(
                    session,
                    company_id=company_id,
                    command_type="create",
                    actor_type=actor_type,
                    actor_id=actor_id,
                    idempotency_key=idempotency_key,
                    request_fingerprint_hash=request_fingerprint_hash,
                )
                if existing is not None:
                    return self._command_result(existing, deduplicated=True)

                command = RunCommandORM(
                    id=self._new_id("cmd"),
                    company_id=company_id,
                    command_type="create",
                    actor_type=actor_type,
                    actor_id=actor_id,
                    idempotency_key=idempotency_key,
                    request_fingerprint_hash=request_fingerprint_hash,
                    command_status="accepted",
                    issued_at=current_time,
                    created_at=current_time,
                    updated_at=current_time,
                )
                self._flush_command_or_raise_insert_race(
                    session,
                    command=command,
                    company_id=company_id,
                    command_type="create",
                    actor_type=actor_type,
                    actor_id=actor_id,
                    idempotency_key=idempotency_key,
                    request_fingerprint_hash=request_fingerprint_hash,
                )

                run_id = self._new_id("run")
                attempt_id = self._new_id("attempt")
                outbox_id = self._new_id("outbox")
                snapshot = {
                    "run_id": run_id,
                    "attempt_id": attempt_id,
                    "outbox_event": "run_dispatch",
                    "run_state": "queued",
                }

                run = RunORM(
                    id=run_id,
                    company_id=company_id,
                    workspace_id=workspace_id,
                    issue_id=issue_id,
                    run_kind=run_kind,
                    state="queued",
                    active_attempt_no=1,
                    current_attempt_id=attempt_id,
                    latest_command_id=command.id,
                    version=0,
                    created_at=current_time,
                    updated_at=current_time,
                )
                session.add(run)

                attempt = RunAttemptORM(
                    id=attempt_id,
                    company_id=company_id,
                    run_id=run_id,
                    attempt_no=1,
                    attempt_state="queued",
                    scheduled_at=current_time,
                    version=0,
                    created_at=current_time,
                    updated_at=current_time,
                )
                session.add(attempt)

                outbox = RunOutboxORM(
                    id=outbox_id,
                    company_id=company_id,
                    run_id=run_id,
                    attempt_id=attempt_id,
                    event_type="run_dispatch",
                    payload={
                        "run_id": run_id,
                        "attempt_id": attempt_id,
                        "command_id": command.id,
                    },
                    publish_state="pending",
                    dedupe_key=f"run:{run_id}:command:{command.id}:dispatch",
                    available_at=current_time,
                    created_at=current_time,
                    updated_at=current_time,
                )
                session.add(outbox)

                command.run_id = run_id
                command.accepted_transition = "queued"
                command.command_status = "completed"
                command.response_snapshot = snapshot
                command.completed_at = current_time
                command.updated_at = current_time

                return self._command_result(command)
        except _RunCommandInsertRaceError as race:
            return self._recover_command_after_insert_race(
                company_id=race.company_id,
                command_type=race.command_type,
                actor_type=race.actor_type,
                actor_id=race.actor_id,
                idempotency_key=race.idempotency_key,
                request_fingerprint_hash=race.request_fingerprint_hash,
                original_error=race.original_error,
            )

    def claim_next_attempt(
        self,
        *,
        company_id: str,
        worker_key: str,
        lease_ttl_seconds: int = 60,
        now: datetime | None = None,
    ) -> ClaimResult | None:
        current_time = self._now(now)
        with self._session_factory() as session, session.begin():
            candidate = self._select_claim_candidate(session, company_id=company_id, now=current_time)
            if candidate is None:
                return None
            return self._claim_attempt(
                session,
                company_id=company_id,
                run_id=candidate.run_id,
                attempt_id=candidate.attempt_id,
                expected_run_version=candidate.run_version,
                expected_attempt_version=candidate.attempt_version,
                worker_key=worker_key,
                lease_ttl_seconds=lease_ttl_seconds,
                now=current_time,
            )

    def claim_attempt(
        self,
        *,
        company_id: str,
        run_id: str,
        attempt_id: str,
        expected_run_version: int,
        expected_attempt_version: int,
        worker_key: str,
        lease_ttl_seconds: int = 60,
        now: datetime | None = None,
    ) -> ClaimResult:
        current_time = self._now(now)
        with self._session_factory() as session, session.begin():
            return self._claim_attempt(
                session,
                company_id=company_id,
                run_id=run_id,
                attempt_id=attempt_id,
                expected_run_version=expected_run_version,
                expected_attempt_version=expected_attempt_version,
                worker_key=worker_key,
                lease_ttl_seconds=lease_ttl_seconds,
                now=current_time,
            )

    def _claim_attempt(
        self,
        session: Session,
        *,
        company_id: str,
        run_id: str,
        attempt_id: str,
        expected_run_version: int,
        expected_attempt_version: int,
        worker_key: str,
        lease_ttl_seconds: int,
        now: datetime,
    ) -> ClaimResult:
        lease_token = str(uuid4())
        lease_expires_at = now + timedelta(seconds=max(1, lease_ttl_seconds))

        attempt_update = session.execute(
            update(RunAttemptORM)
            .where(
                RunAttemptORM.company_id == company_id,
                RunAttemptORM.id == attempt_id,
                RunAttemptORM.run_id == run_id,
                RunAttemptORM.version == expected_attempt_version,
                RunAttemptORM.attempt_state.in_(_CLAIMABLE_ATTEMPT_STATES),
            )
            .values(
                attempt_state="dispatching",
                worker_key=worker_key,
                lease_token=lease_token,
                lease_acquired_at=now,
                lease_expires_at=lease_expires_at,
                last_heartbeat_at=now,
                version=expected_attempt_version + 1,
                updated_at=now,
            )
        )
        if attempt_update.rowcount != 1:
            raise StaleWorkerClaimError(f"Attempt '{attempt_id}' is no longer claimable.")

        run_update = session.execute(
            update(RunORM)
            .where(
                RunORM.company_id == company_id,
                RunORM.id == run_id,
                RunORM.version == expected_run_version,
            )
            .values(
                state="dispatching",
                current_attempt_id=attempt_id,
                version=expected_run_version + 1,
                updated_at=now,
            )
        )
        if run_update.rowcount != 1:
            raise StaleWorkerClaimError(f"Run '{run_id}' changed while claiming attempt '{attempt_id}'.")

        return ClaimResult(
            run_id=run_id,
            attempt_id=attempt_id,
            lease_token=lease_token,
            worker_key=worker_key,
            run_version=expected_run_version + 1,
            attempt_version=expected_attempt_version + 1,
        )

    def mark_attempt_executing(
        self,
        *,
        company_id: str,
        run_id: str,
        attempt_id: str,
        lease_token: str,
        step_key: str,
        now: datetime | None = None,
    ) -> None:
        current_time = self._now(now)
        with self._session_factory() as session, session.begin():
            run = session.get(RunORM, run_id)
            attempt = session.get(RunAttemptORM, attempt_id)
            if run is None or run.company_id != company_id:
                raise RunNotFoundError(f"Run '{run_id}' not found for company '{company_id}'.")
            if attempt is None or attempt.company_id != company_id or attempt.run_id != run_id:
                raise RunTransitionConflictError(f"Attempt '{attempt_id}' does not belong to run '{run_id}'.")
            if run.state != "dispatching" or attempt.attempt_state != "dispatching":
                raise RunTransitionConflictError("Only dispatched attempts can move to executing.")
            if attempt.lease_token != lease_token:
                raise RunTransitionConflictError("Lease token does not match the active worker claim.")

            attempt.version += 1
            attempt.attempt_state = "executing"
            attempt.started_at = attempt.started_at or current_time
            attempt.updated_at = current_time

            run.version += 1
            run.state = "executing"
            run.current_step_key = step_key
            run.updated_at = current_time

    def record_attempt_failure(
        self,
        *,
        company_id: str,
        run_id: str,
        attempt_id: str,
        lease_token: str,
        failure_class: str,
        error_code: str,
        error_detail: str,
        retryable: bool,
        max_attempts: int = 3,
        backoff_base_seconds: int = 30,
        backoff_max_seconds: int = 900,
        backoff_jitter_ratio: float = 0.2,
        retry_after_seconds: int | None = None,
        now: datetime | None = None,
    ) -> AttemptFailureResult:
        current_time = self._now(now)
        if max_attempts < 1:
            raise ValueError("max_attempts must be at least 1")
        with self._session_factory() as session, session.begin():
            run = session.get(RunORM, run_id)
            attempt = session.get(RunAttemptORM, attempt_id)
            if run is None or run.company_id != company_id:
                raise RunNotFoundError(f"Run '{run_id}' not found for company '{company_id}'.")
            if attempt is None or attempt.company_id != company_id or attempt.run_id != run_id:
                raise RunTransitionConflictError(f"Attempt '{attempt_id}' does not belong to run '{run_id}'.")
            if run.current_attempt_id != attempt_id:
                raise RunTransitionConflictError(f"Attempt '{attempt_id}' is not the active attempt for run '{run_id}'.")
            if run.state not in {"dispatching", "executing"} or attempt.attempt_state not in {
                "dispatching",
                "executing",
            }:
                raise RunTransitionConflictError("Only in-flight attempts can record a failure outcome.")
            if attempt.lease_token != lease_token:
                raise RunTransitionConflictError("Lease token does not match the active worker claim.")

            attempt.version += 1
            attempt.attempt_state = "failed"
            attempt.finished_at = current_time
            attempt.last_error_code = error_code
            attempt.last_error_detail = error_detail
            attempt.updated_at = current_time
            self._clear_attempt_lease(attempt)

            next_attempt_id: str | None = None
            outbox_event = "dead_letter"
            retry_delay_seconds: int | None = None
            dead_letter_reason: str | None = None
            next_attempt_no = run.active_attempt_no + 1
            should_retry = retryable and next_attempt_no <= max_attempts

            if should_retry:
                retry_count = attempt.retry_count + 1
                retry_delay_seconds = self._retry_backoff_seconds(
                    attempt_id=attempt.id,
                    retry_count=retry_count,
                    base_seconds=max(1, backoff_base_seconds),
                    max_seconds=max(1, backoff_max_seconds),
                    retry_after_seconds=retry_after_seconds,
                    jitter_ratio=max(0.0, backoff_jitter_ratio),
                )
                scheduled_at = current_time + timedelta(seconds=retry_delay_seconds)
                next_attempt_id = self._new_id("attempt")
                next_state = "retry_backoff" if retry_delay_seconds > 0 else "queued"

                session.add(
                    RunAttemptORM(
                        id=next_attempt_id,
                        company_id=company_id,
                        run_id=run_id,
                        attempt_no=next_attempt_no,
                        attempt_state=next_state,
                        scheduled_at=scheduled_at,
                        retry_count=retry_count,
                        backoff_until=scheduled_at if retry_delay_seconds > 0 else None,
                        version=0,
                        created_at=current_time,
                        updated_at=current_time,
                    )
                )
                session.add(
                    RunOutboxORM(
                        id=self._new_id("outbox"),
                        company_id=company_id,
                        run_id=run_id,
                        attempt_id=next_attempt_id,
                        event_type="run_dispatch",
                        payload={
                            "run_id": run_id,
                            "attempt_id": next_attempt_id,
                            "retry_of_attempt_id": attempt_id,
                            "failure_class": failure_class,
                            "error_code": error_code,
                            "retry_delay_seconds": retry_delay_seconds,
                        },
                        publish_state="pending",
                        dedupe_key=f"run:{run_id}:attempt:{next_attempt_id}:dispatch",
                        available_at=scheduled_at,
                        created_at=current_time,
                        updated_at=current_time,
                    )
                )

                run.version += 1
                run.state = "retry_backoff" if retry_delay_seconds > 0 else "queued"
                run.status_reason = "retry_scheduled"
                run.active_attempt_no = next_attempt_no
                run.current_attempt_id = next_attempt_id
                run.current_approval_link_id = None
                run.current_step_key = None
                run.failure_class = failure_class
                run.result_summary = {
                    "last_failure": self._failure_summary(
                        failure_class=failure_class,
                        error_code=error_code,
                        error_detail=error_detail,
                        retryable=True,
                        attempt_no=attempt.attempt_no,
                        retry_count=attempt.retry_count,
                        max_attempts=max_attempts,
                        retry_delay_seconds=retry_delay_seconds,
                    ),
                    "next_attempt_no": next_attempt_no,
                    "next_attempt_id": next_attempt_id,
                }
                run.next_wakeup_at = scheduled_at
                run.terminal_at = None
                run.updated_at = current_time

                return AttemptFailureResult(
                    run_id=run_id,
                    failed_attempt_id=attempt_id,
                    next_attempt_id=next_attempt_id,
                    outbox_event="run_dispatch",
                    run_state=run.state,
                    retry_scheduled=True,
                    retry_delay_seconds=retry_delay_seconds,
                )

            dead_letter_reason = "retry_budget_exhausted" if retryable else "terminal_failure"
            attempt.attempt_state = "dead_lettered"

            session.add(
                RunOutboxORM(
                    id=self._new_id("outbox"),
                    company_id=company_id,
                    run_id=run_id,
                    attempt_id=attempt_id,
                    event_type="dead_letter",
                    payload={
                        "run_id": run_id,
                        "attempt_id": attempt_id,
                        "failure_class": failure_class,
                        "error_code": error_code,
                        "error_detail": error_detail,
                        "retryable": retryable,
                        "dead_letter_reason": dead_letter_reason,
                        "attempt_no": attempt.attempt_no,
                        "retry_count": attempt.retry_count,
                        "max_attempts": max_attempts,
                    },
                    publish_state="pending",
                    dedupe_key=f"run:{run_id}:attempt:{attempt_id}:dead_letter",
                    available_at=current_time,
                    created_at=current_time,
                    updated_at=current_time,
                )
            )

            run.version += 1
            run.state = "dead_lettered"
            run.status_reason = dead_letter_reason
            run.current_approval_link_id = None
            run.current_step_key = None
            run.failure_class = failure_class
            run.result_summary = self._failure_summary(
                failure_class=failure_class,
                error_code=error_code,
                error_detail=error_detail,
                retryable=retryable,
                attempt_no=attempt.attempt_no,
                retry_count=attempt.retry_count,
                max_attempts=max_attempts,
                retry_delay_seconds=None,
            )
            run.next_wakeup_at = None
            run.terminal_at = current_time
            run.updated_at = current_time

            return AttemptFailureResult(
                run_id=run_id,
                failed_attempt_id=attempt_id,
                next_attempt_id=None,
                outbox_event=outbox_event,
                run_state="dead_lettered",
                retry_scheduled=False,
                retry_delay_seconds=None,
                dead_letter_reason=dead_letter_reason,
            )

    def request_cancel(
        self,
        *,
        company_id: str,
        run_id: str,
        actor_type: str,
        actor_id: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
        now: datetime | None = None,
    ) -> CommandTransitionResult:
        current_time = self._now(now)
        with self._session_factory() as session, session.begin():
            existing = self._find_command_or_raise_conflict(
                session,
                company_id=company_id,
                command_type="cancel",
                actor_type=actor_type,
                actor_id=actor_id,
                idempotency_key=idempotency_key,
                request_fingerprint_hash=request_fingerprint_hash,
            )
            if existing is not None:
                return self._command_result(existing, deduplicated=True)

            run = session.get(RunORM, run_id)
            if run is None or run.company_id != company_id:
                raise RunNotFoundError(f"Run '{run_id}' not found for company '{company_id}'.")
            if run.state in _TERMINAL_RUN_STATES or run.state == "cancel_requested":
                raise RunTransitionConflictError(f"Run '{run_id}' cannot be cancelled from state '{run.state}'.")

            attempt = self._current_attempt(session, run)
            command = RunCommandORM(
                id=self._new_id("cmd"),
                company_id=company_id,
                run_id=run_id,
                command_type="cancel",
                actor_type=actor_type,
                actor_id=actor_id,
                idempotency_key=idempotency_key,
                request_fingerprint_hash=request_fingerprint_hash,
                command_status="completed",
                issued_at=current_time,
                completed_at=current_time,
                created_at=current_time,
                updated_at=current_time,
            )
            session.add(command)
            session.flush()

            outbox = RunOutboxORM(
                id=self._new_id("outbox"),
                company_id=company_id,
                run_id=run_id,
                attempt_id=attempt.id,
                event_type="run_cancel",
                payload={
                    "run_id": run_id,
                    "attempt_id": attempt.id,
                    "command_id": command.id,
                },
                publish_state="pending",
                dedupe_key=f"run:{run_id}:command:{command.id}:cancel",
                available_at=current_time,
                created_at=current_time,
                updated_at=current_time,
            )
            session.add(outbox)

            attempt.version += 1
            attempt.attempt_state = "cancel_requested"
            attempt.updated_at = current_time

            run.version += 1
            run.state = "cancel_requested"
            run.cancel_requested_at = current_time
            run.latest_command_id = command.id
            run.updated_at = current_time

            snapshot = {
                "run_id": run_id,
                "attempt_id": attempt.id,
                "outbox_event": "run_cancel",
                "run_state": "cancel_requested",
            }
            command.accepted_transition = "cancel_requested"
            command.response_snapshot = snapshot

            return self._command_result(command)

    def admit_retry(
        self,
        *,
        company_id: str,
        run_id: str,
        actor_type: str,
        actor_id: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
        replay_reason: str | None = None,
        now: datetime | None = None,
    ) -> CommandTransitionResult:
        current_time = self._now(now)
        try:
            with self._session_factory() as session, session.begin():
                existing = self._find_command_or_raise_conflict(
                    session,
                    company_id=company_id,
                    command_type="retry",
                    actor_type=actor_type,
                    actor_id=actor_id,
                    idempotency_key=idempotency_key,
                    request_fingerprint_hash=request_fingerprint_hash,
                )
                if existing is not None:
                    return self._command_result(existing, deduplicated=True)

                run = session.get(RunORM, run_id)
                if run is None or run.company_id != company_id:
                    raise RunNotFoundError(f"Run '{run_id}' not found for company '{company_id}'.")
                if run.state not in _RETRYABLE_RUN_STATES:
                    raise RunTransitionConflictError(f"Run '{run_id}' cannot retry from state '{run.state}'.")

                command = RunCommandORM(
                    id=self._new_id("cmd"),
                    company_id=company_id,
                    run_id=run_id,
                    command_type="retry",
                    actor_type=actor_type,
                    actor_id=actor_id,
                    idempotency_key=idempotency_key,
                    request_fingerprint_hash=request_fingerprint_hash,
                    command_status="completed",
                    issued_at=current_time,
                    completed_at=current_time,
                    created_at=current_time,
                    updated_at=current_time,
                )
                self._flush_command_or_raise_insert_race(
                    session,
                    command=command,
                    company_id=company_id,
                    command_type="retry",
                    actor_type=actor_type,
                    actor_id=actor_id,
                    idempotency_key=idempotency_key,
                    request_fingerprint_hash=request_fingerprint_hash,
                )

                next_attempt_no = run.active_attempt_no + 1
                attempt_id = self._new_id("attempt")
                attempt = RunAttemptORM(
                    id=attempt_id,
                    company_id=company_id,
                    run_id=run_id,
                    attempt_no=next_attempt_no,
                    attempt_state="queued",
                    scheduled_at=current_time,
                    version=0,
                    created_at=current_time,
                    updated_at=current_time,
                )
                session.add(attempt)

                outbox = RunOutboxORM(
                    id=self._new_id("outbox"),
                    company_id=company_id,
                    run_id=run_id,
                    attempt_id=attempt_id,
                    event_type="run_dispatch",
                    payload={
                        "run_id": run_id,
                        "attempt_id": attempt_id,
                        "command_id": command.id,
                        "replay_reason": replay_reason,
                    },
                    publish_state="pending",
                    dedupe_key=f"run:{run_id}:attempt:{attempt_id}:dispatch",
                    available_at=current_time,
                    created_at=current_time,
                    updated_at=current_time,
                )
                session.add(outbox)

                run.version += 1
                run.state = "queued"
                run.status_reason = None
                run.active_attempt_no = next_attempt_no
                run.current_attempt_id = attempt_id
                run.current_approval_link_id = None
                run.latest_command_id = command.id
                run.current_step_key = None
                run.result_summary = None
                run.failure_class = None
                run.next_wakeup_at = None
                run.cancel_requested_at = None
                run.terminal_at = None
                run.updated_at = current_time

                snapshot = {
                    "run_id": run_id,
                    "attempt_id": attempt_id,
                    "outbox_event": "run_dispatch",
                    "run_state": "queued",
                    "replay_reason": replay_reason,
                }
                command.accepted_transition = "queued"
                command.response_snapshot = snapshot

                return self._command_result(command)
        except _RunCommandInsertRaceError as race:
            return self._recover_command_after_insert_race(
                company_id=race.company_id,
                command_type=race.command_type,
                actor_type=race.actor_type,
                actor_id=race.actor_id,
                idempotency_key=race.idempotency_key,
                request_fingerprint_hash=race.request_fingerprint_hash,
                original_error=race.original_error,
            )

    def open_approval(
        self,
        *,
        company_id: str,
        run_id: str,
        attempt_id: str,
        approval_id: str,
        gate_key: str,
        resume_disposition: str = "resume",
        now: datetime | None = None,
    ) -> ApprovalOpenResult:
        current_time = self._now(now)
        with self._session_factory() as session, session.begin():
            run = session.get(RunORM, run_id)
            attempt = session.get(RunAttemptORM, attempt_id)
            if run is None or run.company_id != company_id:
                raise RunNotFoundError(f"Run '{run_id}' not found for company '{company_id}'.")
            if attempt is None or attempt.company_id != company_id or attempt.run_id != run_id:
                raise RunTransitionConflictError(f"Attempt '{attempt_id}' does not belong to run '{run_id}'.")
            if run.state != "executing" or attempt.attempt_state != "executing":
                raise RunTransitionConflictError("Approvals can only open from the executing state.")

            approval_link = RunApprovalLinkORM(
                id=self._new_id("approval"),
                company_id=company_id,
                run_id=run_id,
                attempt_id=attempt_id,
                approval_id=approval_id,
                gate_key=gate_key,
                gate_status="open",
                resume_disposition=resume_disposition,
                opened_at=current_time,
                version=0,
                created_at=current_time,
                updated_at=current_time,
            )
            session.add(approval_link)

            outbox = RunOutboxORM(
                id=self._new_id("outbox"),
                company_id=company_id,
                run_id=run_id,
                attempt_id=attempt_id,
                event_type="approval_notify",
                payload={
                    "run_id": run_id,
                    "attempt_id": attempt_id,
                    "approval_id": approval_id,
                    "approval_link_id": approval_link.id,
                    "gate_key": gate_key,
                },
                publish_state="pending",
                dedupe_key=f"approval:{approval_id}:notify",
                available_at=current_time,
                created_at=current_time,
                updated_at=current_time,
            )
            session.add(outbox)

            attempt.version += 1
            attempt.attempt_state = "waiting_on_approval"
            attempt.worker_key = None
            attempt.lease_token = None
            attempt.lease_acquired_at = None
            attempt.lease_expires_at = None
            attempt.last_heartbeat_at = None
            attempt.updated_at = current_time

            run.version += 1
            run.state = "waiting_on_approval"
            run.current_approval_link_id = approval_link.id
            run.current_step_key = gate_key
            run.updated_at = current_time

            return ApprovalOpenResult(
                approval_link_id=approval_link.id,
                run_id=run_id,
                attempt_id=attempt_id,
                outbox_event="approval_notify",
            )

    def decide_approval(
        self,
        *,
        company_id: str,
        approval_id: str,
        actor_type: str,
        actor_id: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
        approved: bool,
        now: datetime | None = None,
    ) -> CommandTransitionResult:
        current_time = self._now(now)
        command_type = "approval_resume" if approved else "approval_reject"
        with self._session_factory() as session, session.begin():
            existing = self._find_command_or_raise_conflict(
                session,
                company_id=company_id,
                command_type=command_type,
                actor_type=actor_type,
                actor_id=actor_id,
                idempotency_key=idempotency_key,
                request_fingerprint_hash=request_fingerprint_hash,
            )
            if existing is not None:
                return self._command_result(existing, deduplicated=True)

            approval_link = session.execute(
                select(RunApprovalLinkORM).where(
                    RunApprovalLinkORM.company_id == company_id,
                    RunApprovalLinkORM.approval_id == approval_id,
                )
            ).scalars().first()
            if approval_link is None:
                raise RunTransitionConflictError(f"Approval '{approval_id}' is not linked to a run.")
            if approval_link.gate_status != "open":
                raise RunTransitionConflictError(f"Approval '{approval_id}' is already closed.")

            run = session.get(RunORM, approval_link.run_id)
            attempt = session.get(RunAttemptORM, approval_link.attempt_id)
            if run is None or run.company_id != company_id:
                raise RunNotFoundError(f"Run '{approval_link.run_id}' not found for company '{company_id}'.")
            if attempt is None or attempt.company_id != company_id:
                raise RunTransitionConflictError(f"Attempt '{approval_link.attempt_id}' is missing for approval '{approval_id}'.")

            command = RunCommandORM(
                id=self._new_id("cmd"),
                company_id=company_id,
                run_id=run.id,
                command_type=command_type,
                actor_type=actor_type,
                actor_id=actor_id,
                idempotency_key=idempotency_key,
                request_fingerprint_hash=request_fingerprint_hash,
                command_status="completed",
                issued_at=current_time,
                completed_at=current_time,
                created_at=current_time,
                updated_at=current_time,
            )
            session.add(command)
            session.flush()

            outbox_event: str | None = None
            if approved:
                run_state = "queued"
                attempt_state = "queued"
                approval_link.gate_status = "approved"
                approval_link.resume_enqueued_at = current_time
                outbox_event = "run_resume"
                attempt.finished_at = None
            else:
                approval_link.gate_status = "rejected"
                if approval_link.resume_disposition == "cancel":
                    run_state = "cancel_requested"
                    attempt_state = "cancel_requested"
                    outbox_event = "run_cancel"
                    run.cancel_requested_at = current_time
                elif approval_link.resume_disposition == "compensate":
                    run_state = "compensating"
                    attempt_state = "compensating"
                    outbox_event = "run_resume"
                else:
                    run_state = "failed"
                    attempt_state = "failed"
                    run.terminal_at = current_time
                    attempt.finished_at = current_time

            approval_link.version += 1
            approval_link.decided_at = current_time
            approval_link.decision_actor_type = actor_type
            approval_link.decision_actor_id = actor_id
            approval_link.updated_at = current_time

            attempt.version += 1
            attempt.attempt_state = attempt_state
            attempt.worker_key = None
            attempt.lease_token = None
            attempt.lease_acquired_at = None
            attempt.lease_expires_at = None
            attempt.last_heartbeat_at = None
            attempt.scheduled_at = current_time if outbox_event is not None else attempt.scheduled_at
            attempt.updated_at = current_time

            run.version += 1
            run.state = run_state
            run.latest_command_id = command.id
            run.current_step_key = None
            run.updated_at = current_time

            outbox_id: str | None = None
            if outbox_event is not None:
                outbox_id = self._new_id("outbox")
                session.add(
                    RunOutboxORM(
                        id=outbox_id,
                        company_id=company_id,
                        run_id=run.id,
                        attempt_id=attempt.id,
                        event_type=outbox_event,
                        payload={
                            "run_id": run.id,
                            "attempt_id": attempt.id,
                            "command_id": command.id,
                            "approval_id": approval_id,
                            "approval_link_id": approval_link.id,
                        },
                        publish_state="pending",
                        dedupe_key=f"approval:{approval_link.id}:command:{command.id}:{outbox_event}",
                        available_at=current_time,
                        created_at=current_time,
                        updated_at=current_time,
                    )
                )

            snapshot = {
                "run_id": run.id,
                "attempt_id": attempt.id,
                "approval_link_id": approval_link.id,
                "outbox_event": outbox_event,
                "run_state": run_state,
            }
            command.accepted_transition = run_state
            command.response_snapshot = snapshot

            return self._command_result(command)

    def fetch_run(self, *, company_id: str, run_id: str) -> RunORM:
        with self._session_factory() as session:
            run = session.get(RunORM, run_id)
            if run is None or run.company_id != company_id:
                raise RunNotFoundError(f"Run '{run_id}' not found for company '{company_id}'.")
            return run


__all__ = [
    "ApprovalOpenResult",
    "AttemptFailureResult",
    "ClaimCandidate",
    "ClaimResult",
    "CommandTransitionResult",
    "ExecutionTransitionError",
    "ExecutionTransitionService",
    "RunNotFoundError",
    "RunTransitionConflictError",
    "StaleWorkerClaimError",
]
