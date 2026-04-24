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
_TERMINAL_OPERATOR_STATES = {"completed", "quarantined", "failed"}
_CLAIMABLE_OPERATOR_STATES = {"admitted", "retry_scheduled"}
_IN_FLIGHT_ATTEMPT_STATES = {"dispatching", "executing", "cancel_requested", "compensating"}


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
    operator_state: str | None = None
    execution_lane: str | None = None
    related_run_id: str | None = None
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
    execution_lane: str
    run_version: int
    attempt_version: int


@dataclass(frozen=True)
class LeaseHeartbeatResult:
    run_id: str
    attempt_id: str
    lease_token: str
    lease_expires_at: datetime
    last_heartbeat_at: datetime


@dataclass(frozen=True)
class LeaseReconcileResult:
    run_id: str
    attempt_id: str
    reconciled_to_state: str
    dead_letter_reason: str


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
    def _default_execution_lane(run_kind: str) -> str:
        normalized = run_kind.strip().lower()
        if "oauth" in normalized:
            return "oauth_serialized"
        if "interactive" in normalized and "heavy" in normalized:
            return "interactive_heavy"
        if "interactive" in normalized or "sync" in normalized:
            return "interactive_low_latency"
        return "background_agentic"

    @staticmethod
    def _operator_state_for_execution_step(step_key: str) -> str:
        normalized = step_key.strip().lower()
        if any(token in normalized for token in ("provider", "oauth", "webhook", "http", "remote", "external")):
            return "waiting_external"
        return "executing"

    @staticmethod
    def _operator_state_for_retry_delay(retry_delay_seconds: int | None) -> str:
        return "retry_scheduled" if retry_delay_seconds and retry_delay_seconds > 0 else "admitted"

    @staticmethod
    def _operator_state_for_resume(raw_state: str) -> str:
        return {
            "queued": "admitted",
            "dispatching": "leased",
            "executing": "waiting_external",
            "waiting_on_approval": "waiting_on_approval",
            "cancel_requested": "cancel_requested",
            "retry_backoff": "retry_scheduled",
            "compensating": "compensating",
            "succeeded": "completed",
            "failed": "failed",
            "dead_lettered": "quarantined",
        }.get(raw_state, "admitted")

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
            operator_state=snapshot.get("operator_state"),
            execution_lane=snapshot.get("execution_lane"),
            related_run_id=snapshot.get("related_run_id"),
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
    def _claim_query(
        company_id: str,
        now: datetime,
        *,
        execution_lane: str | None = None,
        run_kind: str | None = None,
    ) -> Select[tuple[RunAttemptORM, RunORM]]:
        query = (
            select(RunAttemptORM, RunORM)
            .join(
                RunORM,
                (RunORM.company_id == RunAttemptORM.company_id) & (RunORM.id == RunAttemptORM.run_id),
            )
            .where(
                RunAttemptORM.company_id == company_id,
                RunAttemptORM.attempt_state.in_(_CLAIMABLE_ATTEMPT_STATES),
                RunAttemptORM.operator_state.in_(_CLAIMABLE_OPERATOR_STATES),
                RunAttemptORM.scheduled_at <= now,
            )
            .order_by(RunAttemptORM.scheduled_at.asc(), RunAttemptORM.attempt_no.asc(), RunAttemptORM.created_at.asc())
        )
        if execution_lane is not None:
            query = query.where(RunORM.execution_lane == execution_lane)
        if run_kind is not None:
            query = query.where(RunORM.run_kind == run_kind)
        return query

    @staticmethod
    def _clear_attempt_lease(attempt: RunAttemptORM) -> None:
        attempt.worker_key = None
        attempt.lease_token = None
        attempt.lease_acquired_at = None
        attempt.lease_expires_at = None
        attempt.last_heartbeat_at = None
        if attempt.lease_status != "expired":
            attempt.lease_status = "released"

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

    @classmethod
    def _json_value(cls, value: Any) -> Any:
        if isinstance(value, datetime):
            if value.tzinfo is None:
                value = value.replace(tzinfo=UTC)
            return value.astimezone(UTC).isoformat()
        if isinstance(value, dict):
            return {str(key): cls._json_value(item) for key, item in value.items() if item is not None}
        if isinstance(value, (list, tuple)):
            return [cls._json_value(item) for item in value]
        return value

    @classmethod
    def _detail_payload(cls, **fields: Any) -> dict[str, Any]:
        return {key: cls._json_value(value) for key, value in fields.items() if value is not None}

    @classmethod
    def _merge_result_summary(cls, existing: dict[str, Any] | None, **sections: Any) -> dict[str, Any]:
        merged = dict(existing or {})
        for key, value in sections.items():
            if value is None:
                continue
            normalized = cls._json_value(value)
            if isinstance(normalized, dict) and isinstance(merged.get(key), dict):
                merged[key] = {**merged[key], **normalized}
            else:
                merged[key] = normalized
        return merged

    def _select_claim_candidate(
        self,
        session: Session,
        *,
        company_id: str,
        now: datetime,
        execution_lane: str | None = None,
        run_kind: str | None = None,
    ) -> ClaimCandidate | None:
        query = self._claim_query(company_id, now, execution_lane=execution_lane, run_kind=run_kind)
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

    def peek_claimable_attempt(
        self,
        *,
        company_id: str,
        execution_lane: str | None = None,
        run_kind: str | None = None,
        now: datetime | None = None,
    ) -> ClaimCandidate | None:
        current_time = self._now(now)
        with self._session_factory() as session:
            return self._select_claim_candidate(
                session,
                company_id=company_id,
                now=current_time,
                execution_lane=execution_lane,
                run_kind=run_kind,
            )

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
        execution_lane: str | None = None,
        now: datetime | None = None,
    ) -> CommandTransitionResult:
        current_time = self._now(now)
        lane = execution_lane or self._default_execution_lane(run_kind)
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
                    "operator_state": "admitted",
                    "execution_lane": lane,
                }

                run = RunORM(
                    id=run_id,
                    company_id=company_id,
                    workspace_id=workspace_id,
                    issue_id=issue_id,
                    run_kind=run_kind,
                    state="queued",
                    execution_lane=lane,
                    operator_state="admitted",
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
                    operator_state="admitted",
                    lease_status="not_leased",
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
        execution_lane: str | None = None,
        run_kind: str | None = None,
        lease_ttl_seconds: int = 60,
        now: datetime | None = None,
    ) -> ClaimResult | None:
        current_time = self._now(now)
        with self._session_factory() as session, session.begin():
            candidate = self._select_claim_candidate(
                session,
                company_id=company_id,
                now=current_time,
                execution_lane=execution_lane,
                run_kind=run_kind,
            )
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
                operator_state="leased",
                worker_key=worker_key,
                lease_status="leased",
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
                operator_state="leased",
                current_attempt_id=attempt_id,
                version=expected_run_version + 1,
                updated_at=now,
            )
        )
        if run_update.rowcount != 1:
            raise StaleWorkerClaimError(f"Run '{run_id}' changed while claiming attempt '{attempt_id}'.")

        refreshed_run = session.get(RunORM, run_id)
        refreshed_attempt = session.get(RunAttemptORM, attempt_id)
        if refreshed_run is not None:
            refreshed_run.result_summary = self._merge_result_summary(
                refreshed_run.result_summary,
                wake_gate=self._detail_payload(
                    claim_allowed=True,
                    scheduled_at=refreshed_attempt.scheduled_at if refreshed_attempt is not None else None,
                    claimed_at=now,
                    lease_expires_at=lease_expires_at,
                    worker_key=worker_key,
                    spurious_wake_blocked=False,
                ),
                dispatch=self._detail_payload(
                    stage="claimed",
                    run_id=run_id,
                    attempt_id=attempt_id,
                    execution_lane=refreshed_run.execution_lane,
                    worker_key=worker_key,
                ),
            )
        return ClaimResult(
            run_id=run_id,
            attempt_id=attempt_id,
            lease_token=lease_token,
            worker_key=worker_key,
            execution_lane=refreshed_run.execution_lane if refreshed_run is not None else "background_agentic",
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
            if run.operator_state == "paused" or attempt.operator_state == "paused":
                raise RunTransitionConflictError("Paused runs cannot move into executing work.")

            operator_state = self._operator_state_for_execution_step(step_key)

            attempt.version += 1
            attempt.attempt_state = "executing"
            attempt.operator_state = operator_state
            attempt.started_at = attempt.started_at or current_time
            attempt.lease_status = "leased"
            attempt.updated_at = current_time

            run.version += 1
            run.state = "executing"
            run.operator_state = operator_state
            run.current_step_key = step_key
            run.result_summary = self._merge_result_summary(
                run.result_summary,
                wake_gate=self._detail_payload(
                    claim_allowed=True,
                    executing_at=current_time,
                    worker_key=attempt.worker_key,
                    spurious_wake_blocked=False,
                ),
                dispatch=self._detail_payload(
                    stage="executing",
                    run_id=run_id,
                    attempt_id=attempt_id,
                    execution_lane=run.execution_lane,
                    operator_state=operator_state,
                    step_key=step_key,
                    entered_at=current_time,
                ),
            )
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
            attempt.operator_state = "failed"
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
                next_operator_state = self._operator_state_for_retry_delay(retry_delay_seconds)

                session.add(
                    RunAttemptORM(
                        id=next_attempt_id,
                        company_id=company_id,
                        run_id=run_id,
                        attempt_no=next_attempt_no,
                        attempt_state=next_state,
                        operator_state=next_operator_state,
                        lease_status="not_leased",
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
                run.operator_state = next_operator_state
                run.status_reason = "retry_scheduled"
                run.active_attempt_no = next_attempt_no
                run.current_attempt_id = next_attempt_id
                run.current_approval_link_id = None
                run.current_step_key = None
                run.failure_class = failure_class
                last_failure = self._failure_summary(
                    failure_class=failure_class,
                    error_code=error_code,
                    error_detail=error_detail,
                    retryable=True,
                    attempt_no=attempt.attempt_no,
                    retry_count=attempt.retry_count,
                    max_attempts=max_attempts,
                    retry_delay_seconds=retry_delay_seconds,
                )
                run.result_summary = self._merge_result_summary(
                    run.result_summary,
                    last_failure=last_failure,
                    next_attempt_no=next_attempt_no,
                    next_attempt_id=next_attempt_id,
                    wake_gate=self._detail_payload(
                        claim_allowed=retry_delay_seconds in {None, 0},
                        spurious_wake_blocked=bool(retry_delay_seconds and retry_delay_seconds > 0),
                        retry_delay_seconds=retry_delay_seconds,
                        next_wakeup_at=scheduled_at,
                        scheduled_by="retry_backoff",
                    ),
                    dispatch=self._detail_payload(
                        stage="retry_scheduled" if retry_delay_seconds and retry_delay_seconds > 0 else "requeued",
                        run_id=run_id,
                        attempt_id=next_attempt_id,
                        execution_lane=run.execution_lane,
                        failed_attempt_id=attempt_id,
                    ),
                )
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
            attempt.operator_state = "quarantined"

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
            run.operator_state = "quarantined"
            run.status_reason = dead_letter_reason
            run.current_approval_link_id = None
            run.current_step_key = None
            run.failure_class = failure_class
            last_failure = self._failure_summary(
                failure_class=failure_class,
                error_code=error_code,
                error_detail=error_detail,
                retryable=retryable,
                attempt_no=attempt.attempt_no,
                retry_count=attempt.retry_count,
                max_attempts=max_attempts,
                retry_delay_seconds=None,
            )
            run.result_summary = self._merge_result_summary(
                run.result_summary,
                **last_failure,
                last_failure=last_failure,
                wake_gate=self._detail_payload(
                    claim_allowed=False,
                    closed_at=current_time,
                    dead_letter_reason=dead_letter_reason,
                    spurious_wake_blocked=False,
                ),
                dispatch=self._detail_payload(
                    stage="dead_lettered",
                    run_id=run_id,
                    attempt_id=attempt_id,
                    execution_lane=run.execution_lane,
                    dead_letter_reason=dead_letter_reason,
                ),
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
            attempt.operator_state = "cancel_requested"
            attempt.updated_at = current_time

            run.version += 1
            run.state = "cancel_requested"
            run.operator_state = "cancel_requested"
            run.cancel_requested_at = current_time
            run.latest_command_id = command.id
            run.updated_at = current_time

            snapshot = {
                "run_id": run_id,
                "attempt_id": attempt.id,
                "outbox_event": "run_cancel",
                "run_state": "cancel_requested",
                "operator_state": "cancel_requested",
                "execution_lane": run.execution_lane,
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
                    operator_state="admitted",
                    lease_status="not_leased",
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
                run.operator_state = "admitted"
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
                    "operator_state": "admitted",
                    "execution_lane": run.execution_lane,
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
            attempt.operator_state = "waiting_on_approval"
            attempt.worker_key = None
            attempt.lease_status = "released"
            attempt.lease_token = None
            attempt.lease_acquired_at = None
            attempt.lease_expires_at = None
            attempt.last_heartbeat_at = None
            attempt.updated_at = current_time

            run.version += 1
            run.state = "waiting_on_approval"
            run.operator_state = "waiting_on_approval"
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
                operator_state = "admitted"
                approval_link.gate_status = "approved"
                approval_link.resume_enqueued_at = current_time
                outbox_event = "run_resume"
                attempt.finished_at = None
            else:
                approval_link.gate_status = "rejected"
                if approval_link.resume_disposition == "cancel":
                    run_state = "cancel_requested"
                    attempt_state = "cancel_requested"
                    operator_state = "cancel_requested"
                    outbox_event = "run_cancel"
                    run.cancel_requested_at = current_time
                elif approval_link.resume_disposition == "compensate":
                    run_state = "compensating"
                    attempt_state = "compensating"
                    operator_state = "compensating"
                    outbox_event = "run_resume"
                else:
                    run_state = "failed"
                    attempt_state = "failed"
                    operator_state = "failed"
                    run.terminal_at = current_time
                    attempt.finished_at = current_time

            approval_link.version += 1
            approval_link.decided_at = current_time
            approval_link.decision_actor_type = actor_type
            approval_link.decision_actor_id = actor_id
            approval_link.updated_at = current_time

            attempt.version += 1
            attempt.attempt_state = attempt_state
            attempt.operator_state = operator_state
            attempt.worker_key = None
            attempt.lease_status = "released"
            attempt.lease_token = None
            attempt.lease_acquired_at = None
            attempt.lease_expires_at = None
            attempt.last_heartbeat_at = None
            attempt.scheduled_at = current_time if outbox_event is not None else attempt.scheduled_at
            attempt.updated_at = current_time

            run.version += 1
            run.state = run_state
            run.operator_state = operator_state
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
                "operator_state": operator_state,
                "execution_lane": run.execution_lane,
            }
            command.accepted_transition = run_state
            command.response_snapshot = snapshot

            return self._command_result(command)

    def renew_attempt_lease(
        self,
        *,
        company_id: str,
        run_id: str,
        attempt_id: str,
        lease_token: str,
        lease_ttl_seconds: int = 60,
        now: datetime | None = None,
    ) -> LeaseHeartbeatResult:
        current_time = self._now(now)
        with self._session_factory() as session, session.begin():
            run = session.get(RunORM, run_id)
            attempt = session.get(RunAttemptORM, attempt_id)
            if run is None or run.company_id != company_id:
                raise RunNotFoundError(f"Run '{run_id}' not found for company '{company_id}'.")
            if attempt is None or attempt.company_id != company_id or attempt.run_id != run_id:
                raise RunTransitionConflictError(f"Attempt '{attempt_id}' does not belong to run '{run_id}'.")
            if attempt.lease_token != lease_token or attempt.lease_status != "leased":
                raise RunTransitionConflictError("Lease token does not match the active worker claim.")
            if attempt.attempt_state not in _IN_FLIGHT_ATTEMPT_STATES:
                raise RunTransitionConflictError("Only in-flight attempts can renew worker leases.")

            attempt.last_heartbeat_at = current_time
            attempt.lease_expires_at = current_time + timedelta(seconds=max(1, lease_ttl_seconds))
            attempt.updated_at = current_time
            return LeaseHeartbeatResult(
                run_id=run_id,
                attempt_id=attempt_id,
                lease_token=lease_token,
                lease_expires_at=attempt.lease_expires_at,
                last_heartbeat_at=current_time,
            )

    def complete_attempt_success(
        self,
        *,
        company_id: str,
        run_id: str,
        attempt_id: str,
        lease_token: str,
        result_summary: dict[str, Any] | None = None,
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
            if attempt.lease_token != lease_token:
                raise RunTransitionConflictError("Lease token does not match the active worker claim.")
            if attempt.attempt_state not in _IN_FLIGHT_ATTEMPT_STATES:
                raise RunTransitionConflictError("Only in-flight attempts can complete successfully.")

            attempt.version += 1
            attempt.attempt_state = "succeeded"
            attempt.operator_state = "completed"
            attempt.finished_at = current_time
            attempt.updated_at = current_time
            self._clear_attempt_lease(attempt)

            run.version += 1
            run.state = "succeeded"
            run.operator_state = "completed"
            run.status_reason = None
            run.result_summary = (
                self._merge_result_summary(run.result_summary, **result_summary)
                if result_summary
                else run.result_summary
            )
            run.next_wakeup_at = None
            run.terminal_at = current_time
            run.current_step_key = None
            run.updated_at = current_time

    def pause_run(
        self,
        *,
        company_id: str,
        run_id: str,
        actor_type: str,
        actor_id: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
        reason: str,
        now: datetime | None = None,
    ) -> CommandTransitionResult:
        current_time = self._now(now)
        pause_reason = reason.strip()
        with self._session_factory() as session, session.begin():
            existing = self._find_command_or_raise_conflict(
                session,
                company_id=company_id,
                command_type="pause",
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
            if run.operator_state in _TERMINAL_OPERATOR_STATES or run.operator_state == "paused":
                raise RunTransitionConflictError(f"Run '{run_id}' cannot pause from operator state '{run.operator_state}'.")

            attempt = self._current_attempt(session, run)
            if attempt.attempt_state in _IN_FLIGHT_ATTEMPT_STATES:
                raise RunTransitionConflictError("In-flight attempts must be interrupted instead of paused.")

            command = RunCommandORM(
                id=self._new_id("cmd"),
                company_id=company_id,
                run_id=run_id,
                command_type="pause",
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

            run.version += 1
            run.operator_state = "paused"
            run.status_reason = pause_reason
            run.latest_command_id = command.id
            run.result_summary = self._merge_result_summary(
                run.result_summary,
                wake_gate=self._detail_payload(
                    claim_allowed=False,
                    paused_at=current_time,
                    pause_reason=pause_reason,
                    spurious_wake_blocked=bool(run.next_wakeup_at and run.next_wakeup_at > current_time),
                    next_wakeup_at=run.next_wakeup_at,
                ),
                dispatch=self._detail_payload(
                    stage="paused",
                    run_id=run.id,
                    attempt_id=attempt.id,
                    execution_lane=run.execution_lane,
                    operator_state="paused",
                ),
            )
            run.updated_at = current_time

            attempt.version += 1
            attempt.operator_state = "paused"
            attempt.updated_at = current_time

            command.accepted_transition = run.state
            command.response_snapshot = {
                "run_id": run.id,
                "attempt_id": attempt.id,
                "run_state": run.state,
                "operator_state": "paused",
                "execution_lane": run.execution_lane,
                "reason": pause_reason,
            }
            return self._command_result(command)

    def resume_run(
        self,
        *,
        company_id: str,
        run_id: str,
        actor_type: str,
        actor_id: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
        reason: str,
        now: datetime | None = None,
    ) -> CommandTransitionResult:
        current_time = self._now(now)
        resume_reason = reason.strip()
        with self._session_factory() as session, session.begin():
            existing = self._find_command_or_raise_conflict(
                session,
                company_id=company_id,
                command_type="resume",
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
            if run.operator_state != "paused":
                raise RunTransitionConflictError(f"Run '{run_id}' cannot resume from operator state '{run.operator_state}'.")
            if run.current_approval_link_id:
                raise RunTransitionConflictError("Runs waiting on approval cannot be resumed outside the approval flow.")

            attempt = self._current_attempt(session, run)
            spurious_wake_blocked = bool(
                run.state == "retry_backoff" and run.next_wakeup_at is not None and run.next_wakeup_at > current_time
            )
            operator_state = "retry_scheduled" if spurious_wake_blocked else self._operator_state_for_resume(run.state)

            command = RunCommandORM(
                id=self._new_id("cmd"),
                company_id=company_id,
                run_id=run_id,
                command_type="resume",
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

            run.version += 1
            run.operator_state = operator_state
            run.status_reason = "retry_scheduled" if spurious_wake_blocked else (resume_reason or None)
            run.latest_command_id = command.id
            run.result_summary = self._merge_result_summary(
                run.result_summary,
                wake_gate=self._detail_payload(
                    claim_allowed=not spurious_wake_blocked,
                    spurious_wake_blocked=spurious_wake_blocked,
                    next_wakeup_at=run.next_wakeup_at,
                    resumed_at=current_time,
                    resume_reason=resume_reason or None,
                ),
                dispatch=self._detail_payload(
                    stage="resume_blocked_until_wakeup" if spurious_wake_blocked else "resumed",
                    run_id=run.id,
                    attempt_id=attempt.id,
                    execution_lane=run.execution_lane,
                    operator_state=operator_state,
                ),
            )
            run.updated_at = current_time

            attempt.version += 1
            attempt.operator_state = operator_state
            attempt.updated_at = current_time

            command.accepted_transition = run.state
            command.response_snapshot = {
                "run_id": run.id,
                "attempt_id": attempt.id,
                "run_state": run.state,
                "operator_state": operator_state,
                "execution_lane": run.execution_lane,
                "reason": resume_reason,
                "spurious_wake_blocked": spurious_wake_blocked,
                "next_wakeup_at": self._json_value(run.next_wakeup_at),
            }
            return self._command_result(command)

    def interrupt_run(
        self,
        *,
        company_id: str,
        run_id: str,
        actor_type: str,
        actor_id: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
        reason: str,
        now: datetime | None = None,
    ) -> CommandTransitionResult:
        current_time = self._now(now)
        interrupt_reason = reason.strip()
        with self._session_factory() as session, session.begin():
            existing = self._find_command_or_raise_conflict(
                session,
                company_id=company_id,
                command_type="interrupt",
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
            if run.operator_state in _TERMINAL_OPERATOR_STATES:
                raise RunTransitionConflictError(f"Run '{run_id}' cannot be interrupted from operator state '{run.operator_state}'.")

            attempt = self._current_attempt(session, run)
            command = RunCommandORM(
                id=self._new_id("cmd"),
                company_id=company_id,
                run_id=run_id,
                command_type="interrupt",
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

            session.add(
                RunOutboxORM(
                    id=self._new_id("outbox"),
                    company_id=company_id,
                    run_id=run_id,
                    attempt_id=attempt.id,
                    event_type="run_cancel",
                    payload={
                        "run_id": run_id,
                        "attempt_id": attempt.id,
                        "command_id": command.id,
                        "interrupt_reason": interrupt_reason,
                    },
                    publish_state="pending",
                    dedupe_key=f"run:{run_id}:command:{command.id}:interrupt",
                    available_at=current_time,
                    created_at=current_time,
                    updated_at=current_time,
                )
            )

            attempt.version += 1
            attempt.operator_state = "interrupted"
            attempt.attempt_state = "cancel_requested"
            attempt.updated_at = current_time
            self._clear_attempt_lease(attempt)

            run.version += 1
            run.state = "cancel_requested"
            run.operator_state = "interrupted"
            run.status_reason = interrupt_reason or "operator_interrupt_requested"
            run.cancel_requested_at = current_time
            run.latest_command_id = command.id
            run.updated_at = current_time

            command.accepted_transition = "cancel_requested"
            command.response_snapshot = {
                "run_id": run.id,
                "attempt_id": attempt.id,
                "run_state": "cancel_requested",
                "operator_state": "interrupted",
                "execution_lane": run.execution_lane,
                "outbox_event": "run_cancel",
                "reason": interrupt_reason,
            }
            return self._command_result(command)

    def quarantine_run(
        self,
        *,
        company_id: str,
        run_id: str,
        actor_type: str,
        actor_id: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
        reason: str,
        now: datetime | None = None,
    ) -> CommandTransitionResult:
        current_time = self._now(now)
        quarantine_reason = reason.strip() or "operator_quarantine"
        with self._session_factory() as session, session.begin():
            existing = self._find_command_or_raise_conflict(
                session,
                company_id=company_id,
                command_type="quarantine",
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
            if run.operator_state == "quarantined":
                raise RunTransitionConflictError(f"Run '{run_id}' is already quarantined.")

            attempt = self._current_attempt(session, run)
            command = RunCommandORM(
                id=self._new_id("cmd"),
                company_id=company_id,
                run_id=run_id,
                command_type="quarantine",
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

            session.add(
                RunOutboxORM(
                    id=self._new_id("outbox"),
                    company_id=company_id,
                    run_id=run_id,
                    attempt_id=attempt.id,
                    event_type="dead_letter",
                    payload={
                        "run_id": run_id,
                        "attempt_id": attempt.id,
                        "command_id": command.id,
                        "dead_letter_reason": quarantine_reason,
                    },
                    publish_state="pending",
                    dedupe_key=f"run:{run_id}:command:{command.id}:quarantine",
                    available_at=current_time,
                    created_at=current_time,
                    updated_at=current_time,
                )
            )

            attempt.version += 1
            attempt.attempt_state = "dead_lettered"
            attempt.operator_state = "quarantined"
            attempt.finished_at = attempt.finished_at or current_time
            attempt.last_error_code = attempt.last_error_code or "operator_quarantine"
            attempt.last_error_detail = quarantine_reason
            attempt.updated_at = current_time
            self._clear_attempt_lease(attempt)

            run.version += 1
            run.state = "dead_lettered"
            run.operator_state = "quarantined"
            run.status_reason = quarantine_reason
            run.failure_class = run.failure_class or "internal"
            run.result_summary = {
                "quarantined_by_operator": True,
                "reason": quarantine_reason,
                "attempt_id": attempt.id,
            }
            run.next_wakeup_at = None
            run.terminal_at = current_time
            run.latest_command_id = command.id
            run.updated_at = current_time

            command.accepted_transition = "dead_lettered"
            command.response_snapshot = {
                "run_id": run.id,
                "attempt_id": attempt.id,
                "run_state": "dead_lettered",
                "operator_state": "quarantined",
                "execution_lane": run.execution_lane,
                "outbox_event": "dead_letter",
                "reason": quarantine_reason,
            }
            return self._command_result(command)

    def escalate_run(
        self,
        *,
        company_id: str,
        run_id: str,
        actor_type: str,
        actor_id: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
        target_execution_lane: str,
        reason: str,
        now: datetime | None = None,
    ) -> CommandTransitionResult:
        current_time = self._now(now)
        escalation_reason = reason.strip()
        with self._session_factory() as session, session.begin():
            existing = self._find_command_or_raise_conflict(
                session,
                company_id=company_id,
                command_type="escalate",
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
            if run.execution_lane == target_execution_lane:
                raise RunTransitionConflictError(f"Run '{run_id}' is already on execution lane '{target_execution_lane}'.")

            command = RunCommandORM(
                id=self._new_id("cmd"),
                company_id=company_id,
                run_id=run_id,
                command_type="escalate",
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

            run.version += 1
            run.execution_lane = target_execution_lane
            run.status_reason = escalation_reason or run.status_reason
            run.latest_command_id = command.id
            run.updated_at = current_time

            command.accepted_transition = run.state
            command.response_snapshot = {
                "run_id": run.id,
                "attempt_id": run.current_attempt_id,
                "run_state": run.state,
                "operator_state": run.operator_state,
                "execution_lane": run.execution_lane,
                "reason": escalation_reason,
            }
            return self._command_result(command)

    def restart_run_from_scratch(
        self,
        *,
        company_id: str,
        run_id: str,
        actor_type: str,
        actor_id: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
        reason: str,
        execution_lane: str | None = None,
        now: datetime | None = None,
    ) -> CommandTransitionResult:
        current_time = self._now(now)
        restart_reason = reason.strip()
        with self._session_factory() as session, session.begin():
            existing = self._find_command_or_raise_conflict(
                session,
                company_id=company_id,
                command_type="restart_from_scratch",
                actor_type=actor_type,
                actor_id=actor_id,
                idempotency_key=idempotency_key,
                request_fingerprint_hash=request_fingerprint_hash,
            )
            if existing is not None:
                return self._command_result(existing, deduplicated=True)

            source_run = session.get(RunORM, run_id)
            if source_run is None or source_run.company_id != company_id:
                raise RunNotFoundError(f"Run '{run_id}' not found for company '{company_id}'.")

            lane = execution_lane or source_run.execution_lane
            command = RunCommandORM(
                id=self._new_id("cmd"),
                company_id=company_id,
                run_id=run_id,
                command_type="restart_from_scratch",
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

            new_run_id = self._new_id("run")
            new_attempt_id = self._new_id("attempt")
            session.add(
                RunORM(
                    id=new_run_id,
                    company_id=company_id,
                    workspace_id=source_run.workspace_id,
                    issue_id=source_run.issue_id,
                    run_kind=source_run.run_kind,
                    state="queued",
                    execution_lane=lane,
                    operator_state="admitted",
                    active_attempt_no=1,
                    current_attempt_id=new_attempt_id,
                    latest_command_id=command.id,
                    version=0,
                    created_at=current_time,
                    updated_at=current_time,
                )
            )
            session.add(
                RunAttemptORM(
                    id=new_attempt_id,
                    company_id=company_id,
                    run_id=new_run_id,
                    attempt_no=1,
                    attempt_state="queued",
                    operator_state="admitted",
                    lease_status="not_leased",
                    scheduled_at=current_time,
                    version=0,
                    created_at=current_time,
                    updated_at=current_time,
                )
            )
            session.add(
                RunOutboxORM(
                    id=self._new_id("outbox"),
                    company_id=company_id,
                    run_id=new_run_id,
                    attempt_id=new_attempt_id,
                    event_type="run_dispatch",
                    payload={
                        "run_id": new_run_id,
                        "attempt_id": new_attempt_id,
                        "command_id": command.id,
                        "restart_reason": restart_reason,
                        "source_run_id": source_run.id,
                    },
                    publish_state="pending",
                    dedupe_key=f"run:{new_run_id}:command:{command.id}:dispatch",
                    available_at=current_time,
                    created_at=current_time,
                    updated_at=current_time,
                )
            )

            source_run.version += 1
            source_run.status_reason = restart_reason or source_run.status_reason
            source_run.latest_command_id = command.id
            source_run.updated_at = current_time

            command.accepted_transition = "queued"
            command.response_snapshot = {
                "run_id": new_run_id,
                "attempt_id": new_attempt_id,
                "run_state": "queued",
                "operator_state": "admitted",
                "execution_lane": lane,
                "related_run_id": source_run.id,
                "outbox_event": "run_dispatch",
                "reason": restart_reason,
            }
            return self._command_result(command)

    def reconcile_expired_leases(
        self,
        *,
        company_id: str,
        now: datetime | None = None,
    ) -> list[LeaseReconcileResult]:
        current_time = self._now(now)
        results: list[LeaseReconcileResult] = []
        with self._session_factory() as session, session.begin():
            attempts = session.execute(
                select(RunAttemptORM)
                .join(
                    RunORM,
                    (RunORM.company_id == RunAttemptORM.company_id) & (RunORM.id == RunAttemptORM.run_id),
                )
                .where(
                    RunAttemptORM.company_id == company_id,
                    RunAttemptORM.lease_status == "leased",
                    RunAttemptORM.attempt_state.in_(_IN_FLIGHT_ATTEMPT_STATES),
                    RunAttemptORM.lease_expires_at.is_not(None),
                    RunAttemptORM.lease_expires_at < current_time,
                )
            ).scalars().all()

            for attempt in attempts:
                run = session.get(RunORM, attempt.run_id)
                if run is None or run.company_id != company_id:
                    continue
                if run.operator_state in _TERMINAL_OPERATOR_STATES:
                    continue

                session.add(
                    RunOutboxORM(
                        id=self._new_id("outbox"),
                        company_id=company_id,
                        run_id=run.id,
                        attempt_id=attempt.id,
                        event_type="dead_letter",
                        payload={
                            "run_id": run.id,
                            "attempt_id": attempt.id,
                            "dead_letter_reason": "lease_expired",
                        },
                        publish_state="pending",
                        dedupe_key=f"run:{run.id}:attempt:{attempt.id}:lease-expired",
                        available_at=current_time,
                        created_at=current_time,
                        updated_at=current_time,
                    )
                )

                attempt.version += 1
                attempt.attempt_state = "timed_out"
                attempt.operator_state = "interrupted"
                attempt.worker_key = None
                attempt.lease_status = "expired"
                attempt.lease_token = None
                attempt.lease_acquired_at = None
                attempt.lease_expires_at = None
                attempt.last_heartbeat_at = None
                attempt.finished_at = current_time
                attempt.last_error_code = "lease_expired"
                attempt.last_error_detail = "Worker lease expired before the attempt could report completion."
                attempt.updated_at = current_time

                run.version += 1
                run.state = "timed_out"
                run.operator_state = "quarantined"
                run.status_reason = "lease_expired"
                run.failure_class = "timeout"
                run.result_summary = self._merge_result_summary(
                    run.result_summary,
                    error_code="lease_expired",
                    error_detail="Worker lease expired before the attempt could report completion.",
                    attempt_id=attempt.id,
                    wake_gate=self._detail_payload(
                        claim_allowed=False,
                        lease_expired_at=current_time,
                        worker_key=attempt.worker_key,
                        spurious_wake_blocked=False,
                    ),
                    dispatch=self._detail_payload(
                        stage="lease_expired",
                        run_id=run.id,
                        attempt_id=attempt.id,
                        execution_lane=run.execution_lane,
                    ),
                )
                run.next_wakeup_at = None
                run.terminal_at = current_time
                run.current_step_key = None
                run.updated_at = current_time

                results.append(
                    LeaseReconcileResult(
                        run_id=run.id,
                        attempt_id=attempt.id,
                        reconciled_to_state="quarantined",
                        dead_letter_reason="lease_expired",
                    )
                )
        return results

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
    "LeaseHeartbeatResult",
    "LeaseReconcileResult",
    "RunNotFoundError",
    "RunTransitionConflictError",
    "StaleWorkerClaimError",
]
