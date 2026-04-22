"""Helpers for projecting ForgeGate request metadata into HTTP headers."""

from __future__ import annotations

from collections.abc import Mapping


def forgegate_request_metadata_headers(request_metadata: Mapping[str, str] | None) -> dict[str, str]:
    """Project runtime request metadata into stable upstream correlation headers."""

    if not request_metadata:
        return {}

    headers: dict[str, str] = {}
    for key, value in request_metadata.items():
        normalized = value.strip()
        if not normalized:
            continue
        header_name = "-".join(part.capitalize() for part in key.split("_"))
        headers[f"X-ForgeGate-{header_name}"] = normalized
    return headers
