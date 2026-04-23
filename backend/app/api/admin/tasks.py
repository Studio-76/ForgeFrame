"""Admin routes for tasks and follow-ups."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord
from app.tasks.dependencies import get_task_automation_admin_service
from app.tasks.models import CreateTask, UpdateTask
from app.tasks.service import TaskAutomationAdminService

router = APIRouter(prefix="/tasks", tags=["admin-tasks"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("")
def list_tasks(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> dict[str, object]:
    tasks = service.list_tasks(instance=instance, status=status_filter, limit=limit)
    return {"status": "ok", "instance": instance.model_dump(mode="json"), "tasks": [item.model_dump(mode="json") for item in tasks]}


@router.get("/{task_id}")
def get_task(
    task_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    try:
        task = service.get_task(instance=instance, task_id=task_id)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "task_not_found", str(exc))
    return {"status": "ok", "task": task.model_dump(mode="json")}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_task(
    payload: CreateTask,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    try:
        task = service.create_task(instance=instance, payload=payload)
    except ValueError as exc:
        error_type = "task_conflict" if "already exists" in str(exc) else "task_invalid"
        code = status.HTTP_409_CONFLICT if error_type == "task_conflict" else status.HTTP_404_NOT_FOUND
        return _error(code, error_type, str(exc))
    return {"status": "ok", "task": task.model_dump(mode="json")}


@router.patch("/{task_id}")
def update_task(
    task_id: str,
    payload: UpdateTask,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    try:
        task = service.update_task(instance=instance, task_id=task_id, payload=payload)
    except ValueError as exc:
        error_type = "task_not_found" if "not found" in str(exc) else "task_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "task_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "task": task.model_dump(mode="json")}
