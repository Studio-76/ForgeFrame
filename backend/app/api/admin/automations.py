"""Admin routes for automations."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord
from app.tasks.dependencies import get_task_automation_admin_service
from app.tasks.models import CreateAutomation, UpdateAutomation
from app.tasks.service import TaskAutomationAdminService

router = APIRouter(prefix="/automations", tags=["admin-automations"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"type": error_type, "message": message}},
    )


@router.get("")
def list_automations(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> dict[str, object]:
    """
    List all automations for the current instance, with optional filtering.

    :param status_filter: Filter by automation status
    :type status_filter: str | None
    :param limit: Maximum number of automations to return
    :type limit: int
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status, instance data, and list of automations
    :rtype: dict[str, object]
    """
    automations = service.list_automations(instance=instance, status=status_filter, limit=limit)
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "automations": [item.model_dump(mode="json") for item in automations],
    }


@router.get("/{automation_id}")
def get_automation(
    automation_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    """
    Retrieve a single automation by its ID.

    :param automation_id: Unique identifier of the automation
    :type automation_id: str
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status and automation data
    :rtype: object
    :raises ValueError: If the automation is not found, returns a 404 error response
    """
    try:
        automation = service.get_automation(instance=instance, automation_id=automation_id)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "automation_not_found", str(exc))
    return {"status": "ok", "automation": automation.model_dump(mode="json")}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_automation(
    payload: CreateAutomation,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    """
    Create a new automation.

    :param payload: Automation creation payload
    :type payload: CreateAutomation
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status and created automation data
    :rtype: object
    :raises ValueError: If the automation already exists or is invalid
    """
    try:
        automation = service.create_automation(instance=instance, payload=payload)
    except ValueError as exc:
        error_type = "automation_conflict" if "already exists" in str(exc) else "automation_invalid"
        code = status.HTTP_409_CONFLICT if error_type == "automation_conflict" else status.HTTP_404_NOT_FOUND
        return _error(code, error_type, str(exc))
    return {"status": "ok", "automation": automation.model_dump(mode="json")}


@router.patch("/{automation_id}")
def update_automation(
    automation_id: str,
    payload: UpdateAutomation,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    """
    Update an existing automation.

    :param automation_id: Unique identifier of the automation to update
    :type automation_id: str
    :param payload: Automation update payload
    :type payload: UpdateAutomation
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status and updated automation data
    :rtype: object
    :raises ValueError: If the automation is not found or the update is invalid
    """
    try:
        automation = service.update_automation(instance=instance, automation_id=automation_id, payload=payload)
    except ValueError as exc:
        error_type = "automation_not_found" if "not found" in str(exc) else "automation_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "automation_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "automation": automation.model_dump(mode="json")}


@router.post("/{automation_id}/trigger")
def trigger_automation(
    automation_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    """
    Trigger an automation to run immediately.

    :param automation_id: Unique identifier of the automation to trigger
    :type automation_id: str
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status and triggered automation data
    :rtype: object
    :raises ValueError: If the automation is not found or triggering is invalid
    """
    try:
        automation = service.trigger_automation(instance=instance, automation_id=automation_id)
    except ValueError as exc:
        error_type = "automation_not_found" if "not found" in str(exc) else "automation_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "automation_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "automation": automation.model_dump(mode="json")}
