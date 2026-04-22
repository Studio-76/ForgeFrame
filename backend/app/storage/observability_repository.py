"""Storage repositories for usage, error, and health observability events."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Literal, Protocol

from pydantic import ValidationError
from sqlalchemy import JSON, DateTime, Integer, String, create_engine, select, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Session, mapped_column, sessionmaker

from app.settings.config import Settings
from app.storage.harness_repository import Base
from app.tenancy import effective_tenant_filter
from app.usage.events import ErrorEvent, HealthEvent, UsageEvent

ObservabilityKind = Literal["usage", "error", "health"]


class UsageEventORM(Base):
    __tablename__ = "usage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
    model: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
    traffic_type: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    client_id: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))


class ErrorEventORM(Base):
    __tablename__ = "error_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
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
    tenant_id: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
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

    @staticmethod
    def _as_iso(value: datetime | None) -> str | None:
        return value.isoformat() if value is not None else None

    @staticmethod
    def _tenant_clause(*, tenant_id: str | None, column: str = "tenant_id") -> tuple[str, dict[str, Any]]:
        if tenant_id is None:
            return "", {}
        return f" AND {column} = :tenant_id", {"tenant_id": tenant_id}

    @staticmethod
    def _window_clause(*, window_seconds: int | None, column: str = "created_at") -> tuple[str, dict[str, Any]]:
        if window_seconds is None:
            return "", {}
        return (
            f" AND {column} >= NOW() - (:window_seconds || ' seconds')::interval",
            {"window_seconds": int(window_seconds)},
        )

    def _mapped_rows(self, query: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        with self._session() as session:
            return [dict(row) for row in session.execute(text(query), params).mappings().all()]

    def _payload_rows(
        self,
        table_name: str,
        *,
        order_column: str,
        tenant_id: str | None = None,
        extra_where: str = "",
        params: dict[str, Any] | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        tenant_clause, tenant_params = self._tenant_clause(tenant_id=tenant_id)
        query_params: dict[str, Any] = {**tenant_params, **(params or {})}
        limit_sql = ""
        if limit is not None:
            limit_sql = " LIMIT :limit"
            query_params["limit"] = int(limit)
        query = f"""
            SELECT payload
            FROM {table_name}
            WHERE 1 = 1
              {tenant_clause}
              {extra_where}
            ORDER BY {order_column} DESC
            {limit_sql}
        """
        return self._mapped_rows(query, query_params)

    def effective_history_tenant_id(self, requested_tenant_id: str | None) -> str | None:
        rows = self._mapped_rows(
            """
            SELECT tenant_id
            FROM (
                SELECT tenant_id FROM usage_events
                UNION
                SELECT tenant_id FROM error_events
                UNION
                SELECT tenant_id FROM health_events
            ) tenant_ids
            ORDER BY tenant_id ASC
            LIMIT 2
            """,
            {},
        )
        return effective_tenant_filter(
            [str(row["tenant_id"]) for row in rows if row.get("tenant_id") is not None],
            requested_tenant_id,
        )

    def latest_usage_event(
        self,
        provider: str,
        *,
        tenant_id: str | None = None,
        stream_mode: str | None = None,
        require_tool_calls: bool = False,
    ) -> UsageEvent | None:
        tenant_clause, tenant_params = self._tenant_clause(tenant_id=tenant_id)
        stream_mode_clause = ""
        if stream_mode in {"stream", "non_stream"}:
            stream_mode_clause = """
              AND COALESCE(
                    payload ->> 'stream_mode',
                    CASE
                        WHEN payload ->> 'credential_type' = 'stream' THEN 'stream'
                        ELSE 'non_stream'
                    END
                  ) = :stream_mode
            """
            tenant_params["stream_mode"] = stream_mode
        tool_clause = ""
        if require_tool_calls:
            tool_clause = " AND COALESCE((payload ->> 'tool_call_count')::integer, 0) > 0"
        rows = self._mapped_rows(
            f"""
            SELECT payload
            FROM usage_events
            WHERE provider = :provider
              AND traffic_type = 'runtime'
              {tenant_clause}
              {stream_mode_clause}
              {tool_clause}
            ORDER BY created_at DESC
            LIMIT 1
            """,
            {"provider": provider, **tenant_params},
        )
        if not rows:
            return None
        return UsageEvent(**rows[0]["payload"])

    def latest_error_event(
        self,
        provider: str,
        *,
        tenant_id: str | None = None,
        stream_mode: str | None = None,
    ) -> ErrorEvent | None:
        tenant_clause, tenant_params = self._tenant_clause(tenant_id=tenant_id)
        stream_mode_clause = ""
        if stream_mode in {"stream", "non_stream"}:
            stream_mode_clause = """
              AND COALESCE(
                    payload ->> 'stream_mode',
                    CASE
                        WHEN payload ->> 'credential_type' = 'stream' THEN 'stream'
                        ELSE 'non_stream'
                    END
                  ) = :stream_mode
            """
            tenant_params["stream_mode"] = stream_mode
        rows = self._mapped_rows(
            f"""
            SELECT payload
            FROM error_events
            WHERE provider = :provider
              AND traffic_type = 'runtime'
              {tenant_clause}
              {stream_mode_clause}
            ORDER BY created_at DESC
            LIMIT 1
            """,
            {"provider": provider, **tenant_params},
        )
        if not rows:
            return None
        return ErrorEvent(**rows[0]["payload"])

    def aggregate_summary(
        self,
        *,
        window_seconds: int | None,
        tenant_id: str | None,
    ) -> dict[str, object]:
        usage_tenant_clause, usage_tenant_params = self._tenant_clause(tenant_id=tenant_id)
        usage_window_clause, usage_window_params = self._window_clause(window_seconds=window_seconds)
        usage_params = {**usage_tenant_params, **usage_window_params}

        error_tenant_clause, error_tenant_params = self._tenant_clause(tenant_id=tenant_id)
        error_window_clause, error_window_params = self._window_clause(window_seconds=window_seconds)
        error_params = {**error_tenant_params, **error_window_params}

        health_tenant_clause, health_tenant_params = self._tenant_clause(tenant_id=tenant_id)
        health_window_clause, health_window_params = self._window_clause(window_seconds=window_seconds)
        health_params = {**health_tenant_params, **health_window_params}

        count_rows = self._mapped_rows(
            f"""
            SELECT
              (SELECT count(*)::bigint FROM usage_events WHERE 1 = 1 {usage_tenant_clause} {usage_window_clause}) AS event_count,
              (SELECT count(*)::bigint FROM error_events WHERE 1 = 1 {error_tenant_clause} {error_window_clause}) AS error_event_count,
              (SELECT count(*)::bigint FROM health_events WHERE 1 = 1 {health_tenant_clause} {health_window_clause}) AS health_event_count
            """,
            {**usage_params, **error_params, **health_params},
        )
        counts = count_rows[0] if count_rows else {}

        by_provider = self._mapped_rows(
            f"""
            SELECT
              provider,
              count(*)::bigint AS requests,
              COALESCE(sum((payload ->> 'total_tokens')::bigint), 0)::bigint AS tokens,
              COALESCE(sum((payload ->> 'actual_cost')::double precision), 0)::double precision AS actual_cost,
              COALESCE(sum((payload ->> 'hypothetical_cost')::double precision), 0)::double precision AS hypothetical_cost,
              COALESCE(sum((payload ->> 'avoided_cost')::double precision), 0)::double precision AS avoided_cost
            FROM usage_events
            WHERE 1 = 1
              {usage_tenant_clause}
              {usage_window_clause}
            GROUP BY provider
            ORDER BY requests DESC, provider ASC
            """,
            usage_params,
        )

        by_model = self._mapped_rows(
            f"""
            SELECT
              model,
              count(*)::bigint AS requests,
              COALESCE(sum((payload ->> 'total_tokens')::bigint), 0)::bigint AS tokens
            FROM usage_events
            WHERE 1 = 1
              {usage_tenant_clause}
              {usage_window_clause}
            GROUP BY model
            ORDER BY requests DESC, model ASC
            """,
            usage_params,
        )

        by_auth = self._mapped_rows(
            f"""
            SELECT
              concat(
                COALESCE(payload ->> 'credential_type', 'unknown'),
                ':',
                COALESCE(payload ->> 'auth_source', 'unknown')
              ) AS auth_key,
              count(*)::bigint AS requests,
              COALESCE(sum((payload ->> 'total_tokens')::bigint), 0)::bigint AS tokens
            FROM usage_events
            WHERE 1 = 1
              {usage_tenant_clause}
              {usage_window_clause}
            GROUP BY auth_key
            ORDER BY requests DESC, auth_key ASC
            """,
            usage_params,
        )

        by_client = self._mapped_rows(
            f"""
            SELECT
              client_id,
              count(*)::bigint AS requests,
              COALESCE(sum((payload ->> 'total_tokens')::bigint), 0)::bigint AS tokens,
              COALESCE(sum((payload ->> 'actual_cost')::double precision), 0)::double precision AS actual_cost,
              COALESCE(sum((payload ->> 'hypothetical_cost')::double precision), 0)::double precision AS hypothetical_cost,
              COALESCE(sum((payload ->> 'avoided_cost')::double precision), 0)::double precision AS avoided_cost
            FROM usage_events
            WHERE 1 = 1
              {usage_tenant_clause}
              {usage_window_clause}
            GROUP BY client_id
            ORDER BY requests DESC, client_id ASC
            """,
            usage_params,
        )

        by_traffic_type = self._mapped_rows(
            f"""
            SELECT
              traffic_type,
              count(*)::bigint AS requests,
              COALESCE(sum((payload ->> 'total_tokens')::bigint), 0)::bigint AS tokens,
              COALESCE(sum((payload ->> 'actual_cost')::double precision), 0)::double precision AS actual_cost,
              COALESCE(sum((payload ->> 'hypothetical_cost')::double precision), 0)::double precision AS hypothetical_cost,
              COALESCE(sum((payload ->> 'avoided_cost')::double precision), 0)::double precision AS avoided_cost
            FROM usage_events
            WHERE 1 = 1
              {usage_tenant_clause}
              {usage_window_clause}
            GROUP BY traffic_type
            ORDER BY requests DESC, traffic_type ASC
            """,
            usage_params,
        )

        errors_by_provider = self._mapped_rows(
            f"""
            SELECT
              COALESCE(provider, 'unknown') AS provider,
              count(*)::bigint AS errors
            FROM error_events
            WHERE 1 = 1
              {error_tenant_clause}
              {error_window_clause}
            GROUP BY COALESCE(provider, 'unknown')
            ORDER BY errors DESC, provider ASC
            """,
            error_params,
        )

        errors_by_model = self._mapped_rows(
            f"""
            SELECT
              COALESCE(model, 'unknown') AS model,
              count(*)::bigint AS errors
            FROM error_events
            WHERE 1 = 1
              {error_tenant_clause}
              {error_window_clause}
            GROUP BY COALESCE(model, 'unknown')
            ORDER BY errors DESC, model ASC
            """,
            error_params,
        )

        errors_by_client = self._mapped_rows(
            f"""
            SELECT
              client_id,
              count(*)::bigint AS errors
            FROM error_events
            WHERE 1 = 1
              {error_tenant_clause}
              {error_window_clause}
            GROUP BY client_id
            ORDER BY errors DESC, client_id ASC
            """,
            error_params,
        )

        errors_by_traffic_type = self._mapped_rows(
            f"""
            SELECT
              traffic_type,
              count(*)::bigint AS errors
            FROM error_events
            WHERE 1 = 1
              {error_tenant_clause}
              {error_window_clause}
            GROUP BY traffic_type
            ORDER BY errors DESC, traffic_type ASC
            """,
            error_params,
        )

        errors_by_type = self._mapped_rows(
            f"""
            SELECT
              concat(error_type, ':', status_code::text) AS error_key,
              count(*)::bigint AS errors
            FROM error_events
            WHERE 1 = 1
              {error_tenant_clause}
              {error_window_clause}
            GROUP BY error_key
            ORDER BY errors DESC, error_key ASC
            """,
            error_params,
        )

        errors_by_integration = self._mapped_rows(
            f"""
            SELECT
              concat(
                COALESCE(payload ->> 'integration_class', 'runtime'),
                ':',
                COALESCE(payload ->> 'template_id', 'none'),
                ':',
                COALESCE(payload ->> 'test_phase', 'none')
              ) AS integration_key,
              count(*)::bigint AS errors
            FROM error_events
            WHERE 1 = 1
              {error_tenant_clause}
              {error_window_clause}
            GROUP BY integration_key
            ORDER BY errors DESC, integration_key ASC
            """,
            error_params,
        )

        errors_by_profile = self._mapped_rows(
            f"""
            SELECT
              COALESCE(payload ->> 'profile_key', 'none') AS profile_key,
              count(*)::bigint AS errors
            FROM error_events
            WHERE 1 = 1
              {error_tenant_clause}
              {error_window_clause}
            GROUP BY profile_key
            ORDER BY errors DESC, profile_key ASC
            """,
            error_params,
        )

        latest_health_rows = self._mapped_rows(
            f"""
            SELECT DISTINCT ON (provider, model)
              provider,
              model,
              check_type,
              status,
              payload ->> 'readiness_reason' AS readiness_reason,
              payload ->> 'last_error' AS last_error,
              created_at AS checked_at
            FROM health_events
            WHERE 1 = 1
              {health_tenant_clause}
              {health_window_clause}
            ORDER BY provider ASC, model ASC, created_at DESC
            """,
            health_params,
        )

        latest_health = [
            {
                "provider": str(row["provider"]),
                "model": str(row["model"]),
                "check_type": str(row["check_type"]),
                "status": str(row["status"]),
                "readiness_reason": row.get("readiness_reason"),
                "last_error": row.get("last_error"),
                "checked_at": self._as_iso(row.get("checked_at")),
            }
            for row in latest_health_rows
        ]
        latest_health.sort(key=lambda item: str(item["checked_at"]), reverse=True)
        duration_rows = self._mapped_rows(
            f"""
            WITH runtime_duration_samples AS (
              SELECT NULLIF(payload ->> 'duration_ms', '')::integer AS duration_ms
              FROM usage_events
              WHERE traffic_type = 'runtime'
                {usage_tenant_clause}
                {usage_window_clause}
              UNION ALL
              SELECT NULLIF(payload ->> 'duration_ms', '')::integer AS duration_ms
              FROM error_events
              WHERE traffic_type = 'runtime'
                {error_tenant_clause}
                {error_window_clause}
            )
            SELECT
              count(*)::bigint AS sample_count,
              COALESCE(avg(duration_ms), 0)::double precision AS avg_ms,
              max(duration_ms)::integer AS max_ms,
              PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
              PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms
            FROM runtime_duration_samples
            WHERE duration_ms IS NOT NULL
            """,
            {**usage_params, **error_params},
        )
        duration_summary = duration_rows[0] if duration_rows else {}

        return {
            "event_count": int(counts.get("event_count", 0) or 0),
            "error_event_count": int(counts.get("error_event_count", 0) or 0),
            "health_event_count": int(counts.get("health_event_count", 0) or 0),
            "by_provider": by_provider,
            "by_model": by_model,
            "by_auth": by_auth,
            "by_client": by_client,
            "by_traffic_type": by_traffic_type,
            "errors_by_provider": errors_by_provider,
            "errors_by_model": errors_by_model,
            "errors_by_client": errors_by_client,
            "errors_by_traffic_type": errors_by_traffic_type,
            "errors_by_type": errors_by_type,
            "errors_by_integration": errors_by_integration,
            "errors_by_profile": errors_by_profile,
            "runtime_duration_ms": {
                "sample_count": int(duration_summary.get("sample_count", 0) or 0),
                "avg": (
                    round(float(duration_summary.get("avg_ms", 0.0) or 0.0), 2)
                    if int(duration_summary.get("sample_count", 0) or 0) > 0
                    else None
                ),
                "p50": int(duration_summary["p50_ms"]) if duration_summary.get("p50_ms") is not None else None,
                "p95": int(duration_summary["p95_ms"]) if duration_summary.get("p95_ms") is not None else None,
                "max": int(duration_summary["max_ms"]) if duration_summary.get("max_ms") is not None else None,
            },
            "latest_health": latest_health,
        }

    def timeline(
        self,
        *,
        window_seconds: int,
        bucket_seconds: int,
        tenant_id: str | None,
    ) -> list[dict[str, object]]:
        tenant_clause, tenant_params = self._tenant_clause(tenant_id=tenant_id)
        rows = self._mapped_rows(
            f"""
            WITH bounds AS (
              SELECT
                NOW() AS now_ts,
                NOW() - (:window_seconds || ' seconds')::interval AS window_start,
                (:bucket_seconds || ' seconds')::interval AS bucket_interval
            ),
            buckets AS (
              SELECT generate_series(
                (SELECT window_start FROM bounds),
                (SELECT now_ts FROM bounds) - (SELECT bucket_interval FROM bounds),
                (SELECT bucket_interval FROM bounds)
              ) AS bucket_start
            ),
            usage_buckets AS (
              SELECT
                (SELECT window_start FROM bounds)
                  + floor(extract(epoch FROM (created_at - (SELECT window_start FROM bounds))) / :bucket_seconds)
                    * (:bucket_seconds || ' seconds')::interval AS bucket_start,
                count(*)::bigint AS requests,
                COALESCE(sum((payload ->> 'actual_cost')::double precision), 0)::double precision AS actual_cost,
                COALESCE(sum((payload ->> 'hypothetical_cost')::double precision), 0)::double precision AS hypothetical_cost,
                COALESCE(sum((payload ->> 'avoided_cost')::double precision), 0)::double precision AS avoided_cost
              FROM usage_events
              WHERE created_at >= (SELECT window_start FROM bounds)
                AND created_at < (SELECT now_ts FROM bounds)
                {tenant_clause}
              GROUP BY 1
            ),
            error_buckets AS (
              SELECT
                (SELECT window_start FROM bounds)
                  + floor(extract(epoch FROM (created_at - (SELECT window_start FROM bounds))) / :bucket_seconds)
                    * (:bucket_seconds || ' seconds')::interval AS bucket_start,
                count(*)::bigint AS errors
              FROM error_events
              WHERE created_at >= (SELECT window_start FROM bounds)
                AND created_at < (SELECT now_ts FROM bounds)
                {tenant_clause}
              GROUP BY 1
            )
            SELECT
              buckets.bucket_start,
              buckets.bucket_start + (SELECT bucket_interval FROM bounds) AS bucket_end,
              COALESCE(usage_buckets.requests, 0)::bigint AS requests,
              COALESCE(error_buckets.errors, 0)::bigint AS errors,
              COALESCE(usage_buckets.actual_cost, 0)::double precision AS actual_cost,
              COALESCE(usage_buckets.hypothetical_cost, 0)::double precision AS hypothetical_cost,
              COALESCE(usage_buckets.avoided_cost, 0)::double precision AS avoided_cost
            FROM buckets
            LEFT JOIN usage_buckets ON usage_buckets.bucket_start = buckets.bucket_start
            LEFT JOIN error_buckets ON error_buckets.bucket_start = buckets.bucket_start
            ORDER BY buckets.bucket_start ASC
            """,
            {
                "window_seconds": int(window_seconds),
                "bucket_seconds": int(bucket_seconds),
                **tenant_params,
            },
        )
        return [
            {
                "bucket_start": self._as_iso(row.get("bucket_start")),
                "bucket_end": self._as_iso(row.get("bucket_end")),
                "requests": int(row.get("requests", 0) or 0),
                "errors": int(row.get("errors", 0) or 0),
                "actual_cost": float(row.get("actual_cost", 0.0) or 0.0),
                "hypothetical_cost": float(row.get("hypothetical_cost", 0.0) or 0.0),
                "avoided_cost": float(row.get("avoided_cost", 0.0) or 0.0),
                "error_rate": int(row.get("errors", 0) or 0)
                / max(1, int(row.get("requests", 0) or 0) + int(row.get("errors", 0) or 0)),
            }
            for row in rows
        ]

    def provider_drilldown(
        self,
        provider: str,
        *,
        window_seconds: int | None,
        tenant_id: str | None,
    ) -> dict[str, object]:
        tenant_clause, tenant_params = self._tenant_clause(tenant_id=tenant_id)
        window_clause, window_params = self._window_clause(window_seconds=window_seconds)
        params = {"provider": provider, **tenant_params, **window_params}

        count_rows = self._mapped_rows(
            f"""
            SELECT
              (SELECT count(*)::bigint FROM usage_events WHERE provider = :provider {tenant_clause} {window_clause}) AS requests,
              (SELECT count(*)::bigint FROM error_events WHERE provider = :provider {tenant_clause} {window_clause}) AS errors
            """,
            params,
        )
        counts = count_rows[0] if count_rows else {}

        models = self._mapped_rows(
            f"""
            WITH usage_rollup AS (
              SELECT
                model,
                count(*)::bigint AS requests,
                COALESCE(sum((payload ->> 'total_tokens')::bigint), 0)::bigint AS tokens,
                COALESCE(sum((payload ->> 'actual_cost')::double precision), 0)::double precision AS actual_cost
              FROM usage_events
              WHERE provider = :provider
                {tenant_clause}
                {window_clause}
              GROUP BY model
            ),
            error_rollup AS (
              SELECT
                COALESCE(model, 'unknown') AS model,
                count(*)::bigint AS errors
              FROM error_events
              WHERE provider = :provider
                {tenant_clause}
                {window_clause}
              GROUP BY COALESCE(model, 'unknown')
            )
            SELECT
              COALESCE(usage_rollup.model, error_rollup.model) AS model,
              COALESCE(usage_rollup.requests, 0)::bigint AS requests,
              COALESCE(usage_rollup.tokens, 0)::bigint AS tokens,
              COALESCE(usage_rollup.actual_cost, 0)::double precision AS actual_cost,
              COALESCE(error_rollup.errors, 0)::bigint AS errors
            FROM usage_rollup
            FULL OUTER JOIN error_rollup USING (model)
            ORDER BY COALESCE(error_rollup.errors, 0) DESC, COALESCE(usage_rollup.requests, 0) DESC, model ASC
            """,
            params,
        )

        clients = self._mapped_rows(
            f"""
            WITH usage_rollup AS (
              SELECT
                client_id,
                count(*)::bigint AS requests,
                COALESCE(sum((payload ->> 'total_tokens')::bigint), 0)::bigint AS tokens,
                COALESCE(sum((payload ->> 'actual_cost')::double precision), 0)::double precision AS actual_cost
              FROM usage_events
              WHERE provider = :provider
                {tenant_clause}
                {window_clause}
              GROUP BY client_id
            ),
            error_rollup AS (
              SELECT
                client_id,
                count(*)::bigint AS errors
              FROM error_events
              WHERE provider = :provider
                {tenant_clause}
                {window_clause}
              GROUP BY client_id
            )
            SELECT
              COALESCE(usage_rollup.client_id, error_rollup.client_id) AS client_id,
              COALESCE(usage_rollup.requests, 0)::bigint AS requests,
              COALESCE(usage_rollup.tokens, 0)::bigint AS tokens,
              COALESCE(usage_rollup.actual_cost, 0)::double precision AS actual_cost,
              COALESCE(error_rollup.errors, 0)::bigint AS errors
            FROM usage_rollup
            FULL OUTER JOIN error_rollup USING (client_id)
            ORDER BY COALESCE(error_rollup.errors, 0) DESC, COALESCE(usage_rollup.actual_cost, 0) DESC, client_id ASC
            """,
            params,
        )

        latest_health_rows = self._payload_rows(
            "health_events",
            order_column="created_at",
            tenant_id=tenant_id,
            extra_where=" AND provider = :provider" + window_clause,
            params={"provider": provider, **window_params},
            limit=20,
        )

        return {
            "provider": provider,
            "requests": int(counts.get("requests", 0) or 0),
            "errors": int(counts.get("errors", 0) or 0),
            "latest_health": [HealthEvent(**row["payload"]).model_dump() for row in latest_health_rows],
            "models": models,
            "clients": clients,
        }

    def client_drilldown(
        self,
        client_id: str,
        *,
        window_seconds: int | None,
        tenant_id: str | None,
    ) -> dict[str, object]:
        tenant_clause, tenant_params = self._tenant_clause(tenant_id=tenant_id)
        window_clause, window_params = self._window_clause(window_seconds=window_seconds)
        params = {"client_id": client_id, **tenant_params, **window_params}

        count_rows = self._mapped_rows(
            f"""
            SELECT
              (SELECT count(*)::bigint FROM usage_events WHERE client_id = :client_id {tenant_clause} {window_clause}) AS requests,
              (SELECT count(*)::bigint FROM error_events WHERE client_id = :client_id {tenant_clause} {window_clause}) AS errors
            """,
            params,
        )
        counts = count_rows[0] if count_rows else {}

        providers = self._mapped_rows(
            f"""
            WITH usage_rollup AS (
              SELECT
                provider,
                count(*)::bigint AS requests,
                COALESCE(sum((payload ->> 'total_tokens')::bigint), 0)::bigint AS tokens,
                COALESCE(sum((payload ->> 'actual_cost')::double precision), 0)::double precision AS actual_cost
              FROM usage_events
              WHERE client_id = :client_id
                {tenant_clause}
                {window_clause}
              GROUP BY provider
            ),
            error_rollup AS (
              SELECT
                COALESCE(provider, 'unknown') AS provider,
                count(*)::bigint AS errors
              FROM error_events
              WHERE client_id = :client_id
                {tenant_clause}
                {window_clause}
              GROUP BY COALESCE(provider, 'unknown')
            )
            SELECT
              COALESCE(usage_rollup.provider, error_rollup.provider) AS provider,
              COALESCE(usage_rollup.requests, 0)::bigint AS requests,
              COALESCE(usage_rollup.tokens, 0)::bigint AS tokens,
              COALESCE(usage_rollup.actual_cost, 0)::double precision AS actual_cost,
              COALESCE(error_rollup.errors, 0)::bigint AS errors
            FROM usage_rollup
            FULL OUTER JOIN error_rollup USING (provider)
            ORDER BY COALESCE(error_rollup.errors, 0) DESC, COALESCE(usage_rollup.requests, 0) DESC, provider ASC
            """,
            params,
        )

        recent_errors = self._payload_rows(
            "error_events",
            order_column="created_at",
            tenant_id=tenant_id,
            extra_where=" AND client_id = :client_id" + window_clause,
            params={"client_id": client_id, **window_params},
            limit=25,
        )
        recent_usage = self._payload_rows(
            "usage_events",
            order_column="created_at",
            tenant_id=tenant_id,
            extra_where=" AND client_id = :client_id" + window_clause,
            params={"client_id": client_id, **window_params},
            limit=25,
        )

        return {
            "client_id": client_id,
            "requests": int(counts.get("requests", 0) or 0),
            "errors": int(counts.get("errors", 0) or 0),
            "providers": providers,
            "recent_errors": [ErrorEvent(**row["payload"]).model_dump() for row in recent_errors],
            "recent_usage": [UsageEvent(**row["payload"]).model_dump() for row in recent_usage],
        }

    def load_usage_events(self) -> list[UsageEvent]:
        with self._session() as session:
            rows = session.scalars(select(UsageEventORM).order_by(UsageEventORM.created_at.asc())).all()
            return [UsageEvent(**row.payload) for row in rows]

    def append_usage_event(self, event: UsageEvent) -> None:
        with self._session() as session:
            session.add(
                UsageEventORM(
                    tenant_id=event.tenant_id,
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
                    tenant_id=event.tenant_id,
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
                    tenant_id=event.tenant_id,
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
