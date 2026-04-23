"""Admin routes for delivery channels."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord
from app.tasks.dependencies import get_task_automation_admin_service
from app.tasks.models import CreateDeliveryChannel, UpdateDeliveryChannel
from app.tasks.service import TaskAutomationAdminService

router = APIRouter(prefix="/channels", tags=["admin-channels"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("")
def list_channels(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> dict[str, object]:
    channels = service.list_channels(instance=instance, status=status_filter, limit=limit)
    return {"status": "ok", "instance": instance.model_dump(mode="json"), "channels": [item.model_dump(mode="json") for item in channels]}


@router.get("/{channel_id}")
def get_channel(
    channel_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    try:
        channel = service.get_channel(instance=instance, channel_id=channel_id)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "channel_not_found", str(exc))
    return {"status": "ok", "channel": channel.model_dump(mode="json")}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_channel(
    payload: CreateDeliveryChannel,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    try:
        channel = service.create_channel(instance=instance, payload=payload)
    except ValueError as exc:
        error_type = "channel_conflict" if "already exists" in str(exc) else "channel_invalid"
        code = status.HTTP_409_CONFLICT if error_type == "channel_conflict" else status.HTTP_404_NOT_FOUND
        return _error(code, error_type, str(exc))
    return {"status": "ok", "channel": channel.model_dump(mode="json")}


@router.patch("/{channel_id}")
def update_channel(
    channel_id: str,
    payload: UpdateDeliveryChannel,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    try:
        channel = service.update_channel(instance=instance, channel_id=channel_id, payload=payload)
    except ValueError as exc:
        error_type = "channel_not_found" if "not found" in str(exc) else "channel_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "channel_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "channel": channel.model_dump(mode="json")}
