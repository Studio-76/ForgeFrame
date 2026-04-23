"""Admin logs and audit endpoints."""

from __future__ import annotations

import base64
import binascii
import csv
import io
import json
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
from app.tenancy import TenantFilterRequiredError
from app.telemetry import (
    build_logging_operability_snapshot,
    build_metrics_operability_snapshot,
    build_tracing_operability_snapshot,
)
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
    "execution_run": {"label": "Open Provider Health & Runs", "href": "/providers#provider-health-runs"},
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
    "status": "Status",
    "target_role": "Target role",
    "target_user_id": "Target user",
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


class AuditExportRequest(BaseModel):
    format: Literal["csv", "json"] = "json"
    window: Literal["24h", "7d", "30d", "all"] = "24h"
    action: str | None = None
    status: Literal["ok", "warning", "failed"] | None = None
    subject: str | None = None
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
    return [
        event
        for event in events
        if (event.created_at, event.event_id) < (cursor_created_at, cursor_event_id)
    ]


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
    accounts = {
        account.account_id: account
        for account in governance.list_accounts(instance_id=instance_id, tenant_id=tenant_id)
    }
    runtime_keys = {
        item.key_id: item
        for item in governance.list_runtime_keys(instance_id=instance_id, tenant_id=tenant_id)
    }
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
    resolved_company_id = (company_id or "").strip() or instance.company_id
    return resolved_tenant_id, (resolved_company_id or None)


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
    elif event.target_type in {"execution_run", "execution_approval", "elevated_access_request", "admin_session", "audit_export"} and event.target_id:
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
        "detailAvailable": True,
    }


def _matches_actor(event: AuditEventRecord, *, indexes: dict[str, dict[str, Any]], actor_filter: str | None) -> bool:
    if actor_filter is None:
        return True
    actor = _actor_summary(event, indexes=indexes)
    haystack = " ".join(
        [
            _safe_str(actor.get("label")),
            _safe_str(actor.get("secondary")),
            _safe_str(actor.get("id")),
            event.actor_type,
        ]
    ).lower()
    return actor_filter in haystack


def _matches_target_id(event: AuditEventRecord, *, target_id_filter: str | None) -> bool:
    if target_id_filter is None:
        return True
    return target_id_filter in _safe_str(event.target_id).lower()


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
    filtered = [event for event in filtered if _matches_target_id(event, target_id_filter=target_id)]
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
        related_links.append(
            {
                "label": route_hint["label"],
                "href": route_hint["href"],
                "kind": "control_plane_route",
            }
        )
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
        entries.append(
            {
                "label": _CHANGE_CONTEXT_FIELD_LABELS.get(key, _humanize_key(key)),
                "value": _safe_str(value),
            }
        )
    return entries, len(entries) == 0


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
        "changeContext": change_context,
        "changeContextUnavailable": change_context_unavailable,
        "rawMetadata": redacted_metadata,
        "redactions": redactions,
        "relatedLinks": _related_links_for_event(event),
    }


def _redacted_audit_export_event_payload(event: AuditEventRecord) -> dict[str, Any]:
    redacted_metadata, _ = _redact_metadata(dict(event.metadata))
    payload = event.model_dump()
    payload["metadata"] = redacted_metadata
    return payload


def _audit_export_subject_haystack(event: AuditEventRecord) -> str:
    export_payload = _redacted_audit_export_event_payload(event)
    return " ".join(
        [
            event.actor_type,
            event.actor_id or "",
            event.action,
            event.target_type,
            event.target_id or "",
            event.details,
            json.dumps(export_payload["metadata"], sort_keys=True),
        ]
    ).lower()


def _filter_audit_events(
    events: list[AuditEventRecord],
    *,
    subject: str | None,
    limit: int,
) -> list[AuditEventRecord]:
    filtered = events
    normalized_subject = (subject or "").strip().lower()
    if normalized_subject:
        filtered = [
            event
            for event in filtered
            if normalized_subject in _audit_export_subject_haystack(event)
        ]

    return filtered[:limit]


def _render_audit_export_csv(events: list[AuditEventRecord]) -> str:
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
        export_payload = _redacted_audit_export_event_payload(event)
        writer.writerow(
            {
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
            }
        )
    return buffer.getvalue()


