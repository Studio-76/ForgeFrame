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
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("")
def list_automations(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> dict[str, object]:
    automations = service.list_automations(instance=instance, status=status_filter, limit=limit)
    return {"status": "ok", "instance": instance.model_dump(mode="json"), "automations": [item.model_dump(mode="json") for item in automations]}


@router.get("/{automation_id}")
def get_automation(
    automation_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
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
    try:
        automation = service.trigger_automation(instance=instance, automation_id=automation_id)
    except ValueError as exc:
        error_type = "automation_not_found" if "not found" in str(exc) else "automation_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "automation_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "automation": automation.model_dump(mode="json")}
