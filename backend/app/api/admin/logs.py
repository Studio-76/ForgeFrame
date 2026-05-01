"""Admin logs and audit endpoints."""

from __future__ import annotations

import base64
import binascii
import csv
import io
import json
from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_session
from app.auth.local_auth import role_allows
from app.governance.models import (
    AdminUserRecord,
    AuditEventRecord,
    AuthenticatedAdmin,
    GatewayAccountRecord,
    MutableSettingRecord,
    RuntimeKeyRecord,
)
from app.governance.service import GovernanceService, get_governance_service
from app.instances.models import InstanceRecord
from app.settings.config import Settings, get_settings
from app.telemetry import (
    build_logging_operability_snapshot,
    build_metrics_operability_snapshot,
    build_tracing_operability_snapshot,
)
from app.tenancy import TenantFilterRequiredError
from app.usage.analytics import UsageAnalyticsStore, get_usage_analytics_store

router = APIRouter(prefix="/logs", tags=["admin-logs"])
_audit_history_bearer = HTTPBearer(auto_error=False)

_AUDIT_EXPORT_WINDOWS: dict[str, timedelta | None] = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "all": None,
}

_AUDIT_STATUS_LABELS = {
    "ok": "Succeeded",
    "warning": "Needs attention",
    "failed": "Failed",
}

_ACTION_LABEL_OVERRIDES = {
    "account_create": "Account created",
    "account_update": "Account updated",
    "admin_break_glass_approved": "Break-glass request approved",
    "admin_break_glass_rejected": "Break-glass request rejected",
    "admin_break_glass_requested": "Break-glass request opened",
    "admin_break_glass_recovery_required": "Break-glass blocked",
    "admin_break_glass_start": "Break-glass session started",
    "admin_break_glass_timed_out": "Break-glass request timed out",
    "admin_impersonation_approved": "Impersonation request approved",
    "admin_impersonation_rejected": "Impersonation request rejected",
    "admin_impersonation_requested": "Impersonation request opened",
    "admin_impersonation_recovery_required": "Impersonation blocked",
    "admin_impersonation_start": "Impersonation session started",
    "admin_impersonation_timed_out": "Impersonation request timed out",
    "admin_login": "Admin login",
    "admin_logout": "Admin logout",
    "admin_password_rotate": "Admin password rotated",
    "admin_role_change": "Admin role changed",
    "admin_session_bulk_revoke": "Admin sessions revoked",
    "admin_session_revoke": "Admin session revoked",
    "admin_status_change": "Admin status changed",
    "admin_token_exchange": "Elevated session token exchanged",
    "admin_user_create": "Admin user created",
    "admin_user_update": "Admin user updated",
    "audit_export_generated": "Audit export generated",
    "bootstrap_admin_created": "Bootstrap admin created",
    "bootstrap_admin_secret_reload": "Bootstrap admin secret reloaded",
    "execution_approval_approved": "Execution approval approved",
    "execution_approval_rejected": "Execution approval rejected",
    "execution_run_replay": "Execution replay admitted",
    "runtime_account_status_denied": "Runtime account denied",
    "runtime_key_expired": "Runtime key expired",
    "runtime_key_issue": "Runtime key issued",
    "runtime_key_rotate": "Runtime key rotated",
    "runtime_key_status": "Runtime key status changed",
    "runtime_provider_binding_denied": "Runtime provider binding denied",
    "secret_rotation_record": "Rotation evidence recorded",
    "setting_override_remove": "Setting reset to default",
    "setting_override_upsert": "Setting override updated",
}

_TARGET_TYPE_LABELS = {
    "admin_session": "Admin session",
    "admin_user": "Admin user",
    "audit_export": "Audit export",
    "elevated_access_request": "Elevated access request",
    "execution_approval": "Execution approval",
    "execution_run": "Execution run",
    "gateway_account": "Gateway account",
    "runtime_key": "Runtime key",
    "setting": "Setting",
}

_RELATED_ROUTE_BY_TARGET_TYPE = {
    "admin_session": {"label": "Open Security & Policies", "href": "/security"},
    "admin_user": {"label": "Open Security & Policies", "href": "/security"},
    "audit_export": {"label": "Open Audit History", "href": "/logs#audit-history"},
    "elevated_access_request": {"label": "Open Approvals", "href": "/approvals"},
    "execution_approval": {"label": "Open Approvals", "href": "/approvals"},
    "execution_run": {
        "label": "Open Provider Health & Runs",
        "href": "/providers#provider-health-runs",
    },
    "gateway_account": {"label": "Open Accounts", "href": "/accounts"},
    "runtime_key": {"label": "Open API Keys", "href": "/api-keys"},
    "setting": {"label": "Open System Settings", "href": "/settings"},
}

_CHANGE_CONTEXT_FIELD_LABELS = {
    "account_id": "Account",
    "approval_expires_at": "Approval expires",
    "approval_reference": "Approval reference",
    "attempt_id": "Attempt",
    "blocked_reason": "Blocked reason",
    "command_id": "Command",
    "decision_note": "Decision note",
    "deduplicated": "Deduplicated",
    "duration_minutes": "Duration",
    "eligible_admin_approver_count": "Eligible approvers",
    "exchange_type": "Exchange type",
    "expires_at": "Expires",
    "filename": "Export filename",
    "format": "Export format",
    "kind": "Evidence kind",
    "new_role": "New role",
    "new_status": "New status",
    "notification_targets": "Notification targets",
    "previous_role": "Previous role",
    "previous_status": "Previous status",
    "reason": "Reason",
    "reference": "Reference",
    "request_id": "Request",
    "request_type": "Request type",
    "role": "Role",
    "rotated_from": "Rotated from",
    "rotated_to": "Rotated to",
    "row_count": "Export rows",
    "scopes": "Scopes",
    "session_id": "Session",
    "status": "Status",
    "target_role": "Target role",
    "target_user_id": "Target user",
    "trace_id": "Trace",
}

_SENSITIVE_METADATA_FRAGMENTS = (
    "authorization",
    "credential",
    "hash",
    "password",
    "secret",
    "token",
)

_DETAIL_METADATA_KEY_ORDER = (
    "request_type",
    "approval_reference",
    "decision_note",
    "reason",
    "kind",
    "reference",
    "status",
    "role",
    "previous_role",
    "new_role",
    "previous_status",
    "new_status",
    "account_id",
    "scopes",
    "expires_at",
    "approval_expires_at",
    "duration_minutes",
    "notification_targets",
    "blocked_reason",
    "eligible_admin_approver_count",
    "rotated_from",
    "rotated_to",
    "command_id",
    "attempt_id",
    "deduplicated",
    "target_user_id",
    "target_role",
    "filename",
    "format",
    "row_count",
)

_CORRELATION_METADATA_KEY_ORDER = (
    "request_id",
    "command_id",
    "session_id",
    "trace_id",
    "approval_reference",
    "attempt_id",
)

_INCIDENT_AXIS_LABELS = {
    "runtime": "Runtime",
    "provider": "Provider",
    "oauth": "OAuth",
    "routing": "Routing",
    "queue_dispatch": "Queue / Dispatch",
    "security": "Security",
    "tls": "TLS",
    "work_interaction": "Work Interaction",
}

_INCIDENT_AXIS_LINKS = {
    "runtime": [
        {"label": "Open Logs", "href": "/logs"},
        {"label": "Open Execution Review", "href": "/execution"},
    ],
    "provider": [
        {"label": "Open Health", "href": "/health-status"},
        {"label": "Open Provider Targets", "href": "/provider-targets"},
    ],
    "oauth": [
        {"label": "Open OAuth Targets", "href": "/oauth-targets"},
        {"label": "Open Health", "href": "/health-status"},
    ],
    "routing": [
        {"label": "Open Routing", "href": "/routing"},
        {"label": "Open Provider Targets", "href": "/provider-targets"},
    ],
    "queue_dispatch": [
        {"label": "Open Queues", "href": "/queues"},
        {"label": "Open Dispatch", "href": "/dispatch"},
        {"label": "Open Execution Review", "href": "/execution"},
    ],
    "security": [{"label": "Open Security & Policies", "href": "/security"}],
    "tls": [
        {"label": "Open Ingress / TLS", "href": "/ingress-tls"},
        {"label": "Open Health", "href": "/health-status"},
    ],
    "work_interaction": [
        {"label": "Open Execution Review", "href": "/execution"},
        {"label": "Open Logs", "href": "/logs"},
    ],
}

