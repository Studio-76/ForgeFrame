"""Admin routes for assistant profiles and personal-assistant-mode policies."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.assistant_profiles.dependencies import get_assistant_profile_admin_service
from app.assistant_profiles.models import (
    CreateAssistantProfile,
    EvaluateAssistantAction,
    UpdateAssistantProfile,
)
from app.assistant_profiles.service import AssistantProfileAdminService
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord

router = APIRouter(prefix="/assistant-profiles", tags=["admin-assistant-profiles"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"type": error_type, "message": message}},
    )


@router.get("")
def list_assistant_profiles(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = 100,
    admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: AssistantProfileAdminService = Depends(get_assistant_profile_admin_service),
) -> dict[str, object]:
    """
    List all assistant profiles for the current instance, with optional filtering.

    :param status_filter: Filter by profile status
    :type status_filter: str | None
    :param limit: Maximum number of profiles to return
    :type limit: int
    :param admin: Injected authentication/admin dependency
    :type admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected assistant profile admin service
    :type service: AssistantProfileAdminService
    :return: Status, instance data, and list of profiles
    :rtype: dict[str, object]
    """
    _ = admin
    profiles = service.list_profiles(instance=instance, status=status_filter, limit=limit)
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "profiles": [item.model_dump(mode="json") for item in profiles],
    }


@router.get("/{assistant_profile_id}")
def get_assistant_profile(
    assistant_profile_id: str,
    admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: AssistantProfileAdminService = Depends(get_assistant_profile_admin_service),
) -> object:
    """
    Retrieve a single assistant profile by its ID.

    :param assistant_profile_id: Unique identifier of the assistant profile
    :type assistant_profile_id: str
    :param admin: Injected authentication/admin dependency
    :type admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected assistant profile admin service
    :type service: AssistantProfileAdminService
    :return: Status and assistant profile data
    :rtype: object
    :raises ValueError: If the profile is not found, returns a 404 error response
    """
    _ = admin
    try:
        profile = service.get_profile(instance=instance, assistant_profile_id=assistant_profile_id)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "assistant_profile_not_found", str(exc))
    return {"status": "ok", "profile": profile.model_dump(mode="json")}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_assistant_profile(
    payload: CreateAssistantProfile,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: AssistantProfileAdminService = Depends(get_assistant_profile_admin_service),
) -> object:
    """
    Create a new assistant profile.

    :param payload: Assistant profile creation payload
    :type payload: CreateAssistantProfile
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected assistant profile admin service
    :type service: AssistantProfileAdminService
    :return: Status and created assistant profile data
    :rtype: object
    :raises ValueError: If the profile already exists or is invalid
    """
    try:
        profile = service.create_profile(instance=instance, payload=payload)
    except ValueError as exc:
        error_type = "assistant_profile_conflict" if "already exists" in str(exc) else "assistant_profile_invalid"
        code = status.HTTP_409_CONFLICT if error_type == "assistant_profile_conflict" else status.HTTP_400_BAD_REQUEST
        return _error(code, error_type, str(exc))
    return {"status": "ok", "profile": profile.model_dump(mode="json")}


@router.patch("/{assistant_profile_id}")
def update_assistant_profile(
    assistant_profile_id: str,
    payload: UpdateAssistantProfile,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: AssistantProfileAdminService = Depends(get_assistant_profile_admin_service),
) -> object:
    """
    Update an existing assistant profile.

    :param assistant_profile_id: Unique identifier of the assistant profile to update
    :type assistant_profile_id: str
    :param payload: Assistant profile update payload
    :type payload: UpdateAssistantProfile
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected assistant profile admin service
    :type service: AssistantProfileAdminService
    :return: Status and updated assistant profile data
    :rtype: object
    :raises ValueError: If the profile is not found or the update is invalid
    """
    try:
        profile = service.update_profile(
            instance=instance,
            assistant_profile_id=assistant_profile_id,
            payload=payload,
        )
    except ValueError as exc:
        error_type = "assistant_profile_not_found" if "not found" in str(exc) else "assistant_profile_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "assistant_profile_not_found" else status.HTTP_400_BAD_REQUEST
        return _error(code, error_type, str(exc))
    return {"status": "ok", "profile": profile.model_dump(mode="json")}


@router.post("/{assistant_profile_id}/evaluate-action")
def evaluate_assistant_action(
    assistant_profile_id: str,
    payload: EvaluateAssistantAction,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: AssistantProfileAdminService = Depends(get_assistant_profile_admin_service),
) -> object:
    """
    Evaluate an action against an assistant profile's policy.

    :param assistant_profile_id: Unique identifier of the assistant profile
    :type assistant_profile_id: str
    :param payload: Action evaluation payload
    :type payload: EvaluateAssistantAction
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected assistant profile admin service
    :type service: AssistantProfileAdminService
    :return: Status and evaluation result data
    :rtype: object
    :raises ValueError: If the profile is not found or the evaluation is invalid
    """
    try:
        evaluation = service.evaluate_action(
            instance=instance,
            assistant_profile_id=assistant_profile_id,
            payload=payload,
        )
    except ValueError as exc:
        error_type = "assistant_profile_not_found" if "Assistant profile" in str(exc) else "assistant_profile_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "assistant_profile_not_found" else status.HTTP_400_BAD_REQUEST
        return _error(code, error_type, str(exc))
    return {"status": "ok", "evaluation": evaluation.model_dump(mode="json")}
