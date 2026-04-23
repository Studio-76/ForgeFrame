"""Static permission and route-policy catalog aligned with FOR-20/FOR-32."""

from __future__ import annotations

from app.authz.models import RoutePolicy

TENANT_PERMISSION_KEYS: tuple[str, ...] = (
    "tenant.read",
    "tenant.members.read",
    "tenant.members.write",
    "tenant.credentials.write",
    "tenant.audit.read",
    "project.read",
    "project.write",
    "project.members.write",
    "workspace.read",
    "workspace.write",
    "workspace.pause",
    "environment.read",
    "environment.write",
    "environment.lock",
    "environment.production.write",
    "task.read",
    "task.write",
    "task.assign",
    "task.cancel",
    "run.read",
    "run.cancel",
    "run.retry",
    "approval.decide",
    "webhook.ingest",
    "provider_account.test",
)

ROLE_PERMISSION_KEYS: dict[str, frozenset[str]] = {
    "tenant_owner": frozenset(TENANT_PERMISSION_KEYS),
    "tenant_admin": frozenset(TENANT_PERMISSION_KEYS),
    "project_admin": frozenset(
        {
            "project.read",
            "project.write",
            "project.members.write",
            "workspace.read",
            "workspace.write",
            "workspace.pause",
            "environment.read",
            "environment.write",
            "environment.lock",
            "task.read",
            "task.write",
            "task.assign",
            "task.cancel",
            "run.read",
            "run.cancel",
            "run.retry",
            "provider_account.test",
        }
    ),
    "contributor": frozenset(
        {
            "project.read",
            "workspace.read",
            "workspace.write",
            "environment.read",
            "environment.write",
            "task.read",
            "task.write",
            "task.assign",
            "run.read",
        }
    ),
    "auditor": frozenset(
        {
            "tenant.read",
            "tenant.members.read",
            "tenant.audit.read",
            "project.read",
            "workspace.read",
            "environment.read",
            "task.read",
            "run.read",
        }
    ),
}

