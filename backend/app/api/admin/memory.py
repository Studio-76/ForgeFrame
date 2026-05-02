"""Admin routes for memory and context entries."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord
from app.knowledge.dependencies import get_knowledge_context_admin_service
from app.knowledge.models import (
    CorrectMemory,
    CreateMemory,
    DeleteMemory,
    RevokeMemory,
    UpdateMemory,
)
from app.knowledge.service import KnowledgeContextAdminService

router = APIRouter(prefix="/memory", tags=["admin-memory"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"type": error_type, "message": message}},
    )


@router.get("")
def list_memory(
    status_filter: str | None = Query(default=None, alias="status"),
    visibility_scope: str | None = Query(default=None, alias="visibilityScope"),
    limit: int = 100,
    admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> dict[str, object]:
    """
    List all memory entries for the current instance, with optional filtering.

    :param status_filter: Filter by memory entry status
    :type status_filter: str | None
    :param visibility_scope: Filter by visibility scope
    :type visibility_scope: str | None
    :param limit: Maximum number of entries to return
    :type limit: int
    :param admin: Authenticated admin performing the request
    :type admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected knowledge context admin service
    :type service: KnowledgeContextAdminService
    :return: Status, instance data, and list of memory entries
    :rtype: dict[str, object]
    """
    entries = service.list_memory(
        instance=instance,
        actor=admin,
        status=status_filter,
        visibility_scope=visibility_scope,
        limit=limit,
    )
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "memory": [item.model_dump(mode="json") for item in entries],
    }


@router.get("/{memory_id}")
def get_memory(
    memory_id: str,
    admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    """
    Retrieve a single memory entry by its ID.

    :param memory_id: Unique identifier of the memory entry
    :type memory_id: str
    :param admin: Authenticated admin performing the request
    :type admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected knowledge context admin service
    :type service: KnowledgeContextAdminService
    :return: Status and memory entry data
    :rtype: object
    :raises ValueError: If the memory entry is not found, returns a 404 error response
    """
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
    """
    Create a new memory entry.

    :param payload: Memory creation payload
    :type payload: CreateMemory
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected knowledge context admin service
    :type service: KnowledgeContextAdminService
    :return: Status and created memory entry data
    :rtype: object
    :raises ValueError: If the memory already exists or is invalid
    """
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
    """
    Update an existing memory entry.

    :param memory_id: Unique identifier of the memory entry to update
    :type memory_id: str
    :param payload: Memory update payload
    :type payload: UpdateMemory
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected knowledge context admin service
    :type service: KnowledgeContextAdminService
    :return: Status and updated memory entry data
    :rtype: object
    :raises ValueError: If the memory is not found or the update is invalid
    """
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
    """
    Submit a correction for a memory entry.

    :param memory_id: Unique identifier of the memory entry to correct
    :type memory_id: str
    :param payload: Correction payload with updated information
    :type payload: CorrectMemory
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected knowledge context admin service
    :type service: KnowledgeContextAdminService
    :return: Status, action taken, and corrected memory data
    :rtype: object
    :raises ValueError: If the memory is not found or the correction is invalid
    """
    try:
        result = service.correct_memory(instance=instance, memory_id=memory_id, payload=payload)
    except ValueError as exc:
        error_type = "memory_not_found" if "not found" in str(exc) else "memory_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "memory_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {
        "status": "ok",
        "action": result.action,
        "memory": result.memory.model_dump(mode="json"),
    }


@router.post("/{memory_id}/delete")
def delete_memory(
    memory_id: str,
    payload: DeleteMemory,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    """
    Mark a memory entry for deletion.

    :param memory_id: Unique identifier of the memory entry to delete
    :type memory_id: str
    :param payload: Deletion payload with reason
    :type payload: DeleteMemory
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected knowledge context admin service
    :type service: KnowledgeContextAdminService
    :return: Status, action taken, and affected memory data
    :rtype: object
    :raises ValueError: If the memory is not found or deletion is invalid
    """
    try:
        result = service.delete_memory(instance=instance, memory_id=memory_id, payload=payload)
    except ValueError as exc:
        error_type = "memory_not_found" if "not found" in str(exc) else "memory_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "memory_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {
        "status": "ok",
        "action": result.action,
        "memory": result.memory.model_dump(mode="json"),
    }


@router.post("/{memory_id}/revoke")
def revoke_memory(
    memory_id: str,
    payload: RevokeMemory,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    """
    Revoke a memory entry, invalidating its trust.

    :param memory_id: Unique identifier of the memory entry to revoke
    :type memory_id: str
    :param payload: Revocation payload with reason
    :type payload: RevokeMemory
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected knowledge context admin service
    :type service: KnowledgeContextAdminService
    :return: Status, action taken, and affected memory data
    :rtype: object
    :raises ValueError: If the memory is not found or revocation is invalid
    """
    try:
        result = service.revoke_memory(instance=instance, memory_id=memory_id, payload=payload)
    except ValueError as exc:
        error_type = "memory_not_found" if "not found" in str(exc) else "memory_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "memory_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {
        "status": "ok",
        "action": result.action,
        "memory": result.memory.model_dump(mode="json"),
    }