_WORK_INTERACTION_ROUTE_FRAGMENTS = (
    "/conversations",
    "/inbox",
    "/tasks",
    "/reminders",
    "/automations",
    "/notifications",
    "/agents",
    "/channels",
    "/contacts",
    "/knowledge",
    "/memory",
    "/learning",
    "/skills",
    "/assistant-profiles",
    "/workspaces",
    "/artifacts",
)


def _incident_links(axis: str) -> list[dict[str, str]]:
    return list(_INCIDENT_AXIS_LINKS.get(axis, [{"label": "Open Logs", "href": "/logs"}]))


def _timestamp_bounds(values: list[str]) -> tuple[str | None, str | None]:
    timestamps = sorted(value for value in values if value)
    if not timestamps:
        return None, None
    return timestamps[0], timestamps[-1]


def _top_counts(values: list[str], *, limit: int = 5) -> list[dict[str, object]]:
    counts = Counter(value for value in values if value)
    return [{"value": value, "count": count} for value, count in counts.most_common(limit)]


def _severity_label(*, critical: bool, warning: bool, unsupported: bool = False) -> str:
    if unsupported:
        return "unsupported"
    if critical:
        return "critical"
    if warning:
        return "warning"
    return "clear"


def _axis_for_error(event: Any) -> str:
    error_type = str(getattr(event, "error_type", "") or "").lower()
    route = str(getattr(event, "route", "") or "").lower()
    integration = str(getattr(event, "integration", "") or "").lower()
    integration_class = str(getattr(event, "integration_class", "") or "").lower()
    provider = str(getattr(event, "provider", "") or "").lower()
    status_code = int(getattr(event, "status_code", 0) or 0)

    if "oauth" in error_type or "oauth" in route or "oauth" in integration or "oauth" in integration_class:
        return "oauth"
    if error_type.startswith("routing_") or "routing" in route:
        return "routing"
    if any(fragment in error_type for fragment in ("queue", "dispatch", "lease", "outbox")):
        return "queue_dispatch"
    if any(fragment in error_type for fragment in ("tls", "certificate", "acme")) or "ingress" in route:
        return "tls"
    if any(fragment in error_type for fragment in ("security", "permission", "forbidden", "unauthorized")) or status_code in {401, 403}:
        return "security"
    if any(fragment in route for fragment in _WORK_INTERACTION_ROUTE_FRAGMENTS) or integration in {
        "conversations",
        "inbox",
        "tasks",
        "reminders",
        "automations",
        "notifications",
        "agents",
        "channels",
        "contacts",
        "knowledge",
        "memory",
        "learning",
        "skills",
        "assistant_profiles",
        "workspaces",
        "artifacts",
    }:
        return "work_interaction"
    if provider and (error_type.startswith("provider_") or status_code >= 502):
        return "provider"
    return "runtime"


def _incident_entry(
    *,
    axis: str,
    title: str,
    severity: str,
    count: int,
    first_seen_at: str | None,
    last_seen_at: str | None,
    current_effect: str,
    next_step: str,
    summary: str,
    raw_evidence: dict[str, object],
) -> dict[str, object]:
    return {
        "incident_id": f"{axis}:{severity}:{count}:{last_seen_at or 'none'}",
        "axis": axis,
        "axis_label": _INCIDENT_AXIS_LABELS[axis],
        "title": title,
        "severity": severity,
        "count": count,
        "first_seen_at": first_seen_at,
        "last_seen_at": last_seen_at,
        "current_effect": current_effect,
        "next_step": next_step,
        "summary": summary,
        "links": _incident_links(axis),
        "raw_evidence": raw_evidence,
    }


def _grouped_error_incidents(error_events: list[Any]) -> dict[str, list[Any]]:
    grouped: dict[str, list[Any]] = defaultdict(list)
    for event in error_events:
        grouped[_axis_for_error(event)].append(event)
    return grouped


