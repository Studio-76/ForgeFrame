"""Helpers for projecting ForgeFrame request metadata into HTTP headers."""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

_SCOPE_ATTRIBUTE_ALIASES: dict[str, tuple[str, ...]] = {
    "instance_id": ("instance_id", "instance", "forgeframe_instance_id"),
    "agent_id": ("agent_id", "agent", "assistant_id", "assistant"),
    "task_id": ("task_id", "task", "task_key"),
    "execution_run_id": ("execution_run_id", "run_id"),
    "attempt_id": ("attempt_id",),
    "worker_key": ("worker_key",),
    "response_id": ("response_id",),
}


def _normalize_metadata_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        normalized = value.strip()
        return normalized or None
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (list, tuple, dict)):
        serialized = json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
        return serialized.strip() or None
    normalized = str(value).strip()
    return normalized or None


def normalize_request_metadata(request_metadata: Mapping[str, Any] | None) -> dict[str, str]:
    if not request_metadata:
        return {}

    normalized: dict[str, str] = {}
    for key, value in request_metadata.items():
        key_name = str(key).strip()
        if not key_name:
            continue
        normalized_value = _normalize_metadata_value(value)
        if normalized_value is None:
            continue
        normalized[key_name] = normalized_value
    return normalized


def merge_request_metadata(*items: Mapping[str, Any] | None) -> dict[str, str]:
    merged: dict[str, str] = {}
    for item in items:
        merged.update(normalize_request_metadata(item))
    return merged


def extract_scope_attributes(
    request_metadata: Mapping[str, Any] | None,
    *,
    instance_id: str | None = None,
) -> dict[str, str]:
    normalized = normalize_request_metadata(request_metadata)
    scope_attributes: dict[str, str] = {}
    if instance_id:
        scope_attributes["instance_id"] = instance_id.strip()

    for scope_key, aliases in _SCOPE_ATTRIBUTE_ALIASES.items():
        for alias in aliases:
            value = normalized.get(alias)
            if value:
                scope_attributes[scope_key] = value
                break
    return scope_attributes


def forgeframe_request_metadata_headers(request_metadata: Mapping[str, str] | None) -> dict[str, str]:
    """Project runtime request metadata into stable upstream correlation headers."""

    normalized_metadata = normalize_request_metadata(request_metadata)
    if not normalized_metadata:
        return {}

    headers: dict[str, str] = {}
    for key, value in normalized_metadata.items():
        header_name = "-".join(part.capitalize() for part in key.split("_"))
        headers[f"X-ForgeFrame-{header_name}"] = value
    return headers
