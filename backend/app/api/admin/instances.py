"""Admin endpoints for ForgeFrame instances."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.api.admin.control_plane import build_control_plane_service
from app.api.admin.security import require_admin_session, require_admin_write_session
from app.agents.dependencies import get_agent_admin_service
from app.agents.models import AgentDetail
from app.agents.service import AgentAdminService
from app.auth.local_auth import role_allows
from app.conversations.dependencies import get_conversation_inbox_admin_service
from app.conversations.models import ConversationSummary
from app.conversations.service import ConversationInboxAdminService
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service
from app.instances.models import InstanceRecord
from app.instances.service import InstanceService, get_instance_service

router = APIRouter(prefix="/instances", tags=["admin-instances"])
_ONBOARDING_METADATA_KEY = "onboarding_v4"
_READY = "ready"
_NOT_READY = "not-ready"
_BRIDGE_ONLY = "bridge-only"
_ONBOARDING_ONLY = "onboarding-only"
_UNSUPPORTED = "unsupported"


class InstanceCreateRequest(BaseModel):
    instance_id: str | None = Field(default=None, min_length=1, max_length=191)
    slug: str | None = Field(default=None, min_length=1, max_length=191)
    display_name: str = Field(min_length=1, max_length=191)
    description: str = Field(default="", max_length=2000)
    tenant_id: str | None = Field(default=None, min_length=1, max_length=191)
    company_id: str | None = Field(default=None, min_length=1, max_length=191)
    status: Literal["active", "disabled"] = "active"
    deployment_mode: Literal["linux_host_native", "restricted_eval", "container_optional"] = "restricted_eval"
    exposure_mode: Literal["same_origin", "local_only", "edge_admission"] = "local_only"
    metadata: dict[str, Any] = Field(default_factory=dict)


class InstanceUpdateRequest(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=191)
    display_name: str | None = Field(default=None, min_length=1, max_length=191)
    description: str | None = Field(default=None, max_length=2000)
    tenant_id: str | None = Field(default=None, min_length=1, max_length=191)
    company_id: str | None = Field(default=None, min_length=1, max_length=191)
    status: Literal["active", "disabled"] | None = None
    deployment_mode: Literal["linux_host_native", "restricted_eval", "container_optional"] | None = None
    exposure_mode: Literal["same_origin", "local_only", "edge_admission"] | None = None
    metadata: dict[str, Any] | None = None


def _instance_error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _latest_timestamp(*values: str | None) -> str | None:
    parsed = [item for item in (_parse_timestamp(value) for value in values) if item is not None]
    if not parsed:
        return None
    return max(parsed).isoformat()


def _onboarding_metadata(instance: InstanceRecord) -> dict[str, Any]:
    metadata = instance.metadata if isinstance(instance.metadata, dict) else {}
    raw = metadata.get(_ONBOARDING_METADATA_KEY)
    return raw if isinstance(raw, dict) else {}


def _operator_agent_summary(agent: AgentDetail | None) -> dict[str, object]:
    if agent is None:
        return {
            "status": _NOT_READY,
            "reason": "Default Operator agent is missing.",
            "agent_id": None,
            "display_name": None,
            "role_kind": None,
            "agent_status": None,
            "auto_created": False,
            "allowed_targets": [],
            "updated_at": None,
        }
    auto_created = bool(agent.metadata.get("autocreated")) if isinstance(agent.metadata, dict) else False
    ready = agent.status == "active" and agent.is_default_operator
    return {
        "status": _READY if ready else _NOT_READY,
        "reason": (
            "Default Operator agent is active."
            if ready
            else f"Default Operator agent is present but currently {agent.status}."
        ),
        "agent_id": agent.agent_id,
        "display_name": agent.display_name,
        "role_kind": agent.role_kind,
        "agent_status": agent.status,
        "auto_created": auto_created,
        "allowed_targets": list(agent.allowed_targets),
        "updated_at": agent.updated_at,
    }


def _provider_targets_summary(instance: InstanceRecord) -> dict[str, object]:
    control_plane = build_control_plane_service(instance.instance_id)
    providers = control_plane.provider_control_snapshot(tenant_id=instance.tenant_id)
    targets = control_plane.provider_target_snapshot()
    configured_provider_count = len(
        [
            item
            for item in providers
            if bool(item.get("enabled"))
            or bool(item.get("config"))
            or int(item.get("model_count") or 0) > 0
            or bool(item.get("last_sync_at"))
        ]
    )
    enabled_targets = [item for item in targets if bool(item.get("enabled"))]
    ready_targets = [item for item in enabled_targets if str(item.get("readiness_status") or "") == _READY]
    bridge_only_providers = [item for item in providers if str(item.get("contract_classification") or "") == _BRIDGE_ONLY]
    unsupported_providers = [item for item in providers if str(item.get("contract_classification") or "") == _UNSUPPORTED]
    onboarding_only_providers = [item for item in providers if str(item.get("contract_classification") or "") == _ONBOARDING_ONLY]
    primary_targets = sorted(
        enabled_targets,
        key=lambda item: (int(item.get("priority") or 0), str(item.get("target_key") or "")),
    )[:3]
    last_target_activity_at = _latest_timestamp(
        *[
            str(item.get("last_probe_at") or item.get("last_seen_at") or "")
            for item in targets
        ]
    )

    if ready_targets:
        status_value = _READY
        reason = f"{len(ready_targets)} ready provider target(s) are available."
    elif bridge_only_providers:
        status_value = _BRIDGE_ONLY
        reason = "Configured providers are still bridge-only and do not expose a runtime-ready target."
    elif unsupported_providers and configured_provider_count > 0:
        status_value = _UNSUPPORTED
        reason = "Configured providers remain unsupported for runtime use."
    elif onboarding_only_providers or configured_provider_count == 0 or not enabled_targets:
        status_value = _ONBOARDING_ONLY
        reason = "No runtime-ready provider target is configured for this instance yet."
    else:
        status_value = _NOT_READY
        reason = "Provider targets exist but none are runtime-ready."

    return {
        "status": status_value,
        "reason": reason,
        "configured_provider_count": configured_provider_count,
        "total_targets": len(targets),
        "enabled_targets": len(enabled_targets),
        "ready_targets": len(ready_targets),
        "primary_targets": [
            {
                "target_key": item.get("target_key"),
                "label": item.get("label"),
                "provider": item.get("provider_label") or item.get("provider"),
                "readiness_status": item.get("readiness_status"),
                "priority": item.get("priority"),
            }
            for item in primary_targets
        ],
        "last_activity_at": last_target_activity_at,
    }


def _routing_summary(instance: InstanceRecord) -> dict[str, object]:
    control_plane = build_control_plane_service(instance.instance_id)
    snapshot = control_plane.routing_snapshot()
    policies = snapshot["policies"]
    targets = snapshot["targets"]
    summary = snapshot["summary"]
    budget = snapshot["budget"]
    simple_policy = next((item for item in policies if item["classification"] == "simple"), None)
    non_simple_policy = next((item for item in policies if item["classification"] == "non_simple"), None)
    ready_targets = [
        item
        for item in targets
        if bool(item.get("enabled")) and str(item.get("readiness_status") or "") == _READY
    ]
    last_decision_at = _latest_timestamp(*[str(item.get("created_at") or "") for item in snapshot["recent_decisions"]])

    if len(targets) == 0:
        status_value = _ONBOARDING_ONLY
        reason = "Routing has no provider targets to evaluate yet."
    elif not ready_targets:
        status_value = _NOT_READY
        reason = "Routing policies exist, but no ready target is currently eligible."
    elif bool(summary.get("hard_budget_blocked")):
        status_value = _NOT_READY
        reason = "Routing is currently hard-blocked by budget policy."
    else:
        status_value = _READY
        open_circuits = int(summary.get("open_circuits") or 0)
        reason = (
            "Routing policies are persisted and have ready targets."
            if open_circuits == 0
            else f"Routing policies are persisted, with {open_circuits} open circuit(s) still under review."
        )

    return {
        "status": status_value,
        "reason": reason,
        "policy_count": int(summary.get("policy_count") or 0),
        "open_circuits": int(summary.get("open_circuits") or 0),
        "hard_budget_blocked": bool(summary.get("hard_budget_blocked")),
        "blocked_cost_classes": list(budget.get("blocked_cost_classes") or []),
        "simple_preferred_target_keys": list((simple_policy or {}).get("preferred_target_keys") or []),
        "non_simple_preferred_target_keys": list((non_simple_policy or {}).get("preferred_target_keys") or []),
        "last_activity_at": last_decision_at,
    }


def _runtime_access_summary(governance: GovernanceService, instance: InstanceRecord) -> dict[str, object]:
    accounts = governance.list_accounts(instance_id=instance.instance_id)
    keys = governance.list_runtime_keys(instance_id=instance.instance_id)
    active_accounts = [item for item in accounts if item.status == "active"]
    active_keys = [item for item in keys if item.status == "active"]
    last_key_activity_at = _latest_timestamp(
        *[
            item.last_used_at or item.updated_at
            for item in keys
        ]
    )
    if active_keys:
        status_value = _READY
        reason = f"{len(active_keys)} active runtime key(s) can reach this instance."
    elif keys:
        status_value = _NOT_READY
        reason = "Runtime keys exist for this instance, but none are active."
    else:
        status_value = _ONBOARDING_ONLY
        reason = "No runtime key has been issued for this instance yet."
    return {
        "status": status_value,
        "reason": reason,
        "total_accounts": len(accounts),
        "active_accounts": len(active_accounts),
        "total_keys": len(keys),
        "active_keys": len(active_keys),
        "last_activity_at": last_key_activity_at,
    }


def _work_interaction_summary(
    instance: InstanceRecord,
    conversations: ConversationInboxAdminService,
    *,
    include_conversation_details: bool,
) -> dict[str, object]:
    onboarding = _onboarding_metadata(instance)
    mode = str(onboarding.get("work_interaction_mode") or "not-configured")
    inbox_enabled = bool(onboarding.get("inbox_enabled")) if onboarding else False
    tasks_enabled = bool(onboarding.get("tasks_enabled")) if onboarding else False
    notifications_enabled = bool(onboarding.get("notifications_enabled")) if onboarding else False

    conversation_rows: list[ConversationSummary] = []
    if include_conversation_details:
        conversation_rows = conversations.list_conversations(instance=instance, limit=100)
    latest_conversation = max(
        conversation_rows,
        key=lambda item: item.latest_message_at or item.updated_at,
        default=None,
    )
    if latest_conversation is not None:
        latest_activity_at = (latest_conversation.latest_message_at or latest_conversation.updated_at).isoformat()
    else:
        latest_activity_at = None

    if latest_conversation is not None or inbox_enabled or tasks_enabled or notifications_enabled:
        status_value = _READY
        reason = (
            f"Mode '{mode}' is configured for this instance."
            if onboarding
            else "Work interaction history exists for this instance."
        )
    elif onboarding:
        status_value = _NOT_READY
        reason = "Work-interaction metadata exists, but no operator-facing lane is enabled."
    else:
        status_value = _ONBOARDING_ONLY
        reason = "Work interaction has not been configured for this instance yet."

    return {
        "status": status_value,
        "reason": reason,
        "mode": mode,
        "inbox_enabled": inbox_enabled,
        "tasks_enabled": tasks_enabled,
        "notifications_enabled": notifications_enabled,
        "conversation_count": len(conversation_rows),
        "open_conversation_count": len([item for item in conversation_rows if item.status == "open"]),
        "latest_conversation_id": latest_conversation.conversation_id if latest_conversation is not None else None,
        "latest_conversation_subject": latest_conversation.subject if latest_conversation is not None else None,
        "latest_activity_at": latest_activity_at,
    }


def _readiness_summary(
    operator_agent: dict[str, object],
    provider_targets: dict[str, object],
    routing: dict[str, object],
    runtime_access: dict[str, object],
    work_interaction: dict[str, object],
) -> dict[str, object]:
    checks = [
        {
            "id": "operator_agent",
            "label": "Operator agent",
            "status": operator_agent["status"],
            "detail": operator_agent["reason"],
        },
        {
            "id": "provider_targets",
            "label": "Provider targets",
            "status": provider_targets["status"],
            "detail": provider_targets["reason"],
        },
        {
            "id": "routing",
            "label": "Routing policy",
            "status": routing["status"],
            "detail": routing["reason"],
        },
        {
            "id": "runtime_access",
            "label": "Runtime access",
            "status": runtime_access["status"],
            "detail": runtime_access["reason"],
        },
        {
            "id": "work_interaction",
            "label": "Work interaction",
            "status": work_interaction["status"],
            "detail": work_interaction["reason"],
        },
    ]
    ready_checks = len([item for item in checks if item["status"] == _READY])

    if operator_agent["status"] != _READY:
        status_value = _NOT_READY
        reason = str(operator_agent["reason"])
    elif provider_targets["status"] == _UNSUPPORTED:
        status_value = _UNSUPPORTED
        reason = str(provider_targets["reason"])
    elif provider_targets["status"] == _BRIDGE_ONLY:
        status_value = _BRIDGE_ONLY
        reason = str(provider_targets["reason"])
    elif provider_targets["status"] == _ONBOARDING_ONLY:
        status_value = _ONBOARDING_ONLY
        reason = str(provider_targets["reason"])
    elif runtime_access["status"] == _ONBOARDING_ONLY:
        status_value = _ONBOARDING_ONLY
        reason = str(runtime_access["reason"])
    elif routing["status"] != _READY:
        status_value = _NOT_READY
        reason = str(routing["reason"])
    elif runtime_access["status"] != _READY:
        status_value = _NOT_READY
        reason = str(runtime_access["reason"])
    else:
        status_value = _READY
        reason = "Operator, provider targets, routing, and runtime access are all in place."

    return {
        "status": status_value,
        "reason": reason,
        "ready_check_count": ready_checks,
        "check_count": len(checks),
        "checks": checks,
    }


def _instance_inventory_record(
    *,
    admin: AuthenticatedAdmin,
    instance: InstanceRecord,
    governance: GovernanceService,
    agents: AgentAdminService,
    conversations: ConversationInboxAdminService,
    operator_override: AgentDetail | None = None,
) -> dict[str, object]:
    operator_agent = _operator_agent_summary(operator_override or agents.inspect_default_operator(instance=instance))
    provider_targets = _provider_targets_summary(instance)
    routing = _routing_summary(instance)
    runtime_access = _runtime_access_summary(governance, instance)
    work_interaction = _work_interaction_summary(
        instance,
        conversations,
        include_conversation_details=role_allows(admin.role, "operator"),  # type: ignore[arg-type]
    )
    readiness = _readiness_summary(
        operator_agent=operator_agent,
        provider_targets=provider_targets,
        routing=routing,
        runtime_access=runtime_access,
        work_interaction=work_interaction,
    )
    last_activity_at = _latest_timestamp(
        instance.updated_at,
        operator_agent.get("updated_at") if isinstance(operator_agent.get("updated_at"), str) else None,
        provider_targets.get("last_activity_at") if isinstance(provider_targets.get("last_activity_at"), str) else None,
        routing.get("last_activity_at") if isinstance(routing.get("last_activity_at"), str) else None,
        runtime_access.get("last_activity_at") if isinstance(runtime_access.get("last_activity_at"), str) else None,
        work_interaction.get("latest_activity_at") if isinstance(work_interaction.get("latest_activity_at"), str) else None,
    )
    return {
        **instance.model_dump(mode="json"),
        "operator_agent": operator_agent,
        "provider_targets": provider_targets,
        "routing": routing,
        "runtime_access": runtime_access,
        "work_interaction": work_interaction,
        "readiness": readiness,
        "last_activity_at": last_activity_at,
    }


@router.get("/")
def list_instances(
    admin: AuthenticatedAdmin = Depends(require_admin_session),
    service: InstanceService = Depends(get_instance_service),
    governance: GovernanceService = Depends(get_governance_service),
    agents: AgentAdminService = Depends(get_agent_admin_service),
    conversations: ConversationInboxAdminService = Depends(get_conversation_inbox_admin_service),
) -> dict[str, object]:
    instances = governance.list_accessible_instances(
        actor=admin,
        instances=service.list_instances(),
        permission_key="instance.read",
    )
    return {
        "status": "ok",
        "instances": [
            _instance_inventory_record(
                admin=admin,
                instance=item,
                governance=governance,
                agents=agents,
                conversations=conversations,
            )
            for item in instances
        ],
    }


@router.get("/{instance_id}")
def get_instance(
    instance_id: str,
    admin: AuthenticatedAdmin = Depends(require_admin_session),
    service: InstanceService = Depends(get_instance_service),
    governance: GovernanceService = Depends(get_governance_service),
    agents: AgentAdminService = Depends(get_agent_admin_service),
    conversations: ConversationInboxAdminService = Depends(get_conversation_inbox_admin_service),
) -> object:
    try:
        instance = service.get_instance(instance_id)
    except ValueError as exc:
        return _instance_error(status.HTTP_404_NOT_FOUND, "instance_not_found", str(exc))
    try:
        governance.authorize_admin_instance_permission(
            actor=admin,
            instance=instance,
            permission_key="instance.read",
        )
    except PermissionError as exc:
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": str(exc)})
    return {
        "status": "ok",
        "instance": _instance_inventory_record(
            admin=admin,
            instance=instance,
            governance=governance,
            agents=agents,
            conversations=conversations,
        ),
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_instance(
    payload: InstanceCreateRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_write_session),
    service: InstanceService = Depends(get_instance_service),
    governance: GovernanceService = Depends(get_governance_service),
    agents: AgentAdminService = Depends(get_agent_admin_service),
    conversations: ConversationInboxAdminService = Depends(get_conversation_inbox_admin_service),
) -> object:
    try:
        active_instance = service.resolve_instance(
            instance_id=admin.active_instance_id,
            allow_default=True,
            allow_legacy_backfill=False,
        )
        creator_membership = governance.authorize_admin_instance_permission(
            actor=admin,
            instance=active_instance,
            permission_key="instance.write",
        )
    except (PermissionError, ValueError) as exc:
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": str(exc)})
    try:
        instance = service.create_instance(**payload.model_dump())
    except ValueError as exc:
        return _instance_error(status.HTTP_409_CONFLICT, "instance_conflict", str(exc))
    governance.upsert_admin_instance_membership(
        user_id=admin.user_id,
        instance=instance,
        role="owner" if creator_membership.role == "owner" else "admin",
        actor=admin,
    )
    operator_agent, operator_agent_created = agents.ensure_default_operator_with_status(instance=instance)
    return {
        "status": "ok",
        "instance": _instance_inventory_record(
            admin=admin,
            instance=instance,
            governance=governance,
            agents=agents,
            conversations=conversations,
            operator_override=operator_agent,
        ),
        "operator_agent": operator_agent.model_dump(mode="json"),
        "operator_agent_created": operator_agent_created,
    }


@router.patch("/{instance_id}")
def update_instance(
    instance_id: str,
    payload: InstanceUpdateRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_write_session),
    service: InstanceService = Depends(get_instance_service),
    governance: GovernanceService = Depends(get_governance_service),
    agents: AgentAdminService = Depends(get_agent_admin_service),
    conversations: ConversationInboxAdminService = Depends(get_conversation_inbox_admin_service),
) -> object:
    try:
        current = service.get_instance(instance_id)
    except ValueError as exc:
        return _instance_error(status.HTTP_404_NOT_FOUND, "instance_not_found", str(exc))
    try:
        governance.authorize_admin_instance_permission(
            actor=admin,
            instance=current,
            permission_key="instance.write",
        )
    except PermissionError as exc:
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": str(exc)})
    try:
        instance = service.update_instance(instance_id, **payload.model_dump(exclude_none=True))
    except ValueError as exc:
        error_type = "instance_not_found" if "was not found" in str(exc) else "instance_conflict"
        status_code = status.HTTP_404_NOT_FOUND if error_type == "instance_not_found" else status.HTTP_409_CONFLICT
        return _instance_error(status_code, error_type, str(exc))
    operator_agent = agents.ensure_default_operator(instance=instance)
    return {
        "status": "ok",
        "instance": _instance_inventory_record(
            admin=admin,
            instance=instance,
            governance=governance,
            agents=agents,
            conversations=conversations,
            operator_override=operator_agent,
        ),
    }
