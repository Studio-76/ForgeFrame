"""Admin routes for knowledge sources and connector registry truth."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord
from app.knowledge.dependencies import get_knowledge_context_admin_service
from app.knowledge.models import CreateKnowledgeSource, UpdateKnowledgeSource
from app.knowledge.service import KnowledgeContextAdminService

router = APIRouter(prefix="/knowledge-sources", tags=["admin-knowledge-sources"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("")
def list_sources(
    source_kind: str | None = Query(default=None, alias="sourceKind"),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = 100,
    admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> dict[str, object]:
    sources = service.list_sources(instance=instance, actor=admin, source_kind=source_kind, status=status_filter, limit=limit)
    return {"status": "ok", "instance": instance.model_dump(mode="json"), "sources": [item.model_dump(mode="json") for item in sources]}


@router.get("/{source_id}")
def get_source(
    source_id: str,
    admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    try:
        source = service.get_source(instance=instance, actor=admin, source_id=source_id)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "knowledge_source_not_found", str(exc))
    return {"status": "ok", "source": source.model_dump(mode="json")}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_source(
    payload: CreateKnowledgeSource,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    try:
        source = service.create_source(instance=instance, payload=payload)
    except ValueError as exc:
        error_type = "knowledge_source_conflict" if "already exists" in str(exc) else "knowledge_source_invalid"
        code = status.HTTP_409_CONFLICT if error_type == "knowledge_source_conflict" else status.HTTP_404_NOT_FOUND
        return _error(code, error_type, str(exc))
    return {"status": "ok", "source": source.model_dump(mode="json")}


@router.patch("/{source_id}")
def update_source(
    source_id: str,
    payload: UpdateKnowledgeSource,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    try:
        source = service.update_source(instance=instance, source_id=source_id, payload=payload)
    except ValueError as exc:
        error_type = "knowledge_source_not_found" if "not found" in str(exc) else "knowledge_source_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "knowledge_source_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "source": source.model_dump(mode="json")}

