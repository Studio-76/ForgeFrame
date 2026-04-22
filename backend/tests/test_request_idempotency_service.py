from __future__ import annotations

import threading
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session, sessionmaker

from app.idempotency import (
    IdempotencyFingerprintMismatchError,
    IdempotencyRequestInProgressError,
    RequestEnvelope,
    RequestIdempotencyService,
)
from app.storage import apply_storage_migrations
from app.storage.execution_repository import RequestIdempotencyRecordORM
from app.storage.models import Base


@pytest.fixture(params=("sqlite", "postgresql"), ids=("sqlite", "postgresql"))
def request_idempotency_session_factory(
    request: pytest.FixtureRequest,
    tmp_path: Path,
) -> sessionmaker[Session]:
    if request.param == "sqlite":
        engine = create_engine(
            f"sqlite+pysqlite:///{tmp_path / 'request-idempotency-threaded.sqlite'}",
            connect_args={"check_same_thread": False, "timeout": 5},
        )
        Base.metadata.create_all(engine)
        session_factory = sessionmaker(engine, autoflush=False, expire_on_commit=False)
        try:
            yield session_factory
        finally:
            engine.dispose()
        return

    schema_name = f"test_request_idempotency_{uuid4().hex[:12]}"
    base_url = "postgresql+psycopg://forgegate:forgegate@localhost:5432/forgegate"
    scoped_url = f"{base_url}?options=-csearch_path%3D{schema_name}"
    admin_engine = create_engine(base_url, isolation_level="AUTOCOMMIT")
    engine = None

    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))

    try:
        apply_storage_migrations(scoped_url)
        engine = create_engine(scoped_url, pool_pre_ping=True)
        session_factory = sessionmaker(engine, autoflush=False, expire_on_commit=False)
        yield session_factory
    finally:
        if engine is not None:
            engine.dispose()
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()


def test_request_idempotency_reservation_recovers_from_concurrent_insert_race(
    request_idempotency_session_factory: sessionmaker[Session],
) -> None:
    class CoordinatedRequestIdempotencyService(RequestIdempotencyService):
        def __init__(self, session_factory: sessionmaker[Session], barrier: threading.Barrier):
            super().__init__(session_factory)
            self._barrier = barrier

        def _new_id(self, prefix: str) -> str:  # type: ignore[override]
            if prefix == "idem":
                self._barrier.wait(timeout=5)
            return super()._new_id(prefix)

    start_barrier = threading.Barrier(2)
    insert_barrier = threading.Barrier(2)
    service = CoordinatedRequestIdempotencyService(request_idempotency_session_factory, insert_barrier)
    envelope = RequestEnvelope(
        request_id="req_http_reserve_race",
        correlation_id="corr_http_reserve_race",
        causation_id="cause_http_reserve_race",
        subject_key="bearer:reserve-race",
        idempotency_key="idem_http_reserve_race",
        fingerprint_hash="fp_http_reserve_race",
        trace_id="trace_http_reserve_race",
        span_id="span_http_reserve_race",
    )
    fixed_now = datetime(2026, 4, 21, 22, 12, tzinfo=UTC)
    reservations = []
    in_progress = []
    errors = []
    lock = threading.Lock()

    def invoke() -> None:
        try:
            start_barrier.wait(timeout=5)
            reservation = service.reserve(
                scope_key="admin.providers.sync",
                request_path="/admin/providers/sync",
                envelope=envelope,
                request_fingerprint_hash="fp_http_reserve_race",
                now=fixed_now,
            )
            with lock:
                reservations.append(reservation)
        except IdempotencyRequestInProgressError as exc:
            with lock:
                in_progress.append(str(exc))
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
    assert len(reservations) == 1
    assert reservations[0] is not None
    assert reservations[0].replay is None
    assert len(in_progress) == 1

    with request_idempotency_session_factory() as session:
        records = session.execute(
            select(RequestIdempotencyRecordORM).where(
                RequestIdempotencyRecordORM.scope_key == "admin.providers.sync",
                RequestIdempotencyRecordORM.subject_key == envelope.subject_key,
                RequestIdempotencyRecordORM.idempotency_key == envelope.idempotency_key,
            )
        ).scalars().all()

        assert len(records) == 1
        assert records[0].record_state == "in_progress"
        assert records[0].request_fingerprint_hash == "fp_http_reserve_race"
        assert records[0].request_metadata == {
            "request_id": "req_http_reserve_race",
            "correlation_id": "corr_http_reserve_race",
            "causation_id": "cause_http_reserve_race",
            "trace_id": "trace_http_reserve_race",
            "span_id": "span_http_reserve_race",
        }


