"""Storage repositories for OAuth/account operation history."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol

from pydantic import ValidationError
from sqlalchemy import JSON, DateTime, Integer, String, Text, create_engine, select, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Session, mapped_column, sessionmaker

from app.control_plane import OAuthOperationRecord
from app.settings.config import Settings
from app.storage.harness_repository import Base
from app.tenancy import effective_tenant_filter


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
    def _tenant_clause(*, tenant_id: str | None, column: str = "tenant_id") -> tuple[str, dict[str, Any]]:
        if tenant_id is None:
            return "", {}
        return f" AND {column} = :tenant_id", {"tenant_id": tenant_id}

    def _mapped_rows(self, query: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        with self._session() as session:
            return [dict(row) for row in session.execute(text(query), params).mappings().all()]

    def effective_tenant_id(self, requested_tenant_id: str | None) -> str | None:
        rows = self._mapped_rows(
            """
            SELECT tenant_id
            FROM oauth_operations
            GROUP BY tenant_id
            ORDER BY tenant_id ASC
            LIMIT 2
            """,
            {},
        )
        return effective_tenant_filter(
            [str(row["tenant_id"]) for row in rows if row.get("tenant_id") is not None],
            requested_tenant_id,
        )

    def recent_operations(self, *, tenant_id: str | None, limit: int = 50) -> list[OAuthOperationRecord]:
        tenant_clause, tenant_params = self._tenant_clause(tenant_id=tenant_id)
        rows = self._mapped_rows(
            f"""
            SELECT payload
            FROM oauth_operations
            WHERE 1 = 1
              {tenant_clause}
            ORDER BY executed_at DESC
            LIMIT :limit
            """,
            {**tenant_params, "limit": int(limit)},
        )
        operations = [OAuthOperationRecord(**row["payload"]) for row in rows]
        operations.reverse()
        return operations

    def latest_operation(
        self,
        provider_key: str,
        *,
        action: str,
        tenant_id: str | None = None,
    ) -> OAuthOperationRecord | None:
        tenant_clause, tenant_params = self._tenant_clause(tenant_id=tenant_id)
        rows = self._mapped_rows(
            f"""
            SELECT payload
            FROM oauth_operations
            WHERE provider_key = :provider_key
              AND action = :action
              {tenant_clause}
            ORDER BY executed_at DESC
            LIMIT 1
            """,
            {"provider_key": provider_key, "action": action, **tenant_params},
        )
        if not rows:
            return None
        return OAuthOperationRecord(**rows[0]["payload"])

    def provider_operation_summary(
        self,
        *,
        tenant_id: str | None,
    ) -> dict[str, dict[str, Any]]:
        tenant_clause, tenant_params = self._tenant_clause(tenant_id=tenant_id)
        counts = self._mapped_rows(
            f"""
            SELECT
              provider_key,
              count(*)::bigint AS operation_count,
              COALESCE(sum(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0)::bigint AS failures,
              COALESCE(
                sum(
                  CASE
                    WHEN status = 'failed'
                     AND executed_at >= NOW() - INTERVAL '24 hours'
                    THEN 1
                    ELSE 0
                  END
                ),
                0
              )::bigint AS failures_24h,
              COALESCE(sum(CASE WHEN action = 'probe' THEN 1 ELSE 0 END), 0)::bigint AS probe_count,
              COALESCE(sum(CASE WHEN action = 'bridge_sync' THEN 1 ELSE 0 END), 0)::bigint AS bridge_sync_count
            FROM oauth_operations
            WHERE 1 = 1
              {tenant_clause}
            GROUP BY provider_key
            """,
            tenant_params,
        )
        latest_probe = self._mapped_rows(
            f"""
            SELECT DISTINCT ON (provider_key)
              provider_key,
              payload
            FROM oauth_operations
            WHERE action = 'probe'
              {tenant_clause}
            ORDER BY provider_key ASC, executed_at DESC
            """,
            tenant_params,
        )
        latest_bridge = self._mapped_rows(
            f"""
            SELECT DISTINCT ON (provider_key)
              provider_key,
              payload
            FROM oauth_operations
            WHERE action = 'bridge_sync'
              {tenant_clause}
            ORDER BY provider_key ASC, executed_at DESC
            """,
            tenant_params,
        )
        latest_failed = self._mapped_rows(
            f"""
            SELECT DISTINCT ON (provider_key)
              provider_key,
              payload
            FROM oauth_operations
            WHERE status = 'failed'
              {tenant_clause}
            ORDER BY provider_key ASC, executed_at DESC
            """,
            tenant_params,
        )

        summary: dict[str, dict[str, Any]] = {}
        for row in counts:
            provider_key = str(row["provider_key"])
            total = int(row.get("operation_count", 0) or 0)
            summary[provider_key] = {
                "failures": int(row.get("failures", 0) or 0),
                "failures_24h": int(row.get("failures_24h", 0) or 0),
                "probe_count": int(row.get("probe_count", 0) or 0),
                "bridge_sync_count": int(row.get("bridge_sync_count", 0) or 0),
                "operation_count": total,
                "failure_rate": (int(row.get("failures", 0) or 0) / max(1, total)),
                "last_probe": None,
                "last_bridge_sync": None,
                "last_failed_operation": None,
            }
        for row in latest_probe:
            provider_key = str(row["provider_key"])
            summary.setdefault(
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
            )["last_probe"] = OAuthOperationRecord(**row["payload"]).model_dump()
        for row in latest_bridge:
            provider_key = str(row["provider_key"])
            summary.setdefault(
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
            )["last_bridge_sync"] = OAuthOperationRecord(**row["payload"]).model_dump()
        for row in latest_failed:
            provider_key = str(row["provider_key"])
            summary.setdefault(
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
            )["last_failed_operation"] = OAuthOperationRecord(**row["payload"]).model_dump()
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
