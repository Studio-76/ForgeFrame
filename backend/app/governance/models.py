"""Governance domain models."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.approvals.models import ApprovalStatus
from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID

AdminRole = Literal["owner", "admin", "operator", "viewer"]
AdminStatus = Literal["active", "disabled"]
AdminPermissionKey = Literal[
    "instance.read",
    "instance.write",
    "providers.read",
    "providers.write",
    "provider_targets.read",
    "provider_targets.write",
    "routing.read",
    "routing.write",
    "approvals.read",
    "approvals.decide",
    "execution.read",
    "execution.operate",
    "security.read",
    "security.write",
    "audit.read",
    "settings.read",
    "settings.write",
]
AccountStatus = Literal["active", "suspended", "disabled"]
KeyStatus = Literal["active", "disabled", "revoked"]
AuditStatus = Literal["ok", "warning", "failed"]
AdminSessionType = Literal["standard", "impersonation", "break_glass"]
ElevatedAccessRequestType = Literal["impersonation", "break_glass"]
ElevatedAccessGateStatus = ApprovalStatus
ElevatedAccessIssuanceStatus = Literal["pending", "issued"]
SecretRotationTargetType = Literal["provider", "harness_profile"]
SecretRotationKind = Literal["manual_env_rotation", "oauth_token_rotation", "api_key_rotation", "harness_profile_rotation"]
RuntimeRequestPathType = Literal[
    "smart_routing",
    "pinned_target",
    "local_only",
    "queue_background",
    "blocked",
    "review_required",
]
LocalOnlyPolicy = Literal["prefer_local", "require_local_target"]


class AdminUserRecord(BaseModel):
    user_id: str
    username: str
    display_name: str
    role: AdminRole = "admin"
    status: AdminStatus = "active"
    password_hash: str
    password_salt: str
    must_rotate_password: bool = True
    created_at: str
    updated_at: str
    last_login_at: str | None = None
    created_by: str | None = None


class AdminInstanceMembershipRecord(BaseModel):
    membership_id: str
    user_id: str
    instance_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    company_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    role: AdminRole = "admin"
    status: AdminStatus = "active"
    created_at: str
    updated_at: str
    created_by: str | None = None


class AdminSessionRecord(BaseModel):
    session_id: str
    user_id: str
    token_hash: str
    role: AdminRole
    membership_id: str | None = None
    instance_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    session_type: AdminSessionType = "standard"
    created_at: str
    expires_at: str
    last_used_at: str
    issued_by_user_id: str | None = None
    approved_by_user_id: str | None = None
    approval_request_id: str | None = None
    approval_reference: str | None = None
    justification: str | None = None
    notification_targets: list[str] = Field(default_factory=list)
    revoked_at: str | None = None
    revoked_reason: str | None = None


class AuthenticatedAdmin(BaseModel):
    session_id: str
    user_id: str
    username: str
    display_name: str
    role: AdminRole
    membership_id: str | None = None
    active_instance_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    active_tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    session_type: AdminSessionType = "standard"
    read_only: bool = False
    must_rotate_password: bool = False
    expires_at: str | None = None
    issued_by_user_id: str | None = None
    approved_by_user_id: str | None = None
    approval_request_id: str | None = None
    approval_reference: str | None = None
    justification: str | None = None
    notification_targets: list[str] = Field(default_factory=list)
    instance_memberships: list[AdminInstanceMembershipRecord] = Field(default_factory=list)
    instance_permissions: dict[str, list[AdminPermissionKey]] = Field(default_factory=dict)


class AdminLoginResult(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: str
    user: AuthenticatedAdmin


class ElevatedAccessRequestRecord(BaseModel):
    request_id: str
    request_type: ElevatedAccessRequestType
    gate_status: ElevatedAccessGateStatus = "open"
    issuance_status: ElevatedAccessIssuanceStatus = "pending"
    requested_by_user_id: str
    target_user_id: str
    target_role: AdminRole
    session_role: AdminRole
    approval_reference: str
    justification: str
    notification_targets: list[str] = Field(default_factory=list)
    duration_minutes: int
    approval_expires_at: str
    decision_note: str | None = None
    decided_at: str | None = None
    decided_by_user_id: str | None = None
    issued_at: str | None = None
    issued_by_user_id: str | None = None
    issued_session_id: str | None = None
    created_at: str
    updated_at: str


class GatewayAccountRecord(BaseModel):
    account_id: str
    instance_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    label: str
    status: AccountStatus = "active"
    provider_bindings: list[str] = Field(default_factory=list)
    notes: str = ""
    created_at: str
    updated_at: str
    last_activity_at: str | None = None


class RuntimeKeyRecord(BaseModel):
    key_id: str
    instance_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    account_id: str | None = None
    label: str
    prefix: str
    secret_hash: str
    scopes: list[str] = Field(default_factory=list)
    status: KeyStatus = "active"
    created_at: str
    updated_at: str
    expires_at: str | None = None
    last_used_at: str | None = None
    last_rotated_at: str | None = None
    rotated_from: str | None = None
    revoked_at: str | None = None
    revoked_reason: str | None = None
    created_by: str | None = None
    allowed_request_paths: list[RuntimeRequestPathType] = Field(default_factory=lambda: ["smart_routing"])
    default_request_path: RuntimeRequestPathType = "smart_routing"
    pinned_target_key: str | None = None
    local_only_policy: LocalOnlyPolicy = "require_local_target"
    review_required_conditions: list[str] = Field(default_factory=list)


class IssuedApiKey(BaseModel):
    key_id: str
    instance_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    token: str
    prefix: str
    account_id: str | None = None
    label: str
    scopes: list[str] = Field(default_factory=list)
    created_at: str
    allowed_request_paths: list[RuntimeRequestPathType] = Field(default_factory=list)
    default_request_path: RuntimeRequestPathType = "smart_routing"
    pinned_target_key: str | None = None
    local_only_policy: LocalOnlyPolicy = "require_local_target"
    review_required_conditions: list[str] = Field(default_factory=list)


class RuntimeGatewayIdentity(BaseModel):
    key_id: str
    instance_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    account_id: str | None = None
    account_label: str | None = None
    account_status: AccountStatus | None = None
    provider_bindings: list[str] = Field(default_factory=list)
    scopes: list[str] = Field(default_factory=list)
    client_id: str
    consumer: str
    integration: str = "runtime_gateway"
    allowed_request_paths: list[RuntimeRequestPathType] = Field(default_factory=list)
    default_request_path: RuntimeRequestPathType = "smart_routing"
    pinned_target_key: str | None = None
    local_only_policy: LocalOnlyPolicy = "require_local_target"
    review_required_conditions: list[str] = Field(default_factory=list)


class RuntimeRequestPathDecision(BaseModel):
    request_path: RuntimeRequestPathType
    default_request_path: RuntimeRequestPathType
    allowed_request_paths: list[RuntimeRequestPathType] = Field(default_factory=list)
    pinned_target_key: str | None = None
    local_only_policy: LocalOnlyPolicy = "require_local_target"
    review_required_conditions: list[str] = Field(default_factory=list)
    selected_via: Literal["default", "header"] = "default"


class MutableSettingRecord(BaseModel):
    key: str
    value: Any
    category: str
    updated_at: str
    updated_by: str | None = None


class AuditEventRecord(BaseModel):
    event_id: str
    actor_type: Literal["admin_user", "runtime_key", "system", "anonymous"]
    actor_id: str | None = None
    instance_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    company_id: str | None = None
    action: str
    target_type: str
    target_id: str | None = None
    status: AuditStatus = "ok"
    details: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class AdminLoginFailureRecord(BaseModel):
    username: str
    failed_at: str


class SecretRotationEventRecord(BaseModel):
    event_id: str
    target_type: SecretRotationTargetType
    target_id: str
    kind: SecretRotationKind
    recorded_at: str
    recorded_by_user_id: str | None = None
    reference: str | None = None
    notes: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class GovernanceStateRecord(BaseModel):
    schema_version: int = 6
    admin_users: list[AdminUserRecord] = Field(default_factory=list)
    instance_memberships: list[AdminInstanceMembershipRecord] = Field(default_factory=list)
    admin_sessions: list[AdminSessionRecord] = Field(default_factory=list)
    elevated_access_requests: list[ElevatedAccessRequestRecord] = Field(default_factory=list)
    gateway_accounts: list[GatewayAccountRecord] = Field(default_factory=list)
    runtime_keys: list[RuntimeKeyRecord] = Field(default_factory=list)
    setting_overrides: list[MutableSettingRecord] = Field(default_factory=list)
    audit_events: list[AuditEventRecord] = Field(default_factory=list)
    admin_login_failures: list[AdminLoginFailureRecord] = Field(default_factory=list)
    secret_rotation_events: list[SecretRotationEventRecord] = Field(default_factory=list)
    updated_at: str = ""
