"""Mutable settings catalog and override helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.storage.governance_repository import get_governance_repository


@dataclass(frozen=True)
class MutableSettingDefinition:
    key: str
    label: str
    group: str
    value_type: str
    description: str
    risk_level: str
    risk_note: str
    confirmation_required: bool = False
    mutable: bool = True
    allowed_values: tuple[str, ...] = ()


MUTABLE_SETTINGS: dict[str, MutableSettingDefinition] = {
    "app_name": MutableSettingDefinition(
        "app_name",
        "App Name",
        "ui",
        "str",
        "Visible product name in the admin shell.",
        "low",
        "Changes operator-facing product labeling but does not alter runtime execution.",
    ),
    "default_model": MutableSettingDefinition(
        "default_model",
        "Default Model",
        "runtime",
        "str",
        "Primary default model for routing.",
        "medium",
        "Changes the model selected by default when routes do not pin an explicit model.",
    ),
    "default_provider": MutableSettingDefinition(
        "default_provider",
        "Default Provider",
        "runtime",
        "str",
        "Primary default provider for routing.",
        "medium",
        "Changes the provider chosen by default when routes do not pin an explicit provider.",
    ),
    "runtime_auth_required": MutableSettingDefinition(
        "runtime_auth_required",
        "Runtime Auth Required",
        "security",
        "bool",
        "Require runtime gateway keys for client traffic.",
        "high",
        "Changing runtime auth can immediately open or close the runtime API to unauthenticated traffic.",
        confirmation_required=True,
    ),
    "routing_strategy": MutableSettingDefinition(
        "routing_strategy",
        "Routing Strategy",
        "routing",
        "str",
        "Routing preference: balanced, quality, or cost.",
        "medium",
        "Changes how default routing weighs quality versus spend.",
        allowed_values=("balanced", "quality", "cost"),
    ),
    "routing_require_healthy": MutableSettingDefinition(
        "routing_require_healthy",
        "Require Healthy Route",
        "routing",
        "bool",
        "Require healthy models for implicit routing when possible.",
        "medium",
        "Can block degraded providers from being selected by default routes.",
    ),
    "routing_allow_degraded_fallback": MutableSettingDefinition(
        "routing_allow_degraded_fallback",
        "Allow Degraded Fallback",
        "routing",
        "bool",
        "Allow degraded models as fallback when no healthy route exists.",
        "medium",
        "Changes whether the runtime may keep serving traffic through degraded providers.",
    ),
    "openai_api_enabled": MutableSettingDefinition(
        "openai_api_enabled",
        "OpenAI API Enabled",
        "providers",
        "bool",
        "Enable the OpenAI API provider.",
        "medium",
        "Can remove or restore OpenAI as a selectable runtime provider.",
    ),
    "openai_codex_enabled": MutableSettingDefinition(
        "openai_codex_enabled",
        "OpenAI Codex Enabled",
        "providers",
        "bool",
        "Enable the OpenAI Codex provider.",
        "medium",
        "Can remove or restore Codex-backed runtime routes.",
    ),
    "gemini_enabled": MutableSettingDefinition(
        "gemini_enabled",
        "Gemini Enabled",
        "providers",
        "bool",
        "Enable the Gemini provider.",
        "medium",
        "Can remove or restore Gemini-backed runtime routes.",
    ),
    "anthropic_enabled": MutableSettingDefinition(
        "anthropic_enabled",
        "Anthropic Enabled",
        "providers",
        "bool",
        "Enable the Anthropic provider.",
        "medium",
        "Can remove or restore Anthropic-backed runtime routes.",
    ),
    "generic_harness_enabled": MutableSettingDefinition(
        "generic_harness_enabled",
        "Generic Harness Enabled",
        "providers",
        "bool",
        "Enable the generic harness provider.",
        "medium",
        "Affects fallback runtime capacity used for generic harness dispatch.",
    ),
    "ollama_enabled": MutableSettingDefinition(
        "ollama_enabled",
        "Ollama Enabled",
        "providers",
        "bool",
        "Enable the Ollama provider.",
        "medium",
        "Can remove or restore local Ollama-backed runtime routes.",
    ),
    "public_tls_mode": MutableSettingDefinition(
        "public_tls_mode",
        "TLS Mode",
        "tls",
        "str",
        "Controls whether public TLS is disabled, manual, or managed by integrated ACME.",
        "high",
        "Can immediately change public TLS posture and ingress expectations.",
        confirmation_required=True,
        allowed_values=("disabled", "manual", "integrated_acme"),
    ),
    "public_fqdn": MutableSettingDefinition(
        "public_fqdn",
        "Public FQDN",
        "tls",
        "str",
        "Canonical public hostname used for admin and runtime ingress checks.",
        "high",
        "Changing the public hostname can invalidate links, certificates, and ingress expectations.",
        confirmation_required=True,
    ),
    "public_https_port": MutableSettingDefinition(
        "public_https_port",
        "Public HTTPS Port",
        "tls",
        "int",
        "Public HTTPS listener port exposed by the control plane.",
        "high",
        "Changing the HTTPS port can break ingress reachability and certificate validation assumptions.",
        confirmation_required=True,
    ),
    "public_http_helper_port": MutableSettingDefinition(
        "public_http_helper_port",
        "ACME Helper Port",
        "tls",
        "int",
        "HTTP helper port used for ACME challenges when integrated TLS is enabled.",
        "high",
        "Changing the HTTP helper port can break ACME challenge delivery.",
        confirmation_required=True,
    ),
    "public_tls_acme_email": MutableSettingDefinition(
        "public_tls_acme_email",
        "ACME Contact Email",
        "tls",
        "str",
        "Contact email used for integrated ACME registration.",
        "medium",
        "Updates the registration contact used for certificate lifecycle operations.",
    ),
    "audit_event_retention_limit": MutableSettingDefinition(
        "audit_event_retention_limit",
        "Audit Event Retention Limit",
        "observability",
        "int",
        "Maximum number of audit events retained in the live admin history window.",
        "medium",
        "Changes how much governance history stays available in the hot observability surface.",
    ),
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
    if definition.value_type == "int":
        if isinstance(value, bool):
            raise ValueError(f"Setting '{key}' expects an integer value.")
        if isinstance(value, int):
            parsed = value
        elif isinstance(value, float) and value.is_integer():
            parsed = int(value)
        elif isinstance(value, str):
            parsed = int(value.strip())
        else:
            raise ValueError(f"Setting '{key}' expects an integer value.")
        if key in {"public_https_port", "public_http_helper_port"} and not 1 <= parsed <= 65535:
            raise ValueError(f"Setting '{key}' expects a port between 1 and 65535.")
        if key == "audit_event_retention_limit" and parsed < 100:
            raise ValueError("Setting 'audit_event_retention_limit' must be at least 100.")
        return parsed
    if definition.value_type == "float":
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            return float(value)
        raise ValueError(f"Setting '{key}' expects a float value.")
    if definition.value_type == "str":
        normalized = str(value).strip()
        if definition.allowed_values and normalized not in definition.allowed_values:
            raise ValueError(f"Setting '{key}' expects one of: {', '.join(definition.allowed_values)}.")
        if key in {"app_name", "default_model", "default_provider"} and not normalized:
            raise ValueError(f"Setting '{key}' cannot be empty.")
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
    group_labels = {
        "runtime": "Runtime",
        "security": "Security",
        "providers": "Providers",
        "routing": "Routing",
        "tls": "TLS",
        "observability": "Observability",
        "ui": "UI",
    }
    risk_labels = {
        "low": "Low risk",
        "medium": "Moderate risk",
        "high": "High risk",
    }
    rows: list[dict[str, Any]] = []
    for definition in mutable_setting_catalog():
        overridden = definition.key in override_map
        rows.append(
            {
                "key": definition.key,
                "label": definition.label,
                "group": definition.group,
                "group_label": group_labels.get(definition.group, definition.group.title()),
                "category": definition.group,
                "value_type": definition.value_type,
                "description": definition.description,
                "default_value": getattr(raw_settings, definition.key),
                "effective_value": getattr(effective_settings, definition.key),
                "source": "override" if overridden else "default",
                "source_label": "Persisted override" if overridden else "Environment default",
                "mutable": definition.mutable,
                "risk_level": definition.risk_level,
                "risk_label": risk_labels.get(definition.risk_level, definition.risk_level.title()),
                "risk_note": definition.risk_note,
                "confirmation_required": definition.confirmation_required,
                "allowed_values": list(definition.allowed_values),
                "overridden": overridden,
                "updated_at": override_map.get(definition.key).updated_at if overridden else None,
                "updated_by": override_map.get(definition.key).updated_by if overridden else None,
            }
        )
    return rows
