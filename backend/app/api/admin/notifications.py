"""Admin routes for notifications and outbox delivery."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord
from app.tasks.dependencies import get_task_automation_admin_service
from app.tasks.models import CreateNotification, UpdateNotification
from app.tasks.service import TaskAutomationAdminService

router = APIRouter(prefix="/notifications", tags=["admin-notifications"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("")
def list_notifications(
    delivery_status: str | None = Query(default=None, alias="deliveryStatus"),
    priority: str | None = Query(default=None, alias="priority"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> dict[str, object]:
    notifications = service.list_notifications(instance=instance, delivery_status=delivery_status, priority=priority, limit=limit)
    return {"status": "ok", "instance": instance.model_dump(mode="json"), "notifications": [item.model_dump(mode="json") for item in notifications]}


@router.get("/{notification_id}")
def get_notification(
    notification_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    try:
        notification = service.get_notification(instance=instance, notification_id=notification_id)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "notification_not_found", str(exc))
    return {"status": "ok", "notification": notification.model_dump(mode="json")}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_notification(
    payload: CreateNotification,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    try:
        notification = service.create_notification(instance=instance, payload=payload)
    except ValueError as exc:
        error_type = "notification_conflict" if "already exists" in str(exc) else "notification_invalid"
        code = status.HTTP_409_CONFLICT if error_type == "notification_conflict" else status.HTTP_404_NOT_FOUND
        return _error(code, error_type, str(exc))
    return {"status": "ok", "notification": notification.model_dump(mode="json")}


@router.patch("/{notification_id}")
def update_notification(
    notification_id: str,
    payload: UpdateNotification,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    try:
        notification = service.update_notification(instance=instance, notification_id=notification_id, payload=payload)
    except ValueError as exc:
        error_type = "notification_not_found" if "not found" in str(exc) else "notification_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "notification_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "notification": notification.model_dump(mode="json")}


@router.post("/{notification_id}/confirm")
def confirm_notification(
    notification_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    try:
        result = service.confirm_notification(instance=instance, notification_id=notification_id)
    except ValueError as exc:
        error_type = "notification_not_found" if "not found" in str(exc) else "notification_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "notification_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "action": result.action, "notification": result.notification.model_dump(mode="json")}


@router.post("/{notification_id}/reject")
def reject_notification(
    notification_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    try:
        result = service.reject_notification(instance=instance, notification_id=notification_id)
    except ValueError as exc:
        error_type = "notification_not_found" if "not found" in str(exc) else "notification_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "notification_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "action": result.action, "notification": result.notification.model_dump(mode="json")}


@router.post("/{notification_id}/retry")
def retry_notification(
    notification_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    try:
        result = service.retry_notification(instance=instance, notification_id=notification_id)
    except ValueError as exc:
        error_type = "notification_not_found" if "not found" in str(exc) else "notification_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "notification_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "action": result.action, "notification": result.notification.model_dump(mode="json")}