FORGEGATE_V1_ROUTE_POLICIES: dict[str, RoutePolicy] = {
    "tenant.read": RoutePolicy(
        policy_key="tenant.read",
        permission_keys=["tenant.read"],
        resource_scope="tenant",
        tenant_resolver="tenant_param",
        audit_action="tenant_read",
    ),
    "tenant.members.read": RoutePolicy(
        policy_key="tenant.members.read",
        permission_keys=["tenant.members.read"],
        resource_scope="tenant",
        tenant_resolver="tenant_param",
        audit_action="tenant_members_read",
    ),
    "tenant.members.disable": RoutePolicy(
        policy_key="tenant.members.disable",
        permission_keys=["tenant.members.write"],
        resource_scope="tenant",
        tenant_resolver="membership_lookup",
        audit_action="tenant_members_disable",
        require_fresh_auth=True,
        allow_impersonated_write=False,
        is_mutating=True,
    ),
    "project.read": RoutePolicy(
        policy_key="project.read",
        permission_keys=["project.read"],
        resource_scope="project",
        tenant_resolver="project_lookup",
        audit_action="project_read",
    ),
    "project.write": RoutePolicy(
        policy_key="project.write",
        permission_keys=["project.write"],
        resource_scope="project",
        tenant_resolver="project_lookup",
        audit_action="project_write",
        is_mutating=True,
        blocked_target_state_flags=["archived"],
    ),
    "workspace.pause": RoutePolicy(
        policy_key="workspace.pause",
        permission_keys=["workspace.pause"],
        resource_scope="workspace",
        tenant_resolver="workspace_lookup",
        audit_action="workspace_pause",
        is_mutating=True,
    ),
    "environment.read": RoutePolicy(
        policy_key="environment.read",
        permission_keys=["environment.read"],
        resource_scope="environment",
        tenant_resolver="environment_lookup",
        audit_action="environment_read",
    ),
    "environment.lock": RoutePolicy(
        policy_key="environment.lock",
        permission_keys=["environment.lock"],
        resource_scope="environment",
        tenant_resolver="environment_lookup",
        audit_action="environment_lock",
        is_mutating=True,
        blocked_target_state_flags=["sealed"],
    ),
    "task.read": RoutePolicy(
        policy_key="task.read",
        permission_keys=["task.read"],
        resource_scope="task",
        tenant_resolver="task_lookup",
        audit_action="task_read",
    ),
    "task.claim": RoutePolicy(
        policy_key="task.claim",
        permission_keys=["task.assign"],
        resource_scope="task",
        tenant_resolver="task_lookup",
        audit_action="task_claim",
        is_mutating=True,
        blocked_target_state_flags=["locked"],
    ),
    "task.write": RoutePolicy(
        policy_key="task.write",
        permission_keys=["task.write"],
        resource_scope="task",
        tenant_resolver="task_lookup",
        audit_action="task_write",
        is_mutating=True,
        blocked_target_state_flags=["locked"],
    ),
    "task.cancel": RoutePolicy(
        policy_key="task.cancel",
        permission_keys=["task.cancel"],
        resource_scope="task",
        tenant_resolver="task_lookup",
        audit_action="task_cancel",
        is_mutating=True,
        blocked_target_state_flags=["locked"],
    ),
    "run.read": RoutePolicy(
        policy_key="run.read",
        permission_keys=["run.read"],
        resource_scope="run",
        tenant_resolver="run_lookup",
        audit_action="run_read",
    ),
    "run.cancel": RoutePolicy(
        policy_key="run.cancel",
        permission_keys=["run.cancel"],
        resource_scope="run",
        tenant_resolver="run_lookup",
        audit_action="run_cancel",
        is_mutating=True,
    ),
    "run.retry": RoutePolicy(
        policy_key="run.retry",
        permission_keys=["run.retry"],
        resource_scope="run",
        tenant_resolver="run_lookup",
        audit_action="run_retry",
        is_mutating=True,
    ),
    "service_account.rotate_key": RoutePolicy(
        policy_key="service_account.rotate_key",
        permission_keys=["tenant.credentials.write"],
        resource_scope="integration",
        tenant_resolver="service_account_lookup",
        audit_action="service_account_rotate_key",
        require_fresh_auth=True,
        allow_impersonated_write=False,
        is_mutating=True,
    ),
    "tenant.audit.read": RoutePolicy(
        policy_key="tenant.audit.read",
        permission_keys=["tenant.audit.read"],
        resource_scope="tenant",
        tenant_resolver="tenant_param",
        audit_action="tenant_audit_read",
    ),
    "webhook.ingest": RoutePolicy(
        policy_key="webhook.ingest",
        permission_keys=["webhook.ingest"],
        resource_scope="integration",
        tenant_resolver="webhook_lookup",
        audit_action="webhook_ingest",
        is_mutating=True,
    ),
}

RUNTIME_ROUTE_POLICIES: dict[str, RoutePolicy] = {
    "runtime.models.read": RoutePolicy(
        policy_key="runtime.models.read",
        permission_keys=["models:read"],
        resource_scope="integration",
        tenant_resolver="service_account_lookup",
        audit_action="runtime_models_read",
    ),
    "runtime.chat.write": RoutePolicy(
        policy_key="runtime.chat.write",
        permission_keys=["chat:write"],
        resource_scope="integration",
        tenant_resolver="service_account_lookup",
        audit_action="runtime_chat_write",
        is_mutating=True,
    ),
    "runtime.responses.write": RoutePolicy(
        policy_key="runtime.responses.write",
        permission_keys=["responses:write"],
        resource_scope="integration",
        tenant_resolver="service_account_lookup",
        audit_action="runtime_responses_write",
        is_mutating=True,
    ),
    "runtime.responses.read": RoutePolicy(
        policy_key="runtime.responses.read",
        permission_keys=["responses:write"],
        resource_scope="integration",
        tenant_resolver="service_account_lookup",
        audit_action="runtime_responses_read",
    ),
}

ALL_ROUTE_POLICIES: dict[str, RoutePolicy] = {
    **FORGEGATE_V1_ROUTE_POLICIES,
    **RUNTIME_ROUTE_POLICIES,
}


def get_route_policy(policy_key: str) -> RoutePolicy:
    try:
        return ALL_ROUTE_POLICIES[policy_key]
    except KeyError as exc:  # pragma: no cover - defensive guard for future wiring mistakes
        raise KeyError(f"Unknown route policy '{policy_key}'.") from exc
