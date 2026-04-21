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
from app.api.admin.security import require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.harness.models import HarnessImportRequest, HarnessPreviewRequest, HarnessProviderProfile, HarnessVerificationRequest

router = APIRouter(prefix="/providers", tags=["admin-providers"])


def _admin_error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("/")
def list_provider_control_plane(service: ControlPlaneService = Depends(get_control_plane_service)) -> dict[str, object]:
    bootstrap_readiness = service.get_last_bootstrap_readiness()
    truth_axes = service.provider_truth_axes()
    return {
        "status": "ok",
        "object": "provider_control_plane",
        "providers": service.provider_control_snapshot(),
        "truth_axes": [item.model_dump() for item in truth_axes],
        "health_config": service.get_health_config().model_dump(),
        "bootstrap_readiness": bootstrap_readiness.model_dump() if bootstrap_readiness else None,
        "notes": {
            "sync_action": "Model sync can be triggered via POST /admin/providers/sync.",
            "health_action": "Model health checks can be configured and triggered via /admin/providers/health endpoints.",
            "harness_actions": ["preview", "dry_run", "verify", "probe", "snapshot"],
            "persistence": "repository_backed_harness_profiles",
            "product_axes": [
                "oauth_account_providers",
                "openai_compatible_providers",
                "local_providers",
                "openai_compatible_clients",
            ],
            "truth_contract": [
                "provider_truth",
                "runtime_truth",
                "harness_truth",
                "ui_truth",
            ],
        },
    }


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=None)
def create_provider(
    payload: ProviderCreateRequest,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        provider = service.create_provider(payload)
    except ValueError as exc:
        return _admin_error(status.HTTP_409_CONFLICT, "provider_conflict", str(exc))
    return {"status": "ok", "provider": provider.model_dump()}


@router.patch("/{provider_name}", response_model=None)
def update_provider(
    provider_name: str,
    payload: ProviderUpdateRequest,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        provider = service.update_provider(provider_name, payload)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "provider_not_found", str(exc))
    return {"status": "ok", "provider": provider.model_dump()}


@router.post("/{provider_name}/activate", response_model=None)
def activate_provider(
    provider_name: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        provider = service.set_provider_enabled(provider_name, True)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "provider_not_found", str(exc))
    return {"status": "ok", "provider": provider.model_dump()}


@router.post("/{provider_name}/deactivate", response_model=None)
def deactivate_provider(
    provider_name: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        provider = service.set_provider_enabled(provider_name, False)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "provider_not_found", str(exc))
    return {"status": "ok", "provider": provider.model_dump()}


@router.post("/sync", response_model=None)
def sync_provider_models(
    payload: ProviderSyncRequest,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        return service.run_sync(payload.provider)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "provider_not_found", str(exc))


@router.get("/health/config")
def get_health_config(service: ControlPlaneService = Depends(get_control_plane_service)) -> dict[str, object]:
    return {"status": "ok", "config": service.get_health_config().model_dump()}


@router.patch("/health/config")
def patch_health_config(
    payload: HealthConfigUpdateRequest,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    return {"status": "ok", "config": service.update_health_config(payload).model_dump()}


@router.post("/health/run")
def run_health_checks(
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    return service.run_health_checks()


@router.get("/beta-targets")
def list_beta_targets(service: ControlPlaneService = Depends(get_control_plane_service)) -> dict[str, object]:
    return {"status": "ok", "targets": service.beta_provider_targets()}


@router.post("/oauth-account/probe/{provider_key}")
def probe_oauth_account_provider(
    provider_key: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        result = service.probe_oauth_account_provider(provider_key)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "oauth_provider_not_found", str(exc))
    return {"status": "ok", "probe": result.model_dump()}


@router.get("/oauth-account/targets")
def list_oauth_account_targets(service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    return {"status": "ok", "targets": service.list_oauth_account_target_statuses()}


@router.get("/oauth-account/onboarding")
def oauth_account_onboarding(service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    return service.oauth_account_onboarding_summary()


@router.get("/oauth-account/operations")
def oauth_account_operations(service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    return service.oauth_account_operations_summary()


@router.get("/compatibility-matrix")
def compatibility_matrix(service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    truth_axes = service.provider_truth_axes()
    matrix = []
    for item in truth_axes:
        capabilities = item.runtime.capabilities
        matrix.append(
            {
                "provider": item.provider.provider,
                "label": item.provider.label,
                "tier": item.runtime.compatibility_tier,
                "ready": item.runtime.ready,
                "provider_axis": item.runtime.provider_axis,
                "streaming": "full" if capabilities.get("streaming") else "none",
                "tool_calling": str(capabilities.get("tool_calling_level", "none")),
                "vision": "full" if capabilities.get("vision") else "none",
                "discovery": "full" if item.runtime.discovery_supported else "none",
                "oauth_required": item.runtime.oauth_required,
                "ui_models": item.ui.model_count,
                "notes": item.runtime.readiness_reason,
            }
        )
    return {"status": "ok", "matrix": matrix}


@router.post("/oauth-account/probe-all")
def probe_all_oauth_account_targets(
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    results = []
    for provider_key in ["openai_codex", "gemini", "antigravity", "github_copilot", "claude_code"]:
        try:
            results.append(service.probe_oauth_account_provider(provider_key).model_dump())
        except ValueError as exc:
            results.append({"provider_key": provider_key, "status": "failed", "details": str(exc)})
    return {"status": "ok", "probes": results}


@router.post("/oauth-account/bridge-profiles/sync")
def sync_oauth_account_bridge_profiles(
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return service.sync_oauth_account_bridge_profiles()


@router.get("/bootstrap/readiness")
def bootstrap_readiness(service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    return service.bootstrap_readiness_report()


@router.get("/harness/templates")
def list_harness_templates(service: ControlPlaneService = Depends(get_control_plane_service)) -> dict[str, object]:
    return {"status": "ok", "templates": service.list_harness_templates()}


@router.get("/harness/profiles")
def list_harness_profiles(service: ControlPlaneService = Depends(get_control_plane_service)) -> dict[str, object]:
    return {"status": "ok", "profiles": [item.model_dump() for item in service.list_harness_profiles()]}


@router.put("/harness/profiles/{provider_key}")
def upsert_harness_profile(
    provider_key: str,
    payload: HarnessProviderProfile,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    if payload.provider_key != provider_key:
        return _admin_error(status.HTTP_400_BAD_REQUEST, "provider_key_mismatch", "Path provider_key and payload.provider_key must match.")
    profile = service.upsert_harness_profile(payload)
    return {"status": "ok", "profile": profile.model_dump()}


@router.delete("/harness/profiles/{provider_key}")
def delete_harness_profile(
    provider_key: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        service.delete_harness_profile(provider_key)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "harness_profile_not_found", str(exc))
    return {"status": "ok", "deleted": provider_key}


@router.post("/harness/profiles/{provider_key}/activate")
def activate_harness_profile(
    provider_key: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        profile = service.set_harness_profile_active(provider_key, True)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "harness_profile_not_found", str(exc))
    return {"status": "ok", "profile": profile.model_dump()}


@router.post("/harness/profiles/{provider_key}/deactivate")
def deactivate_harness_profile(
    provider_key: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        profile = service.set_harness_profile_active(provider_key, False)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "harness_profile_not_found", str(exc))
    return {"status": "ok", "profile": profile.model_dump()}


@router.post("/harness/preview")
def harness_preview(
    payload: HarnessPreviewRequest,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        return service.harness_preview(payload)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "harness_profile_not_found", str(exc))


@router.post("/harness/dry-run")
def harness_dry_run(
    payload: HarnessPreviewRequest,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        return service.harness_dry_run(payload)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "harness_profile_not_found", str(exc))


@router.post("/harness/probe")
def harness_probe(
    payload: HarnessPreviewRequest,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        return service.harness_probe(payload)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "harness_profile_not_found", str(exc))
    except RuntimeError as exc:
        return _admin_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "harness_probe_failed", str(exc))


@router.post("/harness/verify")
def verify_harness_profile(
    payload: HarnessVerificationRequest,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
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


@router.get("/harness/export")
def export_harness_config(
    redact_secrets: bool = True,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return service.export_harness_config(redact_secrets=redact_secrets)


@router.post("/harness/import")
def import_harness_config(
    payload: HarnessImportRequest,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        return service.import_harness_config(payload)
    except ValueError as exc:
        return _admin_error(status.HTTP_400_BAD_REQUEST, "harness_import_invalid", str(exc))


@router.post("/harness/profiles/{provider_key}/rollback/{revision}")
def rollback_harness_profile(
    provider_key: str,
    revision: int,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        profile = service.rollback_harness_profile(provider_key, revision)
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "harness_revision_not_found", str(exc))
    return {"status": "ok", "profile": profile.model_dump()}


@router.get("/harness/runs")
def harness_runs(provider_key: str | None = None, mode: str | None = None, status: str | None = None, client_id: str | None = None, limit: int = 200, service: ControlPlaneService = Depends(get_control_plane_service)) -> object:
    return service.harness_runs(provider_key, mode, status, client_id, limit)