def _axis_incidents_snapshot(
    *,
    metrics_snapshot: dict[str, object],
    logging_snapshot: dict[str, object],
    tracing_snapshot: dict[str, object],
    error_events: list[Any],
    health_events: list[Any],
) -> list[dict[str, object]]:
    grouped_errors = _grouped_error_incidents(error_events)
    dependency_metrics = list(metrics_snapshot.get("dependency_metrics", []))
    routing_metrics = dict(metrics_snapshot.get("routing_metrics", {}))
    queue_metrics = dict(metrics_snapshot.get("queue_metrics", {}))
    degraded_health_events = [
        event for event in health_events if str(getattr(event, "status", "") or "").lower() not in {"healthy", "ok", "success", "discovery_only"} or bool(getattr(event, "last_error", None))
    ]

    runtime_events = grouped_errors.get("runtime", [])
    runtime_first, runtime_last = _timestamp_bounds([str(event.created_at) for event in runtime_events])
    provider_events = grouped_errors.get("provider", [])
    provider_first, provider_last = _timestamp_bounds([str(event.created_at) for event in provider_events] + [str(event.created_at) for event in degraded_health_events])
    oauth_events = grouped_errors.get("oauth", [])
    oauth_first, oauth_last = _timestamp_bounds([str(event.created_at) for event in oauth_events])
    routing_events = grouped_errors.get("routing", [])
    queue_events = grouped_errors.get("queue_dispatch", [])
    security_events = grouped_errors.get("security", [])
    tls_events = grouped_errors.get("tls", [])
    work_events = grouped_errors.get("work_interaction", [])
    work_first, work_last = _timestamp_bounds([str(event.created_at) for event in work_events])
    routing_failures = list(routing_metrics.get("recent_failures", []))
    routing_first, routing_last = _timestamp_bounds([str(item.get("created_at") or "") for item in routing_failures] + [str(event.created_at) for event in routing_events])
    queue_first, queue_last = _timestamp_bounds([str(event.created_at) for event in queue_events])
    security_first, security_last = _timestamp_bounds([str(event.created_at) for event in security_events])
    tls_first, tls_last = _timestamp_bounds([str(event.created_at) for event in tls_events])

    queue_dead_letters = int(queue_metrics.get("dead_letters", 0) or 0)
    queue_expired_leases = int(queue_metrics.get("expired_leases", 0) or 0)
    queue_pending_dispatch = int(queue_metrics.get("pending_dispatch", 0) or 0)
    queue_pending_outbox = int(queue_metrics.get("pending_outbox", 0) or 0)
    queue_pressure = queue_dead_letters + queue_expired_leases + queue_pending_dispatch + queue_pending_outbox
    routing_budget = dict(routing_metrics.get("budget", {}))
    routing_budget_blocked = bool(routing_budget.get("hard_blocked")) or bool(routing_metrics.get("budget_blocked"))
    routing_open_circuits = bool(routing_metrics.get("open_circuits"))
    routing_count = max(
        len(routing_failures),
        len(routing_events),
        int(routing_metrics.get("blocked_decisions", 0) or 0),
    )
    routing_incident_active = routing_budget_blocked or routing_open_circuits or routing_count > 0
    queue_count = max(queue_pressure, len(queue_events))
    security_denials = sum(1 for event in security_events if int(getattr(event, "status_code", 0) or 0) in {401, 403})
    tls_fatal = sum(1 for event in tls_events if int(getattr(event, "status_code", 0) or 0) >= 500)

    incidents = [
        _incident_entry(
            axis="runtime",
            title="Runtime execution failures",
            severity=_severity_label(critical=len(runtime_events) >= 3, warning=len(runtime_events) > 0),
            count=len(runtime_events),
            first_seen_at=runtime_first,
            last_seen_at=runtime_last,
            current_effect="Runtime requests are failing on the active instance scope." if runtime_events else "No current runtime execution failure is visible in the logs endpoint.",
            next_step="Open logs or execution review to inspect the active runtime failure path." if runtime_events else "Monitor only.",
            summary=(
                f"Most common runtime error: {_top_counts([str(event.error_type) for event in runtime_events], limit=1)[0]['value']}."
                if runtime_events
                else "No runtime-specific error shape is currently recorded."
            ),
            raw_evidence={
                "top_error_types": _top_counts([str(event.error_type) for event in runtime_events]),
                "top_routes": _top_counts([str(event.route or "unknown") for event in runtime_events]),
                "sample_errors": [
                    {
                        "created_at": str(event.created_at),
                        "error_type": str(event.error_type),
                        "status_code": int(event.status_code),
                        "route": str(event.route or ""),
                        "client_id": str(event.client_id),
                    }
                    for event in runtime_events[:5]
                ],
            },
        ),
        _incident_entry(
            axis="provider",
            title="Provider health and dependency failures",
            severity=_severity_label(
                critical=len(provider_events) >= 3 or len(degraded_health_events) >= 2,
                warning=len(provider_events) > 0 or len(degraded_health_events) > 0,
            ),
            count=len(provider_events) + len(degraded_health_events),
            first_seen_at=provider_first,
            last_seen_at=provider_last,
            current_effect="Provider failures or degraded health are affecting routing candidates and runtime stability."
            if provider_events or degraded_health_events
            else "No active provider-side failure signal is visible.",
            next_step="Open Health or Provider Targets to repair provider readiness and target posture." if provider_events or degraded_health_events else "Monitor only.",
            summary=(
                f"Affected providers: {', '.join(sorted({str(getattr(event, 'provider', '') or 'unknown') for event in [*provider_events, *degraded_health_events]}))}."
                if provider_events or degraded_health_events
                else "No provider incident is currently recorded."
            ),
            raw_evidence={
                "dependency_metrics": dependency_metrics,
                "top_error_types": _top_counts([str(event.error_type) for event in provider_events]),
                "sample_errors": [
                    {
                        "created_at": str(event.created_at),
                        "provider": str(event.provider or "unknown"),
                        "error_type": str(event.error_type),
                        "status_code": int(event.status_code),
                    }
                    for event in provider_events[:5]
                ],
                "degraded_health": [
                    {
                        "created_at": str(event.created_at),
                        "provider": str(event.provider),
                        "status": str(event.status),
                        "reason": str(event.readiness_reason or ""),
                        "last_error": str(event.last_error or ""),
                    }
                    for event in degraded_health_events[:5]
                ],
            },
        ),
        _incident_entry(
            axis="oauth",
            title="OAuth-specific failures",
            severity=_severity_label(critical=len(oauth_events) >= 2, warning=len(oauth_events) > 0),
            count=len(oauth_events),
            first_seen_at=oauth_first,
            last_seen_at=oauth_last,
            current_effect="OAuth-backed provider flows are failing and can block account-based runtime paths." if oauth_events else "No OAuth-specific error is visible in the current logs scope.",
            next_step="Open OAuth Targets to reconnect or revalidate account-backed providers." if oauth_events else "Monitor only.",
            summary=(
                f"Most common OAuth error: {_top_counts([str(event.error_type) for event in oauth_events], limit=1)[0]['value']}." if oauth_events else "No OAuth incident is currently recorded."
            ),
            raw_evidence={
                "top_error_types": _top_counts([str(event.error_type) for event in oauth_events]),
                "sample_errors": [
                    {
                        "created_at": str(event.created_at),
                        "provider": str(event.provider or "unknown"),
                        "error_type": str(event.error_type),
                        "status_code": int(event.status_code),
                    }
                    for event in oauth_events[:5]
                ],
            },
        ),
        _incident_entry(
            axis="routing",
            title="Routing and policy failures",
            severity=_severity_label(
                critical=routing_budget_blocked or routing_count > 0,
                warning=routing_open_circuits or bool(routing_metrics.get("blocked_decisions")),
            ),
            count=routing_count,
            first_seen_at=routing_first,
            last_seen_at=routing_last,
            current_effect="Routing decisions are being blocked by policy, budget, circuit, or capability posture."
            if routing_incident_active
            else "No blocked routing decision is currently recorded.",
            next_step="Open Routing to inspect policy stage, budget gates, and blocked candidates." if routing_incident_active else "Monitor only.",
            summary=(
                f"Blocked decisions: {int(routing_metrics.get('blocked_decisions', 0) or 0)} · open circuits: {int(routing_metrics.get('open_circuits', 0) or 0)} · budget blocked: {'yes' if routing_budget_blocked else 'no'}."  # noqa: E501
                if routing_incident_active
                else "No routing incident is currently recorded."
            ),
            raw_evidence={
                "routing_metrics": routing_metrics,
                "recent_failures": routing_failures,
                "top_error_types": _top_counts([str(event.error_type) for event in routing_events]),
                "sample_errors": [
                    {
                        "created_at": str(event.created_at),
                        "route": str(event.route or ""),
                        "error_type": str(event.error_type),
                        "status_code": int(event.status_code),
                    }
                    for event in routing_events[:5]
                ],
            },
        ),
        _incident_entry(
            axis="queue_dispatch",
            title="Queue and dispatch pressure",
            severity=_severity_label(
                critical=queue_dead_letters > 0 or queue_expired_leases > 0,
                warning=queue_count > 0,
            ),
            count=queue_count,
            first_seen_at=queue_first,
            last_seen_at=queue_last,
            current_effect="Queue or dispatch pressure is delaying, dead-lettering, or stalling work."
            if queue_count > 0
            else "No queue or dispatch pressure is visible in the current metrics snapshot.",
            next_step="Open Queues, Dispatch, or Execution Review to recover leased attempts, outbox pressure, or dead letters." if queue_count > 0 else "Monitor only.",
            summary=(f"dead_letters={queue_dead_letters}, expired_leases={queue_expired_leases}, pending_dispatch={queue_pending_dispatch}, pending_outbox={queue_pending_outbox}"),
            raw_evidence={
                "queue_metrics": queue_metrics,
                "top_error_types": _top_counts([str(event.error_type) for event in queue_events]),
                "sample_errors": [
                    {
                        "created_at": str(event.created_at),
                        "route": str(event.route or ""),
                        "error_type": str(event.error_type),
                        "status_code": int(event.status_code),
                    }
                    for event in queue_events[:5]
                ],
            },
        ),
        _incident_entry(
            axis="security",
            title="Security-linked failures",
            severity=_severity_label(
                critical=security_denials > 0 or len(security_events) >= 3,
                warning=len(security_events) > 0,
            ),
            count=len(security_events),
            first_seen_at=security_first,
            last_seen_at=security_last,
            current_effect="Authorization or permission failures are actively blocking runtime or admin flows."
            if security_events
            else "No security-linked failure is visible in the current logs scope.",
            next_step="Open Security & Policies to inspect permissions, approvals, or request-path gates." if security_events else "Monitor only.",
            summary=(
                f"Most common security error: {_top_counts([str(event.error_type) for event in security_events], limit=1)[0]['value']}."
                if security_events
                else "No security-linked incident is currently recorded."
            ),
            raw_evidence={
                "top_error_types": _top_counts([str(event.error_type) for event in security_events]),
                "top_routes": _top_counts([str(event.route or "unknown") for event in security_events]),
                "sample_errors": [
                    {
                        "created_at": str(event.created_at),
                        "route": str(event.route or ""),
                        "error_type": str(event.error_type),
                        "status_code": int(event.status_code),
                    }
                    for event in security_events[:5]
                ],
            },
        ),
        _incident_entry(
            axis="tls",
            title="TLS and ingress failures",
            severity=_severity_label(
                critical=tls_fatal > 0 or len(tls_events) >= 2,
                warning=len(tls_events) > 0,
            ),
            count=len(tls_events),
            first_seen_at=tls_first,
            last_seen_at=tls_last,
            current_effect="Ingress or certificate failures are preventing the expected public request path from completing."
            if tls_events
            else "No TLS or ingress failure is visible in the current logs scope.",
            next_step="Open Ingress / TLS or Health to inspect listener exposure, certificates, and public readiness." if tls_events else "Monitor only.",
            summary=(
                f"Most common TLS error: {_top_counts([str(event.error_type) for event in tls_events], limit=1)[0]['value']}." if tls_events else "No TLS or ingress incident is currently recorded."
            ),
            raw_evidence={
                "top_error_types": _top_counts([str(event.error_type) for event in tls_events]),
                "top_routes": _top_counts([str(event.route or "unknown") for event in tls_events]),
                "sample_errors": [
                    {
                        "created_at": str(event.created_at),
                        "route": str(event.route or ""),
                        "error_type": str(event.error_type),
                        "status_code": int(event.status_code),
                    }
                    for event in tls_events[:5]
                ],
            },
        ),
        _incident_entry(
            axis="work_interaction",
            title="Work interaction failures",
            severity=_severity_label(critical=len(work_events) >= 3, warning=len(work_events) > 0),
            count=len(work_events),
            first_seen_at=work_first,
            last_seen_at=work_last,
            current_effect="Conversation, tasking, or other work-interaction routes are failing on the active scope."
            if work_events
            else "No work-interaction error is visible in the current logs scope.",
            next_step="Open Execution Review or Logs to inspect the failing work-interaction path." if work_events else "Monitor only.",
            summary=(
                f"Top work route: {_top_counts([str(event.route or 'unknown') for event in work_events], limit=1)[0]['value']}."
                if work_events
                else "No work-interaction incident is currently recorded."
            ),
            raw_evidence={
                "top_routes": _top_counts([str(event.route or "unknown") for event in work_events]),
                "top_error_types": _top_counts([str(event.error_type) for event in work_events]),
                "sample_errors": [
                    {
                        "created_at": str(event.created_at),
                        "route": str(event.route or ""),
                        "error_type": str(event.error_type),
                        "status_code": int(event.status_code),
                    }
                    for event in work_events[:5]
                ],
            },
        ),
    ]

    return sorted(
        incidents,
        key=lambda item: (
            {"critical": 0, "warning": 1, "info": 2, "clear": 3, "unsupported": 4}.get(str(item["severity"]), 5),
            -int(item["count"]),
            str(item["axis"]),
        ),
    )


