"""Repositories for ForgeFrame instance state."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

from sqlalchemy import JSON, DateTime, String, create_engine, delete, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Session, mapped_column, sessionmaker

from app.instances.models import InstanceRecord, InstanceStateRecord
from app.settings.config import Settings
from app.storage.harness_repository import Base

_INSTANCE_STATE_SCHEMA_VERSION = 1
_SLUG_SANITIZER = re.compile(r"[^a-z0-9]+")


class InstanceORM(Base):
    __tablename__ = "instances"

    instance_id: Mapped[str] = mapped_column(String(191), primary_key=True)
    slug: Mapped[str] = mapped_column(String(191), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(191), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    tenant_id: Mapped[str] = mapped_column(String(191), nullable=False, unique=True)
    company_id: Mapped[str] = mapped_column(String(191), nullable=False, unique=True)
    deployment_mode: Mapped[str] = mapped_column(String(64), nullable=False, default="restricted_eval")
    exposure_mode: Mapped[str] = mapped_column(String(64), nullable=False, default="local_only")
    is_default: Mapped[bool] = mapped_column(default=False, nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


@dataclass(frozen=True)
class InstanceStatePaths:
    state_path: Path


class InstanceRepository(Protocol):
    def load_instances(self) -> list[InstanceRecord]: ...

    def save_instances(self, instances: list[InstanceRecord]) -> list[InstanceRecord]: ...


def _slugify(value: str) -> str:
    normalized = _SLUG_SANITIZER.sub("-", value.strip().lower()).strip("-")
    return normalized or "instance"


class FileInstanceRepository:
    def __init__(self, *, paths: InstanceStatePaths):
        self._paths = paths

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(tz=UTC).isoformat()

    @staticmethod
    def _normalize_payload(payload: dict[str, Any]) -> InstanceStateRecord:
        normalized = dict(payload)
        if "instances" not in normalized:
            raise ValueError("Instance state payload is missing 'instances'.")
        instances = [
            InstanceRecord(**({
                **item,
                "slug": _slugify(
                    str(item.get("slug") or item.get("instance_id") or item.get("tenant_id") or "instance")
                ),
            }))
            for item in normalized.get("instances", [])
        ]
        return InstanceStateRecord(
            schema_version=int(normalized.get("schema_version") or _INSTANCE_STATE_SCHEMA_VERSION),
            instances=instances,
            updated_at=str(normalized.get("updated_at") or ""),
        )

    def load_instances(self) -> list[InstanceRecord]:
        path = self._paths.state_path
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            return []
        try:
            raw = path.read_text(encoding="utf-8")
            if not raw.strip():
                return []
            payload = json.loads(raw)
            if isinstance(payload, list):
                state = InstanceStateRecord(instances=[InstanceRecord(**item) for item in payload])
            else:
                state = self._normalize_payload(payload)
            return list(state.instances)
        except (OSError, json.JSONDecodeError, ValueError):
            backup = path.with_suffix(path.suffix + ".corrupt")
            try:
                path.replace(backup)
            except OSError:
                pass
            return []

    def save_instances(self, instances: list[InstanceRecord]) -> list[InstanceRecord]:
        normalized = [
            item.model_copy(
                update={
                    "slug": _slugify(item.slug or item.instance_id),
                    "updated_at": self._now_iso(),
                }
            )
            for item in instances
        ]
        state = InstanceStateRecord(
            schema_version=_INSTANCE_STATE_SCHEMA_VERSION,
            instances=normalized,
            updated_at=self._now_iso(),
        )
        path = self._paths.state_path
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(state.model_dump(mode="json"), indent=2) + "\n", encoding="utf-8")
        tmp.replace(path)
        return normalized


class PostgresInstanceRepository:
    def __init__(self, database_url: str):
        if not database_url.startswith("postgresql"):
            raise ValueError("Instance PostgreSQL backend requires a postgresql:// URL.")
        self._engine = create_engine(database_url, pool_pre_ping=True)
        Base.metadata.create_all(self._engine)
        self._session_factory = sessionmaker(self._engine, autoflush=False, expire_on_commit=False)

    def _session(self) -> Session:
        return self._session_factory()

    @staticmethod
    def _from_row(row: InstanceORM) -> InstanceRecord:
        return InstanceRecord(
            instance_id=row.instance_id,
            slug=row.slug,
            display_name=row.display_name,
            description=row.description,
            status=row.status,
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            deployment_mode=row.deployment_mode,
            exposure_mode=row.exposure_mode,
            is_default=row.is_default,
            metadata=row.metadata_json,
            created_at=row.created_at.isoformat(),
            updated_at=row.updated_at.isoformat(),
        )

    def load_instances(self) -> list[InstanceRecord]:
        with self._session() as session:
            rows = session.execute(select(InstanceORM).order_by(InstanceORM.created_at.asc())).scalars().all()
            return [self._from_row(row) for row in rows]

    def save_instances(self, instances: list[InstanceRecord]) -> list[InstanceRecord]:
        normalized = [
            item.model_copy(update={"slug": _slugify(item.slug or item.instance_id)})
            for item in instances
        ]
        incoming_ids = {item.instance_id for item in normalized}
        with self._session() as session:
            existing = {
                row.instance_id: row
                for row in session.execute(select(InstanceORM)).scalars().all()
            }

            for stale_id in set(existing) - incoming_ids:
                session.delete(existing[stale_id])

            for item in normalized:
                row = existing.get(item.instance_id)
                created_at = datetime.fromisoformat(item.created_at)
                updated_at = datetime.fromisoformat(item.updated_at)
                if row is None:
                    session.add(
                        InstanceORM(
                            instance_id=item.instance_id,
                            slug=item.slug,
                            display_name=item.display_name,
                            description=item.description,
                            status=item.status,
                            tenant_id=item.tenant_id,
                            company_id=item.company_id,
                            deployment_mode=item.deployment_mode,
                            exposure_mode=item.exposure_mode,
                            is_default=item.is_default,
                            metadata_json=item.metadata,
                            created_at=created_at,
                            updated_at=updated_at,
                        )
                    )
                    continue
                row.slug = item.slug
                row.display_name = item.display_name
                row.description = item.description
                row.status = item.status
                row.tenant_id = item.tenant_id
                row.company_id = item.company_id
                row.deployment_mode = item.deployment_mode
                row.exposure_mode = item.exposure_mode
                row.is_default = item.is_default
                row.metadata_json = dict(item.metadata)
                row.created_at = created_at
                row.updated_at = updated_at
            session.commit()

        return normalized


def get_instance_repository(settings: Settings) -> InstanceRepository:
    if settings.instances_storage_backend == "postgresql":
        database_url = (
            settings.instances_postgres_url.strip()
            or settings.governance_postgres_url.strip()
            or settings.harness_postgres_url
        )
        return PostgresInstanceRepository(database_url)
    return FileInstanceRepository(paths=InstanceStatePaths(state_path=Path(settings.instances_state_path)))


__all__ = [
    "InstanceORM",
    "InstanceRepository",
    "InstanceStatePaths",
    "FileInstanceRepository",
    "PostgresInstanceRepository",
    "get_instance_repository",
]
