"""Instance-scope helpers for admin routes."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Query, status

from app.instances.models import InstanceRecord
from app.instances.service import InstanceService, get_instance_service


def resolve_admin_instance_scope(
    instance_id: str | None = Query(default=None, alias="instanceId"),
    tenant_id: str | None = Query(default=None, alias="tenantId"),
    company_id: str | None = Query(default=None, alias="companyId"),
    service: InstanceService = Depends(get_instance_service),
) -> InstanceRecord:
    try:
        return service.resolve_instance(
            instance_id=instance_id,
            tenant_id=tenant_id,
            company_id=company_id,
            allow_default=True,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "instance_scope_not_found",
                "message": str(exc),
            },
        ) from exc


def require_admin_instance_scope(
    instance_id: str | None = Query(default=None, alias="instanceId"),
    tenant_id: str | None = Query(default=None, alias="tenantId"),
    company_id: str | None = Query(default=None, alias="companyId"),
    service: InstanceService = Depends(get_instance_service),
) -> InstanceRecord:
    normalized_instance_id = (instance_id or "").strip()
    normalized_tenant_id = (tenant_id or "").strip()
    normalized_company_id = (company_id or "").strip()
    if not normalized_instance_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="execution_instance_scope_required",
        )

    try:
        return service.resolve_instance(
            instance_id=normalized_instance_id,
            tenant_id=normalized_tenant_id or None,
            company_id=normalized_company_id or None,
            allow_default=False,
            allow_legacy_backfill=False,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "instance_scope_not_found",
                "message": str(exc),
            },
        ) from exc
