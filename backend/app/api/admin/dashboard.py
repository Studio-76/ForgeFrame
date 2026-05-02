"""Dashboard snapshot endpoints."""

from __future__ import annotations

from typing import Any, cast

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.api.admin.control_plane import ControlPlaneService, get_control_plane_service
from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_session
from app.auth.local_auth import role_allows
from app.execution.admin_service import ExecutionAdminService
from app.execution.dependencies import get_execution_admin_service
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service
from app.harness.service import HarnessService, get_harness_service
from app.instances.models import InstanceRecord
from app.readiness import (
    RuntimeReadinessReport,
    StartupValidationError,
    build_operator_runtime_readiness_payload,
    build_runtime_readiness_report,
    ensure_runtime_startup_validated,
)
from app.settings.config import Settings, get_settings
from app.tenancy import TenantFilterRequiredError
from app.usage.analytics import UsageAnalyticsStore, get_usage_analytics_store

router = APIRouter(prefix="/dashboard", tags=["admin-dashboard"])

_ROUTES = {
    "accounts": "/accounts",
    "approvals": "/approvals",
    "costs": "/costs",
    "dispatch": "/dispatch",
    "errors": "/errors",
    "health": "/health-status",
    "logs": "/logs",
    "oauth_targets": "/oauth-targets",
    "onboarding": "/dashboard",
    "providers": "/providers",
    "provider_health": "/providers#provider-health-runs",
    "queues": "/queues",
    "release_validation": "/release-validation",
    "routing": "/routing",
    "security": "/security",
}
_SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2}
_STATUS_PRIORITY = {
    "blocked": 0,
    "unsupported": 1,
    "bridge-only": 2,
    "onboarding-only": 3,
    "degraded": 4,
    "waiting_approval": 5,
    "ready": 6,
}
_PRIMARY_ACTION_TITLES = {
    "go_live_blocker": "Fix go-live blockers",
    "provider_configuration": "Configure providers",
    "security_closure": "Close security posture",
    "runtime_stability": "Stabilize runtime",
    "routing_queue_pressure": "Clear routing and queue pressure",
    "cost_pressure": "Reduce cost pressure",
    "all_stable": "All stable",
}


def _attention_axis_rank(axis: str) -> int:
    lowered = axis.strip().lower()
    if "readiness" in lowered:
        return 0
    if "security" in lowered:
        return 1
    if "runtime" in lowered or "provider" in lowered:
        return 2
    if "routing" in lowered or "queue" in lowered:
        return 3
    if "cost" in lowered:
        return 4
    return 5


def _attention_priority(item: dict[str, str]) -> tuple[int, int, int, str]:
    return (
        _STATUS_PRIORITY.get(str(item.get("status") or ""), 99),
        _SEVERITY_ORDER.get(str(item.get("severity") or ""), 99),
        _attention_axis_rank(str(item.get("axis") or "")),
        str(item.get("title") or ""),
    )


def _primary_action_kind_for_attention(item: dict[str, str]) -> str:
    item_id = str(item.get("id") or "")
    axis = str(item.get("axis") or "").strip().lower()
    status = str(item.get("status") or "")

    if item_id.startswith("setup:"):
        return "provider_configuration"
    if item_id.startswith("readiness:"):
        return "go_live_blocker"
    if item_id.startswith("security:"):
        return "security_closure"
    if item_id.startswith("routing_queue:"):
        return "routing_queue_pressure"
    if item_id.startswith("cost:") or axis == "cost":
        return "cost_pressure"
    if item_id.startswith("provider:") and status in {
        "onboarding-only",
        "bridge-only",
        "unsupported",
    }:
        return "provider_configuration"
    return "runtime_stability"


def _primary_action_from_attention(
    attention: list[dict[str, str]],
) -> dict[str, str] | None:
    if not attention:
        return None

    selected = min(attention, key=_attention_priority)
    action_kind = _primary_action_kind_for_attention(selected)
    return {
        "kind": action_kind,
        "title": _PRIMARY_ACTION_TITLES[action_kind],
        "description": selected["cause"],
        "status": selected["status"],
        "to": selected["to"],
        "action_label": selected["action_label"],
    }


