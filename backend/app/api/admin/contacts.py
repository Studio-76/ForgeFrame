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
    return JSONResponse(
        status_code=status_code,
        content={"error": {"type": error_type, "message": message}},
    )


@router.get("")
def list_contacts(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = 100,
    admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> dict[str, object]:
    """
    List all contacts for the current instance, with optional filtering.

    :param status_filter: Filter by contact status
    :type status_filter: str | None
    :param limit: Maximum number of contacts to return
    :type limit: int
    :param admin: Authenticated admin performing the request
    :type admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected knowledge context admin service
    :type service: KnowledgeContextAdminService
    :return: Status, instance data, and list of contacts
    :rtype: dict[str, object]
    """
    contacts = service.list_contacts(instance=instance, actor=admin, status=status_filter, limit=limit)
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "contacts": [item.model_dump(mode="json") for item in contacts],
    }


@router.get("/{contact_id}")
def get_contact(
    contact_id: str,
    admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: KnowledgeContextAdminService = Depends(get_knowledge_context_admin_service),
) -> object:
    """
    Retrieve a single contact by its ID.

    :param contact_id: Unique identifier of the contact
    :type contact_id: str
    :param admin: Authenticated admin performing the request
    :type admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected knowledge context admin service
    :type service: KnowledgeContextAdminService
    :return: Status and contact data
    :rtype: object
    :raises ValueError: If the contact is not found, returns a 404 error response
    """
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
    """
    Create a new contact.

    :param payload: Contact creation payload
    :type payload: CreateContact
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected knowledge context admin service
    :type service: KnowledgeContextAdminService
    :return: Status and created contact data
    :rtype: object
    :raises ValueError: If the contact already exists or is invalid
    """
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
    """
    Update an existing contact.

    :param contact_id: Unique identifier of the contact to update
    :type contact_id: str
    :param payload: Contact update payload
    :type payload: UpdateContact
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected knowledge context admin service
    :type service: KnowledgeContextAdminService
    :return: Status and updated contact data
    :rtype: object
    :raises ValueError: If the contact is not found or the update is invalid
    """
    try:
        contact = service.update_contact(instance=instance, contact_id=contact_id, payload=payload)
    except ValueError as exc:
        error_type = "contact_not_found" if "not found" in str(exc) else "contact_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "contact_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "contact": contact.model_dump(mode="json")}