def _render_audit_export_json(
    *,
    export_id: str,
    generated_at: str,
    filters: dict[str, object],
    events: list[AuditEventRecord],
) -> str:
    return json.dumps(
        {
            "status": "ok",
            "object": "audit_export",
            "export_id": export_id,
            "generated_at": generated_at,
            "row_count": len(events),
            "filters": filters,
            "events": [_redacted_audit_export_event_payload(event) for event in events],
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
        window_scoped_events = governance.query_audit_events(
            limit=_retained_audit_limit(settings),
            tenant_id=resolved_tenant_id,
            company_id=resolved_company_id,
            require_explicit_scope=True,
            window_seconds=int(_AUDIT_EXPORT_WINDOWS[window].total_seconds()) if _AUDIT_EXPORT_WINDOWS[window] is not None else None,
        )
        filtered_events = governance.query_audit_events(
            limit=_retained_audit_limit(settings),
            tenant_id=resolved_tenant_id,
            company_id=resolved_company_id,
            require_explicit_scope=True,
            window_seconds=int(_AUDIT_EXPORT_WINDOWS[window].total_seconds()) if _AUDIT_EXPORT_WINDOWS[window] is not None else None,
            action=normalized_action,
            actor=normalized_actor,
            target_type=normalized_target_type,
            target_id=normalized_target_id,
            status=normalized_status,
        )
        cursor_scoped_events = governance.query_audit_events(
            limit=limit + 1,
            tenant_id=resolved_tenant_id,
            company_id=resolved_company_id,
            require_explicit_scope=True,
            window_seconds=int(_AUDIT_EXPORT_WINDOWS[window].total_seconds()) if _AUDIT_EXPORT_WINDOWS[window] is not None else None,
            action=normalized_action,
            actor=normalized_actor,
            target_type=normalized_target_type,
            target_id=normalized_target_id,
            status=normalized_status,
            cursor_created_at=cursor_created_at,
            cursor_event_id=cursor_event_id,
        )
    except TenantFilterRequiredError as exc:
        return JSONResponse(
            status_code=400,
            content={"error": {"type": "tenant_filter_required", "message": str(exc)}},
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
            "details": (
                f"request_id={logging_snapshot['field_coverage'].get('request_id', 0)}, "
                f"trace_id={logging_snapshot['field_coverage'].get('trace_id', 0)}"
            ),
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
            "ok": (
                int(metrics_snapshot["routing_metrics"]["explainability_coverage"]["structured"]) > 0
                and int(metrics_snapshot["routing_metrics"]["explainability_coverage"]["raw"]) > 0
            ),
            "details": (
                "structured="
                f"{metrics_snapshot['routing_metrics']['explainability_coverage']['structured']},"
                "raw="
                f"{metrics_snapshot['routing_metrics']['explainability_coverage']['raw']}"
            ),
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
    window_seconds = int(_AUDIT_EXPORT_WINDOWS[payload.window].total_seconds()) if _AUDIT_EXPORT_WINDOWS[payload.window] is not None else None
    # Export must honor the mixed-tenant scope guard before row slicing.
    try:
        audit_events = governance.query_audit_events(
            limit=retained_limit,
            tenant_id=resolved_tenant_id,
            company_id=resolved_company_id,
            require_explicit_scope=True,
            window_seconds=window_seconds,
            action=normalized_action,
            status=payload.status,
        )
    except TenantFilterRequiredError as exc:
        return _admin_error(400, "tenant_filter_required", str(exc))
    filtered_events = _filter_audit_events(
        audit_events,
        subject=payload.subject,
        limit=effective_limit,
    )
    generated_at = datetime.now(tz=UTC).isoformat()
    export_id = f"audit_export_{uuid4().hex[:12]}"
    filters = {
        "window": payload.window,
        "action": normalized_action,
        "status": payload.status,
        "subject": payload.subject,
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
        content = _render_audit_export_csv(filtered_events)
        media_type = "text/csv; charset=utf-8"
    else:
        content = _render_audit_export_json(
            export_id=export_id,
            generated_at=generated_at,
            filters=filters,
            events=filtered_events,
        )
        media_type = "application/json"

    governance.record_admin_audit_event(
        actor=admin,
        action="audit_export_generated",
        target_type="audit_export",
        target_id=export_id,
        status="ok",
        details=(
            f"Generated {payload.format.upper()} audit export with {len(filtered_events)} event(s)"
            f" for window '{payload.window}'."
        ),
        metadata={
            **filters,
            "export_id": export_id,
            "filename": filename,
            "row_count": len(filtered_events),
            "format": payload.format,
            "effective_limit": effective_limit,
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
