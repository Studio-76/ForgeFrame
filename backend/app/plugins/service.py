"""Service layer for plugin manifests and instance-scoped bindings."""

from __future__ import annotations

from datetime import UTC, datetime
from functools import lru_cache

from app.instances.models import InstanceRecord
from app.plugins.models import (
    CreatePluginManifest,
    InstancePluginBindingRecord,
    PluginCatalogEntry,
    PluginCatalogSummary,
    PluginManifestRecord,
    PluginRegistryStateRecord,
    UpdatePluginManifest,
    UpsertPluginBinding,
    normalize_identifier,
)
from app.settings.config import Settings, get_settings
from app.storage.plugin_repository import PluginRepository, get_plugin_repository


def _now_iso() -> str:
    return datetime.now(tz=UTC).isoformat()


def _normalize_registry_id(plugin_id: str | None, display_name: str) -> str:
    normalized = normalize_identifier(plugin_id or display_name)
    if not normalized:
        raise ValueError("Plugin ID is required.")
    return normalized


class PluginCatalogService:
    def __init__(
        self,
        settings: Settings,
        repository: PluginRepository | None = None,
    ) -> None:
        self._settings = settings
        self._repository = repository or get_plugin_repository(settings)
        self._state = self._repository.load_state()

    def _persist(self) -> PluginRegistryStateRecord:
        self._state = self._repository.save_state(self._state)
        return self._state

    def _manifest_map(self) -> dict[str, PluginManifestRecord]:
        return {manifest.plugin_id: manifest for manifest in self._state.manifests}

    def _binding_map_for_instance(self, instance: InstanceRecord) -> dict[str, InstancePluginBindingRecord]:
        bindings: dict[str, InstancePluginBindingRecord] = {}
        for binding in self._state.bindings:
            if binding.instance_id == instance.instance_id:
                bindings[binding.plugin_id] = binding
        return bindings

    def _bindings_for_plugin(self, plugin_id: str) -> list[InstancePluginBindingRecord]:
        return [binding for binding in self._state.bindings if binding.plugin_id == plugin_id]

    @staticmethod
    def _validate_config_against_schema(manifest: PluginManifestRecord, config: dict[str, object]) -> None:
        properties = manifest.config_schema.get("properties")
        if not isinstance(properties, dict):
            return
        unknown_keys = sorted(key for key in config if key not in properties)
        if unknown_keys:
            raise ValueError(
                "Plugin binding config contains keys not declared by the manifest schema: "
                + ", ".join(unknown_keys)
            )

    def _validate_manifest_contract(self, manifest: PluginManifestRecord) -> None:
        self._validate_config_against_schema(manifest, manifest.default_config)

    def _validate_existing_bindings_against_manifest(self, manifest: PluginManifestRecord) -> None:
        invalid_instances: list[str] = []
        for binding in self._bindings_for_plugin(manifest.plugin_id):
            try:
                self._validate_config_against_schema(manifest, binding.config)
                self._validate_binding_lists(
                    manifest,
                    enabled_capabilities=binding.enabled_capabilities,
                    enabled_ui_slots=binding.enabled_ui_slots,
                    enabled_api_mounts=binding.enabled_api_mounts,
                )
            except ValueError:
                invalid_instances.append(binding.instance_id)
        if invalid_instances:
            raise ValueError(
                "Manifest update would invalidate existing bindings for instances: "
                + ", ".join(sorted(dict.fromkeys(invalid_instances)))
            )

    @staticmethod
    def _validate_binding_lists(
        manifest: PluginManifestRecord,
        *,
        enabled_capabilities: list[str],
        enabled_ui_slots: list[str],
        enabled_api_mounts: list[str],
    ) -> None:
        manifest_capabilities = set(manifest.capabilities)
        manifest_ui_slots = set(manifest.ui_slots)
        manifest_api_mounts = set(manifest.api_mounts)

        invalid_capabilities = sorted(item for item in enabled_capabilities if item not in manifest_capabilities)
        invalid_ui_slots = sorted(item for item in enabled_ui_slots if item not in manifest_ui_slots)
        invalid_api_mounts = sorted(item for item in enabled_api_mounts if item not in manifest_api_mounts)
        if invalid_capabilities:
            raise ValueError(
                "Plugin binding references capabilities outside the manifest: "
                + ", ".join(invalid_capabilities)
            )
        if invalid_ui_slots:
            raise ValueError(
                "Plugin binding references UI slots outside the manifest: "
                + ", ".join(invalid_ui_slots)
            )
        if invalid_api_mounts:
            raise ValueError(
                "Plugin binding references API mounts outside the manifest: "
                + ", ".join(invalid_api_mounts)
            )

    @staticmethod
    def _status_summary(manifest: PluginManifestRecord, binding: InstancePluginBindingRecord | None) -> tuple[str, str]:
        if manifest.status != "active":
            return "disabled", "Manifest disabled in the registry."
        if binding is None:
            return "available", "Registered but not yet activated for this instance."
        if not binding.enabled:
            return "disabled", "Binding persisted for this instance but currently disabled."
        return "enabled", "Enabled for this instance with persisted binding and config."

    @staticmethod
    def _effective_config(manifest: PluginManifestRecord, binding: InstancePluginBindingRecord | None) -> dict[str, object]:
        merged = dict(manifest.default_config)
        if binding is not None:
            merged.update(binding.config)
        return merged

    def _catalog_entry(
        self,
        manifest: PluginManifestRecord,
        binding: InstancePluginBindingRecord | None,
    ) -> PluginCatalogEntry:
        effective_status, status_summary = self._status_summary(manifest, binding)
        return PluginCatalogEntry(
            plugin_id=manifest.plugin_id,
            display_name=manifest.display_name,
            summary=manifest.summary,
            vendor=manifest.vendor,
            version=manifest.version,
            status=manifest.status,
            capabilities=list(manifest.capabilities),
            ui_slots=list(manifest.ui_slots),
            api_mounts=list(manifest.api_mounts),
            runtime_surfaces=list(manifest.runtime_surfaces),
            config_schema=dict(manifest.config_schema),
            default_config=dict(manifest.default_config),
            security_posture=manifest.security_posture,
            metadata=dict(manifest.metadata),
            binding=binding,
            effective_status=effective_status,  # type: ignore[arg-type]
            status_summary=status_summary,
            effective_config=self._effective_config(manifest, binding),
            created_at=manifest.created_at,
            updated_at=max([manifest.updated_at, binding.updated_at] if binding is not None else [manifest.updated_at]),
        )

    def _summary(self, entries: list[PluginCatalogEntry]) -> PluginCatalogSummary:
        capability_keys: list[str] = []
        ui_slots: list[str] = []
        api_mounts: list[str] = []
        seen_capabilities: set[str] = set()
        seen_ui_slots: set[str] = set()
        seen_api_mounts: set[str] = set()
        for entry in entries:
            for capability in entry.capabilities:
                if capability not in seen_capabilities:
                    seen_capabilities.add(capability)
                    capability_keys.append(capability)
            for slot in entry.ui_slots:
                if slot not in seen_ui_slots:
                    seen_ui_slots.add(slot)
                    ui_slots.append(slot)
            for mount in entry.api_mounts:
                if mount not in seen_api_mounts:
                    seen_api_mounts.add(mount)
                    api_mounts.append(mount)

        return PluginCatalogSummary(
            registered_plugins=len(entries),
            active_plugins=sum(1 for entry in entries if entry.status == "active"),
            disabled_plugins=sum(1 for entry in entries if entry.status == "disabled"),
            bound_plugins=sum(1 for entry in entries if entry.binding is not None),
            enabled_bindings=sum(1 for entry in entries if entry.binding is not None and entry.binding.enabled and entry.status == "active"),
            capability_keys=capability_keys,
            ui_slots=ui_slots,
            api_mounts=api_mounts,
        )

    def list_plugins(self, *, instance: InstanceRecord) -> tuple[list[PluginCatalogEntry], PluginCatalogSummary]:
        manifest_map = self._manifest_map()
        binding_map = self._binding_map_for_instance(instance)
        entries = [
            self._catalog_entry(manifest, binding_map.get(manifest.plugin_id))
            for manifest in sorted(manifest_map.values(), key=lambda item: item.display_name.lower())
        ]
        return entries, self._summary(entries)

    def get_plugin(self, *, instance: InstanceRecord, plugin_id: str) -> PluginCatalogEntry:
        manifest = self._manifest_map().get(normalize_identifier(plugin_id))
        if manifest is None:
            raise ValueError(f"Plugin '{plugin_id}' was not found.")
        binding = self._binding_map_for_instance(instance).get(manifest.plugin_id)
        return self._catalog_entry(manifest, binding)

    def create_plugin(self, payload: CreatePluginManifest) -> PluginCatalogEntry:
        plugin_id = _normalize_registry_id(payload.plugin_id, payload.display_name)
        manifest_map = self._manifest_map()
        if plugin_id in manifest_map:
            raise ValueError(f"Plugin '{plugin_id}' already exists.")
        now = _now_iso()
        manifest = PluginManifestRecord(
            plugin_id=plugin_id,
            display_name=payload.display_name.strip(),
            summary=payload.summary.strip(),
            vendor=payload.vendor.strip(),
            version=payload.version.strip(),
            status=payload.status,
            capabilities=payload.capabilities,
            ui_slots=payload.ui_slots,
            api_mounts=payload.api_mounts,
            runtime_surfaces=payload.runtime_surfaces,
            config_schema=dict(payload.config_schema),
            default_config=dict(payload.default_config),
            security_posture=payload.security_posture,
            metadata=dict(payload.metadata),
            created_at=now,
            updated_at=now,
        )
        self._validate_manifest_contract(manifest)
        self._state.manifests.append(manifest)
        self._persist()
        return self._catalog_entry(manifest, None)

    def update_plugin(self, plugin_id: str, payload: UpdatePluginManifest) -> PluginCatalogEntry:
        normalized_plugin_id = normalize_identifier(plugin_id)
        for index, manifest in enumerate(self._state.manifests):
            if manifest.plugin_id != normalized_plugin_id:
                continue
            updated = manifest.model_copy(
                update={
                    "display_name": payload.display_name.strip() if payload.display_name is not None else manifest.display_name,
                    "summary": payload.summary.strip() if payload.summary is not None else manifest.summary,
                    "vendor": payload.vendor.strip() if payload.vendor is not None else manifest.vendor,
                    "version": payload.version.strip() if payload.version is not None else manifest.version,
                    "status": payload.status or manifest.status,
                    "capabilities": list(payload.capabilities) if payload.capabilities is not None else list(manifest.capabilities),
                    "ui_slots": list(payload.ui_slots) if payload.ui_slots is not None else list(manifest.ui_slots),
                    "api_mounts": list(payload.api_mounts) if payload.api_mounts is not None else list(manifest.api_mounts),
                    "runtime_surfaces": list(payload.runtime_surfaces) if payload.runtime_surfaces is not None else list(manifest.runtime_surfaces),
                    "config_schema": dict(payload.config_schema) if payload.config_schema is not None else dict(manifest.config_schema),
                    "default_config": dict(payload.default_config) if payload.default_config is not None else dict(manifest.default_config),
                    "security_posture": payload.security_posture or manifest.security_posture,
                    "metadata": dict(payload.metadata) if payload.metadata is not None else dict(manifest.metadata),
                    "updated_at": _now_iso(),
                }
            )
            self._validate_manifest_contract(updated)
            self._validate_existing_bindings_against_manifest(updated)
            self._state.manifests[index] = updated
            self._persist()
            return self._catalog_entry(updated, None)
        raise ValueError(f"Plugin '{plugin_id}' was not found.")

    def upsert_binding(
        self,
        *,
        instance: InstanceRecord,
        plugin_id: str,
        payload: UpsertPluginBinding,
    ) -> PluginCatalogEntry:
        manifest = self._manifest_map().get(normalize_identifier(plugin_id))
        if manifest is None:
            raise ValueError(f"Plugin '{plugin_id}' was not found.")

        enabled_capabilities = list(payload.enabled_capabilities) if payload.enabled_capabilities is not None else list(manifest.capabilities)
        enabled_ui_slots = list(payload.enabled_ui_slots) if payload.enabled_ui_slots is not None else list(manifest.ui_slots)
        enabled_api_mounts = list(payload.enabled_api_mounts) if payload.enabled_api_mounts is not None else list(manifest.api_mounts)

        self._validate_config_against_schema(manifest, payload.config)
        self._validate_binding_lists(
            manifest,
            enabled_capabilities=enabled_capabilities,
            enabled_ui_slots=enabled_ui_slots,
            enabled_api_mounts=enabled_api_mounts,
        )

        now = _now_iso()
        for index, binding in enumerate(self._state.bindings):
            if binding.instance_id != instance.instance_id or binding.plugin_id != manifest.plugin_id:
                continue
            updated = binding.model_copy(
                update={
                    "company_id": instance.company_id,
                    "enabled": payload.enabled,
                    "config": dict(payload.config),
                    "enabled_capabilities": enabled_capabilities,
                    "enabled_ui_slots": enabled_ui_slots,
                    "enabled_api_mounts": enabled_api_mounts,
                    "notes": payload.notes.strip(),
                    "updated_at": now,
                }
            )
            self._state.bindings[index] = updated
            self._persist()
            return self._catalog_entry(manifest, updated)

        created = InstancePluginBindingRecord(
            plugin_id=manifest.plugin_id,
            instance_id=instance.instance_id,
            company_id=instance.company_id,
            enabled=payload.enabled,
            config=dict(payload.config),
            enabled_capabilities=enabled_capabilities,
            enabled_ui_slots=enabled_ui_slots,
            enabled_api_mounts=enabled_api_mounts,
            notes=payload.notes.strip(),
            created_at=now,
            updated_at=now,
        )
        self._state.bindings.append(created)
        self._persist()
        return self._catalog_entry(manifest, created)


@lru_cache(maxsize=1)
def get_plugin_catalog_service() -> PluginCatalogService:
    settings = get_settings()
    return PluginCatalogService(settings)


def clear_plugin_catalog_service_cache() -> None:
    get_plugin_catalog_service.cache_clear()


__all__ = [
    "PluginCatalogService",
    "clear_plugin_catalog_service_cache",
    "get_plugin_catalog_service",
]
