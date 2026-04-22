"""Shared tenant-keying helpers for runtime and observability paths."""

from __future__ import annotations

from collections.abc import Iterable

DEFAULT_BOOTSTRAP_TENANT_ID = "tenant_bootstrap"


class TenantFilterRequiredError(ValueError):
    """Raised when a query would span multiple tenants without an explicit filter."""


def normalize_tenant_id(
    tenant_id: str | None,
    *,
    fallback_tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID,
) -> str:
    normalized = (tenant_id or "").strip()
    if normalized:
        return normalized
    fallback = fallback_tenant_id.strip()
    return fallback or DEFAULT_BOOTSTRAP_TENANT_ID


def effective_tenant_filter(
    tenant_ids: Iterable[str | None],
    requested_tenant_id: str | None,
) -> str | None:
    requested = (requested_tenant_id or "").strip()
    if requested:
        return requested

    unique_tenant_ids = sorted(
        {
            item.strip()
            for item in tenant_ids
            if item is not None and item.strip()
        }
    )
    if len(unique_tenant_ids) <= 1:
        return unique_tenant_ids[0] if unique_tenant_ids else None

    raise TenantFilterRequiredError(
        "tenantId query parameter is required once observability history contains multiple tenants."
    )
