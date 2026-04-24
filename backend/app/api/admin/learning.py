"""Admin routes for learning persistence and promotion review."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord
from app.learning.dependencies import get_learning_admin_service
from app.learning.models import CreateLearningEvent, DecideLearningEvent
from app.learning.service import LearningAdminService

router = APIRouter(prefix="/learning", tags=["admin-learning"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("")
def list_learning_events(
    status_filter: str | None = Query(default=None, alias="status"),
    trigger_kind: str | None = Query(default=None, alias="triggerKind"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: LearningAdminService = Depends(get_learning_admin_service),
) -> dict[str, object]:
    events = service.list_events(instance=instance, status=status_filter, trigger_kind=trigger_kind, limit=limit)
    return {"status": "ok", "instance": instance.model_dump(mode="json"), "events": [item.model_dump(mode="json") for item in events]}


@router.get("/{event_id}")
def get_learning_event(
    event_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: LearningAdminService = Depends(get_learning_admin_service),
) -> object:
    try:
        event = service.get_event(instance=instance, event_id=event_id)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "learning_event_not_found", str(exc))
    return {"status": "ok", "event": event.model_dump(mode="json")}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_learning_event(
    payload: CreateLearningEvent,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: LearningAdminService = Depends(get_learning_admin_service),
) -> object:
    try:
        event = service.create_event(instance=instance, payload=payload)
    except ValueError as exc:
        return _error(status.HTTP_409_CONFLICT, "learning_event_invalid", str(exc))
    return {"status": "ok", "event": event.model_dump(mode="json")}


@router.post("/pattern-scan")
def scan_learning_patterns(
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: LearningAdminService = Depends(get_learning_admin_service),
) -> dict[str, object]:
    events = service.scan_patterns(instance=instance)
    return {"status": "ok", "events": [item.model_dump(mode="json") for item in events]}


@router.post("/{event_id}/decide")
def decide_learning_event(
    event_id: str,
    payload: DecideLearningEvent,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: LearningAdminService = Depends(get_learning_admin_service),
) -> object:
    try:
        event = service.decide_event(instance=instance, event_id=event_id, payload=payload)
    except ValueError as exc:
        error_type = "learning_event_not_found" if "not found" in str(exc) else "learning_event_invalid"
        code = status.HTTP_404_NOT_FOUND if error_type == "learning_event_not_found" else status.HTTP_409_CONFLICT
        return _error(code, error_type, str(exc))
    return {"status": "ok", "event": event.model_dump(mode="json")}
