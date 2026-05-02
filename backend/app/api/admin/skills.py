"""Admin routes for the skills system."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord
from app.skills.dependencies import get_skill_admin_service
from app.skills.models import (
    ActivateSkillVersion,
    CreateSkill,
    RecordSkillUsage,
    UpdateSkill,
)
from app.skills.service import SkillAdminService

router = APIRouter(prefix="/skills", tags=["admin-skills"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"type": error_type, "message": message}},
    )


@router.get("")
def list_skills(
    status_filter: str | None = Query(default=None, alias="status"),
    scope: str | None = Query(default=None, alias="scope"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: SkillAdminService = Depends(get_skill_admin_service),
) -> dict[str, object]:
    """
    List all skills for the current instance, with optional filtering.

    :param status_filter: Filter by skill status
    :type status_filter: str | None
    :param scope: Filter by skill scope
    :type scope: str | None
    :param limit: Maximum number of skills to return
    :type limit: int
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected skill admin service
    :type service: SkillAdminService
    :return: Status, instance data, and list of skills
    :rtype: dict[str, object]
    """
    skills = service.list_skills(instance=instance, status=status_filter, scope=scope, limit=limit)
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "skills": [item.model_dump(mode="json") for item in skills],
    }


@router.get("/{skill_id}")
def get_skill(
    skill_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: SkillAdminService = Depends(get_skill_admin_service),
) -> object:
    """
    Retrieve a single skill by its ID.

    :param skill_id: Unique identifier of the skill
    :type skill_id: str
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected skill admin service
    :type service: SkillAdminService
    :return: Status and skill data
    :rtype: object
    :raises ValueError: If the skill is not found, returns a 404 error response
    """
    try:
        skill = service.get_skill(instance=instance, skill_id=skill_id)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "skill_not_found", str(exc))
    return {"status": "ok", "skill": skill.model_dump(mode="json")}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_skill(
    payload: CreateSkill,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: SkillAdminService = Depends(get_skill_admin_service),
) -> object:
    """
    Create a new skill.

    :param payload: Skill creation payload
    :type payload: CreateSkill
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected skill admin service
    :type service: SkillAdminService
    :return: Status and created skill data
    :rtype: object
    :raises ValueError: If the skill already exists or is invalid, returns an error response
    """
    try:
        skill = service.create_skill(instance=instance, payload=payload)
    except ValueError as exc:
        error_type = "skill_conflict" if "already exists" in str(exc) else "skill_invalid"
        code = status.HTTP_409_CONFLICT if error_type == "skill_conflict" else status.HTTP_404_NOT_FOUND
        return _error(code, error_type, str(exc))
    return {"status": "ok", "skill": skill.model_dump(mode="json")}


@router.patch("/{skill_id}")
def update_skill(
    skill_id: str,
    payload: UpdateSkill,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: SkillAdminService = Depends(get_skill_admin_service),
) -> object:
    """
    Update an existing skill.

    :param skill_id: Unique identifier of the skill to update
    :type skill_id: str
    :param payload: Skill update payload
    :type payload: UpdateSkill
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected skill admin service
    :type service: SkillAdminService
    :return: Status and updated skill data
    :rtype: object
    :raises ValueError: If the skill is not found or the update is invalid
    """
    try:
        skill = service.update_skill(instance=instance, skill_id=skill_id, payload=payload)
    except ValueError as exc:
        error_type = "skill_not_found" if "not found" in str(exc) else "skill_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "skill_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "skill": skill.model_dump(mode="json")}


@router.post("/{skill_id}/activate")
def activate_skill(
    skill_id: str,
    payload: ActivateSkillVersion,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: SkillAdminService = Depends(get_skill_admin_service),
) -> object:
    """
    Activate a specific version of a skill.

    :param skill_id: Unique identifier of the skill to activate
    :type skill_id: str
    :param payload: Activation payload specifying the version to activate
    :type payload: ActivateSkillVersion
    :param admin: Authenticated admin performing the activation
    :type admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected skill admin service
    :type service: SkillAdminService
    :return: Status and skill data with activated version
    :rtype: object
    :raises ValueError: If the skill is not found or activation is invalid
    """
    try:
        skill = service.activate_skill(
            instance=instance,
            skill_id=skill_id,
            payload=payload,
            actor_type="user",
            actor_id=admin.user_id,
        )
    except ValueError as exc:
        error_type = "skill_not_found" if "not found" in str(exc) else "skill_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "skill_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "skill": skill.model_dump(mode="json")}


@router.post("/{skill_id}/archive")
def archive_skill(
    skill_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: SkillAdminService = Depends(get_skill_admin_service),
) -> object:
    """
    Archive a skill, marking it as inactive.

    :param skill_id: Unique identifier of the skill to archive
    :type skill_id: str
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected skill admin service
    :type service: SkillAdminService
    :return: Status and archived skill data
    :rtype: object
    :raises ValueError: If the skill is not found or archiving is invalid
    """
    try:
        skill = service.archive_skill(instance=instance, skill_id=skill_id)
    except ValueError as exc:
        error_type = "skill_not_found" if "not found" in str(exc) else "skill_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "skill_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "skill": skill.model_dump(mode="json")}


@router.post("/{skill_id}/usage-events")
def record_skill_usage(
    skill_id: str,
    payload: RecordSkillUsage,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: SkillAdminService = Depends(get_skill_admin_service),
) -> object:
    """
    Record a usage event for a skill.

    :param skill_id: Unique identifier of the skill
    :type skill_id: str
    :param payload: Usage event payload
    :type payload: RecordSkillUsage
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected skill admin service
    :type service: SkillAdminService
    :return: Status and skill data with updated usage info
    :rtype: object
    :raises ValueError: If the skill is not found or usage data is invalid
    """
    try:
        skill = service.record_usage(instance=instance, skill_id=skill_id, payload=payload)
    except ValueError as exc:
        error_type = "skill_not_found" if "not found" in str(exc) else "skill_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "skill_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "skill": skill.model_dump(mode="json")}
