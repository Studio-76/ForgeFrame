"""Storage repositories for harness profile/run persistence."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text, create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.harness.models import HarnessModelInventoryItem, HarnessProfileRecord, HarnessVerificationRun

_SCHEMA_VERSION = 4


class Base(DeclarativeBase):
    pass


class HarnessProfileORM(Base):
    __tablename__ = "harness_profiles"

    provider_key: Mapped[str] = mapped_column(String(191), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    lifecycle_status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    integration_class: Mapped[str] = mapped_column(String(64), nullable=False)
    needs_attention: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_verify_status: Mapped[str] = mapped_column(String(32), default="never", nullable=False)
    last_probe_status: Mapped[str] = mapped_column(String(32), default="never", nullable=False)
    last_sync_status: Mapped[str] = mapped_column(String(32), default="never", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(tz=UTC), nullable=False)


class HarnessRunORM(Base):
    __tablename__ = "harness_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(40), index=True, unique=True, nullable=False)
    provider_key: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
    integration_class: Mapped[str] = mapped_column(String(64), nullable=False)
    mode: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    client_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    consumer: Mapped[str | None] = mapped_column(String(128), nullable=True)
    integration: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))


class HarnessSnapshotORM(Base):
    __tablename__ = "harness_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    snapshot_type: Mapped[str] = mapped_column(String(32), nullable=False, default="periodic")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=UTC), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))


@dataclass(frozen=True)
class HarnessStoragePaths:
    profiles_path: Path
    runs_path: Path


@dataclass(frozen=True)
class HarnessRunQuery:
    provider_key: str | None = None
    mode: str | None = None
    status: str | None = None
    client_id: str | None = None
    limit: int = 200


class HarnessRepository(Protocol):
    def list_profiles(self) -> list[HarnessProfileRecord]: ...

    def get_profile(self, provider_key: str) -> HarnessProfileRecord: ...

    def upsert_profile(self, profile: HarnessProfileRecord) -> HarnessProfileRecord: ...

    def delete_profile(self, provider_key: str) -> None: ...

    def set_profile_active(self, provider_key: str, enabled: bool) -> HarnessProfileRecord: ...

    def update_inventory(self, provider_key: str, inventory: list[HarnessModelInventoryItem], *, status: str, error: str | None = None) -> HarnessProfileRecord: ...

    def record_profile_usage(self, *, provider_key: str, model: str, stream: bool, total_tokens: int, actual_cost: float = 0.0, hypothetical_cost: float = 0.0, avoided_cost: float = 0.0) -> HarnessProfileRecord | None: ...

    def record_run(self, run: HarnessVerificationRun) -> HarnessVerificationRun: ...

    def list_runs(self, query: HarnessRunQuery | None = None) -> list[HarnessVerificationRun]: ...

    def runs_summary(self, provider_key: str | None = None) -> dict[str, int]: ...

    def export_snapshot(self) -> dict[str, Any]: ...


class FileHarnessRepository:
    """Legacy JSON repository kept as migration fallback."""

    def __init__(self, *, paths: HarnessStoragePaths):
        self._paths = paths
        self._profiles: dict[str, HarnessProfileRecord] = {}
        self._runs: list[HarnessVerificationRun] = []
        self._load()

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(tz=UTC).isoformat()

    @staticmethod
    def _hydrate_profile(payload: dict[str, Any]) -> HarnessProfileRecord:
        return HarnessProfileRecord(**payload)

    @staticmethod
    def _hydrate_run(payload: dict[str, Any]) -> HarnessVerificationRun:
        if not payload.get("run_id"):
            payload = {**payload, "run_id": f"run_{uuid4().hex[:12]}"}
        return HarnessVerificationRun(**payload)

    def _read_json(self, path: Path, default: Any) -> Any:
        if not path.exists():
            return default
        try:
            raw = path.read_text(encoding="utf-8")
            return json.loads(raw) if raw.strip() else default
        except (OSError, json.JSONDecodeError):
            backup = path.with_suffix(path.suffix + ".corrupt")
            try:
                path.replace(backup)
            except OSError:
                pass
            return default

    def _atomic_write(self, path: Path, payload: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        tmp.replace(path)

    def _load(self) -> None:
        self._paths.profiles_path.parent.mkdir(parents=True, exist_ok=True)
        self._paths.runs_path.parent.mkdir(parents=True, exist_ok=True)
        profile_payload = self._read_json(self._paths.profiles_path, {"schema_version": _SCHEMA_VERSION, "profiles": []})
        run_payload = self._read_json(self._paths.runs_path, {"schema_version": _SCHEMA_VERSION, "runs": []})

        profiles_raw = profile_payload if isinstance(profile_payload, list) else profile_payload.get("profiles", [])
        runs_raw = run_payload if isinstance(run_payload, list) else run_payload.get("runs", [])
        self._profiles = {item["provider_key"]: self._hydrate_profile(item) for item in profiles_raw}
        self._runs = [self._hydrate_run(item) for item in runs_raw]
        self._flush_profiles()
        self._flush_runs()

    def _flush_profiles(self) -> None:
        payload = {
            "schema_version": _SCHEMA_VERSION,
            "updated_at": self._now_iso(),
            "profiles": [item.model_dump() for item in self.list_profiles()],
        }
        self._atomic_write(self._paths.profiles_path, payload)

    def _flush_runs(self) -> None:
        payload = {
            "schema_version": _SCHEMA_VERSION,
            "updated_at": self._now_iso(),
            "runs": [item.model_dump() for item in self._runs][-1500:],
        }
        self._runs = [self._hydrate_run(item) for item in payload["runs"]]
        self._atomic_write(self._paths.runs_path, payload)

    def list_profiles(self) -> list[HarnessProfileRecord]:
        return sorted(self._profiles.values(), key=lambda item: item.provider_key)

    def get_profile(self, provider_key: str) -> HarnessProfileRecord:
        profile = self._profiles.get(provider_key)
        if not profile:
            raise ValueError(f"Harness profile '{provider_key}' not found.")
        return profile

    def _merge_for_update(self, profile: HarnessProfileRecord) -> HarnessProfileRecord:
        existing = self._profiles.get(profile.provider_key)
        if existing:
            profile.created_at = existing.created_at
            profile.updated_at = self._now_iso()
            profile.config_revision = profile.config_revision or existing.config_revision
            profile.config_revision_parent = profile.config_revision_parent if profile.config_revision_parent is not None else existing.config_revision_parent
            profile.config_history = profile.config_history or existing.config_history
            profile.last_exported_at = profile.last_exported_at or existing.last_exported_at
            profile.last_imported_at = profile.last_imported_at or existing.last_imported_at
            profile.last_verified_at = existing.last_verified_at
            profile.last_verify_status = existing.last_verify_status
            profile.last_probe_at = existing.last_probe_at
            profile.last_probe_status = existing.last_probe_status
            profile.last_sync_at = existing.last_sync_at
            profile.last_sync_status = existing.last_sync_status
            profile.last_sync_error = existing.last_sync_error
            profile.last_error = existing.last_error
            profile.last_used_at = existing.last_used_at
            profile.last_used_model = existing.last_used_model
            profile.verify_success_count = existing.verify_success_count
            profile.verify_failure_count = existing.verify_failure_count
            profile.probe_success_count = existing.probe_success_count
            profile.probe_failure_count = existing.probe_failure_count
            profile.request_count = existing.request_count
            profile.stream_request_count = existing.stream_request_count
            profile.total_tokens = existing.total_tokens
            profile.total_actual_cost = existing.total_actual_cost
            profile.total_hypothetical_cost = existing.total_hypothetical_cost
            profile.total_avoided_cost = existing.total_avoided_cost
            profile.needs_attention = existing.needs_attention
            if not profile.model_inventory:
                profile.model_inventory = existing.model_inventory
        else:
            now = self._now_iso()
            profile.created_at = now
            profile.updated_at = now

        if not profile.enabled:
            profile.lifecycle_status = "disabled"
        elif profile.last_error:
            profile.lifecycle_status = "degraded"
        elif profile.last_verify_status == "ok":
            profile.lifecycle_status = "ready"
        else:
            profile.lifecycle_status = "draft"
        profile.needs_attention = bool(
            profile.last_error
            or profile.last_verify_status == "failed"
            or profile.last_probe_status == "failed"
            or profile.last_sync_status in {"warning", "failed"}
        )
        return profile

    def upsert_profile(self, profile: HarnessProfileRecord) -> HarnessProfileRecord:
        profile = self._merge_for_update(profile)
        self._profiles[profile.provider_key] = profile
        self._flush_profiles()
        return profile

    def delete_profile(self, provider_key: str) -> None:
        if provider_key not in self._profiles:
            raise ValueError(f"Harness profile '{provider_key}' not found.")
        del self._profiles[provider_key]
        self._flush_profiles()

    def set_profile_active(self, provider_key: str, enabled: bool) -> HarnessProfileRecord:
        profile = self.get_profile(provider_key)
        profile.enabled = enabled
        profile.updated_at = self._now_iso()
        profile.lifecycle_status = "disabled" if not enabled else "ready"
        profile.needs_attention = not enabled
        self._flush_profiles()
        return profile

    def update_inventory(self, provider_key: str, inventory: list[HarnessModelInventoryItem], *, status: str, error: str | None = None) -> HarnessProfileRecord:
        profile = self.get_profile(provider_key)
        profile.model_inventory = inventory
        profile.last_sync_at = self._now_iso()
        profile.last_sync_status = status
        profile.last_sync_error = error
        profile.updated_at = self._now_iso()
        if error:
            profile.last_error = error
            profile.lifecycle_status = "degraded"
            profile.needs_attention = True
        elif status == "ok":
            profile.lifecycle_status = "ready"
            profile.needs_attention = False
        self._flush_profiles()
        return profile

    def record_profile_usage(self, *, provider_key: str, model: str, stream: bool, total_tokens: int, actual_cost: float = 0.0, hypothetical_cost: float = 0.0, avoided_cost: float = 0.0) -> HarnessProfileRecord | None:
        profile = self._profiles.get(provider_key)
        if not profile:
            return None
        profile.last_used_at = self._now_iso()
        profile.last_used_model = model
        profile.request_count += 1
        profile.stream_request_count += 1 if stream else 0
        profile.total_tokens += max(0, total_tokens)
        profile.total_actual_cost += actual_cost
        profile.total_hypothetical_cost += hypothetical_cost
        profile.total_avoided_cost += avoided_cost
        profile.updated_at = self._now_iso()
        self._flush_profiles()
        return profile

    def record_run(self, run: HarnessVerificationRun) -> HarnessVerificationRun:
        normalized = run.model_copy(update={"run_id": run.run_id or f"run_{uuid4().hex[:12]}"})
        self._runs.append(normalized)
        profile = self._profiles.get(normalized.provider_key)
        if profile:
            profile.updated_at = self._now_iso()
            if normalized.mode == "verify":
                profile.last_verified_at = normalized.executed_at
                profile.last_verify_status = "ok" if normalized.success else "failed"
                profile.verify_success_count += 1 if normalized.success else 0
                profile.verify_failure_count += 0 if normalized.success else 1
            if normalized.mode == "probe":
                profile.last_probe_at = normalized.executed_at
                profile.last_probe_status = "ok" if normalized.success else "failed"
                profile.probe_success_count += 1 if normalized.success else 0
                profile.probe_failure_count += 0 if normalized.success else 1
            if normalized.error:
                profile.last_error = normalized.error
                profile.lifecycle_status = "degraded"
                profile.needs_attention = True
            elif profile.enabled:
                profile.lifecycle_status = "ready"
            self._flush_profiles()
        self._flush_runs()
        return normalized

    def list_runs(self, query: HarnessRunQuery | None = None) -> list[HarnessVerificationRun]:
        query = query or HarnessRunQuery()
        runs = self._runs
        if query.provider_key:
            runs = [item for item in runs if item.provider_key == query.provider_key]
        if query.mode:
            runs = [item for item in runs if item.mode == query.mode]
        if query.status:
            runs = [item for item in runs if item.status == query.status]
        if query.client_id:
            runs = [item for item in runs if item.client_id == query.client_id]
        return sorted(runs, key=lambda item: item.executed_at, reverse=True)[: max(1, query.limit)]

    def runs_summary(self, provider_key: str | None = None) -> dict[str, int]:
        runs = self.list_runs(HarnessRunQuery(provider_key=provider_key, limit=5000))
        return {
            "total": len(runs),
            "failed": len([r for r in runs if not r.success]),
            "verify": len([r for r in runs if r.mode == "verify"]),
            "probe": len([r for r in runs if r.mode == "probe"]),
            "sync": len([r for r in runs if r.mode == "sync"]),
            "runtime_non_stream": len([r for r in runs if r.mode == "runtime_non_stream"]),
            "runtime_stream": len([r for r in runs if r.mode == "runtime_stream"]),
        }

    def export_snapshot(self) -> dict[str, Any]:
        profiles = self.list_profiles()
        runs = self.list_runs(HarnessRunQuery(limit=120))
        return {
            "schema_version": _SCHEMA_VERSION,
            "storage_backend": "file",
            "profiles": [item.model_dump() for item in profiles],
            "runs": [item.model_dump() for item in runs],
            "summary": {
                "profile_count": len(profiles),
                "needs_attention_count": len([p for p in profiles if p.needs_attention]),
                "run_count": len(runs),
            },
        }


class PostgresHarnessRepository:
    def __init__(self, database_url: str):
        if not database_url.startswith("postgresql"):
            raise ValueError("PostgreSQL backend requires a postgresql:// URL.")
        self._engine = create_engine(database_url, pool_pre_ping=True)
        Base.metadata.create_all(self._engine)
        self._session_factory = sessionmaker(self._engine, autoflush=False, expire_on_commit=False)

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(tz=UTC).isoformat()

    def _session(self) -> Session:
        return self._session_factory()

    def _merge_for_update(self, profile: HarnessProfileRecord, existing_payload: dict[str, Any] | None) -> HarnessProfileRecord:
        if existing_payload:
            prior = HarnessProfileRecord(**existing_payload)
            profile.created_at = prior.created_at
            profile.updated_at = self._now_iso()
            profile.config_revision = profile.config_revision or prior.config_revision
            profile.config_revision_parent = profile.config_revision_parent if profile.config_revision_parent is not None else prior.config_revision_parent
            profile.config_history = profile.config_history or prior.config_history
            profile.last_exported_at = profile.last_exported_at or prior.last_exported_at
            profile.last_imported_at = profile.last_imported_at or prior.last_imported_at
            profile.last_verified_at = prior.last_verified_at
            profile.last_verify_status = prior.last_verify_status
            profile.last_probe_at = prior.last_probe_at
            profile.last_probe_status = prior.last_probe_status
            profile.last_sync_at = prior.last_sync_at
            profile.last_sync_status = prior.last_sync_status
            profile.last_sync_error = prior.last_sync_error
            profile.last_error = prior.last_error
            profile.last_used_at = prior.last_used_at
            profile.last_used_model = prior.last_used_model
            profile.verify_success_count = prior.verify_success_count
            profile.verify_failure_count = prior.verify_failure_count
            profile.probe_success_count = prior.probe_success_count
            profile.probe_failure_count = prior.probe_failure_count
            profile.request_count = prior.request_count
            profile.stream_request_count = prior.stream_request_count
            profile.total_tokens = prior.total_tokens
            profile.total_actual_cost = prior.total_actual_cost
            profile.total_hypothetical_cost = prior.total_hypothetical_cost
            profile.total_avoided_cost = prior.total_avoided_cost
            profile.needs_attention = prior.needs_attention
            if not profile.model_inventory:
                profile.model_inventory = prior.model_inventory
        else:
            now = self._now_iso()
            profile.created_at = now
            profile.updated_at = now

        if not profile.enabled:
            profile.lifecycle_status = "disabled"
        elif profile.last_error:
            profile.lifecycle_status = "degraded"
        elif profile.last_verify_status == "ok":
            profile.lifecycle_status = "ready"
        else:
            profile.lifecycle_status = "draft"
        profile.needs_attention = bool(
            profile.last_error
            or profile.last_verify_status == "failed"
            or profile.last_probe_status == "failed"
            or profile.last_sync_status in {"warning", "failed"}
        )
        return profile

    def list_profiles(self) -> list[HarnessProfileRecord]:
        with self._session() as session:
            rows = session.scalars(select(HarnessProfileORM)).all()
            return sorted((HarnessProfileRecord(**row.payload) for row in rows), key=lambda item: item.provider_key)

    def get_profile(self, provider_key: str) -> HarnessProfileRecord:
        with self._session() as session:
            row = session.get(HarnessProfileORM, provider_key)
            if not row:
                raise ValueError(f"Harness profile '{provider_key}' not found.")
            return HarnessProfileRecord(**row.payload)

    def upsert_profile(self, profile: HarnessProfileRecord) -> HarnessProfileRecord:
        with self._session() as session:
            existing = session.get(HarnessProfileORM, profile.provider_key)
            profile = self._merge_for_update(profile, existing.payload if existing else None)
            payload = profile.model_dump()
            if existing:
                existing.payload = payload
                existing.enabled = profile.enabled
                existing.needs_attention = profile.needs_attention
                existing.lifecycle_status = profile.lifecycle_status
                existing.integration_class = profile.integration_class
                existing.last_verify_status = profile.last_verify_status
                existing.last_probe_status = profile.last_probe_status
                existing.last_sync_status = profile.last_sync_status
                existing.updated_at = datetime.fromisoformat(profile.updated_at)
            else:
                session.add(
                    HarnessProfileORM(
                        provider_key=profile.provider_key,
                        payload=payload,
                        enabled=profile.enabled,
                        needs_attention=profile.needs_attention,
                        lifecycle_status=profile.lifecycle_status,
                        integration_class=profile.integration_class,
                        last_verify_status=profile.last_verify_status,
                        last_probe_status=profile.last_probe_status,
                        last_sync_status=profile.last_sync_status,
                        updated_at=datetime.fromisoformat(profile.updated_at),
                    )
                )
            session.commit()
            return profile

    def delete_profile(self, provider_key: str) -> None:
        with self._session() as session:
            row = session.get(HarnessProfileORM, provider_key)
            if not row:
                raise ValueError(f"Harness profile '{provider_key}' not found.")
            session.delete(row)
            session.commit()

    def set_profile_active(self, provider_key: str, enabled: bool) -> HarnessProfileRecord:
        profile = self.get_profile(provider_key)
        profile.enabled = enabled
        profile.updated_at = self._now_iso()
        profile.lifecycle_status = "disabled" if not enabled else "ready"
        profile.needs_attention = not enabled
        return self.upsert_profile(profile)

    def update_inventory(self, provider_key: str, inventory: list[HarnessModelInventoryItem], *, status: str, error: str | None = None) -> HarnessProfileRecord:
        profile = self.get_profile(provider_key)
        profile.model_inventory = inventory
        profile.last_sync_at = self._now_iso()
        profile.last_sync_status = status
        profile.last_sync_error = error
        profile.updated_at = self._now_iso()
        if error:
            profile.last_error = error
            profile.lifecycle_status = "degraded"
            profile.needs_attention = True
        elif status == "ok":
            profile.lifecycle_status = "ready"
            profile.needs_attention = False
        return self.upsert_profile(profile)

    def record_profile_usage(self, *, provider_key: str, model: str, stream: bool, total_tokens: int, actual_cost: float = 0.0, hypothetical_cost: float = 0.0, avoided_cost: float = 0.0) -> HarnessProfileRecord | None:
        try:
            profile = self.get_profile(provider_key)
        except ValueError:
            return None
        profile.last_used_at = self._now_iso()
        profile.last_used_model = model
        profile.request_count += 1
        profile.stream_request_count += 1 if stream else 0
        profile.total_tokens += max(0, total_tokens)
        profile.total_actual_cost += actual_cost
        profile.total_hypothetical_cost += hypothetical_cost
        profile.total_avoided_cost += avoided_cost
        profile.updated_at = self._now_iso()
        return self.upsert_profile(profile)

    def record_run(self, run: HarnessVerificationRun) -> HarnessVerificationRun:
        normalized = run.model_copy(update={"run_id": run.run_id or f"run_{uuid4().hex[:12]}"})
        with self._session() as session:
            session.add(
                HarnessRunORM(
                    run_id=normalized.run_id or f"run_{uuid4().hex[:12]}",
                    provider_key=normalized.provider_key,
                    integration_class=normalized.integration_class,
                    mode=normalized.mode,
                    status=normalized.status,
                    success=normalized.success,
                    client_id=normalized.client_id,
                    consumer=normalized.consumer,
                    integration=normalized.integration,
                    error=normalized.error,
                    executed_at=datetime.fromisoformat(normalized.executed_at),
                    payload=normalized.model_dump(),
                )
            )
            session.commit()

        try:
            profile = self.get_profile(normalized.provider_key)
        except ValueError:
            profile = None

        if profile:
            profile.updated_at = self._now_iso()
            if normalized.mode == "verify":
                profile.last_verified_at = normalized.executed_at
                profile.last_verify_status = "ok" if normalized.success else "failed"
                profile.verify_success_count += 1 if normalized.success else 0
                profile.verify_failure_count += 0 if normalized.success else 1
            if normalized.mode == "probe":
                profile.last_probe_at = normalized.executed_at
                profile.last_probe_status = "ok" if normalized.success else "failed"
                profile.probe_success_count += 1 if normalized.success else 0
                profile.probe_failure_count += 0 if normalized.success else 1
            if normalized.error:
                profile.last_error = normalized.error
                profile.lifecycle_status = "degraded"
                profile.needs_attention = True
            elif profile.enabled:
                profile.lifecycle_status = "ready"
            self.upsert_profile(profile)

        with self._session() as session:
            stale = session.scalars(select(HarnessRunORM).order_by(HarnessRunORM.executed_at.desc()).offset(2000)).all()
            for row in stale:
                session.delete(row)
            session.commit()
        return normalized

    def list_runs(self, query: HarnessRunQuery | None = None) -> list[HarnessVerificationRun]:
        query = query or HarnessRunQuery()
        with self._session() as session:
            stmt = select(HarnessRunORM)
            if query.provider_key:
                stmt = stmt.where(HarnessRunORM.provider_key == query.provider_key)
            if query.mode:
                stmt = stmt.where(HarnessRunORM.mode == query.mode)
            if query.status:
                stmt = stmt.where(HarnessRunORM.status == query.status)
            if query.client_id:
                stmt = stmt.where(HarnessRunORM.client_id == query.client_id)
            rows = session.scalars(stmt.order_by(HarnessRunORM.executed_at.desc()).limit(max(1, query.limit))).all()
            return [HarnessVerificationRun(**row.payload) for row in rows]

    def runs_summary(self, provider_key: str | None = None) -> dict[str, int]:
        runs = self.list_runs(HarnessRunQuery(provider_key=provider_key, limit=5000))
        return {
            "total": len(runs),
            "failed": len([r for r in runs if not r.success]),
            "verify": len([r for r in runs if r.mode == "verify"]),
            "probe": len([r for r in runs if r.mode == "probe"]),
            "sync": len([r for r in runs if r.mode == "sync"]),
            "runtime_non_stream": len([r for r in runs if r.mode == "runtime_non_stream"]),
            "runtime_stream": len([r for r in runs if r.mode == "runtime_stream"]),
        }

    def export_snapshot(self) -> dict[str, Any]:
        profiles = [item.model_dump() for item in self.list_profiles()]
        runs = [item.model_dump() for item in self.list_runs(HarnessRunQuery(limit=120))]
        payload = {
            "schema_version": _SCHEMA_VERSION,
            "storage_backend": "postgresql",
            "profiles": profiles,
            "runs": runs,
            "summary": {
                "profile_count": len(profiles),
                "needs_attention_count": len([p for p in profiles if p.get("needs_attention")]),
                "run_count": len(runs),
            },
        }
        with self._session() as session:
            session.add(HarnessSnapshotORM(snapshot_type="periodic", payload=payload))
            stale = session.scalars(select(HarnessSnapshotORM).order_by(HarnessSnapshotORM.created_at.desc()).offset(100)).all()
            for row in stale:
                session.delete(row)
            session.commit()
        return payload
