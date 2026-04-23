"""Service layer for top-level ForgeFrame instances."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from functools import lru_cache

from app.instances.models import InstanceRecord
from app.settings.config import Settings, get_settings
from app.storage.instance_repository import InstanceRepository, get_instance_repository
from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID, normalize_tenant_id

_SLUG_SANITIZER = re.compile(r"[^a-z0-9]+")


def _slugify(value: str) -> str:
    normalized = _SLUG_SANITIZER.sub("-", value.strip().lower()).strip("-")
    return normalized or "instance"


def _normalize_scope_value(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized or None


class InstanceService:
    def __init__(
        self,
        settings: Settings,
        repository: InstanceRepository | None = None,
    ):
        self._settings = settings
        self._repository = repository or get_instance_repository(settings)
        self._instances = self._repository.load_instances()
        if self._ensure_bootstrap_instance():
            self._persist()

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(tz=UTC).isoformat()

    def _persist(self) -> list[InstanceRecord]:
        self._instances = self._repository.save_instances(self._instances)
        return list(self._instances)

    def _default_instance_id(self) -> str:
        return normalize_tenant_id(self._settings.bootstrap_tenant_id)

    def _bootstrap_instance(self) -> InstanceRecord:
        now = self._now_iso()
        instance_id = self._default_instance_id()
        return InstanceRecord(
            instance_id=instance_id,
            slug=_slugify(instance_id),
            display_name="Default Instance",
            description="Bootstrap instance for the current ForgeFrame installation.",
            status="active",
            tenant_id=instance_id,
            company_id=instance_id,
            deployment_mode="restricted_eval",
            exposure_mode="local_only",
            is_default=True,
            metadata={"bootstrap": True},
            created_at=now,
            updated_at=now,
        )

    def _ensure_bootstrap_instance(self) -> bool:
        if not self._instances:
            self._instances = [self._bootstrap_instance()]
            return True

        changed = False
        default_id = self._default_instance_id()
        for index, instance in enumerate(self._instances):
            normalized = instance.model_copy(
                update={
                    "slug": _slugify(instance.slug or instance.instance_id),
                    "tenant_id": normalize_tenant_id(instance.tenant_id, fallback_tenant_id=default_id),
                    "company_id": _normalize_scope_value(instance.company_id) or instance.instance_id,
                }
            )
            if normalized.instance_id == default_id and not normalized.is_default:
                normalized = normalized.model_copy(update={"is_default": True})
            if normalized != instance:
                self._instances[index] = normalized
                changed = True

        if not any(item.is_default for item in self._instances):
            for index, instance in enumerate(self._instances):
                if instance.instance_id == default_id:
                    self._instances[index] = instance.model_copy(update={"is_default": True})
                    changed = True
                    break
            else:
                self._instances.append(self._bootstrap_instance())
                changed = True

        return changed

    def list_instances(self) -> list[InstanceRecord]:
        return list(self._instances)

    def get_instance(self, instance_id: str) -> InstanceRecord:
        normalized = _normalize_scope_value(instance_id)
        if normalized is None:
            raise ValueError("Instance ID is required.")
        for instance in self._instances:
            if instance.instance_id == normalized:
                return instance
        raise ValueError(f"Instance '{normalized}' was not found.")

    def _assert_unique(
        self,
        *,
        instance_id: str,
        slug: str,
        tenant_id: str,
        company_id: str,
        ignore_instance_id: str | None = None,
    ) -> None:
        for instance in self._instances:
            if ignore_instance_id is not None and instance.instance_id == ignore_instance_id:
                continue
            if instance.instance_id == instance_id:
                raise ValueError(f"Instance '{instance_id}' already exists.")
            if instance.slug == slug:
                raise ValueError(f"Instance slug '{slug}' already exists.")
            if instance.tenant_id == tenant_id:
                raise ValueError(f"Instance tenant scope '{tenant_id}' is already bound.")
            if instance.company_id == company_id:
                raise ValueError(f"Instance execution scope '{company_id}' is already bound.")

    def create_instance(
        self,
        *,
        instance_id: str | None,
        slug: str | None,
        display_name: str,
        description: str = "",
        tenant_id: str | None = None,
        company_id: str | None = None,
        status: str = "active",
        deployment_mode: str = "restricted_eval",
        exposure_mode: str = "local_only",
        metadata: dict[str, object] | None = None,
    ) -> InstanceRecord:
        normalized_display_name = display_name.strip()
        if not normalized_display_name:
            raise ValueError("Instance display name is required.")

        derived_instance_id = _normalize_scope_value(instance_id) or _slugify(normalized_display_name)
        normalized_slug = _slugify(slug or derived_instance_id)
        normalized_tenant_id = normalize_tenant_id(tenant_id, fallback_tenant_id=derived_instance_id)
        normalized_company_id = _normalize_scope_value(company_id) or derived_instance_id
        self._assert_unique(
            instance_id=derived_instance_id,
            slug=normalized_slug,
            tenant_id=normalized_tenant_id,
            company_id=normalized_company_id,
        )
        now = self._now_iso()
        record = InstanceRecord(
            instance_id=derived_instance_id,
            slug=normalized_slug,
            display_name=normalized_display_name,
            description=description.strip(),
            status="active" if status != "disabled" else "disabled",
            tenant_id=normalized_tenant_id,
            company_id=normalized_company_id,
            deployment_mode=deployment_mode,  # type: ignore[arg-type]
            exposure_mode=exposure_mode,  # type: ignore[arg-type]
            is_default=False,
            metadata=dict(metadata or {}),
            created_at=now,
            updated_at=now,
        )
        self._instances.append(record)
        self._persist()
        return record

    def update_instance(
        self,
        instance_id: str,
        *,
        slug: str | None = None,
        display_name: str | None = None,
        description: str | None = None,
        tenant_id: str | None = None,
        company_id: str | None = None,
        status: str | None = None,
        deployment_mode: str | None = None,
        exposure_mode: str | None = None,
        metadata: dict[str, object] | None = None,
    ) -> InstanceRecord:
        current = self.get_instance(instance_id)
        updated = current.model_copy(
            update={
                "slug": _slugify(slug or current.slug),
                "display_name": display_name.strip() if display_name is not None else current.display_name,
                "description": description.strip() if description is not None else current.description,
                "tenant_id": (
                    normalize_tenant_id(tenant_id, fallback_tenant_id=current.instance_id)
                    if tenant_id is not None
                    else current.tenant_id
                ),
                "company_id": (
                    _normalize_scope_value(company_id) or current.company_id
                    if company_id is not None
                    else current.company_id
                ),
                "status": "disabled" if status == "disabled" else "active" if status == "active" else current.status,
                "deployment_mode": deployment_mode or current.deployment_mode,
                "exposure_mode": exposure_mode or current.exposure_mode,
                "metadata": dict(metadata) if metadata is not None else current.metadata,
                "updated_at": self._now_iso(),
            }
        )
        self._assert_unique(
            instance_id=updated.instance_id,
            slug=updated.slug,
            tenant_id=updated.tenant_id,
            company_id=updated.company_id,
            ignore_instance_id=current.instance_id,
        )
        self._instances = [
            updated if item.instance_id == current.instance_id else item
            for item in self._instances
        ]
        self._persist()
        return updated

    def _legacy_backfill_instance(
        self,
        *,
        tenant_id: str | None = None,
        company_id: str | None = None,
    ) -> InstanceRecord:
        legacy_basis = _normalize_scope_value(company_id) or normalize_tenant_id(
            tenant_id,
            fallback_tenant_id=self._default_instance_id(),
        )
        display_name = f"Legacy scope {legacy_basis}"
        return self.create_instance(
            instance_id=legacy_basis,
            slug=_slugify(legacy_basis),
            display_name=display_name,
            description="Auto-created from legacy tenant/company scope during instance migration.",
            tenant_id=normalize_tenant_id(tenant_id, fallback_tenant_id=legacy_basis),
            company_id=_normalize_scope_value(company_id) or legacy_basis,
            deployment_mode="restricted_eval",
            exposure_mode="local_only",
            metadata={
                "migration_source": "legacy_scope_autoprovision",
                "legacy_company_id": _normalize_scope_value(company_id),
                "legacy_tenant_id": _normalize_scope_value(tenant_id),
            },
        )

    def resolve_instance(
        self,
        *,
        instance_id: str | None = None,
        tenant_id: str | None = None,
        company_id: str | None = None,
        allow_default: bool = True,
        allow_legacy_backfill: bool = True,
    ) -> InstanceRecord:
        normalized_instance_id = _normalize_scope_value(instance_id)
        normalized_tenant_id = _normalize_scope_value(tenant_id)
        normalized_company_id = _normalize_scope_value(company_id)

        if normalized_instance_id is not None:
            return self.get_instance(normalized_instance_id)

        if normalized_tenant_id is not None:
            resolved_tenant_id = normalize_tenant_id(
                normalized_tenant_id,
                fallback_tenant_id=self._default_instance_id(),
            )
            for instance in self._instances:
                if instance.tenant_id == resolved_tenant_id:
                    return instance
            if allow_legacy_backfill:
                return self._legacy_backfill_instance(tenant_id=resolved_tenant_id)

        if normalized_company_id is not None:
            for instance in self._instances:
                if instance.company_id == normalized_company_id:
                    return instance
            if allow_legacy_backfill:
                return self._legacy_backfill_instance(company_id=normalized_company_id)

        if allow_default:
            for instance in self._instances:
                if instance.is_default:
                    return instance
            return self._bootstrap_instance()

        raise ValueError("An explicit instance scope is required.")


@lru_cache(maxsize=1)
def get_instance_service() -> InstanceService:
    settings = get_settings()
    return InstanceService(settings)


def clear_instance_service_cache() -> None:
    get_instance_service.cache_clear()


__all__ = [
    "InstanceService",
    "clear_instance_service_cache",
    "get_instance_service",
]
