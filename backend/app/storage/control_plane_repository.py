"""Storage repositories for persistent control-plane state."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

from sqlalchemy import JSON, DateTime, String, create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Session, mapped_column, sessionmaker

from app.control_plane.models import ControlPlaneStateRecord
from app.settings.config import Settings
from app.storage.harness_repository import Base

_STATE_KEY = "default"
_CONTROL_PLANE_STATE_SCHEMA_VERSION = 2


class ControlPlaneStateORM(Base):
    __tablename__ = "control_plane_state"

    state_key: Mapped[str] = mapped_column(String(32), primary_key=True, default=_STATE_KEY)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(tz=UTC), nullable=False)


@dataclass(frozen=True)
class ControlPlaneStatePaths:
    state_path: Path


class ControlPlaneStateRepository(Protocol):
    def load_state(self) -> ControlPlaneStateRecord | None: ...

    def save_state(self, state: ControlPlaneStateRecord) -> ControlPlaneStateRecord: ...


class FileControlPlaneStateRepository:
    def __init__(self, *, paths: ControlPlaneStatePaths):
        self._paths = paths

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(tz=UTC).isoformat()

    @staticmethod
    def _upgrade_payload(payload: dict[str, Any]) -> tuple[dict[str, Any], bool]:
        normalized = dict(payload)
        changed = False
        version = int(normalized.get("schema_version") or 1)

        if version < 2:
            for provider in normalized.get("providers", []):
                provider_label = provider.get("label") or provider.get("provider")
                for model in provider.get("managed_models", []):
                    if model.get("owned_by") is None:
                        model["owned_by"] = provider_label
                        changed = True
                    if model.get("display_name") is None:
                        model["display_name"] = model.get("id")
                        changed = True
                    if "category" not in model:
                        model["category"] = "general"
                        changed = True
                    if "runtime_status" not in model:
                        model["runtime_status"] = "planned"
                        changed = True
                    if "availability_status" not in model:
                        model["availability_status"] = "unknown"
                        changed = True
                    if "status_reason" not in model:
                        model["status_reason"] = None
                        changed = True
                    if "last_seen_at" not in model:
                        model["last_seen_at"] = None
                        changed = True
                    if "last_probe_at" not in model:
                        model["last_probe_at"] = None
                        changed = True
                    if "stale_since" not in model:
                        model["stale_since"] = None
                        changed = True
            normalized["schema_version"] = _CONTROL_PLANE_STATE_SCHEMA_VERSION
            changed = True

        if "updated_at" not in normalized:
            normalized["updated_at"] = ""
            changed = True

        return normalized, changed

    def load_state(self) -> ControlPlaneStateRecord | None:
        path = self._paths.state_path
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            return None
        try:
            raw = path.read_text(encoding="utf-8")
            if not raw.strip():
                return None
            payload, changed = self._upgrade_payload(json.loads(raw))
            state = ControlPlaneStateRecord(**payload)
            if changed:
                return self.save_state(state)
            return state
        except (OSError, json.JSONDecodeError, ValueError):
            backup = path.with_suffix(path.suffix + ".corrupt")
            try:
                path.replace(backup)
            except OSError:
                pass
            return None

    def save_state(self, state: ControlPlaneStateRecord) -> ControlPlaneStateRecord:
        normalized = state.model_copy(update={"updated_at": self._now_iso()})
        path = self._paths.state_path
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(normalized.model_dump(), indent=2) + "\n", encoding="utf-8")
        tmp.replace(path)
        return normalized


class PostgresControlPlaneStateRepository:
    def __init__(self, database_url: str):
        if not database_url.startswith("postgresql"):
            raise ValueError("Control-plane PostgreSQL backend requires a postgresql:// URL.")
        self._engine = create_engine(database_url, pool_pre_ping=True)
        Base.metadata.create_all(self._engine)
        self._session_factory = sessionmaker(self._engine, autoflush=False, expire_on_commit=False)

    @staticmethod
    def _now() -> datetime:
        return datetime.now(tz=UTC)

    def _session(self) -> Session:
        return self._session_factory()

    def load_state(self) -> ControlPlaneStateRecord | None:
        with self._session() as session:
            row = session.get(ControlPlaneStateORM, _STATE_KEY)
            if not row:
                return None
            payload, changed = FileControlPlaneStateRepository._upgrade_payload(row.payload)
            state = ControlPlaneStateRecord(**payload)
            if changed:
                row.payload = state.model_dump()
                row.updated_at = self._now()
                session.commit()
            return state

    def save_state(self, state: ControlPlaneStateRecord) -> ControlPlaneStateRecord:
        normalized = state.model_copy(update={"updated_at": self._now().isoformat()})
        with self._session() as session:
            row = session.get(ControlPlaneStateORM, _STATE_KEY)
            payload = normalized.model_dump()
            if row:
                row.payload = payload
                row.updated_at = self._now()
            else:
                session.add(
                    ControlPlaneStateORM(
                        state_key=_STATE_KEY,
                        payload=payload,
                        updated_at=self._now(),
                    )
                )
            session.commit()
        return normalized


def get_control_plane_state_repository(settings: Settings) -> ControlPlaneStateRepository:
    if settings.control_plane_storage_backend == "postgresql":
        database_url = settings.control_plane_postgres_url.strip() or settings.harness_postgres_url
        return PostgresControlPlaneStateRepository(database_url)
    return FileControlPlaneStateRepository(paths=ControlPlaneStatePaths(state_path=Path(settings.control_plane_state_path)))
