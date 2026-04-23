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
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


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
    try:
        item = service.update_inbox_item(instance=instance, inbox_id=inbox_id, payload=payload)
    except ValueError as exc:
        error_type = "inbox_not_found" if "not found" in str(exc) else "inbox_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "inbox_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "item": item.model_dump(mode="json")}
