"""Admin routes for conversations, threads, sessions, and message history."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.conversations.dependencies import get_conversation_inbox_admin_service
from app.conversations.models import AppendConversationMessage, CreateConversation, UpdateConversation
from app.conversations.service import ConversationInboxAdminService
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord

router = APIRouter(prefix="/conversations", tags=["admin-conversations"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("")
def list_conversations(
    status_filter: str | None = Query(default=None, alias="status"),
    triage_status: str | None = Query(default=None, alias="triageStatus"),
    agent_id: str | None = Query(default=None, alias="agentId"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ConversationInboxAdminService = Depends(get_conversation_inbox_admin_service),
) -> dict[str, object]:
    conversations = service.list_conversations(
        instance=instance,
        status=status_filter,
        triage_status=triage_status,
        agent_id=agent_id,
        limit=limit,
    )
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "conversations": [item.model_dump(mode="json") for item in conversations],
    }


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ConversationInboxAdminService = Depends(get_conversation_inbox_admin_service),
) -> object:
    try:
        conversation = service.get_conversation(instance=instance, conversation_id=conversation_id)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "conversation_not_found", str(exc))
    return {"status": "ok", "conversation": conversation.model_dump(mode="json")}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: CreateConversation,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ConversationInboxAdminService = Depends(get_conversation_inbox_admin_service),
) -> object:
    try:
        conversation = service.create_conversation(
            instance=instance,
            payload=payload,
            actor_type="user",
            actor_id=admin.user_id,
        )
    except ValueError as exc:
        error_type = "conversation_conflict" if "already exists" in str(exc) else "conversation_invalid"
        code = status.HTTP_409_CONFLICT if error_type == "conversation_conflict" else status.HTTP_404_NOT_FOUND
        return _error(code, error_type, str(exc))
    return {"status": "ok", "conversation": conversation.model_dump(mode="json")}


@router.patch("/{conversation_id}")
def update_conversation(
    conversation_id: str,
    payload: UpdateConversation,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ConversationInboxAdminService = Depends(get_conversation_inbox_admin_service),
) -> object:
    try:
        conversation = service.update_conversation(instance=instance, conversation_id=conversation_id, payload=payload)
    except ValueError as exc:
        error_type = "conversation_not_found" if "not found" in str(exc) else "conversation_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "conversation_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "conversation": conversation.model_dump(mode="json")}


@router.post("/{conversation_id}/messages")
def append_conversation_message(
    conversation_id: str,
    payload: AppendConversationMessage,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ConversationInboxAdminService = Depends(get_conversation_inbox_admin_service),
) -> object:
    try:
        conversation = service.append_message(
            instance=instance,
            conversation_id=conversation_id,
            payload=payload,
            actor_type="user",
            actor_id=admin.user_id,
        )
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "conversation_invalid", str(exc))
    return {"status": "ok", "conversation": conversation.model_dump(mode="json")}
