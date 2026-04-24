"""Storage repositories for persistent control-plane state."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

from sqlalchemy import JSON, DateTime, String, create_engine, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Session, mapped_column, sessionmaker

from app.control_plane.models import (
    ControlPlaneStateRecord,
    ManagedModelRecord,
    ProviderCatalogRecord,
    ManagedProviderRecord,
    ManagedProviderTargetRecord,
    RoutingBudgetStateRecord,
    RoutingCircuitStateRecord,
    RoutingPolicyRecord,
)
from app.control_plane.profile_taxonomy import build_legacy_capability_profile, split_legacy_capability_profile
from app.control_plane.routing_defaults import (
    build_default_routing_policies,
    merge_routing_circuits,
    merge_routing_policies,
    normalize_routing_budget_state,
)
from app.control_plane.target_defaults import (
    build_default_targets_from_providers,
    ensure_model_registry_metadata,
)
from app.settings.config import Settings
from app.storage.harness_repository import Base
from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID, normalize_tenant_id

_CONTROL_PLANE_STATE_SCHEMA_VERSION = 6
_LEGACY_STATE_KEY = "default"


class ControlPlaneStateORM(Base):
    __tablename__ = "instance_control_plane_state"

    instance_id: Mapped[str] = mapped_column(String(191), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(tz=UTC), nullable=False)


@dataclass(frozen=True)
class ControlPlaneStatePaths:
    state_path: Path


class ControlPlaneStateRepository(Protocol):
    def load_state(self, instance_id: str | None = None) -> ControlPlaneStateRecord | None: ...

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

        providers = normalized.get("providers", [])
        if isinstance(providers, list):
            for provider in providers:
                if not isinstance(provider, dict):
                    continue
                provider_label = str(provider.get("label") or provider.get("provider") or "")
                provider_name = str(provider.get("provider") or "")
                for model in provider.get("managed_models", []):
                    if not isinstance(model, dict):
                        continue
                    upgraded = ensure_model_registry_metadata(
                        model=ManagedModelRecord(**model),
                        provider_label=provider_label or provider_name,
                        provider_name=provider_name,
                    )
                    upgraded_payload = upgraded.model_dump(mode="json")
                    if upgraded_payload != model:
                        model.clear()
                        model.update(upgraded_payload)
                        changed = True

        if version < 3 or "provider_targets" not in normalized:
            provider_records = []
            for provider in providers if isinstance(providers, list) else []:
                if not isinstance(provider, dict):
                    continue
                try:
                    provider_records.append(ManagedProviderRecord(**provider))
                except Exception:
                    continue
            normalized["provider_targets"] = [
                target.model_dump(mode="json")
                for target in build_default_targets_from_providers(
                    provider_records,
                    instance_id=normalized.get("instance_id") or DEFAULT_BOOTSTRAP_TENANT_ID,
                )
            ]
            normalized["schema_version"] = _CONTROL_PLANE_STATE_SCHEMA_VERSION
            changed = True

        if version < 4 or any(
            key not in normalized
            for key in ("routing_policies", "routing_budget_state", "routing_circuits", "routing_decisions")
        ):
            target_records: list[ManagedProviderTargetRecord] = []
            for raw_target in normalized.get("provider_targets", []):
                if not isinstance(raw_target, dict):
                    continue
                try:
                    target_records.append(ManagedProviderTargetRecord(**raw_target))
                except Exception:
                    continue
            available_target_keys = [target.target_key for target in target_records]
            default_policies = build_default_routing_policies(target_records)
            stored_policies = []
            for raw_policy in normalized.get("routing_policies", []) or []:
                if not isinstance(raw_policy, dict):
                    continue
                try:
                    stored_policies.append(RoutingPolicyRecord(**raw_policy))
                except Exception:
                    continue
            normalized["routing_policies"] = [
                policy.model_dump(mode="json")
                for policy in merge_routing_policies(
                    default_policies,
                    stored_policies,
                    available_target_keys=available_target_keys,
                )
            ]
            try:
                budget_state = RoutingBudgetStateRecord(**dict(normalized.get("routing_budget_state") or {}))
            except Exception:
                budget_state = RoutingBudgetStateRecord()
            normalized["routing_budget_state"] = normalize_routing_budget_state(budget_state).model_dump(mode="json")
            stored_circuits: list[RoutingCircuitStateRecord] = []
            for raw_circuit in normalized.get("routing_circuits", []) or []:
                if not isinstance(raw_circuit, dict):
                    continue
                try:
                    stored_circuits.append(RoutingCircuitStateRecord(**raw_circuit))
                except Exception:
                    continue
            normalized["routing_circuits"] = [
                circuit.model_dump(mode="json")
                for circuit in merge_routing_circuits(
                    stored_circuits,
                    available_target_keys=available_target_keys,
                )
            ]
            if not isinstance(normalized.get("routing_decisions"), list):
                normalized["routing_decisions"] = []
            normalized["schema_version"] = _CONTROL_PLANE_STATE_SCHEMA_VERSION
            changed = True

        if version < 5:
            for provider in normalized.get("providers", []):
                if not isinstance(provider, dict):
                    continue
                provider_name = str(provider.get("provider") or "")
                for model in provider.get("managed_models", []):
                    if not isinstance(model, dict):
                        continue
                    technical_capabilities, execution_traits, policy_flags, economic_profile = split_legacy_capability_profile(
                        provider=provider_name,
                        capability_profile=model.get("capabilities") if isinstance(model.get("capabilities"), dict) else {},
                    )
                    if "capabilities" not in model or not isinstance(model.get("capabilities"), dict):
                        model["capabilities"] = technical_capabilities
                    if "execution_traits" not in model:
                        model["execution_traits"] = execution_traits
                    if "policy_flags" not in model:
                        model["policy_flags"] = policy_flags
                    if "economic_profile" not in model:
                        model["economic_profile"] = economic_profile
                    changed = True

            for target in normalized.get("provider_targets", []):
                if not isinstance(target, dict):
                    continue
                provider_name = str(target.get("provider") or "")
                technical_capabilities, execution_traits, policy_flags, economic_profile = split_legacy_capability_profile(
                    provider=provider_name,
                    capability_profile=target.get("capability_profile") if isinstance(target.get("capability_profile"), dict) else {},
                    cost_class=str(target.get("cost_class") or "medium"),
                    latency_class=str(target.get("latency_class") or "medium"),
                )
                if "technical_capabilities" not in target:
                    target["technical_capabilities"] = technical_capabilities
                if "execution_traits" not in target:
                    target["execution_traits"] = execution_traits
                if "policy_flags" not in target:
                    target["policy_flags"] = policy_flags
                if "economic_profile" not in target:
                    target["economic_profile"] = economic_profile
                if "capability_profile" not in target or not isinstance(target.get("capability_profile"), dict):
                    target["capability_profile"] = build_legacy_capability_profile(
                        technical_capabilities=technical_capabilities,
                        execution_traits=execution_traits,
                    )
                changed = True

            normalized["schema_version"] = _CONTROL_PLANE_STATE_SCHEMA_VERSION

        if version < 6 or "provider_catalog" not in normalized:
            stored_catalog: list[ProviderCatalogRecord] = []
            for raw_catalog in normalized.get("provider_catalog", []) or []:
                if not isinstance(raw_catalog, dict):
                    continue
                try:
                    stored_catalog.append(ProviderCatalogRecord(**raw_catalog))
                except Exception:
                    continue
            normalized["provider_catalog"] = [
                item.model_dump(mode="json")
                for item in stored_catalog
            ]
            normalized["schema_version"] = _CONTROL_PLANE_STATE_SCHEMA_VERSION
            changed = True

        if "updated_at" not in normalized:
            normalized["updated_at"] = ""
            changed = True

        if not normalized.get("instance_id"):
            normalized["instance_id"] = DEFAULT_BOOTSTRAP_TENANT_ID
            changed = True

        return normalized, changed

    @staticmethod
    def _normalize_instance_id(instance_id: str | None) -> str:
        return normalize_tenant_id(instance_id, fallback_tenant_id=DEFAULT_BOOTSTRAP_TENANT_ID)

    def _load_state_map(self) -> tuple[dict[str, dict[str, Any]], bool]:
        path = self._paths.state_path
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            return {}, False
        raw = path.read_text(encoding="utf-8")
        if not raw.strip():
            return {}, False
        payload = json.loads(raw)
        if isinstance(payload, dict) and "states" in payload:
            normalized_states: dict[str, dict[str, Any]] = {}
            changed = False
            raw_states = payload.get("states") or {}
            if isinstance(raw_states, dict):
                for key, state_payload in raw_states.items():
                    if not isinstance(state_payload, dict):
                        continue
                    upgraded_state, upgraded_changed = self._upgrade_payload(state_payload)
                    upgraded_key = self._normalize_instance_id(
                        upgraded_state.get("instance_id") or key
                    )
                    upgraded_state["instance_id"] = upgraded_key
                    normalized_states[upgraded_key] = upgraded_state
                    changed = changed or upgraded_changed or upgraded_key != key
            return normalized_states, changed

        if isinstance(payload, dict):
            upgraded_state, changed = self._upgrade_payload(payload)
            instance_id = self._normalize_instance_id(upgraded_state.get("instance_id"))
            upgraded_state["instance_id"] = instance_id
            return {instance_id: upgraded_state}, True
        return {}, False

    def load_state(self, instance_id: str | None = None) -> ControlPlaneStateRecord | None:
        path = self._paths.state_path
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            return None
        try:
            state_map, changed = self._load_state_map()
            normalized_instance_id = self._normalize_instance_id(instance_id)
            payload = state_map.get(normalized_instance_id)
            if payload is None:
                return None
            state = ControlPlaneStateRecord(**payload)
            if changed:
                self.save_state(state)
                return self.load_state(normalized_instance_id)
            return state
        except (OSError, json.JSONDecodeError, ValueError):
            backup = path.with_suffix(path.suffix + ".corrupt")
            try:
                path.replace(backup)
            except OSError:
                pass
            return None

    def save_state(self, state: ControlPlaneStateRecord) -> ControlPlaneStateRecord:
        normalized_instance_id = self._normalize_instance_id(state.instance_id)
        normalized = state.model_copy(
            update={
                "instance_id": normalized_instance_id,
                "updated_at": self._now_iso(),
            }
        )
        state_map, _ = self._load_state_map()
        state_map[normalized_instance_id] = normalized.model_dump(mode="json")
        path = self._paths.state_path
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(
            json.dumps(
                {
                    "schema_version": _CONTROL_PLANE_STATE_SCHEMA_VERSION,
                    "states": state_map,
                    "updated_at": self._now_iso(),
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
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

    @staticmethod
    def _normalize_instance_id(instance_id: str | None) -> str:
        return normalize_tenant_id(instance_id, fallback_tenant_id=DEFAULT_BOOTSTRAP_TENANT_ID)

    def _load_legacy_default_state(self, session: Session) -> ControlPlaneStateRecord | None:
        row = session.execute(
            text(
                """
                SELECT payload
                FROM control_plane_state
                WHERE state_key = :state_key
                """
            ),
            {"state_key": _LEGACY_STATE_KEY},
        ).first()
        if row is None:
            return None
        payload = dict(row[0] or {})
        upgraded_payload, _ = FileControlPlaneStateRepository._upgrade_payload(payload)
        upgraded_payload["instance_id"] = DEFAULT_BOOTSTRAP_TENANT_ID
        state = ControlPlaneStateRecord(**upgraded_payload)
        self.save_state(state)
        return state

    def load_state(self, instance_id: str | None = None) -> ControlPlaneStateRecord | None:
        normalized_instance_id = self._normalize_instance_id(instance_id)
        with self._session() as session:
            row = session.get(ControlPlaneStateORM, normalized_instance_id)
            if not row:
                if normalized_instance_id == DEFAULT_BOOTSTRAP_TENANT_ID:
                    return self._load_legacy_default_state(session)
                return None
            payload, changed = FileControlPlaneStateRepository._upgrade_payload(row.payload)
            payload["instance_id"] = normalized_instance_id
            state = ControlPlaneStateRecord(**payload)
            if changed:
                row.payload = state.model_dump()
                row.updated_at = self._now()
                session.commit()
            return state

    def save_state(self, state: ControlPlaneStateRecord) -> ControlPlaneStateRecord:
        normalized_instance_id = self._normalize_instance_id(state.instance_id)
        normalized = state.model_copy(
            update={
                "instance_id": normalized_instance_id,
                "updated_at": self._now().isoformat(),
            }
        )
        with self._session() as session:
            row = session.get(ControlPlaneStateORM, normalized_instance_id)
            payload = normalized.model_dump()
            if row:
                row.payload = payload
                row.updated_at = self._now()
            else:
                session.add(
                    ControlPlaneStateORM(
                        instance_id=normalized_instance_id,
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
