"""Admin routes for the skills system."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord
from app.skills.dependencies import get_skill_admin_service
from app.skills.models import ActivateSkillVersion, CreateSkill, RecordSkillUsage, UpdateSkill
from app.skills.service import SkillAdminService

router = APIRouter(prefix="/skills", tags=["admin-skills"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("")
def list_skills(
    status_filter: str | None = Query(default=None, alias="status"),
    scope: str | None = Query(default=None, alias="scope"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: SkillAdminService = Depends(get_skill_admin_service),
) -> dict[str, object]:
    skills = service.list_skills(instance=instance, status=status_filter, scope=scope, limit=limit)
    return {"status": "ok", "instance": instance.model_dump(mode="json"), "skills": [item.model_dump(mode="json") for item in skills]}


@router.get("/{skill_id}")
def get_skill(
    skill_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: SkillAdminService = Depends(get_skill_admin_service),
) -> object:
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
    try:
        skill = service.activate_skill(instance=instance, skill_id=skill_id, payload=payload, actor_type="user", actor_id=admin.user_id)
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
    try:
        skill = service.record_usage(instance=instance, skill_id=skill_id, payload=payload)
    except ValueError as exc:
        error_type = "skill_not_found" if "not found" in str(exc) else "skill_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "skill_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "skill": skill.model_dump(mode="json")}
