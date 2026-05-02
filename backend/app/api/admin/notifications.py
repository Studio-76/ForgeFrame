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
    return JSONResponse(
        status_code=status_code,
        content={"error": {"type": error_type, "message": message}},
    )


@router.get("")
def list_notifications(
    delivery_status: str | None = Query(default=None, alias="deliveryStatus"),
    priority: str | None = Query(default=None, alias="priority"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> dict[str, object]:
    """
    List all notifications for the current instance, with optional filtering.

    :param delivery_status: Filter by delivery status
    :type delivery_status: str | None
    :param priority: Filter by priority level
    :type priority: str | None
    :param limit: Maximum number of notifications to return
    :type limit: int
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status, instance data, and list of notifications
    :rtype: dict[str, object]
    """
    notifications = service.list_notifications(
        instance=instance,
        delivery_status=delivery_status,
        priority=priority,
        limit=limit,
    )
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "notifications": [item.model_dump(mode="json") for item in notifications],
    }


@router.get("/{notification_id}")
def get_notification(
    notification_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    """
    Retrieve a single notification by its ID.

    :param notification_id: Unique identifier of the notification
    :type notification_id: str
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status and notification data
    :rtype: object
    :raises ValueError: If the notification is not found, returns a 404 error response
    """
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
    """
    Create a new notification.

    :param payload: Notification creation payload
    :type payload: CreateNotification
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status and created notification data
    :rtype: object
    :raises ValueError: If the notification already exists or is invalid
    """
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
    """
    Update an existing notification.

    :param notification_id: Unique identifier of the notification to update
    :type notification_id: str
    :param payload: Notification update payload
    :type payload: UpdateNotification
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status and updated notification data
    :rtype: object
    :raises ValueError: If the notification is not found or the update is invalid
    """
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
    """
    Confirm a notification, marking it as acknowledged.

    :param notification_id: Unique identifier of the notification to confirm
    :type notification_id: str
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status, action taken, and confirmed notification data
    :rtype: object
    :raises ValueError: If the notification is not found or confirmation is invalid
    """
    try:
        result = service.confirm_notification(instance=instance, notification_id=notification_id)
    except ValueError as exc:
        error_type = "notification_not_found" if "not found" in str(exc) else "notification_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "notification_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {
        "status": "ok",
        "action": result.action,
        "notification": result.notification.model_dump(mode="json"),
    }


@router.post("/{notification_id}/reject")
def reject_notification(
    notification_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    """
    Reject a notification, marking it as declined.

    :param notification_id: Unique identifier of the notification to reject
    :type notification_id: str
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status, action taken, and rejected notification data
    :rtype: object
    :raises ValueError: If the notification is not found or rejection is invalid
    """
    try:
        result = service.reject_notification(instance=instance, notification_id=notification_id)
    except ValueError as exc:
        error_type = "notification_not_found" if "not found" in str(exc) else "notification_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "notification_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {
        "status": "ok",
        "action": result.action,
        "notification": result.notification.model_dump(mode="json"),
    }


@router.post("/{notification_id}/retry")
def retry_notification(
    notification_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: TaskAutomationAdminService = Depends(get_task_automation_admin_service),
) -> object:
    """
    Retry delivery of a failed notification.

    :param notification_id: Unique identifier of the notification to retry
    :type notification_id: str
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected task automation admin service
    :type service: TaskAutomationAdminService
    :return: Status, action taken, and retried notification data
    :rtype: object
    :raises ValueError: If the notification is not found or retry is invalid
    """
    try:
        result = service.retry_notification(instance=instance, notification_id=notification_id)
    except ValueError as exc:
        error_type = "notification_not_found" if "not found" in str(exc) else "notification_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "notification_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {
        "status": "ok",
        "action": result.action,
        "notification": result.notification.model_dump(mode="json"),
    }
