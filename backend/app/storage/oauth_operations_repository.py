"""Storage repositories for OAuth/account operation history."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol

from pydantic import ValidationError
from sqlalchemy import JSON, DateTime, Integer, String, Text, create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Session, mapped_column, sessionmaker

from app.control_plane import OAuthOperationRecord
from app.settings.config import Settings
from app.storage.harness_repository import Base


class OAuthOperationORM(Base):
    __tablename__ = "oauth_operations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_key: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
    action: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))


@dataclass(frozen=True)
class OAuthOperationPaths:
    operations_path: Path


class OAuthOperationsRepository(Protocol):
    def load_operations(self) -> list[OAuthOperationRecord]: ...

    def append_operation(self, event: OAuthOperationRecord) -> None: ...


class FileOAuthOperationsRepository:
    def __init__(self, *, paths: OAuthOperationPaths):
        self._paths = paths

    def _ensure_path(self) -> Path:
        path = self._paths.operations_path
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.touch()
        return path

    def load_operations(self) -> list[OAuthOperationRecord]:
        path = self._ensure_path()
        events: list[OAuthOperationRecord] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                events.append(OAuthOperationRecord(**json.loads(line)))
            except (json.JSONDecodeError, ValidationError):
                continue
        return events

    def append_operation(self, event: OAuthOperationRecord) -> None:
        path = self._ensure_path()
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event.model_dump()) + "\n")


class PostgresOAuthOperationsRepository:
    def __init__(self, database_url: str):
        if not database_url.startswith("postgresql"):
            raise ValueError("OAuth operations PostgreSQL backend requires a postgresql:// URL.")
        self._engine = create_engine(database_url, pool_pre_ping=True)
        Base.metadata.create_all(self._engine)
        self._session_factory = sessionmaker(self._engine, autoflush=False, expire_on_commit=False)

    def _session(self) -> Session:
        return self._session_factory()

    @staticmethod
    def _dt(value: str) -> datetime:
        return datetime.fromisoformat(value)

    def load_operations(self) -> list[OAuthOperationRecord]:
        with self._session() as session:
            rows = session.scalars(select(OAuthOperationORM).order_by(OAuthOperationORM.executed_at.asc())).all()
            return [OAuthOperationRecord(**row.payload) for row in rows]

    def append_operation(self, event: OAuthOperationRecord) -> None:
        with self._session() as session:
            session.add(
                OAuthOperationORM(
                    provider_key=event.provider_key,
                    action=event.action,
                    status=event.status,
                    details=event.details,
                    executed_at=self._dt(event.executed_at),
                    payload=event.model_dump(),
                )
            )
            session.commit()


def get_oauth_operations_repository(settings: Settings) -> OAuthOperationsRepository:
    if settings.observability_storage_backend == "postgresql":
        database_url = settings.observability_postgres_url.strip() or settings.harness_postgres_url
        return PostgresOAuthOperationsRepository(database_url)
    return FileOAuthOperationsRepository(paths=OAuthOperationPaths(operations_path=Path(settings.oauth_operations_path)))
