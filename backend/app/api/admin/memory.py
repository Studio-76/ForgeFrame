"""Admin routes for memory and context entries."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord
from app.knowledge.dependencies import get_knowledge_context_admin_service
from app.knowledge.models import CorrectMemory, CreateMemory, DeleteMemory, RevokeMemory, UpdateMemory
from app.knowledge.service import KnowledgeContextAdminService

router = APIRouter(prefix="/memory", tags=["admin-memory"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("")
def list_memory(
    status_filter: str | None = Query(default=None, alias="status"),
    visibility_scope: str | None = Query(default=None, alias="visibilityScope"),
    limit: int = 100,
    admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> dict[str, object]:
    entries = service.list_memory(instance=instance, actor=admin, status=status_filter, visibility_scope=visibility_scope, limit=limit)
    return {"status": "ok", "instance": instance.model_dump(mode="json"), "memory": [item.model_dump(mode="json") for item in entries]}


@router.get("/{memory_id}")
def get_memory(
    memory_id: str,
    admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    try:
        memory = service.get_memory(instance=instance, actor=admin, memory_id=memory_id)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "memory_not_found", str(exc))
    return {"status": "ok", "memory": memory.model_dump(mode="json")}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_memory(
    payload: CreateMemory,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    try:
        memory = service.create_memory(instance=instance, payload=payload)
    except ValueError as exc:
        error_type = "memory_conflict" if "already exists" in str(exc) else "memory_invalid"
        code = status.HTTP_409_CONFLICT if error_type == "memory_conflict" else status.HTTP_404_NOT_FOUND
        return _error(code, error_type, str(exc))
    return {"status": "ok", "memory": memory.model_dump(mode="json")}


@router.patch("/{memory_id}")
def update_memory(
    memory_id: str,
    payload: UpdateMemory,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    try:
        memory = service.update_memory(instance=instance, memory_id=memory_id, payload=payload)
    except ValueError as exc:
        error_type = "memory_not_found" if "not found" in str(exc) else "memory_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "memory_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "memory": memory.model_dump(mode="json")}


@router.post("/{memory_id}/correct")
def correct_memory(
    memory_id: str,
    payload: CorrectMemory,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    try:
        result = service.correct_memory(instance=instance, memory_id=memory_id, payload=payload)
    except ValueError as exc:
        error_type = "memory_not_found" if "not found" in str(exc) else "memory_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "memory_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "action": result.action, "memory": result.memory.model_dump(mode="json")}


@router.post("/{memory_id}/delete")
def delete_memory(
    memory_id: str,
    payload: DeleteMemory,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    try:
        result = service.delete_memory(instance=instance, memory_id=memory_id, payload=payload)
    except ValueError as exc:
        error_type = "memory_not_found" if "not found" in str(exc) else "memory_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "memory_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "action": result.action, "memory": result.memory.model_dump(mode="json")}


@router.post("/{memory_id}/revoke")
def revoke_memory(
    memory_id: str,
    payload: RevokeMemory,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    try:
        result = service.revoke_memory(instance=instance, memory_id=memory_id, payload=payload)
    except ValueError as exc:
        error_type = "memory_not_found" if "not found" in str(exc) else "memory_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "memory_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "action": result.action, "memory": result.memory.model_dump(mode="json")}
