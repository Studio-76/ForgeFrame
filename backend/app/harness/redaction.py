"""Harness payload redaction helpers for control-plane responses."""

from __future__ import annotations

import re
from typing import Any

from app.harness.models import HarnessProfileRecord, HarnessProviderProfile

REDACTED_SECRET = "***redacted***"
SENSITIVE_KEY_NAMES = {
    "authorization",
    "proxy_authorization",
    "x_api_key",
    "api_key",
    "apikey",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "client_secret",
    "auth_value",
}
SENSITIVE_KEY_PATTERN = re.compile(
    r"(?:^|_)(authorization|proxy_authorization|x_api_key|api_key|apikey|token|access_token|refresh_token|secret|client_secret|auth_value)(?:_|$)"
)
BEARER_TOKEN_PATTERN = re.compile(r"(?i)\b(Bearer)\s+([^\s,;\"'}\]]+)")
SENSITIVE_STRING_PATTERN = re.compile(
    r"""
    \b(
        proxy[-_]?authorization|
        authorization|
        x[-_]?api[-_]?key|
        api[-_]?key|
        apikey|
        access[-_]?token|
        refresh[-_]?token|
        client[-_]?secret|
        auth_value|
        secret|
        token
    )\b
    (?P<separator>['"]?\s*[:=]\s*['"]?)
    (?P<value>[^,\s"'`}\]]+)
    """,
    flags=re.IGNORECASE | re.VERBOSE,
)


def normalized_secret_key(key: str) -> str:
    return key.strip().lower().replace("-", "_")


def is_sensitive_key(key: str) -> bool:
    normalized_key = normalized_secret_key(key)
    return normalized_key in SENSITIVE_KEY_NAMES or SENSITIVE_KEY_PATTERN.search(normalized_key) is not None


def redact_sensitive_string(value: str) -> str:
    redacted = BEARER_TOKEN_PATTERN.sub(r"\1 " + REDACTED_SECRET, value)
    return SENSITIVE_STRING_PATTERN.sub(
        lambda match: f"{match.group(1)}{match.group('separator')}{REDACTED_SECRET}",
        redacted,
    )


def redact_header_values(headers: dict[str, Any]) -> dict[str, Any]:
    redacted: dict[str, Any] = {}
    for key, value in headers.items():
        header_key = str(key)
        if is_sensitive_key(header_key):
            redacted[header_key] = REDACTED_SECRET
            continue
        redacted[header_key] = redact_sensitive_payload(value)
    return redacted


def redact_sensitive_payload(payload: Any) -> Any:
    if isinstance(payload, str):
        return redact_sensitive_string(payload)
    if isinstance(payload, list):
        return [redact_sensitive_payload(item) for item in payload]
    if not isinstance(payload, dict):
        return payload

    redacted: dict[str, Any] = {}
    for key, value in payload.items():
        field_key = str(key)
        normalized_key = normalized_secret_key(field_key)
        if normalized_key == "headers" and isinstance(value, dict):
            redacted[field_key] = redact_header_values(value)
            continue
        if is_sensitive_key(field_key):
            if isinstance(value, str):
                redacted[field_key] = REDACTED_SECRET if value.strip() else value
            elif value is None:
                redacted[field_key] = None
            else:
                redacted[field_key] = REDACTED_SECRET
            continue
        redacted[field_key] = redact_sensitive_payload(value)
    return redacted


def redacted_harness_profile_payload(profile: HarnessProviderProfile | HarnessProfileRecord) -> dict[str, Any]:
    return redact_sensitive_payload(profile.model_dump())


__all__ = [
    "REDACTED_SECRET",
    "redact_sensitive_payload",
    "redact_sensitive_string",
    "redacted_harness_profile_payload",
]
