"""Admin routes for inbox and triage truth."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.conversations.dependencies import get_conversation_inbox_admin_service
from app.conversations.models import CreateInboxItem, UpdateInboxItem
from app.conversations.service import ConversationInboxAdminService
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord

router = APIRouter(prefix="/inbox", tags=["admin-inbox"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"type": error_type, "message": message}},
    )


@router.get("")
def list_inbox(
    triage_status: str | None = Query(default=None, alias="triageStatus"),
    status_filter: str | None = Query(default=None, alias="status"),
    priority: str | None = Query(default=None, alias="priority"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ConversationInboxAdminService = Depends(get_conversation_inbox_admin_service),
) -> dict[str, object]:
    """
    List all inbox items for the current instance, with optional filtering.

    :param triage_status: Filter by triage status
    :type triage_status: str | None
    :param status_filter: Filter by item status
    :type status_filter: str | None
    :param priority: Filter by priority level
    :type priority: str | None
    :param limit: Maximum number of items to return
    :type limit: int
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected conversation inbox admin service
    :type service: ConversationInboxAdminService
    :return: Status, instance data, and list of inbox items
    :rtype: dict[str, object]
    """
    items = service.list_inbox(
        instance=instance,
        triage_status=triage_status,
        status=status_filter,
        priority=priority,
        limit=limit,
    )
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "items": [item.model_dump(mode="json") for item in items],
    }


@router.get("/{inbox_id}")
def get_inbox_item(
    inbox_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ConversationInboxAdminService = Depends(get_conversation_inbox_admin_service),
) -> object:
    """
    Retrieve a single inbox item by its ID.

    :param inbox_id: Unique identifier of the inbox item
    :type inbox_id: str
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected conversation inbox admin service
    :type service: ConversationInboxAdminService
    :return: Status and inbox item data
    :rtype: object
    :raises ValueError: If the inbox item is not found, returns a 404 error response
    """
    try:
        item = service.get_inbox_item(instance=instance, inbox_id=inbox_id)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "inbox_not_found", str(exc))
    return {"status": "ok", "item": item.model_dump(mode="json")}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_inbox_item(
    payload: CreateInboxItem,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ConversationInboxAdminService = Depends(get_conversation_inbox_admin_service),
) -> object:
    """
    Create a new inbox item.

    :param payload: Inbox item creation payload
    :type payload: CreateInboxItem
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected conversation inbox admin service
    :type service: ConversationInboxAdminService
    :return: Status and created inbox item data
    :rtype: object
    :raises ValueError: If the item already exists or is invalid
    """
    try:
        item = service.create_inbox_item(instance=instance, payload=payload)
    except ValueError as exc:
        error_type = "inbox_conflict" if "already exists" in str(exc) else "inbox_invalid"
        code = status.HTTP_409_CONFLICT if error_type == "inbox_conflict" else status.HTTP_404_NOT_FOUND
        return _error(code, error_type, str(exc))
    return {"status": "ok", "item": item.model_dump(mode="json")}


@router.patch("/{inbox_id}")
def update_inbox_item(
    inbox_id: str,
    payload: UpdateInboxItem,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ConversationInboxAdminService = Depends(get_conversation_inbox_admin_service),
) -> object:
    """
    Update an existing inbox item.

    :param inbox_id: Unique identifier of the inbox item to update
    :type inbox_id: str
    :param payload: Inbox item update payload
    :type payload: UpdateInboxItem
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected conversation inbox admin service
    :type service: ConversationInboxAdminService
    :return: Status and updated inbox item data
    :rtype: object
    :raises ValueError: If the item is not found or the update is invalid
    """
    try:
        item = service.update_inbox_item(instance=instance, inbox_id=inbox_id, payload=payload)
    except ValueError as exc:
        error_type = "inbox_not_found" if "not found" in str(exc) else "inbox_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "inbox_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "item": item.model_dump(mode="json")}
