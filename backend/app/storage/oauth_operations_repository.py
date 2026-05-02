"""Storage repositories for OAuth/account operation history."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol

from pydantic import ValidationError
from sqlalchemy import (
    JSON,
    DateTime,
    Integer,
    String,
    Text,
    and_,
    create_engine,
    func,
    select,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Session, mapped_column, sessionmaker

from app.control_plane import OAuthOperationRecord
from app.settings.config import Settings
from app.storage.harness_repository import Base
from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID, effective_tenant_filter


class OAuthOperationORM(Base):
    __tablename__ = "oauth_operations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
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

    @staticmethod
    def _scope_filters(
        *,
        tenant_id: str | None,
        instance_id: str | None,
    ) -> list[Any]:
        filters: list[Any] = []
        if tenant_id is not None:
            filters.append(OAuthOperationORM.tenant_id == tenant_id)
        normalized_instance_id = (instance_id or "").strip() or None
        if normalized_instance_id is not None:
            resolved_instance = func.coalesce(
                func.nullif(OAuthOperationORM.payload["instance_id"].as_string(), ""),
                func.nullif(OAuthOperationORM.payload["tenant_id"].as_string(), ""),
                DEFAULT_BOOTSTRAP_TENANT_ID,
            )
            filters.append(resolved_instance == normalized_instance_id)
        return filters

    def effective_tenant_id(self, requested_tenant_id: str | None) -> str | None:
        with self._session() as session:
            rows = session.execute(select(OAuthOperationORM.tenant_id).group_by(OAuthOperationORM.tenant_id).order_by(OAuthOperationORM.tenant_id.asc()).limit(2)).all()
        return effective_tenant_filter(
            [str(row[0]) for row in rows if row[0] is not None],
            requested_tenant_id,
        )

    def recent_operations(
        self,
        *,
        tenant_id: str | None,
        instance_id: str | None = None,
        limit: int = 50,
    ) -> list[OAuthOperationRecord]:
        filters = self._scope_filters(tenant_id=tenant_id, instance_id=instance_id)
        with self._session() as session:
            rows = session.execute(select(OAuthOperationORM.payload).where(and_(*filters) if filters else True).order_by(OAuthOperationORM.executed_at.desc()).limit(int(limit))).all()
        operations = [OAuthOperationRecord(**row[0]) for row in rows]
        operations.reverse()
        return operations

    def latest_operation(
        self,
        provider_key: str,
        *,
        action: str,
        tenant_id: str | None = None,
        instance_id: str | None = None,
    ) -> OAuthOperationRecord | None:
        filters = self._scope_filters(tenant_id=tenant_id, instance_id=instance_id)
        filters.extend([
            OAuthOperationORM.provider_key == provider_key,
            OAuthOperationORM.action == action,
        ])
        with self._session() as session:
            payload = session.execute(select(OAuthOperationORM.payload).where(and_(*filters)).order_by(OAuthOperationORM.executed_at.desc()).limit(1)).scalar_one_or_none()
        if payload is None:
            return None
        return OAuthOperationRecord(**payload)

    def provider_operation_summary(
        self,
        *,
        tenant_id: str | None,
        instance_id: str | None = None,
    ) -> dict[str, dict[str, Any]]:
        filters = self._scope_filters(tenant_id=tenant_id, instance_id=instance_id)
        with self._session() as session:
            rows = session.scalars(select(OAuthOperationORM).where(and_(*filters) if filters else True).order_by(OAuthOperationORM.executed_at.asc())).all()

        summary: dict[str, dict[str, Any]] = {}
        now = datetime.now().astimezone()
        for row in rows:
            provider_key = row.provider_key
            current = summary.setdefault(
                provider_key,
                {
                    "failures": 0,
                    "failures_24h": 0,
                    "probe_count": 0,
                    "bridge_sync_count": 0,
                    "operation_count": 0,
                    "failure_rate": 0.0,
                    "last_probe": None,
                    "last_bridge_sync": None,
                    "last_failed_operation": None,
                },
            )
            current["operation_count"] += 1
            payload = OAuthOperationRecord(**row.payload).model_dump()
            if row.status == "failed":
                current["failures"] += 1
                if (now - row.executed_at.astimezone()).total_seconds() <= 24 * 3600:
                    current["failures_24h"] += 1
                current["last_failed_operation"] = payload
            if row.action == "probe":
                current["probe_count"] += 1
                current["last_probe"] = payload
            if row.action == "bridge_sync":
                current["bridge_sync_count"] += 1
                current["last_bridge_sync"] = payload

        for provider_key, current in summary.items():
            total = int(current["operation_count"])
            current["failure_rate"] = int(current["failures"]) / max(1, total)
        return summary

    def load_operations(self) -> list[OAuthOperationRecord]:
        with self._session() as session:
            rows = session.scalars(select(OAuthOperationORM).order_by(OAuthOperationORM.executed_at.asc())).all()
            return [OAuthOperationRecord(**row.payload) for row in rows]

    def append_operation(self, event: OAuthOperationRecord) -> None:
        with self._session() as session:
            session.add(
                OAuthOperationORM(
                    tenant_id=event.tenant_id,
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
