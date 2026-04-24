"""Admin provider control-plane endpoints."""

from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.api.admin.control_plane import (
    ControlPlaneService,
    HealthConfigUpdateRequest,
    ProviderCreateRequest,
    ProviderSyncRequest,
    ProviderUpdateRequest,
    get_control_plane_service,
)
from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_instance_permission
from app.auth.local_auth import role_allows
from app.execution.dependencies import get_execution_session_factory
from app.governance.models import AuthenticatedAdmin
from app.harness.models import (
    HarnessImportRequest,
    HarnessPreviewRequest,
    HarnessProviderProfile,
    HarnessVerificationRequest,
)
from app.instances.models import InstanceRecord
from app.harness.redaction import (
    redact_sensitive_payload as _redact_sensitive_payload,
    redacted_harness_profile_payload as _redacted_harness_profile_payload,
)
from app.idempotency import (
    IdempotencyFingerprintMismatchError,
    IdempotencyRequestInProgressError,
    InvalidIdempotencyKeyError,
    RequestIdempotencyService,
    StoredResponseSnapshot,
    build_request_fingerprint,
    get_request_envelope,
)
from app.telemetry.context import telemetry_context_from_request
from app.tenancy import TenantFilterRequiredError

router = APIRouter(prefix="/providers", tags=["admin-providers"])
_require_provider_read = require_admin_instance_permission("providers.read")
_require_provider_operate = require_admin_instance_permission(
    "providers.read",
    allow_impersonation=False,
)
_require_provider_write = require_admin_instance_permission(
    "providers.write",
    allow_impersonation=False,
)


def _admin_error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


def _admin_error_payload(error_type: str, message: str) -> dict[str, object]:
    return {"error": {"type": error_type, "message": message}}


def _replay_snapshot_response(snapshot: StoredResponseSnapshot) -> JSONResponse:
    response = JSONResponse(status_code=snapshot.status_code, content=snapshot.body)
    response.headers["X-ForgeFrame-Idempotent-Replay"] = "true"
    for key, value in snapshot.headers.items():
        response.headers[key] = value
    return response


def _execute_idempotent_admin_json(
    *,
    request: Request,
    scope_key: str,
    fingerprint_payload: dict[str, Any] | list[Any],
    execute: Callable[[], dict[str, Any]],
    errors: tuple[tuple[type[Exception], int, str], ...] = (),
    resource_type: str | None = None,
    resource_id: str | None = None,
) -> JSONResponse:
    idempotency = RequestIdempotencyService(get_execution_session_factory())
    envelope = get_request_envelope(request)
    reservation = None
    try:
        reservation = idempotency.reserve(
            scope_key=scope_key,
            request_path=request.url.path,
            envelope=envelope,
            request_fingerprint_hash=build_request_fingerprint(
                request,
                fingerprint_payload,
                content_type="application/json",
            ),
        )
    except InvalidIdempotencyKeyError as exc:
        return _admin_error(status.HTTP_400_BAD_REQUEST, "invalid_idempotency_key", str(exc))
    except IdempotencyFingerprintMismatchError as exc:
        return _admin_error(status.HTTP_409_CONFLICT, "idempotency_fingerprint_mismatch", str(exc))
    except IdempotencyRequestInProgressError as exc:
        return _admin_error(status.HTTP_409_CONFLICT, "idempotency_in_progress", str(exc))

    if reservation is not None and reservation.replay is not None:
        return _replay_snapshot_response(reservation.replay)

    try:
        body = execute()
    except Exception as exc:
        for exc_type, status_code, error_type in errors:
            if isinstance(exc, exc_type):
                body = _admin_error_payload(error_type, str(exc))
                idempotency.complete(
                    reservation=reservation,
                    status_code=status_code,
                    body=body,
                    resource_type=resource_type,
                    resource_id=resource_id,
                )
                return JSONResponse(status_code=status_code, content=body)
        idempotency.abandon(reservation=reservation)
        raise

    idempotency.complete(
        reservation=reservation,
        status_code=status.HTTP_200_OK,
        body=body,
        resource_type=resource_type,
        resource_id=resource_id,
    )
    return JSONResponse(status_code=status.HTTP_200_OK, content=body)


