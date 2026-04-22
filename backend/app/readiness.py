"""Startup validation and readiness reporting for ForgeGate."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Literal

from fastapi import FastAPI
from pydantic import BaseModel

from app.tenancy import TenantFilterRequiredError

if TYPE_CHECKING:
    from app.governance.service import GovernanceService
    from app.harness.service import HarnessService
    from app.settings.config import Settings
    from app.usage.analytics import UsageAnalyticsStore

ReadinessState = Literal["booting", "degraded", "ready"]
ReadinessSeverity = Literal["critical", "warning"]
INSECURE_BOOTSTRAP_ADMIN_PASSWORDS = frozenset({"", "forgegate-admin", "replace-with-a-strong-password"})
PUBLIC_READINESS_ID_MAP = {
    "settings_validation": "startup_validation",
    "bootstrap_admin_password": "security_configuration",
    "bootstrap_admin_account": "security_configuration",
    "admin_auth_enabled": "security_configuration",
    "secret_rotation_evidence": "security_configuration",
    "harness_service_boot": "service_dependencies",
    "observability_store_boot": "service_dependencies",
    "governance_service_boot": "service_dependencies",
    "control_plane_service_boot": "service_dependencies",
    "runtime_registry_boot": "service_dependencies",
    "active_runtime_models": "runtime_model_configuration",
    "configured_default_model": "runtime_model_configuration",
    "default_runtime_model_boot": "runtime_model_configuration",
    "default_provider_ready": "runtime_provider_configuration",
    "default_provider_adapter_boot": "runtime_provider_configuration",
    "observability_backend": "observability",
}
PUBLIC_READINESS_DISPLAY_ORDER = (
    "startup_validation",
    "security_configuration",
    "service_dependencies",
    "runtime_model_configuration",
    "runtime_provider_configuration",
    "observability",
)


class RuntimeReadinessCheck(BaseModel):
    id: str
    ok: bool
    severity: ReadinessSeverity
    details: str


class RuntimeReadinessReport(BaseModel):
    state: ReadinessState
    accepting_traffic: bool
    checked_at: str
    checks: list[RuntimeReadinessCheck]
    warning_count: int
    critical_count: int

    @classmethod
    def booting(cls, details: str = "startup_validation_pending") -> "RuntimeReadinessReport":
        return cls.from_checks(
            [
                RuntimeReadinessCheck(
                    id="startup_validation",
                    ok=False,
                    severity="critical",
                    details=details,
                )
            ]
        )

    @classmethod
    def from_checks(
        cls,
        checks: list[RuntimeReadinessCheck],
        *,
        checked_at: str | None = None,
    ) -> "RuntimeReadinessReport":
        critical_count = sum(1 for check in checks if check.severity == "critical" and not check.ok)
        warning_count = sum(1 for check in checks if check.severity == "warning" and not check.ok)
        if critical_count:
            state: ReadinessState = "booting"
            accepting_traffic = False
        elif warning_count:
            state = "degraded"
            accepting_traffic = True
        else:
            state = "ready"
            accepting_traffic = True
        return cls(
            state=state,
            accepting_traffic=accepting_traffic,
            checked_at=checked_at or datetime.now(tz=UTC).isoformat(),
            checks=checks,
            warning_count=warning_count,
            critical_count=critical_count,
        )


def build_operator_runtime_readiness_payload(readiness: RuntimeReadinessReport) -> dict[str, object]:
    return readiness.model_dump()


def _merge_public_check_severity(
    current: RuntimeReadinessCheck,
    incoming: RuntimeReadinessCheck,
) -> ReadinessSeverity:
    relevant_checks = [check for check in (current, incoming) if not check.ok]
    if not relevant_checks:
        relevant_checks = [current, incoming]
    return "critical" if any(check.severity == "critical" for check in relevant_checks) else "warning"


def build_public_runtime_readiness_payload(readiness: RuntimeReadinessReport) -> dict[str, object]:
    public_checks: dict[str, RuntimeReadinessCheck] = {}
    observed_order: list[str] = []
    for check in readiness.checks:
        public_id = PUBLIC_READINESS_ID_MAP.get(check.id, check.id)
        if public_id not in public_checks:
            observed_order.append(public_id)
            public_checks[public_id] = RuntimeReadinessCheck(
                id=public_id,
                ok=check.ok,
                severity=check.severity,
                details="redacted",
            )
            continue
        current = public_checks[public_id]
        public_checks[public_id] = RuntimeReadinessCheck(
            id=public_id,
            ok=current.ok and check.ok,
            severity=_merge_public_check_severity(current, check),
            details="redacted",
        )
    order_rank = {check_id: index for index, check_id in enumerate(PUBLIC_READINESS_DISPLAY_ORDER)}
    ordered_ids = sorted(
        observed_order,
        key=lambda check_id: (order_rank.get(check_id, len(order_rank)), observed_order.index(check_id)),
    )
    checks = [public_checks[check_id] for check_id in ordered_ids]
    return {
        "state": readiness.state,
        "accepting_traffic": readiness.accepting_traffic,
        "checked_at": readiness.checked_at,
        "checks": [
            {
                "id": check.id,
                "ok": check.ok,
                "severity": check.severity,
            }
            for check in checks
        ],
        "warning_count": sum(1 for check in checks if check.severity == "warning" and not check.ok),
        "critical_count": sum(1 for check in checks if check.severity == "critical" and not check.ok),
    }


class StartupValidationError(RuntimeError):
    def __init__(self, checks: list[RuntimeReadinessCheck]):
        self.checks = checks
        super().__init__("ForgeGate startup validation failed.")


def reset_runtime_readiness_state(app: FastAPI) -> None:
    app.state.runtime_startup_checks = None
    app.state.runtime_readiness = RuntimeReadinessReport.booting()


def bootstrap_admin_password_is_insecure(password: str) -> bool:
    return password.strip().lower() in INSECURE_BOOTSTRAP_ADMIN_PASSWORDS


def _build_bootstrap_admin_password_check(settings: Settings) -> RuntimeReadinessCheck:
    if not settings.admin_auth_enabled:
        return RuntimeReadinessCheck(
            id="bootstrap_admin_password",
            ok=True,
            severity="critical",
            details="admin_auth_disabled",
        )
    if bootstrap_admin_password_is_insecure(settings.bootstrap_admin_password):
        return RuntimeReadinessCheck(
            id="bootstrap_admin_password",
            ok=False,
            severity="critical",
            details="bootstrap admin password must be rotated from the default or placeholder value",
        )
    return RuntimeReadinessCheck(
        id="bootstrap_admin_password",
        ok=True,
        severity="critical",
        details="bootstrap_admin_password_rotated",
    )


def _build_bootstrap_admin_account_check(governance: GovernanceService) -> RuntimeReadinessCheck:
    bootstrap = governance.bootstrap_status()
    if not bool(bootstrap.get("admin_auth_enabled", True)):
        return RuntimeReadinessCheck(
            id="bootstrap_admin_account",
            ok=True,
            severity="critical",
            details="admin_auth_disabled",
        )
    if bool(bootstrap.get("default_password_in_use")):
        return RuntimeReadinessCheck(
            id="bootstrap_admin_account",
            ok=False,
            severity="critical",
            details="bootstrap admin account still uses an insecure default or placeholder credential",
        )
    return RuntimeReadinessCheck(
        id="bootstrap_admin_account",
        ok=True,
        severity="critical",
        details="bootstrap_admin_password_applied",
    )


def _run_startup_check(
    *,
    checks: list[RuntimeReadinessCheck],
    check_id: str,
    success_details: str,
    action,
):
    try:
        value = action()
    except Exception as exc:  # pragma: no cover - exercised via caller tests
        checks.append(
            RuntimeReadinessCheck(
                id=check_id,
                ok=False,
                severity="critical",
                details=f"{type(exc).__name__}: {exc}",
            )
        )
        return None
    checks.append(
        RuntimeReadinessCheck(
            id=check_id,
            ok=True,
            severity="critical",
            details=success_details,
        )
    )
    return value


def validate_runtime_startup() -> list[RuntimeReadinessCheck]:
    from app.settings.config import get_settings

    try:
        settings = get_settings()
    except Exception as exc:
        raise StartupValidationError(
            [
                RuntimeReadinessCheck(
                    id="settings_validation",
                    ok=False,
                    severity="critical",
                    details=f"{type(exc).__name__}: {exc}",
                )
            ]
        ) from exc

    checks: list[RuntimeReadinessCheck] = [_build_bootstrap_admin_password_check(settings)]
    from app.api.admin.control_plane import get_control_plane_service
    from app.core.model_registry import ModelRegistry
    from app.governance.service import get_governance_service
    from app.harness.service import get_harness_service
    from app.providers import ProviderRegistry
    from app.usage.analytics import get_usage_analytics_store

    harness = _run_startup_check(
        checks=checks,
        check_id="harness_service_boot",
        success_details=f"storage_backend={settings.harness_storage_backend}",
        action=get_harness_service,
    )
    _run_startup_check(
        checks=checks,
        check_id="observability_store_boot",
        success_details=f"storage_backend={settings.observability_storage_backend}",
        action=get_usage_analytics_store,
    )
    governance = _run_startup_check(
        checks=checks,
        check_id="governance_service_boot",
        success_details=f"storage_backend={settings.governance_storage_backend}",
        action=get_governance_service,
    )
    if governance is not None:
        checks.append(_build_bootstrap_admin_account_check(governance))
    _run_startup_check(
        checks=checks,
        check_id="control_plane_service_boot",
        success_details=f"storage_backend={settings.control_plane_storage_backend}",
        action=get_control_plane_service,
    )
    registry = _run_startup_check(
        checks=checks,
        check_id="runtime_registry_boot",
        success_details=f"default_provider={settings.default_provider}",
        action=lambda: ModelRegistry(settings),
    )
    default_model = None
    if registry is not None:
        default_model = _run_startup_check(
            checks=checks,
            check_id="default_runtime_model_boot",
            success_details=f"default_model={settings.default_model}",
            action=registry.default_model,
        )
    if harness is not None and default_model is not None:
        _run_startup_check(
            checks=checks,
            check_id="default_provider_adapter_boot",
            success_details=f"provider={default_model.provider}",
            action=lambda: ProviderRegistry(settings, harness_service=harness).get(default_model.provider),
        )

    if any(not check.ok for check in checks):
        raise StartupValidationError(checks)
    return checks


def ensure_runtime_startup_validated(app: FastAPI) -> list[RuntimeReadinessCheck]:
    existing = getattr(app.state, "runtime_startup_checks", None)
    if existing is not None:
        return existing
    checks = validate_runtime_startup()
    app.state.runtime_startup_checks = checks
    app.state.runtime_readiness = RuntimeReadinessReport.from_checks(list(checks))
    return checks


def build_runtime_readiness_report(
    *,
    settings: Settings,
    startup_checks: list[RuntimeReadinessCheck] | None,
    governance: GovernanceService,
    harness: HarnessService,
    analytics: UsageAnalyticsStore,
) -> RuntimeReadinessReport:
    from app.core.model_registry import ModelRegistry
    from app.providers import ProviderRegistry

    checks = list(startup_checks or [])
    registry = ModelRegistry(settings)
    providers = ProviderRegistry(settings, harness_service=harness)

    active_models = registry.list_active_models()
    checks.append(
        RuntimeReadinessCheck(
            id="active_runtime_models",
            ok=bool(active_models),
            severity="critical",
            details=f"active_models={len(active_models)}",
        )
    )

    configured_default_model = registry.get_model(settings.default_model)
    checks.append(
        RuntimeReadinessCheck(
            id="configured_default_model",
            ok=configured_default_model is not None,
            severity="warning",
            details=(
                f"default_model={settings.default_model}"
                if configured_default_model is not None
                else f"default_model_missing:{settings.default_model}"
            ),
        )
    )

    try:
        default_provider_status = providers.get_provider_status(settings.default_provider)
        default_provider_ready = bool(default_provider_status["ready"])
        default_provider_reason = str(default_provider_status.get("readiness_reason") or "ready")
    except ValueError:
        default_provider_ready = False
        default_provider_reason = "provider_disabled_or_not_registered"
    checks.append(
        RuntimeReadinessCheck(
            id="default_provider_ready",
            ok=default_provider_ready,
            severity="warning",
            details=f"{settings.default_provider}:{default_provider_reason}",
        )
    )

    checks.append(
        RuntimeReadinessCheck(
            id="admin_auth_enabled",
            ok=settings.admin_auth_enabled,
            severity="warning",
            details=(
                "admin_auth_enabled"
                if settings.admin_auth_enabled
                else "FORGEGATE_ADMIN_AUTH_ENABLED=false"
            ),
        )
    )
    secret_posture = governance.provider_secret_posture()
    rotation_gaps = [
        str(item["provider"])
        for item in secret_posture
        if bool(item.get("configured")) and bool(item.get("needs_rotation_evidence"))
    ]
    checks.append(
        RuntimeReadinessCheck(
            id="secret_rotation_evidence",
            ok=not rotation_gaps,
            severity="warning",
            details="none" if not rotation_gaps else ",".join(rotation_gaps[:5]),
        )
    )

    observability_details = ""
    try:
        aggregates = analytics.aggregate(window_seconds=24 * 3600)
        observability_details = (
            f"{settings.observability_storage_backend}:"
            f"events_24h={aggregates['event_count']}:errors_24h={aggregates['error_event_count']}"
        )
    except TenantFilterRequiredError:
        observability_details = f"{settings.observability_storage_backend}:tenant_filter_required"
    checks.append(
        RuntimeReadinessCheck(
            id="observability_backend",
            ok=bool(settings.observability_storage_backend.strip()),
            severity="warning",
            details=observability_details,
        )
    )

    return RuntimeReadinessReport.from_checks(checks)


def build_health_payload(
    *,
    app_name: str,
    app_version: str,
    api_base: str,
    readiness: RuntimeReadinessReport,
) -> dict[str, object]:
    return {
        "status": "ok" if readiness.accepting_traffic else "starting",
        "app": app_name,
        "version": app_version,
        "api_base": api_base,
        "readiness": build_public_runtime_readiness_payload(readiness),
    }