def test_request_idempotency_reservation_rejects_mismatched_fingerprint_after_concurrent_insert_race(
    request_idempotency_session_factory: sessionmaker[Session],
) -> None:
    class CoordinatedRequestIdempotencyService(RequestIdempotencyService):
        def __init__(self, session_factory: sessionmaker[Session], barrier: threading.Barrier):
            super().__init__(session_factory)
            self._barrier = barrier

        def _new_id(self, prefix: str) -> str:  # type: ignore[override]
            if prefix == "idem":
                self._barrier.wait(timeout=5)
            return super()._new_id(prefix)

    start_barrier = threading.Barrier(2)
    insert_barrier = threading.Barrier(2)
    service = CoordinatedRequestIdempotencyService(request_idempotency_session_factory, insert_barrier)
    fixed_now = datetime(2026, 4, 21, 22, 24, tzinfo=UTC)
    reservations = []
    mismatches = []
    errors = []
    lock = threading.Lock()

    def invoke(fingerprint_hash: str) -> None:
        envelope = RequestEnvelope(
            request_id=f"req_http_reserve_conflict_{fingerprint_hash}",
            correlation_id=f"corr_http_reserve_conflict_{fingerprint_hash}",
            causation_id=f"cause_http_reserve_conflict_{fingerprint_hash}",
            subject_key="bearer:reserve-race",
            idempotency_key="idem_http_reserve_conflict",
            fingerprint_hash=fingerprint_hash,
            trace_id=f"trace_http_reserve_conflict_{fingerprint_hash}",
            span_id=f"span_http_reserve_conflict_{fingerprint_hash}",
        )
        try:
            start_barrier.wait(timeout=5)
            reservation = service.reserve(
                scope_key="admin.providers.sync",
                request_path="/admin/providers/sync",
                envelope=envelope,
                request_fingerprint_hash=fingerprint_hash,
                now=fixed_now,
            )
            with lock:
                reservations.append(reservation)
        except IdempotencyFingerprintMismatchError as exc:
            with lock:
                mismatches.append(str(exc))
        except BaseException as exc:  # pragma: no cover - assertion below is the contract
            with lock:
                errors.append(exc)

    threads = [
        threading.Thread(target=invoke, args=("fp_http_reserve_conflict_a",)),
        threading.Thread(target=invoke, args=("fp_http_reserve_conflict_b",)),
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=5)

    assert all(not thread.is_alive() for thread in threads)
    assert not errors, [repr(error) for error in errors]
    assert len(reservations) == 1
    assert reservations[0] is not None
    assert reservations[0].replay is None
    assert len(mismatches) == 1

    with request_idempotency_session_factory() as session:
        records = session.execute(
            select(RequestIdempotencyRecordORM).where(
                RequestIdempotencyRecordORM.scope_key == "admin.providers.sync",
                RequestIdempotencyRecordORM.subject_key == "bearer:reserve-race",
                RequestIdempotencyRecordORM.idempotency_key == "idem_http_reserve_conflict",
            )
        ).scalars().all()

        assert len(records) == 1
        assert records[0].record_state == "in_progress"
        assert records[0].request_fingerprint_hash in {
            "fp_http_reserve_conflict_a",
            "fp_http_reserve_conflict_b",
        }