def _unsupported_idempotency_response(request: Request, *, message: str) -> JSONResponse | None:
    envelope = get_request_envelope(request)
    if envelope.idempotency_key is None:
        return None
    return _admin_error(status.HTTP_400_BAD_REQUEST, "idempotency_not_supported", message)


def _ensure_harness_export_access(
    admin: AuthenticatedAdmin,
    *,
    redact_secrets: bool,
) -> None:
    if redact_secrets:
        return
    if admin.read_only:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "impersonation_session_read_only",
                "message": "Read-only sessions cannot request full secret-bearing harness exports.",
            },
        )
    if not role_allows(admin.role, "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "admin_role_required",
                "message": "Full secret-bearing harness exports require an admin session.",
            },
        )


@router.get("/")
def list_provider_control_plane(
    _admin: AuthenticatedAdmin = Depends(_require_provider_read),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    bootstrap_readiness = service.get_last_bootstrap_readiness()
    try:
        truth_axes = service.provider_truth_axes(tenant_id=instance.tenant_id)
        providers = service.provider_control_snapshot(tenant_id=instance.tenant_id)
    except TenantFilterRequiredError as exc:
        return _admin_error(status.HTTP_400_BAD_REQUEST, "tenant_filter_required", str(exc))
    return {
        "status": "ok",
        "object": "provider_control_plane",
        "instance": instance.model_dump(mode="json"),
        "providers": providers,
        "provider_catalog": [item.model_dump() for item in service.list_provider_catalog()],
        "provider_catalog_summary": service.provider_catalog_summary().model_dump(),
        "openai_compatibility_signoff": service.openai_compatibility_signoff(tenant_id=instance.tenant_id),
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
                "provider_catalog",
                "provider_truth",
                "runtime_truth",
                "harness_truth",
                "ui_truth",
            ],
        },
    }


