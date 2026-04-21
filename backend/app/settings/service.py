"""Mutable settings catalog and override helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.storage.governance_repository import get_governance_repository


@dataclass(frozen=True)
class MutableSettingDefinition:
    key: str
    label: str
    category: str
    value_type: str
    description: str


MUTABLE_SETTINGS: dict[str, MutableSettingDefinition] = {
    "app_name": MutableSettingDefinition("app_name", "App Name", "product", "str", "Visible product name."),
    "default_model": MutableSettingDefinition("default_model", "Default Model", "runtime", "str", "Primary default model for routing."),
    "default_provider": MutableSettingDefinition("default_provider", "Default Provider", "runtime", "str", "Primary default provider for routing."),
    "runtime_auth_required": MutableSettingDefinition("runtime_auth_required", "Runtime Auth Required", "security", "bool", "Require runtime gateway keys for client traffic."),
    "routing_strategy": MutableSettingDefinition("routing_strategy", "Routing Strategy", "runtime", "str", "Routing preference: balanced, quality or cost."),
    "routing_require_healthy": MutableSettingDefinition("routing_require_healthy", "Require Healthy Route", "runtime", "bool", "Require healthy models for implicit routing when possible."),
    "routing_allow_degraded_fallback": MutableSettingDefinition("routing_allow_degraded_fallback", "Allow Degraded Fallback", "runtime", "bool", "Allow degraded models as fallback when no healthy route exists."),
    "openai_api_enabled": MutableSettingDefinition("openai_api_enabled", "OpenAI API Enabled", "providers", "bool", "Enable OpenAI API provider."),
    "openai_codex_enabled": MutableSettingDefinition("openai_codex_enabled", "OpenAI Codex Enabled", "providers", "bool", "Enable OpenAI Codex provider."),
    "gemini_enabled": MutableSettingDefinition("gemini_enabled", "Gemini Enabled", "providers", "bool", "Enable Gemini provider."),
    "anthropic_enabled": MutableSettingDefinition("anthropic_enabled", "Anthropic Enabled", "providers", "bool", "Enable Anthropic provider."),
    "generic_harness_enabled": MutableSettingDefinition("generic_harness_enabled", "Generic Harness Enabled", "providers", "bool", "Enable generic harness provider."),
    "ollama_enabled": MutableSettingDefinition("ollama_enabled", "Ollama Enabled", "providers", "bool", "Enable Ollama provider."),
    "governance_storage_backend": MutableSettingDefinition("governance_storage_backend", "Governance Storage", "storage", "str", "Storage backend for auth, sessions, keys and audit."),
    "control_plane_storage_backend": MutableSettingDefinition("control_plane_storage_backend", "Control Plane Storage", "storage", "str", "Storage backend for control-plane truth state."),
    "observability_storage_backend": MutableSettingDefinition("observability_storage_backend", "Observability Storage", "storage", "str", "Storage backend for usage, error and health events."),
    "pricing_openai_input_per_1m_tokens": MutableSettingDefinition("pricing_openai_input_per_1m_tokens", "OpenAI Input Price", "pricing", "float", "USD per 1M input tokens."),
    "pricing_openai_output_per_1m_tokens": MutableSettingDefinition("pricing_openai_output_per_1m_tokens", "OpenAI Output Price", "pricing", "float", "USD per 1M output tokens."),
    "pricing_codex_hypothetical_input_per_1m_tokens": MutableSettingDefinition("pricing_codex_hypothetical_input_per_1m_tokens", "Codex Hypothetical Input Price", "pricing", "float", "Hypothetical Codex input rate."),
    "pricing_codex_hypothetical_output_per_1m_tokens": MutableSettingDefinition("pricing_codex_hypothetical_output_per_1m_tokens", "Codex Hypothetical Output Price", "pricing", "float", "Hypothetical Codex output rate."),
    "pricing_internal_hypothetical_input_per_1m_tokens": MutableSettingDefinition("pricing_internal_hypothetical_input_per_1m_tokens", "Internal Input Price", "pricing", "float", "Internal comparison input rate."),
    "pricing_internal_hypothetical_output_per_1m_tokens": MutableSettingDefinition("pricing_internal_hypothetical_output_per_1m_tokens", "Internal Output Price", "pricing", "float", "Internal comparison output rate."),
}


def mutable_setting_catalog() -> list[MutableSettingDefinition]:
    return list(MUTABLE_SETTINGS.values())


def coerce_mutable_setting_value(key: str, value: Any) -> Any:
    definition = MUTABLE_SETTINGS.get(key)
    if definition is None:
        raise ValueError(f"Unknown mutable setting '{key}'.")
    if definition.value_type == "bool":
        if isinstance(value, bool):
            return value
        if isinstance(value, str) and value.lower() in {"true", "false"}:
            return value.lower() == "true"
        raise ValueError(f"Setting '{key}' expects a boolean value.")
    if definition.value_type == "float":
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            return float(value)
        raise ValueError(f"Setting '{key}' expects a float value.")
    if definition.value_type == "str":
        normalized = str(value)
        if key in {"routing_strategy"} and normalized not in {"balanced", "quality", "cost"}:
            raise ValueError(f"Setting '{key}' expects one of: balanced, quality, cost.")
        if key in {"governance_storage_backend", "control_plane_storage_backend", "observability_storage_backend"} and normalized not in {"file", "postgresql"}:
            raise ValueError(f"Setting '{key}' expects one of: file, postgresql.")
        return normalized
    return value


def load_persisted_setting_overrides(base_settings) -> dict[str, Any]:
    repository = get_governance_repository(base_settings)
    state = repository.load_state()
    overrides: dict[str, Any] = {}
    for record in state.setting_overrides:
        if record.key not in MUTABLE_SETTINGS:
            continue
        try:
            overrides[record.key] = coerce_mutable_setting_value(record.key, record.value)
        except ValueError:
            continue
    return overrides


def serialize_mutable_settings(raw_settings, effective_settings, override_records) -> list[dict[str, Any]]:
    override_map = {record.key: record for record in override_records}
    rows: list[dict[str, Any]] = []
    for definition in mutable_setting_catalog():
        rows.append(
            {
                "key": definition.key,
                "label": definition.label,
                "category": definition.category,
                "value_type": definition.value_type,
                "description": definition.description,
                "default_value": getattr(raw_settings, definition.key),
                "effective_value": getattr(effective_settings, definition.key),
                "overridden": definition.key in override_map,
                "updated_at": override_map.get(definition.key).updated_at if definition.key in override_map else None,
                "updated_by": override_map.get(definition.key).updated_by if definition.key in override_map else None,
            }
        )
    return rows