def _resolve_runtime_readiness(
    request: Request,
    *,
    settings: Settings,
    governance: GovernanceService,
    harness: HarnessService,
    analytics: UsageAnalyticsStore,
) -> RuntimeReadinessReport:
    readiness = getattr(request.app.state, "runtime_readiness", None)
    if isinstance(readiness, RuntimeReadinessReport) and getattr(request.app.state, "runtime_startup_checks", None) is not None:
        startup_checks = request.app.state.runtime_startup_checks
    else:
        try:
            startup_checks = ensure_runtime_startup_validated(request.app)
        except StartupValidationError as exc:
            startup_checks = exc.checks
            request.app.state.runtime_startup_checks = exc.checks
            request.app.state.runtime_readiness = RuntimeReadinessReport.from_checks(exc.checks)
    readiness = build_runtime_readiness_report(
        settings=settings,
        startup_checks=startup_checks,
        governance=governance,
        harness=harness,
        analytics=analytics,
        app=request.app,
    )
    request.app.state.runtime_readiness = readiness
    return readiness


def _to_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _to_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _attention_item(
    *,
    item_id: str,
    severity: str,
    title: str,
    cause: str,
    axis: str,
    to: str,
    action_label: str,
    status: str,
) -> dict[str, str]:
    return {
        "id": item_id,
        "severity": severity,
        "title": title,
        "cause": cause,
        "axis": axis,
        "to": to,
        "action_label": action_label,
        "status": status,
    }


def _section(
    *,
    key: str,
    title: str,
    status: str,
    reason: str,
    to: str,
    action_label: str,
    details: list[str],
) -> Any:
    return {
        "key": key,
        "title": title,
        "status": status,
        "reason": reason,
        "to": to,
        "action_label": action_label,
        "details": details,
    }


def _top_failing_check_message(checks: list[dict[str, Any]], *, fallback: str) -> str:
    for check in checks:
        if not bool(check.get("ok")):
            details = str(check.get("details") or "").strip()
            if details:
                return details
            return str(check.get("id") or fallback)
    return fallback


def _configured_provider_count(provider_snapshot: list[dict[str, Any]]) -> int:
    return len([item for item in provider_snapshot if bool(item.get("enabled")) or _to_int(item.get("model_count")) > 0 or bool(item.get("config")) or bool(item.get("last_sync_at"))])