@router.get("/openai-compatibility/signoff")
def openai_compatibility_signoff(
    _admin: AuthenticatedAdmin = Depends(_require_provider_read),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    try:
        payload = service.openai_compatibility_signoff(tenant_id=instance.tenant_id)
    except TenantFilterRequiredError as exc:
        return _admin_error(status.HTTP_400_BAD_REQUEST, "tenant_filter_required", str(exc))
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        **payload,
    }


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=None)
def create_provider(
    payload: ProviderCreateRequest,
    _admin: AuthenticatedAdmin = Depends(_require_provider_write),
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
    _admin: AuthenticatedAdmin = Depends(_require_provider_write),
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
    _admin: AuthenticatedAdmin = Depends(_require_provider_write),
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
    _admin: AuthenticatedAdmin = Depends(_require_provider_write),
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
    request: Request,
    _admin: AuthenticatedAdmin = Depends(_require_provider_write),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return _execute_idempotent_admin_json(
        request=request,
        scope_key="admin.providers.sync",
        fingerprint_payload=payload.model_dump(mode="json"),
        execute=lambda: service.run_sync(payload.provider),
        errors=((ValueError, status.HTTP_404_NOT_FOUND, "provider_not_found"),),
        resource_type="provider_sync",
        resource_id=payload.provider or "all",
    )


@router.get("/health/config")
def get_health_config(
    _admin: AuthenticatedAdmin = Depends(_require_provider_read),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    return {"status": "ok", "config": service.get_health_config().model_dump()}


@router.patch("/health/config")
def patch_health_config(
    payload: HealthConfigUpdateRequest,
    _admin: AuthenticatedAdmin = Depends(_require_provider_write),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    return {"status": "ok", "config": service.update_health_config(payload).model_dump()}


@router.post("/health/run")
def run_health_checks(
    request: Request,
    _admin: AuthenticatedAdmin = Depends(_require_provider_operate),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    telemetry_context = telemetry_context_from_request(
        request,
        route=request.url.path or "/admin/providers/health/run",
        operation="admin.providers.health.run",
        service_name="forgeframe-control-plane",
        service_kind="control_plane",
    )
    return _execute_idempotent_admin_json(
        request=request,
        scope_key="admin.providers.health.run",
        fingerprint_payload={},
        execute=lambda: service.run_health_checks(context=telemetry_context),
        resource_type="provider_health_run",
        resource_id="control_plane",
    )


@router.get("/product-axis-targets")
def list_product_axis_targets(
    _admin: AuthenticatedAdmin = Depends(_require_provider_read),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        return {
            "status": "ok",
            "instance": instance.model_dump(mode="json"),
            "targets": service.product_axis_targets(tenant_id=instance.tenant_id),
        }
    except TenantFilterRequiredError as exc:
        return _admin_error(status.HTTP_400_BAD_REQUEST, "tenant_filter_required", str(exc))


@router.post("/oauth-account/probe/{provider_key}")
def probe_oauth_account_provider(
    provider_key: str,
    request: Request,
    _admin: AuthenticatedAdmin = Depends(_require_provider_operate),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return _execute_idempotent_admin_json(
        request=request,
        scope_key=f"admin.providers.oauth_account.probe:{provider_key}",
        fingerprint_payload={},
        execute=lambda: {"status": "ok", "probe": service.probe_oauth_account_provider(provider_key).model_dump()},
        errors=((ValueError, status.HTTP_404_NOT_FOUND, "oauth_provider_not_found"),),
        resource_type="oauth_account_probe",
        resource_id=provider_key,
    )


@router.get("/oauth-account/targets")
def list_oauth_account_targets(
    _admin: AuthenticatedAdmin = Depends(_require_provider_read),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        return {
            "status": "ok",
            "instance": instance.model_dump(mode="json"),
            "targets": service.list_oauth_account_target_statuses(tenant_id=instance.tenant_id),
        }
    except TenantFilterRequiredError as exc:
        return _admin_error(status.HTTP_400_BAD_REQUEST, "tenant_filter_required", str(exc))


@router.get("/oauth-account/onboarding")
def oauth_account_onboarding(
    _admin: AuthenticatedAdmin = Depends(_require_provider_read),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        response = service.oauth_account_onboarding_summary(tenant_id=instance.tenant_id)
        if isinstance(response, dict):
            return {"instance": instance.model_dump(mode="json"), **response}
        return response
    except TenantFilterRequiredError as exc:
        return _admin_error(status.HTTP_400_BAD_REQUEST, "tenant_filter_required", str(exc))


@router.get("/oauth-account/operations")
def oauth_account_operations(
    _admin: AuthenticatedAdmin = Depends(_require_provider_read),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        response = service.oauth_account_operations_summary(tenant_id=instance.tenant_id)
        if isinstance(response, dict):
            return {"instance": instance.model_dump(mode="json"), **response}
        return response
    except TenantFilterRequiredError as exc:
        return _admin_error(status.HTTP_400_BAD_REQUEST, "tenant_filter_required", str(exc))


@router.get("/compatibility-matrix")
def compatibility_matrix(
    _admin: AuthenticatedAdmin = Depends(_require_provider_read),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    try:
        truth_axes = service.provider_truth_axes(tenant_id=instance.tenant_id)
    except TenantFilterRequiredError as exc:
        return _admin_error(status.HTTP_400_BAD_REQUEST, "tenant_filter_required", str(exc))
    matrix = []
    for item in truth_axes:
        capabilities = item.runtime.capabilities
        streaming_level = str(
            capabilities.get(
                "streaming_level",
                "full" if capabilities.get("streaming") else "none",
            )
        )
        vision_level = str(
            capabilities.get(
                "vision_level",
                "full" if capabilities.get("vision") else "none",
            )
        )
        notes = item.runtime.readiness_reason
        proof_status = item.harness.proof_status
        if item.provider.provider == "generic_harness" and item.runtime.runtime_readiness != "planned":
            model_less_enabled_profiles = int(item.harness.model_less_enabled_profile_count)
            mixed_model_ownership = model_less_enabled_profiles > 0 and int(item.harness.runtime_profile_count) > 0
            profile_word = "profile" if model_less_enabled_profiles == 1 else "profiles"
            if item.harness.proof_status == "proven":
                if mixed_model_ownership:
                    proof_status = "partial"
                    notes = (
                        "Harness-backed OpenAI-compatible runtime proof exists for "
                        + ", ".join(item.harness.proven_profile_keys)
                        + f", but {model_less_enabled_profiles} enabled {profile_word} currently own no models. "
                        "Keep the axis partial until every enabled profile is runtime-dispatchable."
                    )
                else:
                    notes = (
                        "Harness-backed OpenAI-compatible runtime proof exists for "
                        + ", ".join(item.harness.proven_profile_keys)
                        + ". Keep the axis partial until broader compatibility coverage is proven."
                    )
            elif item.harness.proof_status == "partial":
                notes = (
                    "Harness evidence exists, but the full preview/verify/probe/runtime proof set is incomplete."
                    if not mixed_model_ownership
                    else (
                        "Harness evidence exists, but the full preview/verify/probe/runtime proof set is incomplete, "
                        + f"and {model_less_enabled_profiles} enabled {profile_word} currently own no models."
                    )
                )
        matrix.append(
            {
                "provider": item.provider.provider,
                "label": item.provider.label,
                "compatibility_depth": item.runtime.compatibility_depth,
                "contract_classification": item.runtime.contract_classification,
                "ready": item.runtime.ready,
                "runtime_readiness": item.runtime.runtime_readiness,
                "streaming_readiness": item.runtime.streaming_readiness,
                "proof_status": proof_status,
                "proven_profile_keys": item.harness.proven_profile_keys,
                "provider_axis": item.runtime.provider_axis,
                "streaming": streaming_level,
                "tool_calling": str(capabilities.get("tool_calling_level", "none")),
                "evidence": item.runtime.evidence.model_dump(),
                "vision": vision_level,
                "discovery": "full" if item.runtime.discovery_supported else "none",
                "oauth_required": item.runtime.oauth_required,
                "ui_models": item.ui.model_count,
                "notes": notes,
            }
        )
    return {"status": "ok", "instance": instance.model_dump(mode="json"), "matrix": matrix}


@router.post("/oauth-account/probe-all")
def probe_all_oauth_account_targets(
    _admin: AuthenticatedAdmin = Depends(_require_provider_operate),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    results = []
    for provider_key in [
        "openai_codex",
        "gemini",
        "antigravity",
        "github_copilot",
        "claude_code",
        "nous_oauth",
        "qwen_oauth",
    ]:
        try:
            results.append(service.probe_oauth_account_provider(provider_key).model_dump())
        except ValueError as exc:
            results.append({"provider_key": provider_key, "status": "failed", "details": str(exc)})
    return {"status": "ok", "probes": results}


@router.post("/oauth-account/bridge-profiles/sync")
def sync_oauth_account_bridge_profiles(
    request: Request,
    _admin: AuthenticatedAdmin = Depends(_require_provider_write),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return _execute_idempotent_admin_json(
        request=request,
        scope_key="admin.providers.oauth_account.bridge_profiles.sync",
        fingerprint_payload={},
        execute=service.sync_oauth_account_bridge_profiles,
        resource_type="oauth_bridge_profile_sync",
        resource_id="control_plane",
    )


@router.get("/bootstrap/readiness")
def bootstrap_readiness(
    _admin: AuthenticatedAdmin = Depends(_require_provider_read),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return service.bootstrap_readiness_report()


@router.get("/harness/templates")
def list_harness_templates(
    _admin: AuthenticatedAdmin = Depends(_require_provider_read),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    return {"status": "ok", "templates": service.list_harness_templates()}


@router.get("/harness/profiles")
def list_harness_profiles(
    _admin: AuthenticatedAdmin = Depends(_require_provider_read),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    return {"status": "ok", "profiles": [_redacted_harness_profile_payload(item) for item in service.list_harness_profiles()]}


@router.put("/harness/profiles/{provider_key}")
def upsert_harness_profile(
    provider_key: str,
    payload: HarnessProviderProfile,
    request: Request,
    _admin: AuthenticatedAdmin = Depends(_require_provider_write),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    if payload.provider_key != provider_key:
        return _admin_error(status.HTTP_400_BAD_REQUEST, "provider_key_mismatch", "Path provider_key and payload.provider_key must match.")
    return _execute_idempotent_admin_json(
        request=request,
        scope_key=f"admin.providers.harness.profile.upsert:{provider_key}",
        fingerprint_payload=payload.model_dump(mode="json"),
        execute=lambda: {
            "status": "ok",
            "profile": _redacted_harness_profile_payload(service.upsert_harness_profile(payload)),
        },
        resource_type="harness_profile",
        resource_id=provider_key,
    )


@router.delete("/harness/profiles/{provider_key}")
def delete_harness_profile(
    provider_key: str,
    request: Request,
    _admin: AuthenticatedAdmin = Depends(_require_provider_write),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return _execute_idempotent_admin_json(
        request=request,
        scope_key=f"admin.providers.harness.profile.delete:{provider_key}",
        fingerprint_payload={},
        execute=lambda: _delete_harness_profile(service, provider_key),
        errors=((ValueError, status.HTTP_404_NOT_FOUND, "harness_profile_not_found"),),
        resource_type="harness_profile",
        resource_id=provider_key,
    )


@router.post("/harness/profiles/{provider_key}/activate")
def activate_harness_profile(
    provider_key: str,
    request: Request,
    _admin: AuthenticatedAdmin = Depends(_require_provider_write),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return _execute_idempotent_admin_json(
        request=request,
        scope_key=f"admin.providers.harness.profile.activate:{provider_key}",
        fingerprint_payload={},
        execute=lambda: {
            "status": "ok",
            "profile": _redacted_harness_profile_payload(service.set_harness_profile_active(provider_key, True)),
        },
        errors=((ValueError, status.HTTP_404_NOT_FOUND, "harness_profile_not_found"),),
        resource_type="harness_profile",
        resource_id=provider_key,
    )


@router.post("/harness/profiles/{provider_key}/deactivate")
def deactivate_harness_profile(
    provider_key: str,
    request: Request,
    _admin: AuthenticatedAdmin = Depends(_require_provider_write),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return _execute_idempotent_admin_json(
        request=request,
        scope_key=f"admin.providers.harness.profile.deactivate:{provider_key}",
        fingerprint_payload={},
        execute=lambda: {
            "status": "ok",
            "profile": _redacted_harness_profile_payload(service.set_harness_profile_active(provider_key, False)),
        },
        errors=((ValueError, status.HTTP_404_NOT_FOUND, "harness_profile_not_found"),),
        resource_type="harness_profile",
        resource_id=provider_key,
    )


@router.post("/harness/preview")
def harness_preview(
    payload: HarnessPreviewRequest,
    request: Request,
    _admin: AuthenticatedAdmin = Depends(_require_provider_read),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return _execute_idempotent_admin_json(
        request=request,
        scope_key="admin.providers.harness.preview",
        fingerprint_payload=payload.model_dump(mode="json"),
        execute=lambda: _redact_sensitive_payload(service.harness_preview(payload)),
        errors=((ValueError, status.HTTP_404_NOT_FOUND, "harness_profile_not_found"),),
        resource_type="harness_preview",
        resource_id=payload.provider_key,
    )


@router.post("/harness/dry-run")
def harness_dry_run(
    payload: HarnessPreviewRequest,
    request: Request,
    _admin: AuthenticatedAdmin = Depends(_require_provider_operate),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return _execute_idempotent_admin_json(
        request=request,
        scope_key="admin.providers.harness.dry_run",
        fingerprint_payload=payload.model_dump(mode="json"),
        execute=lambda: _redact_sensitive_payload(service.harness_dry_run(payload)),
        errors=((ValueError, status.HTTP_404_NOT_FOUND, "harness_profile_not_found"),),
        resource_type="harness_dry_run",
        resource_id=payload.provider_key,
    )


@router.post("/harness/probe")
def harness_probe(
    payload: HarnessPreviewRequest,
    request: Request,
    _admin: AuthenticatedAdmin = Depends(_require_provider_operate),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    unsupported = _unsupported_idempotency_response(
        request,
        message="Idempotency-Key is not supported for harness probe responses.",
    )
    if unsupported is not None:
        return unsupported
    try:
        return _redact_sensitive_payload(service.harness_probe(payload))
    except ValueError as exc:
        return _admin_error(status.HTTP_404_NOT_FOUND, "harness_profile_not_found", str(exc))
    except RuntimeError as exc:
        return _admin_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "harness_probe_failed",
            str(_redact_sensitive_payload(str(exc))),
        )


@router.post("/harness/verify")
def verify_harness_profile(
    payload: HarnessVerificationRequest,
    request: Request,
    _admin: AuthenticatedAdmin = Depends(_require_provider_operate),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return _execute_idempotent_admin_json(
        request=request,
        scope_key="admin.providers.harness.verify",
        fingerprint_payload=payload.model_dump(mode="json"),
        execute=lambda: {
            "status": "ok",
            "verification": _redact_sensitive_payload(service.verify_harness_profile(payload)),
        },
        errors=(
            (ValueError, status.HTTP_404_NOT_FOUND, "harness_profile_not_found"),
            (RuntimeError, status.HTTP_422_UNPROCESSABLE_ENTITY, "harness_verification_failed"),
        ),
        resource_type="harness_verify",
        resource_id=payload.provider_key,
    )


@router.get("/harness/snapshot")
def harness_snapshot(
    _admin: AuthenticatedAdmin = Depends(_require_provider_read),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return service.harness_snapshot()


@router.get("/harness/export")
def export_harness_config(
    redact_secrets: bool = True,
    admin: AuthenticatedAdmin = Depends(_require_provider_read),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    _ensure_harness_export_access(admin, redact_secrets=redact_secrets)
    return service.export_harness_config(redact_secrets=redact_secrets)


@router.post("/harness/import")
def import_harness_config(
    payload: HarnessImportRequest,
    request: Request,
    _admin: AuthenticatedAdmin = Depends(_require_provider_write),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return _execute_idempotent_admin_json(
        request=request,
        scope_key="admin.providers.harness.import",
        fingerprint_payload=payload.model_dump(mode="json"),
        execute=lambda: service.import_harness_config(payload),
        errors=((ValueError, status.HTTP_400_BAD_REQUEST, "harness_import_invalid"),),
        resource_type="harness_import",
        resource_id="control_plane",
    )


@router.post("/harness/profiles/{provider_key}/rollback/{revision}")
def rollback_harness_profile(
    provider_key: str,
    revision: int,
    request: Request,
    _admin: AuthenticatedAdmin = Depends(_require_provider_write),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return _execute_idempotent_admin_json(
        request=request,
        scope_key=f"admin.providers.harness.profile.rollback:{provider_key}",
        fingerprint_payload={},
        execute=lambda: {
            "status": "ok",
            "profile": _redacted_harness_profile_payload(service.rollback_harness_profile(provider_key, revision)),
        },
        errors=((ValueError, status.HTTP_404_NOT_FOUND, "harness_revision_not_found"),),
        resource_type="harness_profile",
        resource_id=provider_key,
    )


@router.get("/harness/runs")
def harness_runs(
    provider_key: str | None = None,
    mode: str | None = None,
    status: str | None = None,
    client_id: str | None = None,
    limit: int = 200,
    _admin: AuthenticatedAdmin = Depends(_require_provider_read),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> object:
    return _redact_sensitive_payload(service.harness_runs(provider_key, mode, status, client_id, limit))


def _delete_harness_profile(service: ControlPlaneService, provider_key: str) -> dict[str, Any]:
    service.delete_harness_profile(provider_key)
    return {"status": "ok", "deleted": provider_key}
