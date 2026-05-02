"""Admin routes for instance-scoped agents."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.agents.dependencies import get_agent_admin_service
from app.agents.models import ArchiveAgent, CreateAgent, UpdateAgent
from app.agents.service import AgentAdminService
from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord

router = APIRouter(prefix="/agents", tags=["admin-agents"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"type": error_type, "message": message}},
    )


@router.get("")
def list_agents(
    status_filter: str | None = Query(default=None, alias="status"),
    ensure_default_operator: bool = Query(default=False, alias="ensureDefaultOperator"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: AgentAdminService = Depends(get_agent_admin_service),
) -> dict[str, object]:
    """
    List all agents for the current instance, with optional filtering.

    :param status_filter: Filter by agent status
    :type status_filter: str | None
    :param ensure_default_operator: Whether to ensure a default operator agent exists
    :type ensure_default_operator: bool
    :param limit: Maximum number of agents to return
    :type limit: int
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected agent admin service
    :type service: AgentAdminService
    :return: Status, instance data, and list of agents
    :rtype: dict[str, object]
    """
    agents = service.list_agents(
        instance=instance,
        status=status_filter,
        limit=limit,
        ensure_default_operator=ensure_default_operator,
    )
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "agents": [item.model_dump(mode="json") for item in agents],
    }


@router.get("/{agent_id}")
def get_agent(
    agent_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: AgentAdminService = Depends(get_agent_admin_service),
) -> object:
    """
    Retrieve a single agent by its ID.

    :param agent_id: Unique identifier of the agent
    :type agent_id: str
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected agent admin service
    :type service: AgentAdminService
    :return: Status and agent data
    :rtype: object
    :raises ValueError: If the agent is not found, returns a 404 error response
    """
    try:
        agent = service.get_agent(instance=instance, agent_id=agent_id)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "agent_not_found", str(exc))
    return {"status": "ok", "agent": agent.model_dump(mode="json")}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_agent(
    payload: CreateAgent,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: AgentAdminService = Depends(get_agent_admin_service),
) -> object:
    """
    Create a new agent.

    :param payload: Agent creation payload
    :type payload: CreateAgent
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected agent admin service
    :type service: AgentAdminService
    :return: Status and created agent data
    :rtype: object
    :raises ValueError: If the agent already exists or is invalid
    """
    try:
        agent = service.create_agent(instance=instance, payload=payload)
    except ValueError as exc:
        error_type = "agent_conflict" if "already exists" in str(exc) else "agent_invalid"
        code = status.HTTP_409_CONFLICT if error_type == "agent_conflict" else status.HTTP_404_NOT_FOUND
        return _error(code, error_type, str(exc))
    return {"status": "ok", "agent": agent.model_dump(mode="json")}


@router.patch("/{agent_id}")
def update_agent(
    agent_id: str,
    payload: UpdateAgent,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: AgentAdminService = Depends(get_agent_admin_service),
) -> object:
    """
    Update an existing agent.

    :param agent_id: Unique identifier of the agent to update
    :type agent_id: str
    :param payload: Agent update payload
    :type payload: UpdateAgent
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected agent admin service
    :type service: AgentAdminService
    :return: Status and updated agent data
    :rtype: object
    :raises ValueError: If the agent is not found or the update is invalid
    """
    try:
        agent = service.update_agent(instance=instance, agent_id=agent_id, payload=payload)
    except ValueError as exc:
        error_type = "agent_not_found" if "not found" in str(exc) else "agent_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "agent_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "agent": agent.model_dump(mode="json")}


@router.post("/{agent_id}/archive")
def archive_agent(
    agent_id: str,
    payload: ArchiveAgent,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: AgentAdminService = Depends(get_agent_admin_service),
) -> object:
    """
    Archive an agent, optionally replacing it with another agent.

    :param agent_id: Unique identifier of the agent to archive
    :type agent_id: str
    :param payload: Archive payload with optional replacement agent and reason
    :type payload: ArchiveAgent
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected agent admin service
    :type service: AgentAdminService
    :return: Status and archived agent data
    :rtype: object
    :raises ValueError: If the agent is not found or archiving is invalid
    """
    try:
        agent = service.archive_agent(
            instance=instance,
            agent_id=agent_id,
            replacement_agent_id=payload.replacement_agent_id,
            reason=payload.reason,
        )
    except ValueError as exc:
        error_type = "agent_not_found" if "not found" in str(exc) else "agent_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "agent_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "agent": agent.model_dump(mode="json")}
