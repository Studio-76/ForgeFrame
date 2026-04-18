"""Storage repositories for harness profile/run persistence."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text, create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.harness.models import HarnessModelInventoryItem, HarnessProfileRecord, HarnessVerificationRun

_SCHEMA_VERSION = 3


class Base(DeclarativeBase):
    pass


class HarnessProfileORM(Base):
    __tablename__ = "harness_profiles"

    provider_key: Mapped[str] = mapped_column(String(191), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    lifecycle_status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    integration_class: Mapped[str] = mapped_column(String(64), nullable=False)
    last_verify_status: Mapped[str] = mapped_column(String(32), default="never", nullable=False)
    last_probe_status: Mapped[str] = mapped_column(String(32), default="never", nullable=False)
    last_sync_status: Mapped[str] = mapped_column(String(32), default="never", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(tz=UTC), nullable=False)


class HarnessRunORM(Base):
    __tablename__ = "harness_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_key: Mapped[str] = mapped_column(String(191), index=True, nullable=False)
    integration_class: Mapped[str] = mapped_column(String(64), nullable=False)
    mode: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))


@dataclass(frozen=True)
class HarnessStoragePaths:
    profiles_path: Path
    runs_path: Path


class HarnessRepository(Protocol):
    def list_profiles(self) -> list[HarnessProfileRecord]: ...

    def get_profile(self, provider_key: str) -> HarnessProfileRecord: ...

    def upsert_profile(self, profile: HarnessProfileRecord) -> HarnessProfileRecord: ...

    def delete_profile(self, provider_key: str) -> None: ...

    def set_profile_active(self, provider_key: str, enabled: bool) -> HarnessProfileRecord: ...

    def update_inventory(self, provider_key: str, inventory: list[HarnessModelInventoryItem], *, status: str, error: str | None = None) -> HarnessProfileRecord: ...

    def record_run(self, run: HarnessVerificationRun) -> HarnessVerificationRun: ...

    def list_runs(self, provider_key: str | None = None) -> list[HarnessVerificationRun]: ...

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
    def _as_datetime(raw: str | None) -> datetime:
        return datetime.fromisoformat(raw or datetime.now(tz=UTC).isoformat())

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

        self._profiles = {item["provider_key"]: HarnessProfileRecord(**item) for item in profiles_raw}
        self._runs = [HarnessVerificationRun(**item) for item in runs_raw]
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
            "runs": [item.model_dump() for item in self._runs][-1000:],
        }
        self._runs = [HarnessVerificationRun(**item) for item in payload["runs"]]
        self._atomic_write(self._paths.runs_path, payload)

    def list_profiles(self) -> list[HarnessProfileRecord]:
        return sorted(self._profiles.values(), key=lambda item: item.provider_key)

    def get_profile(self, provider_key: str) -> HarnessProfileRecord:
        profile = self._profiles.get(provider_key)
        if not profile:
            raise ValueError(f"Harness profile '{provider_key}' not found.")
        return profile

    def upsert_profile(self, profile: HarnessProfileRecord) -> HarnessProfileRecord:
        existing = self._profiles.get(profile.provider_key)
        if existing:
            profile.created_at = existing.created_at
            profile.updated_at = self._now_iso()
            profile.last_verified_at = existing.last_verified_at
            profile.last_verify_status = existing.last_verify_status
            profile.last_probe_at = existing.last_probe_at
            profile.last_probe_status = existing.last_probe_status
            profile.last_sync_at = existing.last_sync_at
            profile.last_sync_status = existing.last_sync_status
            profile.last_sync_error = existing.last_sync_error
            profile.last_error = existing.last_error
            profile.verify_success_count = existing.verify_success_count
            profile.verify_failure_count = existing.verify_failure_count
            profile.probe_success_count = existing.probe_success_count
            profile.probe_failure_count = existing.probe_failure_count
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
        elif status == "ok":
            profile.lifecycle_status = "ready"
        self._flush_profiles()
        return profile

    def record_run(self, run: HarnessVerificationRun) -> HarnessVerificationRun:
        self._runs.append(run)
        profile = self._profiles.get(run.provider_key)
        if profile:
            profile.updated_at = self._now_iso()
            if run.mode == "verify":
                profile.last_verified_at = run.executed_at
                profile.last_verify_status = "ok" if run.success else "failed"
                profile.verify_success_count += 1 if run.success else 0
                profile.verify_failure_count += 0 if run.success else 1
            if run.mode == "probe":
                profile.last_probe_at = run.executed_at
                profile.last_probe_status = "ok" if run.success else "failed"
                profile.probe_success_count += 1 if run.success else 0
                profile.probe_failure_count += 0 if run.success else 1
            if run.error:
                profile.last_error = run.error
                profile.lifecycle_status = "degraded"
            elif profile.enabled:
                profile.lifecycle_status = "ready"
            self._flush_profiles()
        self._flush_runs()
        return run

    def list_runs(self, provider_key: str | None = None) -> list[HarnessVerificationRun]:
        runs = self._runs if provider_key is None else [item for item in self._runs if item.provider_key == provider_key]
        return sorted(runs, key=lambda item: item.executed_at, reverse=True)

    def export_snapshot(self) -> dict[str, Any]:
        return {
            "schema_version": _SCHEMA_VERSION,
            "storage_backend": "file",
            "profiles": [item.model_dump() for item in self.list_profiles()],
            "runs": [item.model_dump() for item in self.list_runs()[:100]],
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
        existing = None
        with self._session() as session:
            existing = session.get(HarnessProfileORM, profile.provider_key)
            if existing:
                prior = HarnessProfileRecord(**existing.payload)
                profile.created_at = prior.created_at
                profile.updated_at = self._now_iso()
                profile.last_verified_at = prior.last_verified_at
                profile.last_verify_status = prior.last_verify_status
                profile.last_probe_at = prior.last_probe_at
                profile.last_probe_status = prior.last_probe_status
                profile.last_sync_at = prior.last_sync_at
                profile.last_sync_status = prior.last_sync_status
                profile.last_sync_error = prior.last_sync_error
                profile.last_error = prior.last_error
                profile.verify_success_count = prior.verify_success_count
                profile.verify_failure_count = prior.verify_failure_count
                profile.probe_success_count = prior.probe_success_count
                profile.probe_failure_count = prior.probe_failure_count
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

            payload = profile.model_dump()
            if existing:
                existing.payload = payload
                existing.enabled = profile.enabled
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
        elif status == "ok":
            profile.lifecycle_status = "ready"
        return self.upsert_profile(profile)

    def record_run(self, run: HarnessVerificationRun) -> HarnessVerificationRun:
        with self._session() as session:
            session.add(
                HarnessRunORM(
                    provider_key=run.provider_key,
                    integration_class=run.integration_class,
                    mode=run.mode,
                    status=run.status,
                    success=run.success,
                    error=run.error,
                    executed_at=datetime.fromisoformat(run.executed_at),
                    payload=run.model_dump(),
                )
            )
            session.commit()

        profile = None
        try:
            profile = self.get_profile(run.provider_key)
        except ValueError:
            profile = None

        if profile:
            profile.updated_at = self._now_iso()
            if run.mode == "verify":
                profile.last_verified_at = run.executed_at
                profile.last_verify_status = "ok" if run.success else "failed"
                profile.verify_success_count += 1 if run.success else 0
                profile.verify_failure_count += 0 if run.success else 1
            if run.mode == "probe":
                profile.last_probe_at = run.executed_at
                profile.last_probe_status = "ok" if run.success else "failed"
                profile.probe_success_count += 1 if run.success else 0
                profile.probe_failure_count += 0 if run.success else 1
            if run.error:
                profile.last_error = run.error
                profile.lifecycle_status = "degraded"
            elif profile.enabled:
                profile.lifecycle_status = "ready"
            self.upsert_profile(profile)

        with self._session() as session:
            stale = session.scalars(select(HarnessRunORM).order_by(HarnessRunORM.executed_at.desc()).offset(1000)).all()
            for row in stale:
                session.delete(row)
            session.commit()
        return run

    def list_runs(self, provider_key: str | None = None) -> list[HarnessVerificationRun]:
        with self._session() as session:
            stmt = select(HarnessRunORM)
            if provider_key:
                stmt = stmt.where(HarnessRunORM.provider_key == provider_key)
            rows = session.scalars(stmt.order_by(HarnessRunORM.executed_at.desc())).all()
            return [HarnessVerificationRun(**row.payload) for row in rows]

    def export_snapshot(self) -> dict[str, Any]:
        return {
            "schema_version": _SCHEMA_VERSION,
            "storage_backend": "postgresql",
            "profiles": [item.model_dump() for item in self.list_profiles()],
            "runs": [item.model_dump() for item in self.list_runs()[:100]],
        }