def _blocked_routing_failures_snapshot(
    metrics_snapshot: dict[str, object],
) -> list[dict[str, object]]:
    routing_metrics = dict(metrics_snapshot.get("routing_metrics", {}))
    failures = list(routing_metrics.get("recent_failures", []))
    rows: list[dict[str, object]] = []
    for failure in failures:
        error_type = str(failure.get("error_type") or "routing_failure")
        lowered = error_type.lower()
        if "budget" in lowered:
            reason_category = "budget"
            current_effect = "Budget posture is blocking eligible routing candidates."
            next_step = "Open Routing or Costs to remove the blocking budget condition."
            links = [
                {"label": "Open Routing", "href": "/routing"},
                {"label": "Open Costs", "href": "/costs"},
            ]
        elif "capability" in lowered:
            reason_category = "capability"
            current_effect = "No candidate satisfied the requested runtime capability or modality constraints."
            next_step = "Open Provider Targets to add or enable a compatible target."
            links = [
                {"label": "Open Provider Targets", "href": "/provider-targets"},
                {"label": "Open Health", "href": "/health-status"},
            ]
        elif "circuit" in lowered:
            reason_category = "circuit"
            current_effect = "Open target circuits are excluding otherwise eligible candidates."
            next_step = "Open Routing to close or review the affected circuit breakers."
            links = [
                {"label": "Open Routing", "href": "/routing"},
                {"label": "Open Provider Targets", "href": "/provider-targets"},
            ]
        else:
            reason_category = "policy"
            current_effect = "Policy stage evaluation is blocking route admission for the current request shape."
            next_step = "Open Routing to inspect stage eligibility, fallback, and escalation policy."
            links = [{"label": "Open Routing", "href": "/routing"}]

        rows.append({
            "decision_id": str(failure.get("decision_id") or ""),
            "error_type": error_type,
            "summary": str(failure.get("summary") or ""),
            "policy_stage": failure.get("policy_stage"),
            "created_at": str(failure.get("created_at") or ""),
            "reason_category": reason_category,
            "current_effect": current_effect,
            "next_step": next_step,
            "links": links,
            "raw_evidence": dict(failure),
        })

    return sorted(rows, key=lambda item: str(item["created_at"]), reverse=True)


def _incident_review_snapshot(
    analytics: UsageAnalyticsStore,
    *,
    tenant_id: str | None,
    metrics_snapshot: dict[str, object],
    logging_snapshot: dict[str, object],
    tracing_snapshot: dict[str, object],
) -> dict[str, object]:
    cutoff = datetime.now(tz=UTC) - timedelta(hours=24)
    error_events = [event for event in analytics.list_error_events(tenant_id=tenant_id) if datetime.fromisoformat(event.created_at) >= cutoff]
    health_events = [event for event in analytics.list_health_events(tenant_id=tenant_id) if datetime.fromisoformat(event.created_at) >= cutoff]

    return {
        "axes": _axis_incidents_snapshot(
            metrics_snapshot=metrics_snapshot,
            logging_snapshot=logging_snapshot,
            tracing_snapshot=tracing_snapshot,
            error_events=error_events,
            health_events=health_events,
        ),
        "blocked_routing_failures": _blocked_routing_failures_snapshot(metrics_snapshot),
    }


class AuditExportRequest(BaseModel):
    format: Literal["csv", "json"] = "json"
    window: Literal["24h", "7d", "30d", "all"] = "24h"
    action: str | None = None
    actor: str | None = None
    status: Literal["ok", "warning", "failed"] | None = None
    subject: str | None = None
    include_raw_details: bool = True
    limit: int = Field(default=250, ge=1, le=5000)


def _admin_error(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": code, "message": message}})


def _audit_history_auth_error(code: str, *, status_code: int, message: str) -> None:
    raise HTTPException(
        status_code=status_code,
        detail={
            "code": code,
            "message": message,
        },
    )


def authenticate_audit_history_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(_audit_history_bearer),
    service: GovernanceService = Depends(get_governance_service),
) -> AuthenticatedAdmin:
    if credentials is None or credentials.scheme.lower() != "bearer":
        _audit_history_auth_error(
            "admin_auth_required",
            status_code=status.HTTP_401_UNAUTHORIZED,
            message="Admin authentication required.",
        )
    try:
        return service.authenticate_admin_token(credentials.credentials)
    except PermissionError as exc:
        code = str(exc).strip() or "invalid_admin_session"
        message_map = {
            "missing_admin_token": "Admin authentication required.",
            "invalid_admin_session": "Admin session is invalid or expired.",
            "expired_admin_session": "Admin session is invalid or expired.",
            "admin_user_disabled": "Admin session is no longer active.",
        }
        _audit_history_auth_error(
            code,
            status_code=status.HTTP_401_UNAUTHORIZED,
            message=message_map.get(code, "Admin authentication required."),
        )


