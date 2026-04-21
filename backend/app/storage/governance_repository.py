"""Repository for governance state."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Session, mapped_column, sessionmaker

from app.governance.models import GovernanceStateRecord
from app.settings.config import Settings
from app.storage.harness_repository import Base

_STATE_KEY = "default"


class GovernanceStateORM(Base):
    __tablename__ = "governance_state"

    state_key: Mapped[str] = mapped_column(String(32), primary_key=True, default=_STATE_KEY)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(tz=UTC), nullable=False)


@dataclass(frozen=True)
class GovernanceStatePaths:
    state_path: Path


class GovernanceRepository(Protocol):
    def load_state(self) -> GovernanceStateRecord: ...

    def save_state(self, state: GovernanceStateRecord) -> GovernanceStateRecord: ...


class FileGovernanceRepository:
    def __init__(self, *, paths: GovernanceStatePaths):
        self._paths = paths

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(tz=UTC).isoformat()

    @staticmethod
    def _upgrade_payload(payload: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(payload)
        normalized.setdefault("schema_version", 2)
        normalized.setdefault("admin_users", [])
        normalized.setdefault("admin_sessions", [])
        normalized.setdefault("gateway_accounts", [])
        normalized.setdefault("runtime_keys", [])
        normalized.setdefault("setting_overrides", [])
        normalized.setdefault("audit_events", [])
        normalized.setdefault("updated_at", "")
        return normalized

    def load_state(self) -> GovernanceStateRecord:
        path = self._paths.state_path
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            return GovernanceStateRecord()
        try:
            raw = path.read_text(encoding="utf-8")
            if not raw.strip():
                return GovernanceStateRecord()
            payload = self._upgrade_payload(json.loads(raw))
            return GovernanceStateRecord(**payload)
        except (OSError, json.JSONDecodeError, ValueError):
            backup = path.with_suffix(path.suffix + ".corrupt")
            try:
                path.replace(backup)
            except OSError:
                pass
            return GovernanceStateRecord()

    def save_state(self, state: GovernanceStateRecord) -> GovernanceStateRecord:
        normalized = state.model_copy(update={"updated_at": self._now_iso()})
        path = self._paths.state_path
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(normalized.model_dump(), indent=2) + "\n", encoding="utf-8")
        tmp.replace(path)
        return normalized


class PostgresGovernanceRepository:
    def __init__(self, database_url: str):
        from sqlalchemy import create_engine

        if not database_url.startswith("postgresql"):
            raise ValueError("Governance PostgreSQL backend requires a postgresql:// URL.")
        self._engine = create_engine(database_url, pool_pre_ping=True)
        Base.metadata.create_all(self._engine)
        self._session_factory = sessionmaker(self._engine, autoflush=False, expire_on_commit=False)

    @staticmethod
    def _now() -> datetime:
        return datetime.now(tz=UTC)

    def _session(self) -> Session:
        return self._session_factory()

    def load_state(self) -> GovernanceStateRecord:
        with self._session() as session:
            row = session.get(GovernanceStateORM, _STATE_KEY)
            if not row:
                return GovernanceStateRecord()
            payload = FileGovernanceRepository._upgrade_payload(row.payload)
            return GovernanceStateRecord(**payload)

    def save_state(self, state: GovernanceStateRecord) -> GovernanceStateRecord:
        normalized = state.model_copy(update={"updated_at": self._now().isoformat()})
        with self._session() as session:
            row = session.get(GovernanceStateORM, _STATE_KEY)
            payload = normalized.model_dump()
            if row:
                row.payload = payload
                row.updated_at = self._now()
            else:
                session.add(
                    GovernanceStateORM(
                        state_key=_STATE_KEY,
                        payload=payload,
                        updated_at=self._now(),
                    )
                )
            session.commit()
        return normalized


def get_governance_repository(settings: Settings) -> GovernanceRepository:
    if settings.governance_storage_backend == "postgresql":
        database_url = settings.governance_postgres_url.strip() or settings.harness_postgres_url
        return PostgresGovernanceRepository(database_url)
    return FileGovernanceRepository(paths=GovernanceStatePaths(state_path=Path(settings.governance_state_path)))
