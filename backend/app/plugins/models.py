"""Plugin registry and instance-binding models."""

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

PLUGIN_MANIFEST_STATUSES = ("active", "disabled")
PLUGIN_EFFECTIVE_STATUSES = ("available", "enabled", "disabled")
ADMIN_ROLE_VALUES = ("viewer", "operator", "admin", "owner")

PluginManifestStatus = Literal["active", "disabled"]
PluginEffectiveStatus = Literal["available", "enabled", "disabled"]
AdminRoleValue = Literal["viewer", "operator", "admin", "owner"]

_IDENTIFIER_SANITIZER = re.compile(r"[^a-z0-9._-]+")


def normalize_identifier(value: str) -> str:
    normalized = _IDENTIFIER_SANITIZER.sub("-", value.strip().lower()).strip("-")
    return normalized


def _normalize_unique_strings(values: list[str] | tuple[str, ...] | None) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for value in values or []:
        item = str(value).strip()
        if not item or item in seen:
            continue
        normalized.append(item)
        seen.add(item)
    return normalized


def _coerce_string_list(value: object, *, field_label: str, allow_none: bool) -> list[str] | None:
    if value is None:
        return None if allow_none else []
    if not isinstance(value, (list, tuple)):
        raise ValueError(f"{field_label} must be an array of strings.")
    return _normalize_unique_strings(value)


class PluginSecurityPosture(BaseModel):
    allowed_roles: list[AdminRoleValue] = Field(default_factory=lambda: ["admin", "owner"])
    admin_approval_required: bool = True
    network_access: bool = False
    writes_external_state: bool = False
    secret_refs: list[str] = Field(default_factory=list)

    @field_validator("allowed_roles", mode="before")
    @classmethod
    def _normalize_roles(cls, value: object) -> list[str]:
        normalized = _coerce_string_list(value, field_label="allowed_roles", allow_none=False)
        return normalized or ["admin", "owner"]

    @field_validator("secret_refs", mode="before")
    @classmethod
    def _normalize_secret_refs(cls, value: object) -> list[str]:
        return _coerce_string_list(value, field_label="secret_refs", allow_none=False) or []


class PluginManifestRecord(BaseModel):
    plugin_id: str
    display_name: str
    summary: str = ""
    vendor: str = "customer"
    version: str = "0.1.0"
    status: PluginManifestStatus = "active"
    capabilities: list[str] = Field(default_factory=list)
    ui_slots: list[str] = Field(default_factory=list)
    api_mounts: list[str] = Field(default_factory=list)
    runtime_surfaces: list[str] = Field(default_factory=list)
    config_schema: dict[str, Any] = Field(default_factory=lambda: {"type": "object", "properties": {}})
    default_config: dict[str, Any] = Field(default_factory=dict)
    security_posture: PluginSecurityPosture = Field(default_factory=PluginSecurityPosture)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str

    @field_validator("plugin_id")
    @classmethod
    def _validate_plugin_id(cls, value: str) -> str:
        normalized = normalize_identifier(value)
        if not normalized:
            raise ValueError("Plugin ID is required.")
        return normalized

    @field_validator("display_name", "vendor")
    @classmethod
    def _validate_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Plugin manifest fields must not be empty.")
        return normalized

    @field_validator("summary", "version")
    @classmethod
    def _normalize_optional_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("capabilities", "ui_slots", "api_mounts", "runtime_surfaces", mode="before")
    @classmethod
    def _normalize_string_lists(cls, value: object) -> list[str]:
        return _coerce_string_list(value, field_label="plugin list fields", allow_none=False) or []