def require_audit_history_role(required_role: str) -> Any:
    def _dependency(
        admin: AuthenticatedAdmin = Depends(authenticate_audit_history_session),
    ) -> AuthenticatedAdmin:
        if admin.session_type != "impersonation" and admin.must_rotate_password:
            _audit_history_auth_error(
                "password_rotation_required",
                status_code=status.HTTP_403_FORBIDDEN,
                message="Rotate your password before accessing audit history.",
            )
        if not role_allows(admin.role, required_role):  # type: ignore[arg-type]
            _audit_history_auth_error(
                f"{required_role}_role_required",
                status_code=status.HTTP_403_FORBIDDEN,
                message=f"{required_role.title()} role required.",
            )
        return admin

    return _dependency


def _humanize_key(value: str) -> str:
    normalized = value.replace("-", "_").strip("_")
    if not normalized:
        return "Unknown"
    return " ".join(segment.capitalize() for segment in normalized.split("_"))


def _action_label(action: str) -> str:
    return _ACTION_LABEL_OVERRIDES.get(action, _humanize_key(action))


def _status_label(status_key: str) -> str:
    return _AUDIT_STATUS_LABELS.get(status_key, _humanize_key(status_key))


def _target_type_label(target_type: str) -> str:
    return _TARGET_TYPE_LABELS.get(target_type, _humanize_key(target_type))


def _retained_audit_limit(settings: Settings) -> int:
    return max(100, int(settings.audit_event_retention_limit))


def _sort_audit_events(events: list[AuditEventRecord]) -> list[AuditEventRecord]:
    return sorted(
        events,
        key=lambda item: (item.created_at, item.event_id),
        reverse=True,
    )


def _within_window(event: AuditEventRecord, *, window: str) -> bool:
    cutoff_delta = _AUDIT_EXPORT_WINDOWS[window]
    if cutoff_delta is None:
        return True
    cutoff = datetime.now(tz=UTC) - cutoff_delta
    return datetime.fromisoformat(event.created_at) >= cutoff


