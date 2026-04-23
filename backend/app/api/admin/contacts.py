"""Admin routes for contacts."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord
from app.knowledge.dependencies import get_knowledge_context_admin_service
from app.knowledge.models import CreateContact, UpdateContact
from app.knowledge.service import KnowledgeContextAdminService

router = APIRouter(prefix="/contacts", tags=["admin-contacts"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("")
def list_contacts(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = 100,
    admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> dict[str, object]:
    contacts = service.list_contacts(instance=instance, actor=admin, status=status_filter, limit=limit)
    return {"status": "ok", "instance": instance.model_dump(mode="json"), "contacts": [item.model_dump(mode="json") for item in contacts]}


@router.get("/{contact_id}")
def get_contact(
    contact_id: str,
    admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    try:
        contact = service.get_contact(instance=instance, actor=admin, contact_id=contact_id)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "contact_not_found", str(exc))
    return {"status": "ok", "contact": contact.model_dump(mode="json")}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_contact(
    payload: CreateContact,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    try:
        contact = service.create_contact(instance=instance, payload=payload)
    except ValueError as exc:
        error_type = "contact_conflict" if "already exists" in str(exc) else "contact_invalid"
        code = status.HTTP_409_CONFLICT if error_type == "contact_conflict" else status.HTTP_404_NOT_FOUND
        return _error(code, error_type, str(exc))
    return {"status": "ok", "contact": contact.model_dump(mode="json")}


@router.patch("/{contact_id}")
def update_contact(
    contact_id: str,
    payload: UpdateContact,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    try:
        contact = service.update_contact(instance=instance, contact_id=contact_id, payload=payload)
    except ValueError as exc:
        error_type = "contact_not_found" if "not found" in str(exc) else "contact_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "contact_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "contact": contact.model_dump(mode="json")}

