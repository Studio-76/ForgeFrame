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
    return JSONResponse(
        status_code=status_code,
        content={"error": {"type": error_type, "message": message}},
    )


@router.get("")
def list_channels(
    status_filter: str | None = Query(default=None, alias="status"),
    kind_filter: str | None = Query(default=None, alias="kind"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> dict[str, object]:
    """
    List all delivery channels for the current instance, with optional filtering.

    :param status_filter: Filter by channel status
    :type status_filter: str | None
    :param kind_filter: Filter by channel kind/type
    :type kind_filter: str | None
    :param limit: Maximum number of channels to return
    :type limit: int
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status, instance data, and list of channels
    :rtype: dict[str, object]
    """
    channels = service.list_channels(instance=instance, status=status_filter, kind=kind_filter, limit=limit)
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "channels": [item.model_dump(mode="json") for item in channels],
    }


@router.get("/{channel_id}")
def get_channel(
    channel_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    """
    Retrieve a single delivery channel by its ID.

    :param channel_id: Unique identifier of the channel
    :type channel_id: str
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status and channel data
    :rtype: object
    :raises ValueError: If the channel is not found, returns a 404 error response
    """
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
    """
    Create a new delivery channel.

    :param payload: Channel creation payload
    :type payload: CreateDeliveryChannel
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status and created channel data
    :rtype: object
    :raises ValueError: If the channel already exists or is invalid
    """
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
    """
    Update an existing delivery channel.

    :param channel_id: Unique identifier of the channel to update
    :type channel_id: str
    :param payload: Channel update payload
    :type payload: UpdateDeliveryChannel
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status and updated channel data
    :rtype: object
    :raises ValueError: If the channel is not found or the update is invalid
    """
    try:
        channel = service.update_channel(instance=instance, channel_id=channel_id, payload=payload)
    except ValueError as exc:
        error_type = "channel_not_found" if "not found" in str(exc) else "channel_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "channel_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "channel": channel.model_dump(mode="json")}
