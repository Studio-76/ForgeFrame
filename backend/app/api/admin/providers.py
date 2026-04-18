"""Admin provider control-plane endpoints."""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.api.admin.control_plane import (
    ProviderCreateRequest,
    ProviderSyncRequest,
    ProviderUpdateRequest,
    get_control_plane_service,
)
from app.api.admin.control_plane import ControlPlaneService

router = APIRouter(prefix="/providers", tags=["admin-providers"])


def _admin_error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("/")
def list_provider_control_plane(service: ControlPlaneService = Depends(get_control_plane_service)) -> dict[str, object]:
    return {
        "status": "ok",
        "object": "provider_control_plane",
        "providers": service.provider_control_snapshot(),
        "notes": {
            "sync_action": "Model sync can be triggered via POST /admin/providers/sync.",
            "ui_first": True,
            "persistence": "in_memory_phase5",
        },
    }


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=None)
def create_provider(
    payload: ProviderCreateRequest,
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        provider = service.create_provider(payload)
    except ValueError as exc:
        return _admin_error(status.HTTP_409_CONFLICT, "provider_conflict", str(exc))

    return {"status": "ok", "provider": provider.model_dump()}


@router.patch("/{provider_name}" , response_model=None)
def update_provider(
    provider_name: str,
    payload: ProviderUpdateRequest,
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        provider = service.update_provider(provider_name, payload)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "provider_not_found", str(exc))

    return {"status": "ok", "provider": provider.model_dump()}


@router.post("/{provider_name}/activate" , response_model=None)
def activate_provider(provider_name: str, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    try:
        provider = service.set_provider_enabled(provider_name, True)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "provider_not_found", str(exc))
    return {"status": "ok", "provider": provider.model_dump()}


@router.post("/{provider_name}/deactivate" , response_model=None)
def deactivate_provider(provider_name: str, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    try:
        provider = service.set_provider_enabled(provider_name, False)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "provider_not_found", str(exc))
    return {"status": "ok", "provider": provider.model_dump()}


@router.post("/sync" , response_model=None)
def sync_provider_models(
    payload: ProviderSyncRequest,
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        return service.run_sync(payload.provider)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "provider_not_found", str(exc))
