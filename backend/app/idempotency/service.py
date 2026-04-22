"""Request-envelope and idempotency persistence helpers for mutating APIs."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from time import monotonic, sleep
from typing import Any, Callable
from uuid import uuid4

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

SessionFactory = Callable[[], Session]

_MUTATING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
_IDEMPOTENCY_KEY_MAX_LENGTH = 191


class InvalidIdempotencyKeyError(ValueError):
    """Raised when a client supplies an invalid or conflicting idempotency key."""


class IdempotencyFingerprintMismatchError(RuntimeError):
    """Raised when an idempotency key is reused for a different request payload."""


class IdempotencyRequestInProgressError(RuntimeError):
    """Raised when the original request is still executing."""


class _IdempotencyReservationInsertRaceError(RuntimeError):
    """Internal signal that a reservation insert lost the unique-key race."""

    def __init__(
        self,
        *,
        scope_key: str,
        subject_key: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
        original_error: IntegrityError,
    ) -> None:
        super().__init__(str(original_error))
        self.scope_key = scope_key
        self.subject_key = subject_key
        self.idempotency_key = idempotency_key
        self.request_fingerprint_hash = request_fingerprint_hash
        self.original_error = original_error


@dataclass(frozen=True)
class RequestEnvelope:
    request_id: str
    correlation_id: str
    causation_id: str
    subject_key: str
    idempotency_key: str | None
    fingerprint_hash: str | None
    trace_id: str | None = None
    span_id: str | None = None


@dataclass(frozen=True)
class StoredResponseSnapshot:
    status_code: int
    body: dict[str, Any]
    headers: dict[str, str]


@dataclass(frozen=True)
class IdempotencyReservation:
    record_id: str
    idempotency_key: str
    replay: StoredResponseSnapshot | None = None


def is_mutating_request(method: str) -> bool:
    return method.upper() in _MUTATING_METHODS


def _canonical_body(body: bytes, content_type: str) -> bytes:
    if not body:
        return b""
    normalized_content_type = content_type.lower()
    if "json" not in normalized_content_type:
        return body
    try:
        parsed = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return body
    return json.dumps(parsed, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def _query_fingerprint(request: Request) -> str:
    return "&".join(f"{key}={value}" for key, value in sorted(request.query_params.multi_items()))


def _subject_key(request: Request) -> str:
    authorization = request.headers.get("authorization", "").strip()
    if authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        if token:
            digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
            return f"bearer:{digest[:24]}"
    api_key = request.headers.get("x-api-key", "").strip()
    if api_key:
        digest = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
        return f"api_key:{digest[:24]}"
    host = request.client.host if request.client is not None else "anonymous"
    user_agent = request.headers.get("user-agent", "").strip()
    digest = hashlib.sha256(f"{host}|{user_agent}".encode("utf-8")).hexdigest()
    return f"anonymous:{digest[:24]}"


def build_request_fingerprint(
    request: Request,
    body: bytes | str | dict[str, Any] | list[Any] | None,
    *,
    content_type: str | None = None,
) -> str | None:
    if not is_mutating_request(request.method) or body is None:
        return None
    if isinstance(body, bytes):
        raw_body = body
    elif isinstance(body, str):
        raw_body = body.encode("utf-8")
    else:
        raw_body = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    canonical_body = _canonical_body(raw_body, content_type or request.headers.get("content-type", ""))
    body_digest = hashlib.sha256(canonical_body).hexdigest()
    fingerprint = "\n".join(
        [
            request.method.upper(),
            request.url.path,
            _query_fingerprint(request),
            (content_type or request.headers.get("content-type", "")).split(";", 1)[0].strip().lower(),
            body_digest,
        ]
    )
    return hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()


def build_request_envelope(request: Request, body: bytes | None = None) -> RequestEnvelope:
    request_id = (
        request.headers.get("x-request-id", "").strip()
        or request.headers.get("x-forgegate-request-id", "").strip()
        or f"req_{uuid4().hex[:12]}"
    )
    correlation_id = request.headers.get("x-forgegate-correlation-id", "").strip() or request_id
    causation_id = request.headers.get("x-forgegate-causation-id", "").strip() or request_id
    traceparent = request.headers.get("traceparent", "").strip()
    trace_id = request.headers.get("x-forgegate-trace-id", "").strip()
    if not trace_id and traceparent:
        parts = traceparent.split("-")
        if len(parts) == 4 and len(parts[1]) == 32:
            trace_id = parts[1]
    if not trace_id:
        trace_id = f"trace_{uuid4().hex[:16]}"
    span_id = request.headers.get("x-forgegate-span-id", "").strip() or request_id
    idempotency_key = request.headers.get("idempotency-key", "").strip() or None
    return RequestEnvelope(
        request_id=request_id,
        correlation_id=correlation_id,
        causation_id=causation_id,
        trace_id=trace_id,
        subject_key=_subject_key(request),
        idempotency_key=idempotency_key,
        fingerprint_hash=build_request_fingerprint(request, body),
        span_id=span_id,
    )


def attach_request_body(request: Request, body: bytes) -> None:
    delivered = False

    async def _receive() -> dict[str, object]:
        nonlocal delivered
        if delivered:
            return {"type": "http.disconnect"}
        delivered = True
        return {"type": "http.request", "body": body, "more_body": False}

    request._receive = _receive  # type: ignore[attr-defined]


def get_request_envelope(request: Request) -> RequestEnvelope:
    envelope = getattr(request.state, "request_envelope", None)
    if not isinstance(envelope, RequestEnvelope):
        raise RuntimeError("request_envelope_missing")
    return envelope


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _normalize_timestamp(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def validate_idempotency_key(key: str) -> str:
    normalized = key.strip()
    if not normalized:
        raise InvalidIdempotencyKeyError("Idempotency-Key must not be empty.")
    if len(normalized) > _IDEMPOTENCY_KEY_MAX_LENGTH:
        raise InvalidIdempotencyKeyError(f"Idempotency-Key must be <= {_IDEMPOTENCY_KEY_MAX_LENGTH} characters.")
    if any(ord(character) < 33 or ord(character) > 126 for character in normalized):
        raise InvalidIdempotencyKeyError("Idempotency-Key must use visible ASCII characters without spaces.")
    return normalized


class RequestIdempotencyService:
    """Stores replayable JSON outcomes for opt-in mutating API routes."""

    def __init__(self, session_factory: SessionFactory, *, ttl_hours: int = 24):
        self._session_factory = session_factory
        self._ttl_hours = max(1, ttl_hours)

    @staticmethod
    def _new_id(prefix: str) -> str:
        return f"{prefix}_{uuid4().hex}"

    @staticmethod
    def _find_record(
        session: Session,
        *,
        scope_key: str,
        subject_key: str,
        idempotency_key: str,
    ) -> Any | None:
        from app.storage.execution_repository import RequestIdempotencyRecordORM

        return session.execute(
            select(RequestIdempotencyRecordORM).where(
                RequestIdempotencyRecordORM.scope_key == scope_key,
                RequestIdempotencyRecordORM.subject_key == subject_key,
                RequestIdempotencyRecordORM.idempotency_key == idempotency_key,
            )
        ).scalars().first()

    @staticmethod
    def _reservation_from_existing_or_raise(
        *,
        existing: Any,
        idempotency_key: str,
        request_fingerprint_hash: str,
    ) -> IdempotencyReservation:
        if existing.request_fingerprint_hash != request_fingerprint_hash:
            raise IdempotencyFingerprintMismatchError(
                f"Idempotency-Key '{idempotency_key}' was already used for a different request fingerprint."
            )

        if existing.record_state == "completed" and existing.response_status_code is not None and existing.response_body is not None:
            return IdempotencyReservation(
                record_id=existing.id,
                idempotency_key=idempotency_key,
                replay=StoredResponseSnapshot(
                    status_code=existing.response_status_code,
                    body=existing.response_body,
                    headers=existing.response_headers or {},
                ),
            )

        raise IdempotencyRequestInProgressError(
            f"Request with Idempotency-Key '{idempotency_key}' is still in progress."
        )

    @staticmethod
    def _flush_reservation_or_raise_insert_race(
        session: Session,
        *,
        record: Any,
        scope_key: str,
        subject_key: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
    ) -> None:
        session.add(record)
        try:
            session.flush()
        except IntegrityError as exc:
            raise _IdempotencyReservationInsertRaceError(
                scope_key=scope_key,
                subject_key=subject_key,
                idempotency_key=idempotency_key,
                request_fingerprint_hash=request_fingerprint_hash,
                original_error=exc,
            ) from exc

    def _recover_reservation_after_insert_race(
        self,
        *,
        scope_key: str,
        subject_key: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
        current_time: datetime,
        original_error: IntegrityError,
        max_wait_seconds: float = 1.0,
    ) -> IdempotencyReservation:
        deadline = monotonic() + max_wait_seconds
        while True:
            with self._session_factory() as session:
                existing = self._find_record(
                    session,
                    scope_key=scope_key,
                    subject_key=subject_key,
                    idempotency_key=idempotency_key,
                )
                if existing is not None:
                    existing_expires_at = _normalize_timestamp(existing.expires_at)
                    if existing_expires_at is not None and existing_expires_at <= current_time:
                        if monotonic() >= deadline:
                            raise original_error
                    else:
                        return self._reservation_from_existing_or_raise(
                            existing=existing,
                            idempotency_key=idempotency_key,
                            request_fingerprint_hash=request_fingerprint_hash,
                        )
            if monotonic() >= deadline:
                raise original_error
            sleep(0.01)

    def reserve(
        self,
        *,
        scope_key: str,
        request_path: str,
        envelope: RequestEnvelope,
        fallback_idempotency_key: str | None = None,
        request_fingerprint_hash: str | None = None,
        now: datetime | None = None,
    ) -> IdempotencyReservation | None:
        header_key = envelope.idempotency_key
        body_key = (fallback_idempotency_key or "").strip() or None
        if header_key and body_key and header_key != body_key:
            raise InvalidIdempotencyKeyError("Idempotency-Key header and payload idempotency_key must match.")

        chosen_key = header_key or body_key
        if chosen_key is None:
            return None

        normalized_key = validate_idempotency_key(chosen_key)
        current_time = now or _now()
        fingerprint_hash = request_fingerprint_hash or envelope.fingerprint_hash or ""
        try:
            with self._session_factory() as session, session.begin():
                from app.storage.execution_repository import RequestIdempotencyRecordORM

                existing = self._find_record(
                    session,
                    scope_key=scope_key,
                    subject_key=envelope.subject_key,
                    idempotency_key=normalized_key,
                )

                existing_expires_at = _normalize_timestamp(existing.expires_at) if existing is not None else None
                if existing is not None and existing_expires_at is not None and existing_expires_at <= current_time:
                    session.delete(existing)
                    session.flush()
                    existing = None

                if existing is None:
                    record = RequestIdempotencyRecordORM(
                        id=self._new_id("idem"),
                        scope_key=scope_key,
                        subject_key=envelope.subject_key,
                        request_path=request_path,
                        idempotency_key=normalized_key,
                        request_fingerprint_hash=fingerprint_hash,
                        record_state="in_progress",
                        request_metadata={
                            "request_id": envelope.request_id,
                            "correlation_id": envelope.correlation_id,
                            "causation_id": envelope.causation_id,
                            "trace_id": envelope.trace_id,
                            **({"span_id": envelope.span_id} if envelope.span_id else {}),
                        },
                        expires_at=current_time + timedelta(hours=self._ttl_hours),
                        created_at=current_time,
                        updated_at=current_time,
                    )
                    self._flush_reservation_or_raise_insert_race(
                        session,
                        record=record,
                        scope_key=scope_key,
                        subject_key=envelope.subject_key,
                        idempotency_key=normalized_key,
                        request_fingerprint_hash=fingerprint_hash,
                    )
                    return IdempotencyReservation(record_id=record.id, idempotency_key=normalized_key)

                return self._reservation_from_existing_or_raise(
                    existing=existing,
                    idempotency_key=normalized_key,
                    request_fingerprint_hash=fingerprint_hash,
                )
        except _IdempotencyReservationInsertRaceError as race:
            return self._recover_reservation_after_insert_race(
                scope_key=race.scope_key,
                subject_key=race.subject_key,
                idempotency_key=race.idempotency_key,
                request_fingerprint_hash=race.request_fingerprint_hash,
                current_time=current_time,
                original_error=race.original_error,
            )

    def complete(
        self,
        *,
        reservation: IdempotencyReservation | None,
        status_code: int,
        body: dict[str, Any],
        headers: dict[str, str] | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        now: datetime | None = None,
    ) -> None:
        if reservation is None or reservation.replay is not None:
            return

        current_time = now or _now()
        with self._session_factory() as session, session.begin():
            from app.storage.execution_repository import RequestIdempotencyRecordORM

            record = session.get(RequestIdempotencyRecordORM, reservation.record_id)
            if record is None:
                return
            record.record_state = "completed"
            record.response_status_code = status_code
            record.response_body = body
            record.response_headers = dict(headers or {})
            record.resource_type = resource_type
            record.resource_id = resource_id
            record.completed_at = current_time
            record.updated_at = current_time

    def abandon(self, *, reservation: IdempotencyReservation | None) -> None:
        if reservation is None or reservation.replay is not None:
            return

        with self._session_factory() as session, session.begin():
            from app.storage.execution_repository import RequestIdempotencyRecordORM

            record = session.get(RequestIdempotencyRecordORM, reservation.record_id)
            if record is not None and record.record_state == "in_progress":
                session.delete(record)
