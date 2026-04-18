"""Admin provider control-plane endpoints."""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.api.admin.control_plane import (
    ControlPlaneService,
    HealthConfigUpdateRequest,
    ProviderCreateRequest,
    ProviderSyncRequest,
    ProviderUpdateRequest,
    get_control_plane_service,
)
from app.harness.models import HarnessPreviewRequest, HarnessProviderProfile, HarnessVerificationRequest

router = APIRouter(prefix="/providers", tags=["admin-providers"])


def _admin_error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("/")
def list_provider_control_plane(service: ControlPlaneService = Depends(get_control_plane_service)) -> dict[str, object]:
    return {
        "status": "ok",
        "object": "provider_control_plane",
        "providers": service.provider_control_snapshot(),
        "health_config": service.get_health_config().model_dump(),
        "notes": {
            "sync_action": "Model sync can be triggered via POST /admin/providers/sync.",
            "health_action": "Model health checks can be configured and triggered via /admin/providers/health endpoints.",
            "harness_actions": ["preview", "dry_run", "verify", "probe", "snapshot"],
            "persistence": "json_file_backed_harness_profiles",
        },
    }


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=None)
def create_provider(payload: ProviderCreateRequest, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    try:
        provider = service.create_provider(payload)
    except ValueError as exc:
        return _admin_error(status.HTTP_409_CONFLICT, "provider_conflict", str(exc))
    return {"status": "ok", "provider": provider.model_dump()}


@router.patch("/{provider_name}", response_model=None)
def update_provider(provider_name: str, payload: ProviderUpdateRequest, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    try:
        provider = service.update_provider(provider_name, payload)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "provider_not_found", str(exc))
    return {"status": "ok", "provider": provider.model_dump()}


@router.post("/{provider_name}/activate", response_model=None)
def activate_provider(provider_name: str, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    try:
        provider = service.set_provider_enabled(provider_name, True)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "provider_not_found", str(exc))
    return {"status": "ok", "provider": provider.model_dump()}


@router.post("/{provider_name}/deactivate", response_model=None)
def deactivate_provider(provider_name: str, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    try:
        provider = service.set_provider_enabled(provider_name, False)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "provider_not_found", str(exc))
    return {"status": "ok", "provider": provider.model_dump()}


@router.post("/sync", response_model=None)
def sync_provider_models(payload: ProviderSyncRequest, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    try:
        return service.run_sync(payload.provider)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "provider_not_found", str(exc))


@router.get("/health/config")
def get_health_config(service: ControlPlaneService = Depends(get_control_plane_service)) -> dict[str, object]:
    return {"status": "ok", "config": service.get_health_config().model_dump()}


@router.patch("/health/config")
def patch_health_config(payload: HealthConfigUpdateRequest, service: ControlPlaneService = Depends(get_control_plane_service)) -> dict[str, object]:
    return {"status": "ok", "config": service.update_health_config(payload).model_dump()}


@router.post("/health/run")
def run_health_checks(service: ControlPlaneService = Depends(get_control_plane_service)) -> dict[str, object]:
    return service.run_health_checks()


@router.get("/harness/templates")
def list_harness_templates(service: ControlPlaneService = Depends(get_control_plane_service)) -> dict[str, object]:
    return {"status": "ok", "templates": service.list_harness_templates()}


@router.get("/harness/profiles")
def list_harness_profiles(service: ControlPlaneService = Depends(get_control_plane_service)) -> dict[str, object]:
    return {"status": "ok", "profiles": [item.model_dump() for item in service.list_harness_profiles()]}


@router.put("/harness/profiles/{provider_key}")
def upsert_harness_profile(provider_key: str, payload: HarnessProviderProfile, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    if payload.provider_key != provider_key:
        return _admin_error(status.HTTP_400_BAD_REQUEST, "provider_key_mismatch", "Path provider_key and payload.provider_key must match.")
    profile = service.upsert_harness_profile(payload)
    return {"status": "ok", "profile": profile.model_dump()}


@router.delete("/harness/profiles/{provider_key}")
def delete_harness_profile(provider_key: str, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    try:
        service.delete_harness_profile(provider_key)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "harness_profile_not_found", str(exc))
    return {"status": "ok", "deleted": provider_key}


@router.post("/harness/profiles/{provider_key}/activate")
def activate_harness_profile(provider_key: str, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    try:
        profile = service.set_harness_profile_active(provider_key, True)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "harness_profile_not_found", str(exc))
    return {"status": "ok", "profile": profile.model_dump()}


@router.post("/harness/profiles/{provider_key}/deactivate")
def deactivate_harness_profile(provider_key: str, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    try:
        profile = service.set_harness_profile_active(provider_key, False)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "harness_profile_not_found", str(exc))
    return {"status": "ok", "profile": profile.model_dump()}


@router.post("/harness/preview")
def harness_preview(payload: HarnessPreviewRequest, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    try:
        return service.harness_preview(payload)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "harness_profile_not_found", str(exc))


@router.post("/harness/dry-run")
def harness_dry_run(payload: HarnessPreviewRequest, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    try:
        return service.harness_dry_run(payload)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "harness_profile_not_found", str(exc))


@router.post("/harness/probe")
def harness_probe(payload: HarnessPreviewRequest, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    try:
        return service.harness_probe(payload)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "harness_profile_not_found", str(exc))
    except RuntimeError as exc:
        return _admin_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "harness_probe_failed", str(exc))


@router.post("/harness/verify")
def verify_harness_profile(payload: HarnessVerificationRequest, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    try:
        result = service.verify_harness_profile(payload)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "harness_profile_not_found", str(exc))
    except RuntimeError as exc:
        return _admin_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "harness_verification_failed", str(exc))
    return {"status": "ok", "verification": result}


@router.get("/harness/snapshot")
def harness_snapshot(service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    return service.harness_snapshot()


@router.get("/harness/runs")
def harness_runs(provider_key: str | None = None, mode: str | None = None, status: str | None = None, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    return service.harness_runs(provider_key, mode, status)
