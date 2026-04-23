"""Default-deny policy evaluator for ForgeFrame route guards."""

from __future__ import annotations

from app.authz.catalog import ROLE_PERMISSION_KEYS
from app.authz.models import AuthorizationDecision, RequestActor, RoutePolicy, TenantBoundTarget

_TENANT_WIDE_ROLES = frozenset({"tenant_owner", "tenant_admin"})


class PolicyEvaluator:
    """Evaluates RBAC/ABAC policy decisions using the FOR-20 order of operations."""

    def resolve_permission_keys(self, actor: RequestActor) -> set[str]:
        permission_keys = set(actor.scope.permission_keys)
        for role_key in actor.role_keys:
            permission_keys.update(ROLE_PERMISSION_KEYS.get(role_key, frozenset()))
        return permission_keys

    def authorize(
        self,
        *,
        actor: RequestActor | None,
        policy: RoutePolicy,
        target: TenantBoundTarget | None,
    ) -> AuthorizationDecision:
        if actor is None:
            return AuthorizationDecision(
                allowed=False,
                status_code=401,
                error_code="unauthenticated",
                message="Authentication required.",
            )

        if actor.credential_state != "active":
            return AuthorizationDecision(
                allowed=False,
                status_code=401,
                error_code="unauthenticated",
                message="Authentication required.",
            )

        if actor.principal_type == "human" and actor.membership_state != "active":
            return AuthorizationDecision(
                allowed=False,
                status_code=401,
                error_code="unauthenticated",
                message="Authentication required.",
            )

        if target is None and policy.resource_scope != "integration":
            return AuthorizationDecision(
                allowed=False,
                status_code=404,
                error_code="not_found",
                message="Resource not found.",
            )

        if target is not None and target.tenant_id is not None and actor.tenant_id != target.tenant_id:
            return AuthorizationDecision(
                allowed=False,
                status_code=404,
                error_code="not_found",
                message="Resource not found.",
            )

        permission_keys = self.resolve_permission_keys(actor)
        missing_permissions = [key for key in policy.permission_keys if key not in permission_keys]
        if missing_permissions:
            return AuthorizationDecision(
                allowed=False,
                status_code=403,
                error_code="forbidden",
                message="Forbidden.",
                details={
                    "reason": "missing_permission",
                    "missingPermissionKeys": missing_permissions,
                },
            )

        if policy.require_fresh_auth and "fresh_auth" not in actor.policy_flags:
            return AuthorizationDecision(
                allowed=False,
                status_code=403,
                error_code="forbidden",
                message="Forbidden.",
                details={
                    "reason": "policy_guard_failed",
                    "guard": "fresh_auth_required",
                },
            )

        if (
            actor.impersonation is not None
            and actor.impersonation.read_only
            and policy.is_mutating
            and not policy.allow_impersonated_write
        ):
            return AuthorizationDecision(
                allowed=False,
                status_code=403,
                error_code="forbidden",
                message="Forbidden.",
                details={
                    "reason": "policy_guard_failed",
                    "guard": "impersonation_read_only",
                },
            )

        if target is not None and self._target_state_blocks(policy, target):
            return AuthorizationDecision(
                allowed=False,
                status_code=403,
                error_code="forbidden",
                message="Forbidden.",
                details={
                    "reason": "policy_guard_failed",
                    "guard": "target_state_blocked",
                },
            )

        if target is not None and self._requires_production_scope(policy, target):
            if "environment.production.write" not in permission_keys:
                return AuthorizationDecision(
                    allowed=False,
                    status_code=403,
                    error_code="forbidden",
                    message="Forbidden.",
                    details={
                        "reason": "missing_permission",
                        "missingPermissionKeys": ["environment.production.write"],
                    },
                )
            if target.environment_id not in actor.scope.production_environment_ids:
                return AuthorizationDecision(
                    allowed=False,
                    status_code=403,
                    error_code="forbidden",
                    message="Forbidden.",
                    details={"reason": "scope_mismatch"},
                )

        if target is not None and not self._scope_matches(actor=actor, policy=policy, target=target):
            return AuthorizationDecision(
                allowed=False,
                status_code=403,
                error_code="forbidden",
                message="Forbidden.",
                details={"reason": "scope_mismatch"},
            )

        return AuthorizationDecision(allowed=True, status_code=200)

    @staticmethod
    def _target_state_blocks(policy: RoutePolicy, target: TenantBoundTarget) -> bool:
        return any(flag in target.state_flags for flag in policy.blocked_target_state_flags)

    @staticmethod
    def _requires_production_scope(policy: RoutePolicy, target: TenantBoundTarget) -> bool:
        return policy.resource_scope == "environment" and policy.is_mutating and "production" in target.state_flags

    @staticmethod
    def _has_tenant_wide_access(actor: RequestActor) -> bool:
        return any(role_key in _TENANT_WIDE_ROLES for role_key in actor.role_keys)

    def _scope_matches(
        self,
        *,
        actor: RequestActor,
        policy: RoutePolicy,
        target: TenantBoundTarget,
    ) -> bool:
        if policy.resource_scope == "integration":
            return self._integration_scope_matches(actor=actor, policy=policy, target=target)

        if self._has_tenant_wide_access(actor):
            return True

        if policy.resource_scope == "tenant":
            return actor.tenant_id == target.tenant_id

        if policy.resource_scope == "project":
            return target.project_id in actor.scope.project_ids

        if policy.resource_scope == "workspace":
            return (
                target.workspace_id in actor.scope.workspace_ids
                or target.project_id in actor.scope.project_ids
            )

        if policy.resource_scope == "environment":
            return (
                target.environment_id in actor.scope.environment_ids
                or target.workspace_id in actor.scope.workspace_ids
                or target.project_id in actor.scope.project_ids
            )

        if policy.resource_scope == "task":
            if "task.assign" in policy.permission_keys:
                return (
                    target.queue_id in actor.scope.queue_ids
                    or target.task_id in actor.scope.task_ids
                    or target.workspace_id in actor.scope.workspace_ids
                    or target.project_id in actor.scope.project_ids
                )
            return (
                target.task_id in actor.scope.task_ids
                or target.workspace_id in actor.scope.workspace_ids
                or target.project_id in actor.scope.project_ids
            )

        if policy.resource_scope == "run":
            explicit_run_scope = target.run_id in actor.scope.run_ids or target.task_id in actor.scope.task_ids
            if "run.read" in policy.permission_keys:
                return (
                    explicit_run_scope
                    or target.workspace_id in actor.scope.workspace_ids
                    or target.project_id in actor.scope.project_ids
                )
            return explicit_run_scope

        return False

    def _integration_scope_matches(
        self,
        *,
        actor: RequestActor,
        policy: RoutePolicy,
        target: TenantBoundTarget,
    ) -> bool:
        if self._has_tenant_wide_access(actor):
            return True

        if target.environment_id is not None:
            return (
                target.environment_id in actor.scope.environment_ids
                or target.workspace_id in actor.scope.workspace_ids
                or target.project_id in actor.scope.project_ids
            )

        if target.task_id is not None or target.run_id is not None:
            return self._scope_matches(actor=actor, policy=RoutePolicy(
                policy_key=f"{policy.policy_key}.delegated",
                permission_keys=policy.permission_keys,
                resource_scope="run" if target.run_id is not None else "task",
                tenant_resolver=policy.tenant_resolver,
                audit_action=policy.audit_action,
            ), target=target)

        if target.queue_id is not None:
            return (
                target.queue_id in actor.scope.queue_ids
                or target.workspace_id in actor.scope.workspace_ids
                or target.project_id in actor.scope.project_ids
            )

        return True