class InstancePluginBindingRecord(BaseModel):
    plugin_id: str
    instance_id: str
    company_id: str
    enabled: bool = True
    config: dict[str, Any] = Field(default_factory=dict)
    enabled_capabilities: list[str] = Field(default_factory=list)
    enabled_ui_slots: list[str] = Field(default_factory=list)
    enabled_api_mounts: list[str] = Field(default_factory=list)
    notes: str = ""
    created_at: str
    updated_at: str

    @field_validator("plugin_id")
    @classmethod
    def _normalize_plugin_id(cls, value: str) -> str:
        normalized = normalize_identifier(value)
        if not normalized:
            raise ValueError("Plugin ID is required.")
        return normalized

    @field_validator("instance_id", "company_id")
    @classmethod
    def _normalize_scope_fields(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Instance binding scope fields must not be empty.")
        return normalized

    @field_validator("notes")
    @classmethod
    def _normalize_notes(cls, value: str) -> str:
        return value.strip()

    @field_validator("enabled_capabilities", "enabled_ui_slots", "enabled_api_mounts", mode="before")
    @classmethod
    def _normalize_enabled_lists(cls, value: object) -> list[str]:
        return _coerce_string_list(value, field_label="binding list fields", allow_none=False) or []


class PluginCatalogEntry(BaseModel):
    plugin_id: str
    display_name: str
    summary: str
    vendor: str
    version: str
    status: PluginManifestStatus
    capabilities: list[str] = Field(default_factory=list)
    ui_slots: list[str] = Field(default_factory=list)
    api_mounts: list[str] = Field(default_factory=list)
    runtime_surfaces: list[str] = Field(default_factory=list)
    config_schema: dict[str, Any] = Field(default_factory=dict)
    default_config: dict[str, Any] = Field(default_factory=dict)
    security_posture: PluginSecurityPosture = Field(default_factory=PluginSecurityPosture)
    metadata: dict[str, Any] = Field(default_factory=dict)
    binding: InstancePluginBindingRecord | None = None
    effective_status: PluginEffectiveStatus
    status_summary: str
    effective_config: dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str


class PluginCatalogSummary(BaseModel):
    registered_plugins: int = 0
    active_plugins: int = 0
    disabled_plugins: int = 0
    bound_plugins: int = 0
    enabled_bindings: int = 0
    capability_keys: list[str] = Field(default_factory=list)
    ui_slots: list[str] = Field(default_factory=list)
    api_mounts: list[str] = Field(default_factory=list)


class PluginRegistryStateRecord(BaseModel):
    schema_version: int = 1
    manifests: list[PluginManifestRecord] = Field(default_factory=list)
    bindings: list[InstancePluginBindingRecord] = Field(default_factory=list)
    updated_at: str = ""


class CreatePluginManifest(BaseModel):
    plugin_id: str | None = Field(default=None, min_length=1, max_length=191)
    display_name: str = Field(min_length=1, max_length=191)
    summary: str = Field(default="", max_length=4000)
    vendor: str = Field(default="customer", min_length=1, max_length=191)
    version: str = Field(default="0.1.0", min_length=1, max_length=64)
    status: PluginManifestStatus = "active"
    capabilities: list[str] = Field(default_factory=list)
    ui_slots: list[str] = Field(default_factory=list)
    api_mounts: list[str] = Field(default_factory=list)
    runtime_surfaces: list[str] = Field(default_factory=list)
    config_schema: dict[str, Any] = Field(default_factory=lambda: {"type": "object", "properties": {}})
    default_config: dict[str, Any] = Field(default_factory=dict)
    security_posture: PluginSecurityPosture = Field(default_factory=PluginSecurityPosture)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("capabilities", "ui_slots", "api_mounts", "runtime_surfaces", mode="before")
    @classmethod
    def _normalize_lists(cls, value: object) -> list[str]:
        return _coerce_string_list(value, field_label="plugin manifest list fields", allow_none=False) or []


class UpdatePluginManifest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=191)
    summary: str | None = Field(default=None, max_length=4000)
    vendor: str | None = Field(default=None, min_length=1, max_length=191)
    version: str | None = Field(default=None, min_length=1, max_length=64)
    status: PluginManifestStatus | None = None
    capabilities: list[str] | None = None
    ui_slots: list[str] | None = None
    api_mounts: list[str] | None = None
    runtime_surfaces: list[str] | None = None
    config_schema: dict[str, Any] | None = None
    default_config: dict[str, Any] | None = None
    security_posture: PluginSecurityPosture | None = None
    metadata: dict[str, Any] | None = None

    @field_validator("capabilities", "ui_slots", "api_mounts", "runtime_surfaces", mode="before")
    @classmethod
    def _normalize_optional_lists(cls, value: object) -> list[str] | None:
        return _coerce_string_list(value, field_label="plugin manifest list fields", allow_none=True)


class UpsertPluginBinding(BaseModel):
    enabled: bool = True
    config: dict[str, Any] = Field(default_factory=dict)
    enabled_capabilities: list[str] | None = None
    enabled_ui_slots: list[str] | None = None
    enabled_api_mounts: list[str] | None = None
    notes: str = Field(default="", max_length=4000)

    @field_validator("enabled_capabilities", "enabled_ui_slots", "enabled_api_mounts", mode="before")
    @classmethod
    def _normalize_binding_lists(cls, value: object) -> list[str] | None:
        return _coerce_string_list(value, field_label="plugin binding list fields", allow_none=True)


__all__ = [
    "ADMIN_ROLE_VALUES",
    "PLUGIN_EFFECTIVE_STATUSES",
    "PLUGIN_MANIFEST_STATUSES",
    "AdminRoleValue",
    "CreatePluginManifest",
    "InstancePluginBindingRecord",
    "PluginCatalogEntry",
    "PluginCatalogSummary",
    "PluginEffectiveStatus",
    "PluginManifestRecord",
    "PluginManifestStatus",
    "PluginRegistryStateRecord",
    "PluginSecurityPosture",
    "UpdatePluginManifest",
    "UpsertPluginBinding",
    "normalize_identifier",
]
