"""Governance domain models."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

AdminRole = Literal["admin", "operator", "viewer"]
AdminStatus = Literal["active", "disabled"]
AccountStatus = Literal["active", "suspended", "disabled"]
KeyStatus = Literal["active", "disabled", "revoked"]
AuditStatus = Literal["ok", "warning", "failed"]


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


class AdminSessionRecord(BaseModel):
    session_id: str
    user_id: str
    token_hash: str
    role: AdminRole
    created_at: str
    expires_at: str
    last_used_at: str
    revoked_at: str | None = None
    revoked_reason: str | None = None


class AuthenticatedAdmin(BaseModel):
    session_id: str
    user_id: str
    username: str
    display_name: str
    role: AdminRole
    must_rotate_password: bool = False


class AdminLoginResult(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: str
    user: AuthenticatedAdmin


class GatewayAccountRecord(BaseModel):
    account_id: str
    label: str
    status: AccountStatus = "active"
    provider_bindings: list[str] = Field(default_factory=list)
    notes: str = ""
    created_at: str
    updated_at: str
    last_activity_at: str | None = None


class RuntimeKeyRecord(BaseModel):
    key_id: str
    account_id: str | None = None
    label: str
    prefix: str
    secret_hash: str
    scopes: list[str] = Field(default_factory=list)
    status: KeyStatus = "active"
    created_at: str
    updated_at: str
    last_used_at: str | None = None
    rotated_from: str | None = None


class IssuedApiKey(BaseModel):
    key_id: str
    token: str
    prefix: str
    account_id: str | None = None
    label: str
    scopes: list[str] = Field(default_factory=list)
    created_at: str


class RuntimeGatewayIdentity(BaseModel):
    key_id: str
    account_id: str | None = None
    account_label: str | None = None
    scopes: list[str] = Field(default_factory=list)
    client_id: str
    consumer: str
    integration: str = "runtime_gateway"


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
    action: str
    target_type: str
    target_id: str | None = None
    status: AuditStatus = "ok"
    details: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class GovernanceStateRecord(BaseModel):
    schema_version: int = 1
    admin_users: list[AdminUserRecord] = Field(default_factory=list)
    admin_sessions: list[AdminSessionRecord] = Field(default_factory=list)
    gateway_accounts: list[GatewayAccountRecord] = Field(default_factory=list)
    runtime_keys: list[RuntimeKeyRecord] = Field(default_factory=list)
    setting_overrides: list[MutableSettingRecord] = Field(default_factory=list)
    audit_events: list[AuditEventRecord] = Field(default_factory=list)
    updated_at: str = ""