def _normalize_filter_value(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized.lower() or None


def _encode_cursor(*, created_at: str, event_id: str) -> str:
    payload = json.dumps({"created_at": created_at, "event_id": event_id}, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def _decode_cursor(cursor: str) -> tuple[str, str]:
    padded = cursor + "=" * (-len(cursor) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
    except (ValueError, json.JSONDecodeError, binascii.Error) as exc:
        raise ValueError("invalid_audit_cursor") from exc

    created_at = str(payload.get("created_at") or "").strip()
    event_id = str(payload.get("event_id") or "").strip()
    if not created_at or not event_id:
        raise ValueError("invalid_audit_cursor")
    return created_at, event_id


def _apply_cursor(events: list[AuditEventRecord], *, cursor: str | None) -> list[AuditEventRecord]:
    if not cursor:
        return events
    cursor_created_at, cursor_event_id = _decode_cursor(cursor)
    return [event for event in events if (event.created_at, event.event_id) < (cursor_created_at, cursor_event_id)]


def _safe_str(value: Any) -> str:
    if value is None:
        return "None"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, list):
        return ", ".join(_safe_str(item) for item in value) or "None"
    return str(value)


def _redact_metadata(value: Any, *, path: str = "") -> tuple[Any, list[dict[str, str]]]:
    redactions: list[dict[str, str]] = []

    if isinstance(value, dict):
        redacted_dict: dict[str, Any] = {}
        for key, nested_value in value.items():
            child_path = f"{path}.{key}" if path else key
            if any(fragment in key.lower() for fragment in _SENSITIVE_METADATA_FRAGMENTS):
                redacted_dict[key] = "[redacted]"
                redactions.append({"path": child_path, "reason": "sensitive_field"})
                continue
            redacted_child, child_redactions = _redact_metadata(nested_value, path=child_path)
            redacted_dict[key] = redacted_child
            redactions.extend(child_redactions)
        return redacted_dict, redactions

    if isinstance(value, list):
        redacted_list: list[Any] = []
        for index, nested_value in enumerate(value):
            child_path = f"{path}[{index}]"
            redacted_child, child_redactions = _redact_metadata(nested_value, path=child_path)
            redacted_list.append(redacted_child)
            redactions.extend(child_redactions)
        return redacted_list, redactions

    return value, redactions


def _build_lookup_indexes(
    governance: GovernanceService,
    *,
    instance_id: str | None,
    tenant_id: str | None,
) -> dict[str, dict[str, Any]]:
    users = {user.user_id: user for user in governance.list_admin_users()}
    accounts = {account.account_id: account for account in governance.list_accounts(instance_id=instance_id, tenant_id=tenant_id)}
    runtime_keys = {item.key_id: item for item in governance.list_runtime_keys(instance_id=instance_id, tenant_id=tenant_id)}
    settings = {item.key: item for item in governance.list_setting_overrides()}
    return {
        "users": users,
        "accounts": accounts,
        "runtime_keys": runtime_keys,
        "settings": settings,
    }


def _resolve_scope_from_instance(
    *,
    instance: InstanceRecord,
    tenant_id: str | None,
    company_id: str | None,
) -> tuple[str, str | None]:
    resolved_tenant_id = (tenant_id or "").strip() or instance.tenant_id
    resolved_company_id = (company_id or "").strip() or None
    return resolved_tenant_id, resolved_company_id


def _actor_summary(
    event: AuditEventRecord,
    *,
    indexes: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    users: dict[str, AdminUserRecord] = indexes["users"]  # type: ignore[assignment]
    runtime_keys: dict[str, RuntimeKeyRecord] = indexes["runtime_keys"]  # type: ignore[assignment]

    if event.actor_type == "admin_user" and event.actor_id:
        user = users.get(event.actor_id)
        if user is not None:
            return {
                "type": event.actor_type,
                "id": user.user_id,
                "label": user.display_name,
                "secondary": user.username,
            }

    if event.actor_type == "runtime_key" and event.actor_id:
        runtime_key = runtime_keys.get(event.actor_id)
        if runtime_key is not None:
            return {
                "type": event.actor_type,
                "id": runtime_key.key_id,
                "label": runtime_key.label,
                "secondary": runtime_key.prefix,
            }

    if event.actor_type == "system":
        return {
            "type": event.actor_type,
            "id": None,
            "label": "ForgeFrame system",
            "secondary": None,
        }

    if event.actor_type == "anonymous":
        return {
            "type": event.actor_type,
            "id": event.actor_id,
            "label": "Anonymous actor",
            "secondary": event.actor_id,
        }

    return {
        "type": event.actor_type,
        "id": event.actor_id,
        "label": event.actor_id or _humanize_key(event.actor_type),
        "secondary": None,
    }


def _target_summary(
    event: AuditEventRecord,
    *,
    indexes: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    users: dict[str, AdminUserRecord] = indexes["users"]  # type: ignore[assignment]
    accounts: dict[str, GatewayAccountRecord] = indexes["accounts"]  # type: ignore[assignment]
    runtime_keys: dict[str, RuntimeKeyRecord] = indexes["runtime_keys"]  # type: ignore[assignment]
    settings: dict[str, MutableSettingRecord] = indexes["settings"]  # type: ignore[assignment]

    label = event.target_id or _target_type_label(event.target_type)
    secondary: str | None = None

    if event.target_type == "admin_user" and event.target_id:
        user = users.get(event.target_id)
        if user is not None:
            label = user.display_name
            secondary = user.username
    elif event.target_type == "gateway_account" and event.target_id:
        account = accounts.get(event.target_id)
        if account is not None:
            label = account.label
            secondary = account.account_id
    elif event.target_type == "runtime_key" and event.target_id:
        runtime_key = runtime_keys.get(event.target_id)
        if runtime_key is not None:
            label = runtime_key.label
            secondary = runtime_key.prefix
    elif event.target_type == "setting" and event.target_id:
        setting = settings.get(event.target_id)
        if setting is not None:
            label = _humanize_key(setting.key)
            secondary = setting.key
        else:
            label = _humanize_key(event.target_id)
            secondary = event.target_id
    elif (
        event.target_type
        in {
            "execution_run",
            "execution_approval",
            "elevated_access_request",
            "admin_session",
            "audit_export",
        }
        and event.target_id
    ):
        secondary = event.target_id

    return {
        "type": event.target_type,
        "typeLabel": _target_type_label(event.target_type),
        "id": event.target_id,
        "label": label,
        "secondary": secondary,
    }


def _normalize_audit_row(
    event: AuditEventRecord,
    *,
    indexes: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    correlation = _correlation_summary(event)
    return {
        "eventId": event.event_id,
        "createdAt": event.created_at,
        "tenantId": event.tenant_id,
        "companyId": event.company_id,
        "actionKey": event.action,
        "actionLabel": _action_label(event.action),
        "status": event.status,
        "statusLabel": _status_label(event.status),
        "actor": _actor_summary(event, indexes=indexes),
        "target": _target_summary(event, indexes=indexes),
        "summary": event.details,
        "correlation": correlation,
        "detailAvailable": True,
    }


def _matches_actor(
    event: AuditEventRecord,
    *,
    indexes: dict[str, dict[str, Any]],
    actor_filter: str | None,
) -> bool:
    if actor_filter is None:
        return True
    actor = _actor_summary(event, indexes=indexes)
    haystack = " ".join([
        _safe_str(actor.get("label")),
        _safe_str(actor.get("secondary")),
        _safe_str(actor.get("id")),
        event.actor_type,
    ]).lower()
    return actor_filter in haystack


def _matches_target(
    event: AuditEventRecord,
    *,
    indexes: dict[str, dict[str, Any]],
    target_filter: str | None,
) -> bool:
    if target_filter is None:
        return True
    target = _target_summary(event, indexes=indexes)
    correlation = _correlation_summary(event)
    haystack = " ".join([
        _safe_str(target.get("label")),
        _safe_str(target.get("secondary")),
        _safe_str(target.get("id")),
        event.target_type,
        correlation["value"] if correlation is not None else "",
    ]).lower()
    return target_filter in haystack


def _filter_audit_history_events(
    events: list[AuditEventRecord],
    *,
    indexes: dict[str, dict[str, Any]],
    window: str,
    action: str | None,
    actor: str | None,
    target_type: str | None,
    target_id: str | None,
    status_filter: str | None,
) -> tuple[list[AuditEventRecord], list[AuditEventRecord]]:
    window_scoped = [event for event in events if _within_window(event, window=window)]

    filtered = window_scoped
    if action is not None:
        filtered = [event for event in filtered if event.action.lower() == action]
    if status_filter is not None:
        filtered = [event for event in filtered if event.status.lower() == status_filter]
    if target_type is not None:
        filtered = [event for event in filtered if event.target_type.lower() == target_type]
    filtered = [event for event in filtered if _matches_actor(event, indexes=indexes, actor_filter=actor)]
    filtered = [event for event in filtered if _matches_target(event, indexes=indexes, target_filter=target_id)]
    return window_scoped, filtered


def _normalize_filters_payload(
    *,
    window: str,
    action: str | None,
    actor: str | None,
    target_type: str | None,
    target_id: str | None,
    status_filter: str | None,
    window_scoped_events: list[AuditEventRecord],
) -> dict[str, Any]:
    action_options = sorted({event.action for event in window_scoped_events})
    status_options = sorted({event.status for event in window_scoped_events})
    target_type_options = sorted({event.target_type for event in window_scoped_events})
    return {
        "applied": {
            "window": window,
            "action": action,
            "actor": actor,
            "targetType": target_type,
            "targetId": target_id,
            "status": status_filter,
        },
        "available": {
            "actions": [{"value": value, "label": _action_label(value)} for value in action_options],
            "statuses": [{"value": value, "label": _status_label(value)} for value in status_options],
            "targetTypes": [{"value": value, "label": _target_type_label(value)} for value in target_type_options],
        },
    }


def _related_links_for_event(event: AuditEventRecord) -> list[dict[str, str]]:
    related_links: list[dict[str, str]] = []
    route_hint = _RELATED_ROUTE_BY_TARGET_TYPE.get(event.target_type)
    if route_hint is not None:
        related_links.append({
            "label": route_hint["label"],
            "href": route_hint["href"],
            "kind": "control_plane_route",
        })
    return related_links


def _build_change_context(
    *,
    redacted_metadata: dict[str, Any],
) -> tuple[list[dict[str, str]], bool]:
    entries: list[dict[str, str]] = []
    for key in _DETAIL_METADATA_KEY_ORDER:
        if key not in redacted_metadata:
            continue
        value = redacted_metadata.get(key)
        if value in (None, "", [], {}):
            continue
        entries.append({
            "label": _CHANGE_CONTEXT_FIELD_LABELS.get(key, _humanize_key(key)),
            "value": _safe_str(value),
        })
    return entries, len(entries) == 0


def _correlation_summary(event: AuditEventRecord) -> dict[str, str] | None:
    metadata = dict(event.metadata)
    for key in _CORRELATION_METADATA_KEY_ORDER:
        value = metadata.get(key)
        if value in (None, "", [], {}):
            continue
        return {
            "label": _CHANGE_CONTEXT_FIELD_LABELS.get(key, _humanize_key(key)),
            "value": _safe_str(value),
        }
    return None


def _audit_detail_payload(
    event: AuditEventRecord,
    *,
    indexes: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    redacted_metadata, redactions = _redact_metadata(dict(event.metadata))
    change_context, change_context_unavailable = _build_change_context(redacted_metadata=redacted_metadata)
    normalized_row = _normalize_audit_row(event, indexes=indexes)
    return {
        "status": "ok",
        "event": {
            "eventId": event.event_id,
            "createdAt": event.created_at,
            "tenantId": event.tenant_id,
            "companyId": event.company_id,
            "actionKey": event.action,
            "actionLabel": normalized_row["actionLabel"],
            "status": event.status,
            "statusLabel": normalized_row["statusLabel"],
        },
        "actor": normalized_row["actor"],
        "target": normalized_row["target"],
        "summary": event.details,
        "outcome": normalized_row["statusLabel"],
        "correlation": normalized_row["correlation"],
        "changeContext": change_context,
        "changeContextUnavailable": change_context_unavailable,
        "rawMetadata": redacted_metadata,
        "redactions": redactions,
        "relatedLinks": _related_links_for_event(event),
    }


def _redacted_audit_export_event_payload(
    event: AuditEventRecord,
    *,
    include_raw_details: bool,
) -> dict[str, Any]:
    redacted_metadata, _ = _redact_metadata(dict(event.metadata))
    payload = event.model_dump()
    payload["metadata"] = redacted_metadata if include_raw_details else {}
    return payload


def _audit_export_subject_haystack(event: AuditEventRecord, *, include_raw_details: bool) -> str:
    export_payload = _redacted_audit_export_event_payload(event, include_raw_details=include_raw_details)
    return " ".join([
        event.actor_type,
        event.actor_id or "",
        event.action,
        event.target_type,
        event.target_id or "",
        event.details,
        json.dumps(export_payload["metadata"], sort_keys=True),
    ]).lower()


def _filter_audit_events(
    events: list[AuditEventRecord],
    *,
    subject: str | None,
    limit: int,
    include_raw_details: bool,
) -> list[AuditEventRecord]:
    filtered = events
    normalized_subject = (subject or "").strip().lower()
    if normalized_subject:
        filtered = [
            event
            for event in filtered
            if normalized_subject
            in _audit_export_subject_haystack(
                event,
                include_raw_details=include_raw_details,
            )
        ]

    return filtered[:limit]


def _render_audit_export_csv(events: list[AuditEventRecord], *, include_raw_details: bool) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(
        buffer,
        fieldnames=[
            "event_id",
            "created_at",
            "tenant_id",
            "company_id",
            "status",
            "action",
            "actor_type",
            "actor_id",
            "target_type",
            "target_id",
            "details",
            "metadata",
        ],
    )
    writer.writeheader()
    for event in events:
        export_payload = _redacted_audit_export_event_payload(
            event,
            include_raw_details=include_raw_details,
        )
        writer.writerow({
            "event_id": export_payload["event_id"],
            "created_at": export_payload["created_at"],
            "tenant_id": export_payload["tenant_id"],
            "company_id": export_payload["company_id"] or "",
            "status": export_payload["status"],
            "action": export_payload["action"],
            "actor_type": export_payload["actor_type"],
            "actor_id": export_payload["actor_id"] or "",
            "target_type": export_payload["target_type"],
            "target_id": export_payload["target_id"] or "",
            "details": export_payload["details"],
            "metadata": json.dumps(export_payload["metadata"], sort_keys=True),
        })
    return buffer.getvalue()


def _render_audit_export_json(
    *,
    export_id: str,
    generated_at: str,
    filters: dict[str, object],
    events: list[AuditEventRecord],
    include_raw_details: bool,
) -> str:
    return json.dumps(
        {
            "status": "ok",
            "object": "audit_export",
            "export_id": export_id,
            "generated_at": generated_at,
            "row_count": len(events),
            "filters": filters,
            "events": [
                _redacted_audit_export_event_payload(
                    event,
                    include_raw_details=include_raw_details,
                )
                for event in events
            ],
        },
        indent=2,
        sort_keys=True,
    )


@router.get("/audit-events", response_model=None)
def list_audit_history(
    _admin: AuthenticatedAdmin = Depends(require_audit_history_role("operator")),
    governance: GovernanceService = Depends(get_governance_service),
    settings: Settings = Depends(get_settings),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    tenant_id: str | None = Query(default=None, alias="tenantId"),
    company_id: str | None = Query(default=None, alias="companyId"),
    window: Literal["24h", "7d", "30d", "all"] = Query(default="24h"),
    action: str | None = Query(default=None),
    actor: str | None = Query(default=None),
    target_type: str | None = Query(default=None, alias="targetType"),
    target_id: str | None = Query(default=None, alias="targetId"),
    status_filter: Literal["ok", "warning", "failed"] | None = Query(default=None, alias="status"),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
) -> Any:
    resolved_tenant_id, resolved_company_id = _resolve_scope_from_instance(
        instance=instance,
        tenant_id=tenant_id,
        company_id=company_id,
    )
    indexes = _build_lookup_indexes(
        governance,
        instance_id=instance.instance_id,
        tenant_id=resolved_tenant_id,
    )
    normalized_action = _normalize_filter_value(action)
    normalized_actor = _normalize_filter_value(actor)
    normalized_target_type = _normalize_filter_value(target_type)
    normalized_target_id = _normalize_filter_value(target_id)
    normalized_status = _normalize_filter_value(status_filter)
    try:
        cursor_created_at, cursor_event_id = _decode_cursor(cursor) if cursor else (None, None)
    except ValueError:
        return _admin_error(400, "invalid_audit_cursor", "Invalid audit history cursor.")

    try:
        retention = governance.audit_event_retention_summary(
            tenant_id=resolved_tenant_id,
            company_id=resolved_company_id,
            require_explicit_scope=True,
        )
        retained_events = governance.query_audit_events(
            limit=_retained_audit_limit(settings),
            tenant_id=resolved_tenant_id,
            company_id=resolved_company_id,
            require_explicit_scope=True,
            window_seconds=None,
        )
    except TenantFilterRequiredError as exc:
        return JSONResponse(
            status_code=400,
            content={"error": {"type": "tenant_filter_required", "message": str(exc)}},
        )

    window_scoped_events, filtered_events = _filter_audit_history_events(
        retained_events,
        indexes=indexes,
        window=window,
        action=normalized_action,
        actor=normalized_actor,
        target_type=normalized_target_type,
        target_id=normalized_target_id,
        status_filter=normalized_status,
    )
    cursor_scoped_events = _apply_cursor(
        _sort_audit_events(filtered_events),
        cursor=cursor,
    )

    page_items = cursor_scoped_events[:limit]
    has_more = len(cursor_scoped_events) > limit
    next_cursor = None
    if has_more and page_items:
        last_item = page_items[-1]
        next_cursor = _encode_cursor(created_at=last_item.created_at, event_id=last_item.event_id)

    return {
        "status": "ok",
        "object": "audit_history",
        "instance": instance.model_dump(mode="json"),
        "items": [_normalize_audit_row(event, indexes=indexes) for event in page_items],
        "page": {
            "limit": limit,
            "nextCursor": next_cursor,
            "hasMore": has_more,
        },
        "retention": {
            "eventLimit": int(retention["event_limit"]),
            "oldestAvailableAt": retention["oldest_available_at"],
            "retentionLimited": bool(retention["retention_limited"]),
        },
        "filters": _normalize_filters_payload(
            window=window,
            action=normalized_action,
            actor=normalized_actor,
            target_type=normalized_target_type,
            target_id=normalized_target_id,
            status_filter=normalized_status,
            window_scoped_events=window_scoped_events,
        ),
        "summary": {
            "totalInScope": len(window_scoped_events),
            "totalMatchingFilters": len(filtered_events),
            "latestEventAt": window_scoped_events[0].created_at if window_scoped_events else None,
        },
    }


@router.get("/audit-events/{event_id}", response_model=None)
def get_audit_history_event(
    event_id: str,
    _admin: AuthenticatedAdmin = Depends(require_audit_history_role("operator")),
    governance: GovernanceService = Depends(get_governance_service),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    tenant_id: str | None = Query(default=None, alias="tenantId"),
    company_id: str | None = Query(default=None, alias="companyId"),
) -> Any:
    resolved_tenant_id, resolved_company_id = _resolve_scope_from_instance(
        instance=instance,
        tenant_id=tenant_id,
        company_id=company_id,
    )
    try:
        event = governance.get_audit_event(
            event_id,
            tenant_id=resolved_tenant_id,
            company_id=resolved_company_id,
            require_explicit_scope=True,
        )
    except TenantFilterRequiredError as exc:
        return JSONResponse(
            status_code=400,
            content={"error": {"type": "tenant_filter_required", "message": str(exc)}},
        )
    if event is None:
        return _admin_error(404, "audit_event_not_found", f"Audit event '{event_id}' was not found.")
    indexes = _build_lookup_indexes(
        governance,
        instance_id=instance.instance_id,
        tenant_id=resolved_tenant_id,
    )
    return {
        "status": "ok",
        "object": "audit_event_detail",
        "instance": instance.model_dump(mode="json"),
        **_audit_detail_payload(event, indexes=indexes),
    }


@router.get("/")
def logs_view(
    _admin: AuthenticatedAdmin = Depends(require_admin_session),
    governance: GovernanceService = Depends(get_governance_service),
    analytics: UsageAnalyticsStore = Depends(get_usage_analytics_store),
    settings: Settings = Depends(get_settings),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    tenant_id: str | None = Query(default=None, alias="tenantId"),
    company_id: str | None = Query(default=None, alias="companyId"),
) -> Any:
    resolved_tenant_id, resolved_company_id = _resolve_scope_from_instance(
        instance=instance,
        tenant_id=tenant_id,
        company_id=company_id,
    )
    try:
        metrics_snapshot = build_metrics_operability_snapshot(
            settings,
            analytics,
            tenant_id=resolved_tenant_id,
            company_id=resolved_company_id,
            instance_id=instance.instance_id,
        )
        aggregates = analytics.aggregate(window_seconds=24 * 3600, tenant_id=resolved_tenant_id)
        retention = governance.audit_event_retention_summary(
            tenant_id=resolved_tenant_id,
            company_id=resolved_company_id,
            require_explicit_scope=True,
        )
        retained_events = governance.query_audit_events(
            limit=_retained_audit_limit(settings),
            tenant_id=resolved_tenant_id,
            company_id=resolved_company_id,
            window_seconds=None,
        )
    except TenantFilterRequiredError as exc:
        return JSONResponse(
            status_code=400,
            content={"error": {"type": "tenant_filter_required", "message": str(exc)}},
        )
    preview_events = retained_events[:5]
    indexes = _build_lookup_indexes(
        governance,
        instance_id=instance.instance_id,
        tenant_id=resolved_tenant_id,
    )
    logging_snapshot = build_logging_operability_snapshot(
        settings,
        governance,
        analytics,
        tenant_id=resolved_tenant_id,
        company_id=resolved_company_id,
    )
    tracing_snapshot = build_tracing_operability_snapshot()
    recent_alerts = list(metrics_snapshot["alerts"])
    operability_checks = [
        {
            "id": "observability_storage_configured",
            "ok": bool(str(metrics_snapshot["storage_backend"]).strip()),
            "details": str(metrics_snapshot["storage_backend"]),
        },
        {
            "id": "runtime_signal_path",
            "ok": int(metrics_snapshot["runtime_requests"]) > 0,
            "details": f"requests_24h={metrics_snapshot['runtime_requests']}",
        },
        {
            "id": "health_signal_path",
            "ok": int(metrics_snapshot["health_events"]) > 0,
            "details": f"health_events_24h={metrics_snapshot['health_events']}",
        },
        {
            "id": "audit_signal_path",
            "ok": int(logging_snapshot["audit_event_count"]) > 0,
            "details": f"audit_events={logging_snapshot['audit_event_count']}",
        },
        {
            "id": "structured_runtime_context",
            "ok": bool(logging_snapshot["field_coverage"].get("request_id")) and bool(logging_snapshot["field_coverage"].get("trace_id")),
            "details": (f"request_id={logging_snapshot['field_coverage'].get('request_id', 0)}, trace_id={logging_snapshot['field_coverage'].get('trace_id', 0)}"),
        },
        {
            "id": "tracing_scope_declared",
            "ok": bool(tracing_snapshot["configured"]),
            "details": str(tracing_snapshot["details"]),
        },
        {
            "id": "routing_decision_signal_path",
            "ok": int(metrics_snapshot["routing_metrics"]["decision_count"]) > 0,
            "details": f"decisions_24h={metrics_snapshot['routing_metrics']['decision_count']}",
        },
        {
            "id": "routing_explainability_path",
            "ok": (int(metrics_snapshot["routing_metrics"]["explainability_coverage"]["structured"]) > 0 and int(metrics_snapshot["routing_metrics"]["explainability_coverage"]["raw"]) > 0),
            "details": (f"structured={metrics_snapshot['routing_metrics']['explainability_coverage']['structured']},raw={metrics_snapshot['routing_metrics']['explainability_coverage']['raw']}"),
        },
    ]
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "audit_preview": [_normalize_audit_row(event, indexes=indexes) for event in preview_events],
        "audit_retention": {
            "eventLimit": int(retention["event_limit"]),
            "oldestAvailableAt": retention["oldest_available_at"],
            "retentionLimited": bool(retention["retention_limited"]),
            "latestEventAt": retained_events[0].created_at if retained_events else None,
        },
        "alerts": recent_alerts,
        "error_summary": {
            "errors_24h": aggregates["error_event_count"],
            "errors_by_provider": aggregates["errors_by_provider"][:10],
            "errors_by_type": aggregates["errors_by_type"][:10],
        },
        "incident_review": _incident_review_snapshot(
            analytics,
            tenant_id=resolved_tenant_id,
            metrics_snapshot=metrics_snapshot,
            logging_snapshot=logging_snapshot,
            tracing_snapshot=tracing_snapshot,
        ),
        "operability": {
            "ready": all(bool(item["ok"]) for item in operability_checks),
            "checks": operability_checks,
            "metrics": metrics_snapshot,
            "logging": logging_snapshot,
            "tracing": tracing_snapshot,
        },
    }


@router.post("/audit-export")
def export_audit_events(
    payload: AuditExportRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("operator")),
    governance: GovernanceService = Depends(get_governance_service),
    settings: Settings = Depends(get_settings),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    tenant_id: str | None = Query(default=None, alias="tenantId"),
    company_id: str | None = Query(default=None, alias="companyId"),
) -> Response:
    resolved_tenant_id, resolved_company_id = _resolve_scope_from_instance(
        instance=instance,
        tenant_id=tenant_id,
        company_id=company_id,
    )
    retained_limit = _retained_audit_limit(settings)
    effective_limit = min(payload.limit, retained_limit)
    normalized_action = _normalize_filter_value(payload.action)
    normalized_actor = _normalize_filter_value(payload.actor)
    # Export must honor the mixed-tenant scope guard before row slicing.
    try:
        audit_events = governance.query_audit_events(
            limit=retained_limit,
            tenant_id=resolved_tenant_id,
            company_id=resolved_company_id,
            require_explicit_scope=True,
            window_seconds=None,
        )
    except TenantFilterRequiredError as exc:
        return _admin_error(400, "tenant_filter_required", str(exc))
    indexes = _build_lookup_indexes(
        governance,
        instance_id=instance.instance_id,
        tenant_id=resolved_tenant_id,
    )
    _window_scoped_events, filtered_export_events = _filter_audit_history_events(
        audit_events,
        indexes=indexes,
        window=payload.window,
        action=normalized_action,
        actor=normalized_actor,
        target_type=None,
        target_id=None,
        status_filter=payload.status,
    )
    filtered_events = _filter_audit_events(
        filtered_export_events,
        subject=payload.subject,
        limit=effective_limit,
        include_raw_details=payload.include_raw_details,
    )
    generated_at = datetime.now(tz=UTC).isoformat()
    export_id = f"audit_export_{uuid4().hex[:12]}"
    filters = {
        "window": payload.window,
        "action": normalized_action,
        "actor": normalized_actor,
        "status": payload.status,
        "subject": payload.subject,
        "include_raw_details": payload.include_raw_details,
        "tenant_id": resolved_tenant_id,
        "company_id": resolved_company_id,
        "instance_id": instance.instance_id,
        "limit": effective_limit,
    }
    timestamp = datetime.now(tz=UTC).strftime("%Y%m%dT%H%M%SZ")
    if resolved_tenant_id:
        scope_label = instance.slug or resolved_tenant_id
    elif resolved_company_id:
        scope_label = f"company-{resolved_company_id}"
    else:
        scope_label = "global"
    filename = f"forgeframe-audit-export-{scope_label.replace('/', '_')}-{timestamp}.{payload.format}"

    if payload.format == "csv":
        content = _render_audit_export_csv(
            filtered_events,
            include_raw_details=payload.include_raw_details,
        )
        media_type = "text/csv; charset=utf-8"
    else:
        content = _render_audit_export_json(
            export_id=export_id,
            generated_at=generated_at,
            filters=filters,
            events=filtered_events,
            include_raw_details=payload.include_raw_details,
        )
        media_type = "application/json"

    governance.record_admin_audit_event(
        actor=admin,
        action="audit_export_generated",
        target_type="audit_export",
        target_id=export_id,
        status="ok",
        details=(f"Generated {payload.format.upper()} audit export with {len(filtered_events)} event(s) for window '{payload.window}'."),
        metadata={
            **filters,
            "export_id": export_id,
            "filename": filename,
            "row_count": len(filtered_events),
            "format": payload.format,
            "effective_limit": effective_limit,
            "actor": normalized_actor,
            "include_raw_details": payload.include_raw_details,
        },
        instance_id=instance.instance_id,
        tenant_id=resolved_tenant_id,
        company_id=resolved_company_id,
    )

    response = Response(content=content, media_type=media_type)
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    response.headers["X-ForgeFrame-Audit-Export-Id"] = export_id
    response.headers["X-ForgeFrame-Audit-Export-Status"] = "ready"
    response.headers["X-ForgeFrame-Audit-Export-Row-Count"] = str(len(filtered_events))
    response.headers["X-ForgeFrame-Audit-Export-Generated-At"] = generated_at
    return response
