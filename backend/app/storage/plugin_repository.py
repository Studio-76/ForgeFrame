"""Persistent substrate for plugin manifests and instance bindings."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, JSON, String, Text, create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Session, mapped_column, sessionmaker

from app.plugins.models import InstancePluginBindingRecord, PluginManifestRecord, PluginRegistryStateRecord
from app.settings.config import Settings
from app.storage.harness_repository import Base

_PLUGIN_STATE_SCHEMA_VERSION = 1


class PluginManifestORM(Base):
    __tablename__ = "plugin_manifests"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'disabled')", name="plugin_manifests_status_ck"),
    )

    plugin_id: Mapped[str] = mapped_column(String(191), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(191), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    vendor: Mapped[str] = mapped_column(String(191), nullable=False, default="customer")
    version: Mapped[str] = mapped_column(String(64), nullable=False, default="0.1.0")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    capabilities_json: Mapped[list[str]] = mapped_column(
        "capabilities",
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
    )
    ui_slots_json: Mapped[list[str]] = mapped_column(
        "ui_slots",
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
    )
    api_mounts_json: Mapped[list[str]] = mapped_column(
        "api_mounts",
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
    )
    runtime_surfaces_json: Mapped[list[str]] = mapped_column(
        "runtime_surfaces",
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
    )
    config_schema_json: Mapped[dict[str, Any]] = mapped_column(
        "config_schema",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    default_config_json: Mapped[dict[str, Any]] = mapped_column(
        "default_config",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    security_posture_json: Mapped[dict[str, Any]] = mapped_column(
        "security_posture",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class InstancePluginBindingORM(Base):
    __tablename__ = "instance_plugin_bindings"
    __table_args__ = (
        Index("instance_plugin_bindings_instance_plugin_uq", "instance_id", "plugin_id", unique=True),
        Index("instance_plugin_bindings_company_plugin_idx", "company_id", "plugin_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plugin_id: Mapped[str] = mapped_column(ForeignKey("plugin_manifests.plugin_id", ondelete="CASCADE"), nullable=False, index=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False, index=True)
    company_id: Mapped[str] = mapped_column(String(191), nullable=False, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    config_json: Mapped[dict[str, Any]] = mapped_column(
        "config",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    enabled_capabilities_json: Mapped[list[str]] = mapped_column(
        "enabled_capabilities",
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
    )
    enabled_ui_slots_json: Mapped[list[str]] = mapped_column(
        "enabled_ui_slots",
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
    )
    enabled_api_mounts_json: Mapped[list[str]] = mapped_column(
        "enabled_api_mounts",
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
    )
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


@dataclass(frozen=True)
class PluginStatePaths:
    state_path: Path


class PluginRepository(Protocol):
    def load_state(self) -> PluginRegistryStateRecord: ...

    def save_state(self, state: PluginRegistryStateRecord) -> PluginRegistryStateRecord: ...


def _plugin_state_path(settings: Settings) -> Path:
    state_path = Path(settings.instances_state_path)
    return state_path.with_name("plugins_state.json")


class FilePluginRepository:
    def __init__(self, *, paths: PluginStatePaths):
        self._paths = paths

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(tz=UTC).isoformat()

    def load_state(self) -> PluginRegistryStateRecord:
        path = self._paths.state_path
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            return PluginRegistryStateRecord()
        try:
            raw = path.read_text(encoding="utf-8")
            if not raw.strip():
                return PluginRegistryStateRecord()
            payload = json.loads(raw)
            return PluginRegistryStateRecord.model_validate(payload)
        except (OSError, json.JSONDecodeError, ValueError):
            backup = path.with_suffix(path.suffix + ".corrupt")
            try:
                path.replace(backup)
            except OSError:
                pass
            return PluginRegistryStateRecord()

    def save_state(self, state: PluginRegistryStateRecord) -> PluginRegistryStateRecord:
        normalized = state.model_copy(
            update={
                "schema_version": _PLUGIN_STATE_SCHEMA_VERSION,
                "updated_at": self._now_iso(),
            }
        )
        path = self._paths.state_path
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(normalized.model_dump(mode="json"), indent=2) + "\n", encoding="utf-8")
        tmp.replace(path)
        return normalized


class PostgresPluginRepository:
    def __init__(self, database_url: str):
        if not database_url.startswith("postgresql"):
            raise ValueError("Plugin PostgreSQL backend requires a postgresql:// URL.")
        self._engine = create_engine(database_url, pool_pre_ping=True)
        Base.metadata.create_all(self._engine)
        self._session_factory = sessionmaker(self._engine, autoflush=False, expire_on_commit=False)

    def _session(self) -> Session:
        return self._session_factory()

    @staticmethod
    def _manifest_from_row(row: PluginManifestORM) -> PluginManifestRecord:
        return PluginManifestRecord(
            plugin_id=row.plugin_id,
            display_name=row.display_name,
            summary=row.summary,
            vendor=row.vendor,
            version=row.version,
            status=row.status,  # type: ignore[arg-type]
            capabilities=list(row.capabilities_json or []),
            ui_slots=list(row.ui_slots_json or []),
            api_mounts=list(row.api_mounts_json or []),
            runtime_surfaces=list(row.runtime_surfaces_json or []),
            config_schema=dict(row.config_schema_json or {}),
            default_config=dict(row.default_config_json or {}),
            security_posture=dict(row.security_posture_json or {}),
            metadata=dict(row.metadata_json or {}),
            created_at=row.created_at.isoformat(),
            updated_at=row.updated_at.isoformat(),
        )

    @staticmethod
    def _binding_from_row(row: InstancePluginBindingORM) -> InstancePluginBindingRecord:
        return InstancePluginBindingRecord(
            plugin_id=row.plugin_id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            enabled=row.enabled,
            config=dict(row.config_json or {}),
            enabled_capabilities=list(row.enabled_capabilities_json or []),
            enabled_ui_slots=list(row.enabled_ui_slots_json or []),
            enabled_api_mounts=list(row.enabled_api_mounts_json or []),
            notes=row.notes,
            created_at=row.created_at.isoformat(),
            updated_at=row.updated_at.isoformat(),
        )

    def load_state(self) -> PluginRegistryStateRecord:
        with self._session() as session:
            manifests = session.execute(select(PluginManifestORM).order_by(PluginManifestORM.created_at.asc())).scalars().all()
            bindings = session.execute(
                select(InstancePluginBindingORM).order_by(InstancePluginBindingORM.instance_id.asc(), InstancePluginBindingORM.plugin_id.asc())
            ).scalars().all()
            updated_at = ""
            timestamps = [
                *[item.updated_at.isoformat() for item in manifests],
                *[item.updated_at.isoformat() for item in bindings],
            ]
            if timestamps:
                updated_at = max(timestamps)
            return PluginRegistryStateRecord(
                schema_version=_PLUGIN_STATE_SCHEMA_VERSION,
                manifests=[self._manifest_from_row(item) for item in manifests],
                bindings=[self._binding_from_row(item) for item in bindings],
                updated_at=updated_at,
            )

    def save_state(self, state: PluginRegistryStateRecord) -> PluginRegistryStateRecord:
        normalized = state.model_copy(update={"schema_version": _PLUGIN_STATE_SCHEMA_VERSION})
        with self._session() as session:
            existing_manifests = {
                row.plugin_id: row
                for row in session.execute(select(PluginManifestORM)).scalars().all()
            }
            existing_bindings = {
                (row.instance_id, row.plugin_id): row
                for row in session.execute(select(InstancePluginBindingORM)).scalars().all()
            }

            incoming_manifest_ids = {item.plugin_id for item in normalized.manifests}
            for stale_id in set(existing_manifests) - incoming_manifest_ids:
                session.delete(existing_manifests[stale_id])

            incoming_binding_keys = {(item.instance_id, item.plugin_id) for item in normalized.bindings}
            for stale_key in set(existing_bindings) - incoming_binding_keys:
                session.delete(existing_bindings[stale_key])

            for manifest in normalized.manifests:
                row = existing_manifests.get(manifest.plugin_id)
                created_at = datetime.fromisoformat(manifest.created_at)
                updated_at = datetime.fromisoformat(manifest.updated_at)
                if row is None:
                    session.add(
                        PluginManifestORM(
                            plugin_id=manifest.plugin_id,
                            display_name=manifest.display_name,
                            summary=manifest.summary,
                            vendor=manifest.vendor,
                            version=manifest.version,
                            status=manifest.status,
                            capabilities_json=list(manifest.capabilities),
                            ui_slots_json=list(manifest.ui_slots),
                            api_mounts_json=list(manifest.api_mounts),
                            runtime_surfaces_json=list(manifest.runtime_surfaces),
                            config_schema_json=dict(manifest.config_schema),
                            default_config_json=dict(manifest.default_config),
                            security_posture_json=manifest.security_posture.model_dump(mode="json"),
                            metadata_json=dict(manifest.metadata),
                            created_at=created_at,
                            updated_at=updated_at,
                        )
                    )
                    continue
                row.display_name = manifest.display_name
                row.summary = manifest.summary
                row.vendor = manifest.vendor
                row.version = manifest.version
                row.status = manifest.status
                row.capabilities_json = list(manifest.capabilities)
                row.ui_slots_json = list(manifest.ui_slots)
                row.api_mounts_json = list(manifest.api_mounts)
                row.runtime_surfaces_json = list(manifest.runtime_surfaces)
                row.config_schema_json = dict(manifest.config_schema)
                row.default_config_json = dict(manifest.default_config)
                row.security_posture_json = manifest.security_posture.model_dump(mode="json")
                row.metadata_json = dict(manifest.metadata)
                row.created_at = created_at
                row.updated_at = updated_at

            for binding in normalized.bindings:
                row = existing_bindings.get((binding.instance_id, binding.plugin_id))
                created_at = datetime.fromisoformat(binding.created_at)
                updated_at = datetime.fromisoformat(binding.updated_at)
                if row is None:
                    session.add(
                        InstancePluginBindingORM(
                            plugin_id=binding.plugin_id,
                            instance_id=binding.instance_id,
                            company_id=binding.company_id,
                            enabled=binding.enabled,
                            config_json=dict(binding.config),
                            enabled_capabilities_json=list(binding.enabled_capabilities),
                            enabled_ui_slots_json=list(binding.enabled_ui_slots),
                            enabled_api_mounts_json=list(binding.enabled_api_mounts),
                            notes=binding.notes,
                            created_at=created_at,
                            updated_at=updated_at,
                        )
                    )
                    continue
                row.company_id = binding.company_id
                row.enabled = binding.enabled
                row.config_json = dict(binding.config)
                row.enabled_capabilities_json = list(binding.enabled_capabilities)
                row.enabled_ui_slots_json = list(binding.enabled_ui_slots)
                row.enabled_api_mounts_json = list(binding.enabled_api_mounts)
                row.notes = binding.notes
                row.created_at = created_at
                row.updated_at = updated_at

            session.commit()

        return normalized.model_copy(update={"updated_at": datetime.now(tz=UTC).isoformat()})


def get_plugin_repository(settings: Settings) -> PluginRepository:
    if settings.instances_storage_backend == "postgresql":
        database_url = (
            settings.instances_postgres_url.strip()
            or settings.governance_postgres_url.strip()
            or settings.harness_postgres_url.strip()
        )
        return PostgresPluginRepository(database_url)
    return FilePluginRepository(paths=PluginStatePaths(state_path=_plugin_state_path(settings)))


__all__ = [
    "FilePluginRepository",
    "InstancePluginBindingORM",
    "PluginManifestORM",
    "PluginRepository",
    "PluginStatePaths",
    "PostgresPluginRepository",
    "get_plugin_repository",
]
