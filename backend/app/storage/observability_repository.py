"""Storage repositories for usage, error, and health observability events."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Literal, Protocol

from pydantic import ValidationError
from sqlalchemy import JSON, DateTime, Integer, String, create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Session, mapped_column, sessionmaker

from app.settings.config import Settings
from app.storage.harness_repository import Base
from app.usage.events import ErrorEvent, HealthEvent, UsageEvent

ObservabilityKind = Literal["usage", "error", "health"]


class UsageEventORM(Base):
    __tablename__ = "usage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
    model: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
    traffic_type: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    client_id: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))


class ErrorEventORM(Base):
    __tablename__ = "error_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[str | None] = mapped_column(String(191), index=True, nullable=True)
    model: Mapped[str | None] = mapped_column(String(191), index=True, nullable=True)
    traffic_type: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    client_id: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
    error_type: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))


class HealthEventORM(Base):
    __tablename__ = "health_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
    model: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
    check_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))


@dataclass(frozen=True)
class ObservabilityPaths:
    events_path: Path


class ObservabilityRepository(Protocol):
    def load_usage_events(self) -> list[UsageEvent]: ...

    def append_usage_event(self, event: UsageEvent) -> None: ...

    def load_error_events(self) -> list[ErrorEvent]: ...

    def append_error_event(self, event: ErrorEvent) -> None: ...

    def load_health_events(self) -> list[HealthEvent]: ...

    def append_health_event(self, event: HealthEvent) -> None: ...


class FileObservabilityRepository:
    def __init__(self, *, paths: ObservabilityPaths):
        self._paths = paths

    def _ensure_path(self) -> Path:
        path = self._paths.events_path
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.touch()
        return path

    def _load_kind(self, kind: ObservabilityKind) -> list[dict[str, Any]]:
        path = self._ensure_path()
        items: list[dict[str, Any]] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                continue
            if payload.get("kind") == kind:
                items.append(payload.get("data", {}))
        return items

    def _append(self, kind: ObservabilityKind, payload: dict[str, Any]) -> None:
        path = self._ensure_path()
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({"kind": kind, "data": payload}) + "\n")

    def load_usage_events(self) -> list[UsageEvent]:
        events: list[UsageEvent] = []
        for item in self._load_kind("usage"):
            try:
                events.append(UsageEvent(**item))
            except ValidationError:
                continue
        return events

    def append_usage_event(self, event: UsageEvent) -> None:
        self._append("usage", event.model_dump())

    def load_error_events(self) -> list[ErrorEvent]:
        events: list[ErrorEvent] = []
        for item in self._load_kind("error"):
            try:
                events.append(ErrorEvent(**item))
            except ValidationError:
                continue
        return events

    def append_error_event(self, event: ErrorEvent) -> None:
        self._append("error", event.model_dump())

    def load_health_events(self) -> list[HealthEvent]:
        events: list[HealthEvent] = []
        for item in self._load_kind("health"):
            try:
                events.append(HealthEvent(**item))
            except ValidationError:
                continue
        return events

    def append_health_event(self, event: HealthEvent) -> None:
        self._append("health", event.model_dump())


class PostgresObservabilityRepository:
    def __init__(self, database_url: str):
        if not database_url.startswith("postgresql"):
            raise ValueError("Observability PostgreSQL backend requires a postgresql:// URL.")
        self._engine = create_engine(database_url, pool_pre_ping=True)
        Base.metadata.create_all(self._engine)
        self._session_factory = sessionmaker(self._engine, autoflush=False, expire_on_commit=False)

    def _session(self) -> Session:
        return self._session_factory()

    @staticmethod
    def _dt(value: str) -> datetime:
        return datetime.fromisoformat(value)

    def load_usage_events(self) -> list[UsageEvent]:
        with self._session() as session:
            rows = session.scalars(select(UsageEventORM).order_by(UsageEventORM.created_at.asc())).all()
            return [UsageEvent(**row.payload) for row in rows]

    def append_usage_event(self, event: UsageEvent) -> None:
        with self._session() as session:
            session.add(
                UsageEventORM(
                    provider=event.provider,
                    model=event.model,
                    traffic_type=event.traffic_type,
                    client_id=event.client_id,
                    created_at=self._dt(event.created_at),
                    payload=event.model_dump(),
                )
            )
            session.commit()

    def load_error_events(self) -> list[ErrorEvent]:
        with self._session() as session:
            rows = session.scalars(select(ErrorEventORM).order_by(ErrorEventORM.created_at.asc())).all()
            return [ErrorEvent(**row.payload) for row in rows]

    def append_error_event(self, event: ErrorEvent) -> None:
        with self._session() as session:
            session.add(
                ErrorEventORM(
                    provider=event.provider,
                    model=event.model,
                    traffic_type=event.traffic_type,
                    client_id=event.client_id,
                    error_type=event.error_type,
                    status_code=event.status_code,
                    created_at=self._dt(event.created_at),
                    payload=event.model_dump(),
                )
            )
            session.commit()

    def load_health_events(self) -> list[HealthEvent]:
        with self._session() as session:
            rows = session.scalars(select(HealthEventORM).order_by(HealthEventORM.created_at.asc())).all()
            return [HealthEvent(**row.payload) for row in rows]

    def append_health_event(self, event: HealthEvent) -> None:
        with self._session() as session:
            session.add(
                HealthEventORM(
                    provider=event.provider,
                    model=event.model,
                    check_type=event.check_type,
                    status=event.status,
                    created_at=self._dt(event.created_at),
                    payload=event.model_dump(),
                )
            )
            session.commit()


def get_observability_repository(settings: Settings) -> ObservabilityRepository:
    if settings.observability_storage_backend == "postgresql":
        database_url = settings.observability_postgres_url.strip() or settings.harness_postgres_url
        return PostgresObservabilityRepository(database_url)
    return FileObservabilityRepository(paths=ObservabilityPaths(events_path=Path(settings.observability_events_path)))
