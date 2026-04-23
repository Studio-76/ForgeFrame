"""Policy-evaluation contracts for ForgeFrame authz and tenant-aware route guards."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

PrincipalType = Literal["human", "service", "agent"]
CredentialState = Literal["active", "expired", "revoked", "disabled", "suspended"]
MembershipState = Literal["active", "invited", "disabled", "suspended"]
AuthMethod = Literal["session", "bearer_token", "token_exchange"]
ResourceScope = Literal["tenant", "project", "workspace", "environment", "task", "run", "integration"]
TenantResolver = Literal[
    "tenant_param",
    "membership_lookup",
    "project_lookup",
    "workspace_lookup",
    "environment_lookup",
    "task_lookup",
    "run_lookup",
    "service_account_lookup",
    "provider_lookup",
    "webhook_lookup",
]


class ActorScope(BaseModel):
    permission_keys: list[str] = Field(default_factory=list)
    project_ids: list[str] = Field(default_factory=list)
    workspace_ids: list[str] = Field(default_factory=list)
    environment_ids: list[str] = Field(default_factory=list)
    production_environment_ids: list[str] = Field(default_factory=list)
    task_ids: list[str] = Field(default_factory=list)
    run_ids: list[str] = Field(default_factory=list)
    queue_ids: list[str] = Field(default_factory=list)


class ImpersonationContext(BaseModel):
    real_principal_type: PrincipalType
    real_principal_id: str
    reason: str
    expires_at: str
    read_only: bool = True


class BreakGlassContext(BaseModel):
    incident_id: str
    approved_by_principal_id: str
    expires_at: str


class RequestActor(BaseModel):
    principal_type: PrincipalType
    principal_id: str
    credential_id: str | None = None
    auth_method: AuthMethod
    credential_state: CredentialState = "active"
    tenant_id: str | None = None
    role_keys: list[str] = Field(default_factory=list)
    scope: ActorScope = Field(default_factory=ActorScope)
    membership_state: MembershipState | None = None
    impersonation: ImpersonationContext | None = None
    break_glass: BreakGlassContext | None = None
    request_id: str
    policy_flags: list[str] = Field(default_factory=list)


class RoutePolicy(BaseModel):
    policy_key: str
    permission_keys: list[str] = Field(default_factory=list)
    resource_scope: ResourceScope
    tenant_resolver: TenantResolver
    audit_action: str
    require_fresh_auth: bool = False
    allow_impersonated_write: bool = True
    is_mutating: bool = False
    blocked_target_state_flags: list[str] = Field(default_factory=list)


class TenantBoundTarget(BaseModel):
    resource_type: str
    resource_id: str
    tenant_id: str | None = None
    project_id: str | None = None
    workspace_id: str | None = None
    environment_id: str | None = None
    task_id: str | None = None
    run_id: str | None = None
    queue_id: str | None = None
    state_flags: list[str] = Field(default_factory=list)


class AuthorizationDecision(BaseModel):
    allowed: bool
    status_code: int
    error_code: str | None = None
    message: str | None = None
    details: dict[str, object] = Field(default_factory=dict)


class AuthorizationContext(BaseModel):
    actor: RequestActor
    policy: RoutePolicy
    target: TenantBoundTarget | None = None