def _provider_attention_candidates(
    provider_snapshot: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    def score(item: dict[str, Any]) -> tuple[int, int, int, str]:
        oauth_failures = _to_int(item.get("oauth_failure_count"))
        harness_attention = _to_int(item.get("harness_needs_attention_count"))
        ready = bool(item.get("ready"))
        provider = str(item.get("provider") or "")
        return (
            0 if oauth_failures > 0 else 1,
            0 if not ready else 1,
            0 if harness_attention > 0 else 1,
            provider,
        )

    return [
        item for item in sorted(provider_snapshot, key=score) if _to_int(item.get("oauth_failure_count")) > 0 or _to_int(item.get("harness_needs_attention_count")) > 0 or not bool(item.get("ready"))
    ]


def _provider_issue_status(item: dict[str, Any]) -> str:
    classification = str(item.get("contract_classification") or "").strip()
    if classification in {"bridge-only", "onboarding-only", "unsupported"}:
        return classification
    if not bool(item.get("ready")):
        return "blocked"
    return "degraded"


def _provider_issue_action(item: dict[str, Any]) -> tuple[str, str]:
    if bool(item.get("oauth_required")) and _to_int(item.get("oauth_failure_count")) > 0:
        return _ROUTES["oauth_targets"], "Fix OAuth targets"
    if not bool(item.get("ready")):
        return _ROUTES["providers"], "Configure provider"
    return _ROUTES["providers"], "Review provider route"


def _provider_issue_cause(item: dict[str, Any]) -> str:
    parts: list[str] = []
    readiness_reason = str(item.get("readiness_reason") or "").strip()
    if readiness_reason:
        parts.append(readiness_reason)
    oauth_failures = _to_int(item.get("oauth_failure_count"))
    if oauth_failures > 0:
        parts.append(f"{oauth_failures} OAuth probe failures are still unresolved.")
    harness_attention = _to_int(item.get("harness_needs_attention_count"))
    if harness_attention > 0:
        parts.append(f"{harness_attention} harness profiles still need follow-up.")
    if not parts:
        runtime_readiness = str(item.get("runtime_readiness") or "planned")
        parts.append(f"Runtime readiness is currently {runtime_readiness}.")
    return " ".join(parts)


def _alert_attention_items(alerts: list[dict[str, Any]]) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for alert in alerts:
        alert_type = str(alert.get("type") or "alert")
        severity = str(alert.get("severity") or "warning")
        message = str(alert.get("message") or "An alert requires review.")
        if alert_type == "health_failures":
            items.append(
                _attention_item(
                    item_id=f"alert:{alert_type}",
                    severity=severity,
                    title="Health checks are failing repeatedly",
                    cause=message,
                    axis="Runtime",
                    to=_ROUTES["health"],
                    action_label="Investigate health failures",
                    status="degraded",
                )
            )
            continue
        if alert_type == "health_cost_pressure":
            items.append(
                _attention_item(
                    item_id=f"alert:{alert_type}",
                    severity=severity,
                    title="Health probes cost more than runtime traffic",
                    cause=message,
                    axis="Cost",
                    to=_ROUTES["costs"],
                    action_label="Review probe cost pressure",
                    status="degraded",
                )
            )
            continue
        if alert_type in {"error_rate_spike", "error_rate_rising", "provider_hotspot"}:
            items.append(
                _attention_item(
                    item_id=f"alert:{alert_type}",
                    severity=severity,
                    title="Runtime failures are climbing",
                    cause=message,
                    axis="Runtime",
                    to=_ROUTES["errors"],
                    action_label="Investigate runtime failures",
                    status="blocked" if severity == "critical" else "degraded",
                )
            )
            continue
        items.append(
            _attention_item(
                item_id=f"alert:{alert_type}",
                severity=severity,
                title="Operational alert requires review",
                cause=message,
                axis="Runtime",
                to=_ROUTES["logs"],
                action_label="Review runtime logs",
                status="degraded",
            )
        )
    return items


def _summary_item(*, key: str, label: str, value: str, meta: str, status: str) -> dict[str, str]:
    return {
        "key": key,
        "label": label,
        "value": value,
        "meta": meta,
        "status": status,
    }


def _scoped_governance_inventory(
    governance: GovernanceService,
    *,
    instance: InstanceRecord,
    requested_tenant_id: str,
) -> tuple[list[Any], list[Any]]:
    if not requested_tenant_id:
        return (
            governance.list_accounts(instance_id=instance.instance_id),
            governance.list_runtime_keys(instance_id=instance.instance_id),
        )

    accounts = governance.list_accounts(tenant_id=requested_tenant_id)
    runtime_keys = governance.list_runtime_keys(tenant_id=requested_tenant_id)
    if accounts or runtime_keys:
        return accounts, runtime_keys

    # Legacy tenant-scoped routes can still arrive with an account-backed scope id.
    # When that happens, usage and observability data already resolve correctly via
    # the auto-backfilled instance scope, so dashboard governance KPIs need the same
    # fallback instead of dropping to zero.
    accounts = [item for item in governance.list_accounts() if str(getattr(item, "account_id", "")).strip() == requested_tenant_id]
    account_ids = {str(getattr(item, "account_id", "")).strip() for item in accounts}
    runtime_keys = [
        item for item in governance.list_runtime_keys() if str(getattr(item, "account_id", "")).strip() == requested_tenant_id or str(getattr(item, "account_id", "")).strip() in account_ids
    ]
    return accounts, runtime_keys


@router.get("/")
def dashboard_snapshot(
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_session),
    control_plane: ControlPlaneService = Depends(get_control_plane_service),
    analytics: UsageAnalyticsStore = Depends(get_usage_analytics_store),
    governance: GovernanceService = Depends(get_governance_service),
    harness: HarnessService = Depends(get_harness_service),
    settings: Settings = Depends(get_settings),
    execution: ExecutionAdminService = Depends(get_execution_admin_service),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
) -> Any:
    """
    Return a comprehensive dashboard snapshot for the current instance scope.

    Aggregates readiness, security, runtime, routing/queue, and cost signals into
    a command-center payload with attention items, KPIs, and a primary action.

    :param request: Incoming HTTP request
    :type request: Request
    :param admin: Authenticated admin session
    :type admin: AuthenticatedAdmin
    :param control_plane: Control-plane service for provider/routing data
    :type control_plane: ControlPlaneService
    :param analytics: Usage analytics store
    :type analytics: UsageAnalyticsStore
    :param governance: Governance service for audit/security/access data
    :type governance: GovernanceService
    :param harness: Harness service for readiness checks
    :type harness: HarnessService
    :param settings: Application settings
    :type settings: Settings
    :param execution: Execution admin service for dispatch/queue data
    :type execution: ExecutionAdminService
    :param instance: Resolved instance record
    :type instance: InstanceRecord
    :return: Dashboard snapshot with sections, attention items, KPIs, and summary
    :rtype: Any
    :raises TenantFilterRequiredError: If tenant scope resolution fails
    """
    requested_tenant_id = (request.query_params.get("tenantId") or "").strip()
    try:
        aggregates = analytics.aggregate(window_seconds=24 * 3600, tenant_id=instance.tenant_id)
        alerts = analytics.alert_indicators(tenant_id=instance.tenant_id)
        provider_snapshot = control_plane.provider_control_snapshot(tenant_id=instance.tenant_id)
    except TenantFilterRequiredError as exc:
        return JSONResponse(
            status_code=400,
            content={"error": {"type": "tenant_filter_required", "message": str(exc)}},
        )

    routing_snapshot = control_plane.routing_snapshot()
    queue_lanes, _queue_runs = execution.list_queue_view(instance=instance, limit=100)
    queue_lane_summaries = [lane.model_dump(mode="json") for lane in queue_lanes]
    dispatch_snapshot = execution.get_dispatch_snapshot(instance=instance).model_dump(mode="json")
    bootstrap_readiness = control_plane.bootstrap_readiness_report()
    runtime_readiness = build_operator_runtime_readiness_payload(
        _resolve_runtime_readiness(
            request,
            settings=settings,
            governance=governance,
            harness=harness,
            analytics=analytics,
        )
    )

    accounts, runtime_keys = _scoped_governance_inventory(
        governance,
        instance=instance,
        requested_tenant_id=requested_tenant_id,
    )
    configured_provider_count = _configured_provider_count(provider_snapshot)
    ready_provider_count = len([item for item in provider_snapshot if bool(item.get("ready")) and str(item.get("runtime_readiness") or "") == "ready"])
    provider_attention = _provider_attention_candidates(provider_snapshot)
    provider_attention_count = len(provider_attention)

    runtime_requests_24h = _to_int(aggregates["event_count"])
    errors_24h = _to_int(aggregates["error_event_count"])
    runtime_traffic = next(
        (item for item in aggregates["by_traffic_type"] if item["traffic_type"] == "runtime"),
        {
            "actual_cost": 0.0,
            "hypothetical_cost": 0.0,
            "avoided_cost": 0.0,
            "requests": 0,
        },
    )
    health_traffic = next(
        (item for item in aggregates["by_traffic_type"] if item["traffic_type"] == "health_check"),
        {
            "actual_cost": 0.0,
            "hypothetical_cost": 0.0,
            "avoided_cost": 0.0,
            "requests": 0,
        },
    )
    runtime_actual_cost = _to_float(runtime_traffic.get("actual_cost"))
    runtime_hypothetical_cost = _to_float(runtime_traffic.get("hypothetical_cost"))
    runtime_avoided_cost = _to_float(runtime_traffic.get("avoided_cost"))
    health_actual_cost = _to_float(health_traffic.get("actual_cost"))

    open_circuits = [circuit for circuit in routing_snapshot["circuits"] if str(circuit.get("state") or "") == "open"]
    blocked_decisions = [decision for decision in routing_snapshot["recent_decisions"] if bool(decision.get("error_type"))]
    routing_summary = routing_snapshot["summary"]
    hard_budget_blocked = bool(routing_summary.get("hard_budget_blocked"))
    blocked_cost_classes = [str(value) for value in routing_summary.get("blocked_cost_classes", [])]

    waiting_on_approval_runs = sum(_to_int(lane["waiting_on_approval_runs"]) for lane in queue_lane_summaries)
    paused_runs = sum(_to_int(lane["paused_runs"]) for lane in queue_lane_summaries)
    runnable_runs = sum(_to_int(lane["runnable_runs"]) for lane in queue_lane_summaries)
    longest_wait_seconds = max(
        (_to_int(lane["longest_wait_seconds"]) for lane in queue_lane_summaries if lane.get("longest_wait_seconds") is not None),
        default=0,
    )
    stalled_attempt_count = len(dispatch_snapshot["stalled_attempts"])
    leased_attempt_count = len(dispatch_snapshot["leased_attempts"])
    quarantined_runs = _to_int(dispatch_snapshot["quarantined_runs"])

    admin_security = governance.bootstrap_status() if role_allows(admin.role, "admin") else None
    secret_posture = governance.provider_secret_posture() if admin_security is not None else []
    secret_rotation_gaps = [item for item in secret_posture if bool(item.get("configured")) and bool(item.get("needs_rotation_evidence"))]

    empty_state: dict[str, str] | None = None
    if configured_provider_count == 0 and ready_provider_count == 0 and len(runtime_keys) == 0 and len(accounts) == 0 and runtime_requests_24h == 0:
        empty_state = {
            "status": "onboarding-only",
            "title": "Command center is not configured yet",
            "description": ("No configured provider, runtime key, account, or runtime traffic is active in this scope yet. Finish onboarding before trusting runtime, routing, or cost posture."),
            "action_label": "Open onboarding",
            "to": _ROUTES["onboarding"],
        }

    checks = cast("list[dict[str, Any]]", bootstrap_readiness.get("checks", []))
    bootstrap_failures = [check for check in checks if not bool(check.get("ok"))]
    readiness_details: list[str] = []
    if bootstrap_failures:
        readiness_details.append(f"{len(bootstrap_failures)} bootstrap checks are still failing.")
        readiness_details.append(_top_failing_check_message(bootstrap_failures, fallback="Bootstrap checks require review."))
    if not bool(runtime_readiness["accepting_traffic"]):
        readiness_details.append(f"Runtime is not accepting traffic because {runtime_readiness['critical_count']} critical checks remain open.")
    elif _to_int(runtime_readiness["warning_count"]) > 0:
        readiness_details.append(f"Runtime is accepting traffic with {runtime_readiness['warning_count']} warning checks still open.")
    if empty_state is not None:
        readiness_status = "onboarding-only"
        readiness_reason = empty_state["description"]
        readiness_action = (_ROUTES["onboarding"], "Configure providers")
        readiness_details = [
            "This scope does not yet have configured providers, runtime keys, or routed traffic.",
            "Use onboarding to establish the first real runtime path before treating this as an operating surface.",
        ]
    elif bootstrap_failures or not bool(runtime_readiness["accepting_traffic"]):
        readiness_status = "blocked"
        readiness_reason = f"{len(bootstrap_failures)} bootstrap checks and {runtime_readiness['critical_count']} runtime critical checks are blocking go-live."
        readiness_action = (_ROUTES["onboarding"], "Fix go-live blockers")
    elif _to_int(runtime_readiness["warning_count"]) > 0:
        readiness_status = "degraded"
        readiness_reason = f"{runtime_readiness['warning_count']} runtime readiness warnings still need proof before release."
        readiness_action = (_ROUTES["release_validation"], "Review release validation")
    else:
        readiness_status = "ready"
        readiness_reason = "Bootstrap checks passed and runtime readiness is currently accepting traffic."
        readiness_action = (_ROUTES["release_validation"], "Review release validation")
        readiness_details.append("The current build has no active bootstrap or runtime gate blockers.")

    if admin_security is None:
        security_status = "waiting_approval"
        security_reason = "Security bootstrap and secret posture stay limited to admin sessions on the command center."
        security_action = (_ROUTES["accounts"], "Review runtime access")
        security_details = [
            "This session can still review runtime accounts and keys, but bootstrap-secret posture remains admin-only.",
        ]
    else:
        security_details = []
        if bool(admin_security.get("default_password_in_use")):
            security_details.append("The bootstrap admin still uses an insecure default or placeholder password.")
        if bool(admin_security.get("must_rotate_password")):
            security_details.append("The bootstrap admin session still requires a password rotation.")
        if not bool(admin_security.get("admin_auth_enabled")):
            security_details.append("Admin authentication is disabled.")
        if secret_rotation_gaps:
            security_details.append(f"{len(secret_rotation_gaps)} configured provider credentials lack rotation evidence.")
        if bool(admin_security.get("default_password_in_use")) or bool(admin_security.get("must_rotate_password")) or not bool(admin_security.get("admin_auth_enabled")):
            security_status = "blocked"
            security_reason = "Bootstrap admin security is incomplete and should be closed before calling the stack stable."
        elif secret_rotation_gaps:
            security_status = "degraded"
            security_reason = "Secret rotation evidence is incomplete for configured provider credentials."
        else:
            security_status = "ready"
            security_reason = "Admin auth is enabled, bootstrap password posture is closed, and credential rotation evidence is present."
            security_details.append("No immediate security posture blocker is active on the dashboard.")
        security_action = (
            _ROUTES["security"],
            "Close security posture" if security_status in {"blocked", "degraded"} else "Review security posture",
        )

    critical_alerts = [alert for alert in alerts if str(alert.get("severity") or "") == "critical"]
    warning_alerts = [alert for alert in alerts if str(alert.get("severity") or "") == "warning"]
    runtime_details: list[str] = []
    if critical_alerts:
        runtime_status = "blocked"
        runtime_reason = str(critical_alerts[0].get("message") or "Critical runtime alerts are active.")
        runtime_action = (_ROUTES["errors"], "Investigate runtime failures")
    elif warning_alerts or provider_attention_count > 0:
        runtime_status = "degraded"
        if warning_alerts:
            runtime_reason = str(warning_alerts[0].get("message") or "Runtime alerts require review.")
            runtime_action = (_ROUTES["errors"], "Investigate runtime failures")
        else:
            runtime_reason = f"{provider_attention_count} provider routes still need runtime follow-up."
            runtime_action = (_ROUTES["providers"], "Stabilize provider runtime")
    elif runtime_requests_24h == 0:
        runtime_status = "onboarding-only"
        runtime_reason = "No runtime traffic was recorded in the last 24 hours, so runtime proof is still health-only."
        runtime_action = (_ROUTES["provider_health"], "Prove runtime traffic")
    else:
        runtime_status = "ready"
        runtime_reason = "Runtime alerts are quiet and at least one provider route is carrying real traffic."
        runtime_action = (_ROUTES["logs"], "Review runtime logs")
    runtime_details.append(f"{errors_24h} runtime errors were recorded in the last 24 hours.")
    runtime_details.append(f"{provider_attention_count} provider routes currently require follow-up.")
    runtime_details.append(f"{ready_provider_count} runtime-ready provider routes are in scope.")

    routing_queue_details: list[str] = []
    if hard_budget_blocked:
        routing_queue_status = "blocked"
        routing_queue_reason = "Routing is hard-blocked by the current budget policy."
        routing_queue_action = (_ROUTES["routing"], "Unblock routing budget")
    elif stalled_attempt_count > 0:
        routing_queue_status = "blocked"
        routing_queue_reason = f"{stalled_attempt_count} dispatch leases are stalled and need intervention."
        routing_queue_action = (_ROUTES["dispatch"], "Recover stalled dispatch")
    elif quarantined_runs > 0:
        routing_queue_status = "blocked"
        routing_queue_reason = f"{quarantined_runs} runs are quarantined and need execution review."
        routing_queue_action = (_ROUTES["dispatch"], "Review quarantined runs")
    elif waiting_on_approval_runs > 0:
        routing_queue_status = "degraded"
        routing_queue_reason = f"{waiting_on_approval_runs} runs are waiting on approval instead of moving through the queue."
        routing_queue_action = (_ROUTES["approvals"], "Clear approval queue")
    elif open_circuits or blocked_decisions or paused_runs > 0:
        routing_queue_status = "degraded"
        if open_circuits:
            routing_queue_reason = f"{len(open_circuits)} routing circuits are open."
            routing_queue_action = (_ROUTES["routing"], "Resolve routing pressure")
        elif blocked_decisions:
            routing_queue_reason = f"{len(blocked_decisions)} recent routing decisions were blocked."
            routing_queue_action = (_ROUTES["routing"], "Resolve routing pressure")
        else:
            routing_queue_reason = f"{paused_runs} runs are paused inside the execution fabric."
            routing_queue_action = (_ROUTES["queues"], "Resume paused runs")
    else:
        routing_queue_status = "ready"
        routing_queue_reason = "Queue lanes, dispatch leases, and routing controls are not showing active pressure."
        routing_queue_action = (_ROUTES["queues"], "Review queue lanes")
    routing_queue_details.append(f"{runnable_runs} runs are currently runnable across queue lanes.")
    routing_queue_details.append(f"{leased_attempt_count} dispatch leases are active right now.")
    if longest_wait_seconds > 0:
        routing_queue_details.append(f"The longest queued wait is {longest_wait_seconds} seconds.")
    if blocked_cost_classes:
        routing_queue_details.append(f"Blocked cost classes: {', '.join(blocked_cost_classes)}.")

    cost_details: list[str] = [
        f"Runtime actual cost is {runtime_actual_cost:.2f} over the last 24 hours.",
        f"Runtime hypothetical cost is {runtime_hypothetical_cost:.2f}, with {runtime_avoided_cost:.2f} avoided.",
    ]
    if hard_budget_blocked:
        cost_status = "blocked"
        cost_reason = "Budget guardrails are hard-blocking routing decisions."
        cost_action = (_ROUTES["costs"], "Unblock budget guardrails")
    elif runtime_requests_24h == 0 and health_actual_cost == 0.0:
        cost_status = "onboarding-only"
        cost_reason = "No spend or traffic has been recorded in this scope yet."
        cost_action = (_ROUTES["costs"], "Review cost posture")
    elif health_actual_cost > runtime_actual_cost and health_actual_cost > 0:
        cost_status = "degraded"
        cost_reason = "Health-check spend is higher than runtime spend and should be reviewed."
        cost_action = (_ROUTES["costs"], "Reduce cost pressure")
    elif blocked_cost_classes:
        cost_status = "degraded"
        cost_reason = "Blocked cost classes are constraining routing choices."
        cost_action = (_ROUTES["costs"], "Reduce cost pressure")
    else:
        cost_status = "ready"
        cost_reason = "Spend is flowing without an active budget or probe-cost blocker."
        cost_action = (_ROUTES["costs"], "Review cost posture")
    if health_actual_cost > 0:
        cost_details.append(f"Health-check spend is {health_actual_cost:.2f} for the same window.")

    sections = [
        _section(
            key="readiness",
            title="Readiness",
            status=readiness_status,
            reason=readiness_reason,
            to=readiness_action[0],
            action_label=readiness_action[1],
            details=readiness_details[:3],
        ),
        _section(
            key="security",
            title="Security",
            status=security_status,
            reason=security_reason,
            to=security_action[0],
            action_label=security_action[1],
            details=security_details[:3],
        ),
        _section(
            key="runtime",
            title="Runtime",
            status=runtime_status,
            reason=runtime_reason,
            to=runtime_action[0],
            action_label=runtime_action[1],
            details=runtime_details[:3],
        ),
        _section(
            key="routing_queue",
            title="Routing / Queue",
            status=routing_queue_status,
            reason=routing_queue_reason,
            to=routing_queue_action[0],
            action_label=routing_queue_action[1],
            details=routing_queue_details[:3],
        ),
        _section(
            key="cost",
            title="Cost",
            status=cost_status,
            reason=cost_reason,
            to=cost_action[0],
            action_label=cost_action[1],
            details=cost_details[:3],
        ),
    ]

    attention: list[dict[str, str]] = []
    if empty_state is not None:
        attention.append(
            _attention_item(
                item_id="setup:not_configured",
                severity="critical",
                title="This scope is still in onboarding",
                cause=empty_state["description"],
                axis="Readiness",
                to=empty_state["to"],
                action_label=empty_state["action_label"],
                status=empty_state["status"],
            )
        )
    elif readiness_status in {"blocked", "onboarding-only"}:
        attention.append(
            _attention_item(
                item_id="readiness:go_live",
                severity="critical",
                title="Go-live readiness is blocked",
                cause=readiness_reason,
                axis="Readiness",
                to=readiness_action[0],
                action_label=readiness_action[1],
                status=readiness_status,
            )
        )

    if security_status in {"blocked", "degraded"}:
        attention.append(
            _attention_item(
                item_id="security:posture",
                severity="critical" if security_status == "blocked" else "warning",
                title="Security posture needs closure",
                cause=security_reason,
                axis="Security",
                to=security_action[0],
                action_label=security_action[1],
                status=security_status,
            )
        )

    attention.extend(_alert_attention_items(alerts[:2]))

    for item in provider_attention[:2]:
        provider_label = str(item.get("label") or item.get("provider") or "Provider")
        target_route, target_label = _provider_issue_action(item)
        attention.append(
            _attention_item(
                item_id=f"provider:{str(item.get('provider') or provider_label)}",
                severity="critical" if _to_int(item.get("oauth_failure_count")) > 0 else "warning",
                title=f"{provider_label} is not runtime-stable yet",
                cause=_provider_issue_cause(item),
                axis=str(item.get("provider_axis") or "Provider route"),
                to=target_route,
                action_label=target_label,
                status=_provider_issue_status(item),
            )
        )

    if routing_queue_status in {"blocked", "degraded"}:
        attention.append(
            _attention_item(
                item_id="routing_queue:pressure",
                severity="critical" if routing_queue_status == "blocked" else "warning",
                title="Routing or queue pressure needs intervention",
                cause=routing_queue_reason,
                axis="Routing / Queue",
                to=routing_queue_action[0],
                action_label=routing_queue_action[1],
                status=routing_queue_status,
            )
        )

    if cost_status in {"blocked", "degraded"}:
        attention.append(
            _attention_item(
                item_id="cost:guardrails",
                severity="critical" if cost_status == "blocked" else "warning",
                title="Cost guardrails are shaping runtime behavior",
                cause=cost_reason,
                axis="Cost",
                to=cost_action[0],
                action_label=cost_action[1],
                status=cost_status,
            )
        )

    attention = sorted(
        attention,
        key=_attention_priority,
    )[:8]
    primary_action: dict[str, str] | None
    if empty_state is not None:
        primary_action = {
            "kind": "provider_configuration",
            "title": _PRIMARY_ACTION_TITLES["provider_configuration"],
            "description": empty_state["description"],
            "status": empty_state["status"],
            "to": empty_state["to"],
            "action_label": "Configure providers",
        }
    else:
        primary_action = _primary_action_from_attention(attention)
        if primary_action is None:
            primary_action = {
                "kind": "all_stable",
                "title": _PRIMARY_ACTION_TITLES["all_stable"],
                "description": "No blocking signal is active across readiness, security, runtime, routing, or cost for this scope.",
                "status": "ready",
                "to": _ROUTES["release_validation"],
                "action_label": "Review release validation",
            }

    summary = [
        _summary_item(
            key="go_live",
            label="Go-live",
            value=readiness_status.replace("_", " "),
            meta=readiness_reason,
            status=readiness_status,
        ),
        _summary_item(
            key="providers",
            label="Provider posture",
            value=f"{ready_provider_count} ready routes",
            meta=f"{provider_attention_count} routes still need follow-up.",
            status=runtime_status,
        ),
        _summary_item(
            key="routing_queue",
            label="Routing / Queue",
            value=f"{stalled_attempt_count + quarantined_runs + waiting_on_approval_runs} active blockers",
            meta=routing_queue_reason,
            status=routing_queue_status,
        ),
        _summary_item(
            key="cost",
            label="Cost guardrails",
            value=f"{runtime_actual_cost:.2f} actual / 24h",
            meta=cost_reason,
            status=cost_status,
        ),
    ]

    response: dict[str, Any] = {
        "status": "ok",
        "object": "dashboard_command_center",
        "generated_at": runtime_readiness["checked_at"],
        "kpis": {
            "providers": len(provider_snapshot),
            "configured_providers": configured_provider_count,
            "ready_providers": ready_provider_count,
            "active_models": sum(_to_int(item.get("model_count")) for item in provider_snapshot),
            "runtime_requests_24h": runtime_requests_24h,
            "errors_24h": errors_24h,
            "needs_attention_count": len(attention),
            "runtime_keys": len(runtime_keys),
            "accounts": len(accounts),
            "waiting_on_approval_runs": waiting_on_approval_runs,
            "stalled_attempts": stalled_attempt_count,
            "open_circuits": len(open_circuits),
        },
        "alerts": alerts,
        "needs_attention": [item["title"] for item in attention],
        "primary_action": primary_action,
        "attention": attention,
        "sections": sections,
        "summary": summary,
        "empty_state": empty_state,
        "instance": {
            "instance_id": instance.instance_id,
            "tenant_id": instance.tenant_id,
            "company_id": instance.company_id,
            "display_name": instance.display_name,
        },
    }

    if not requested_tenant_id and admin_security is not None:
        response["security"] = admin_security
    return response
