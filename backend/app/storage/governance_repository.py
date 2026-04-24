"""Repository for governance state."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    delete,
    select,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Session, mapped_column, sessionmaker

from app.governance.models import (
    AdminInstanceMembershipRecord,
    AdminSessionRecord,
    AdminUserRecord,
    AuditEventRecord,
    GatewayAccountRecord,
    GovernanceStateRecord,
    RuntimeKeyRecord,
)
from app.settings.config import Settings
from app.storage.harness_repository import Base
from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID, normalize_tenant_id

_STATE_KEY = "default"
_UNBOUND_RUNTIME_SERVICE_ACCOUNT_ID = "svc_bootstrap_runtime"
_BOOTSTRAP_TENANT_DISPLAY_NAME = "ForgeFrame Bootstrap Tenant"
_ADMIN_ROLE_RANK = {"viewer": 0, "operator": 1, "admin": 2, "owner": 3}


class GovernanceStateORM(Base):
    __tablename__ = "governance_state"

    state_key: Mapped[str] = mapped_column(String(32), primary_key=True, default=_STATE_KEY)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(tz=UTC), nullable=False)


class GovernanceTenantORM(Base):
    __tablename__ = "tenants"

    tenant_id: Mapped[str] = mapped_column(String(191), primary_key=True)
    slug: Mapped[str] = mapped_column(String(191), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(191), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"), default=dict)


class GovernancePrincipalORM(Base):
    __tablename__ = "principals"

    principal_id: Mapped[str] = mapped_column(String(191), primary_key=True)
    principal_type: Mapped[str] = mapped_column(String(32), nullable=False)
    external_subject: Mapped[str | None] = mapped_column(String(191), nullable=True)
    username: Mapped[str | None] = mapped_column(String(191), nullable=True)
    display_name: Mapped[str] = mapped_column(String(191), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"), default=dict)


class GovernanceTenantMembershipORM(Base):
    __tablename__ = "tenant_memberships"
    __table_args__ = (
        ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], name="tenant_memberships_tenant_fk"),
        ForeignKeyConstraint(["principal_id"], ["principals.principal_id"], name="tenant_memberships_principal_fk"),
        ForeignKeyConstraint(
            ["tenant_id", "created_by_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.membership_id"],
            name="tenant_memberships_created_by_membership_tenant_fk",
        ),
        UniqueConstraint("tenant_id", "principal_id", name="tenant_memberships_tenant_principal_key"),
        UniqueConstraint("tenant_id", "membership_id", name="tenant_memberships_tenant_membership_key"),
        Index("tenant_memberships_principal_status_idx", "principal_id", "status"),
        Index("tenant_memberships_tenant_role_status_idx", "tenant_id", "membership_role", "status"),
    )

    membership_id: Mapped[str] = mapped_column(String(191), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(191), nullable=False)
    principal_id: Mapped[str] = mapped_column(String(191), nullable=False)
    membership_role: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    created_by_membership_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"), default=dict)


class GovernanceScopeGrantORM(Base):
    __tablename__ = "scope_grants"
    __table_args__ = (
        ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], name="scope_grants_tenant_fk"),
        ForeignKeyConstraint(
            ["tenant_id", "membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.membership_id"],
            name="scope_grants_membership_tenant_fk",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "service_account_id"],
            ["service_accounts.tenant_id", "service_accounts.service_account_id"],
            name="scope_grants_service_account_tenant_fk",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "created_by_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.membership_id"],
            name="scope_grants_created_by_membership_tenant_fk",
        ),
        Index("scope_grants_tenant_scope_idx", "tenant_id", "scope_kind", "scope_id"),
    )

    grant_id: Mapped[str] = mapped_column(String(191), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(191), nullable=False)
    membership_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    service_account_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    scope_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    scope_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    permission_set: Mapped[str] = mapped_column(String(64), nullable=False)
    effect: Mapped[str] = mapped_column(String(16), nullable=False)
    created_by_membership_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class GovernanceServiceAccountORM(Base):
    __tablename__ = "service_accounts"
    __table_args__ = (
        ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], name="service_accounts_tenant_fk"),
        ForeignKeyConstraint(
            ["tenant_id", "owner_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.membership_id"],
            name="service_accounts_owner_membership_tenant_fk",
        ),
        UniqueConstraint("tenant_id", "slug", name="service_accounts_tenant_slug_key"),
        UniqueConstraint("tenant_id", "service_account_id", name="service_accounts_tenant_service_account_key"),
        Index("service_accounts_tenant_status_idx", "tenant_id", "status"),
        Index("service_accounts_tenant_owner_idx", "tenant_id", "owner_membership_id"),
    )

    service_account_id: Mapped[str] = mapped_column(String(191), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(191), nullable=False)
    slug: Mapped[str] = mapped_column(String(191), nullable=False)
    display_name: Mapped[str] = mapped_column(String(191), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    owner_membership_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"), default=dict)


class GovernanceAgentCredentialORM(Base):
    __tablename__ = "agent_credentials"
    __table_args__ = (
        ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], name="agent_credentials_tenant_fk"),
        ForeignKeyConstraint(
            ["tenant_id", "service_account_id"],
            ["service_accounts.tenant_id", "service_accounts.service_account_id"],
            name="agent_credentials_service_account_tenant_fk",
        ),
        ForeignKeyConstraint(
            ["rotated_from_credential_id"],
            ["agent_credentials.credential_id"],
            name="agent_credentials_rotated_from_credential_fk",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "issued_by_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.membership_id"],
            name="agent_credentials_issued_by_membership_tenant_fk",
        ),
        UniqueConstraint(
            "tenant_id",
            "service_account_id",
            "provider_key",
            "slot",
            name="agent_credentials_tenant_service_account_provider_slot_key",
        ),
        Index("agent_credentials_provider_status_idx", "tenant_id", "provider_key", "status"),
        Index("agent_credentials_service_account_last_used_idx", "tenant_id", "service_account_id", "last_used_at"),
    )

    credential_id: Mapped[str] = mapped_column(String(191), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(191), nullable=False)
    service_account_id: Mapped[str] = mapped_column(String(191), nullable=False)
    provider_key: Mapped[str] = mapped_column(String(64), nullable=False)
    credential_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    slot: Mapped[str] = mapped_column(String(64), nullable=False)
    secret_ref: Mapped[str] = mapped_column(String(191), nullable=False)
    secret_hash: Mapped[str] = mapped_column(String(191), nullable=False)
    secret_prefix: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    rotation_state: Mapped[str] = mapped_column(String(32), nullable=False)
    rotated_from_credential_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    issued_by_membership_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"), default=dict)


class GovernanceAuthSessionORM(Base):
    __tablename__ = "auth_sessions"
    __table_args__ = (
        ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], name="auth_sessions_tenant_fk"),
        ForeignKeyConstraint(
            ["tenant_id", "membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.membership_id"],
            name="auth_sessions_membership_tenant_fk",
        ),
        UniqueConstraint("session_hash", name="auth_sessions_session_hash_key"),
        Index("auth_sessions_membership_status_idx", "tenant_id", "membership_id", "status"),
        Index("auth_sessions_expires_idx", "tenant_id", "expires_at"),
    )

    session_id: Mapped[str] = mapped_column(String(191), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(191), nullable=False)
    membership_id: Mapped[str] = mapped_column(String(191), nullable=False)
    session_hash: Mapped[str] = mapped_column(String(191), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON(), "sqlite"), default=dict)


class GovernanceAuditEventORM(Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], name="audit_events_tenant_fk"),
        ForeignKeyConstraint(
            ["tenant_id", "actor_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.membership_id"],
            name="audit_events_actor_membership_tenant_fk",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "actor_service_account_id"],
            ["service_accounts.tenant_id", "service_accounts.service_account_id"],
            name="audit_events_actor_service_account_tenant_fk",
        ),
        Index("audit_events_tenant_created_idx", "tenant_id", "created_at"),
        Index("audit_events_tenant_target_idx", "tenant_id", "target_type", "target_id", "created_at"),
        Index("audit_events_tenant_actor_membership_idx", "tenant_id", "actor_membership_id", "created_at"),
        Index("audit_events_tenant_actor_service_account_idx", "tenant_id", "actor_service_account_id", "created_at"),
    )

    event_id: Mapped[str] = mapped_column(String(191), primary_key=True)
    tenant_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    actor_membership_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    actor_service_account_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    actor_type: Mapped[str] = mapped_column(String(32), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    company_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    details: Mapped[str] = mapped_column(Text(), nullable=False)
    event_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB().with_variant(JSON(), "sqlite"), default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


@dataclass(frozen=True)
class GovernanceStatePaths:
    state_path: Path


class GovernanceRepository(Protocol):
    def load_state(self) -> GovernanceStateRecord: ...

    def save_state(self, state: GovernanceStateRecord) -> GovernanceStateRecord: ...


class FileGovernanceRepository:
    def __init__(self, *, paths: GovernanceStatePaths):
        self._paths = paths

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(tz=UTC).isoformat()

    @staticmethod
    def _upgrade_payload(payload: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(payload)
        normalized["schema_version"] = max(6, int(normalized.get("schema_version") or 0))
        normalized.setdefault("admin_users", [])
        normalized.setdefault("instance_memberships", [])
        normalized.setdefault("admin_sessions", [])
        normalized.setdefault("elevated_access_requests", [])
        normalized.setdefault("gateway_accounts", [])
        normalized.setdefault("runtime_keys", [])
        normalized.setdefault("setting_overrides", [])
        normalized.setdefault("audit_events", [])
        normalized.setdefault("admin_login_failures", [])
        normalized.setdefault("secret_rotation_events", [])
        normalized.setdefault("updated_at", "")

        upgraded_accounts: list[dict[str, Any]] = []
        for raw_account in normalized.get("gateway_accounts", []):
            account = dict(raw_account or {})
            tenant_scope = normalize_tenant_id(
                account.get("tenant_id") or account.get("account_id"),
                fallback_tenant_id=DEFAULT_BOOTSTRAP_TENANT_ID,
            )
            account["tenant_id"] = tenant_scope
            account["instance_id"] = normalize_tenant_id(
                account.get("instance_id") or tenant_scope,
                fallback_tenant_id=tenant_scope,
            )
            upgraded_accounts.append(account)
        normalized["gateway_accounts"] = upgraded_accounts

        upgraded_memberships: list[dict[str, Any]] = []
        for raw_membership in normalized.get("instance_memberships", []):
            membership = dict(raw_membership or {})
            tenant_scope = normalize_tenant_id(
                membership.get("tenant_id") or membership.get("instance_id") or membership.get("user_id"),
                fallback_tenant_id=DEFAULT_BOOTSTRAP_TENANT_ID,
            )
            membership["tenant_id"] = tenant_scope
            membership["instance_id"] = normalize_tenant_id(
                membership.get("instance_id") or tenant_scope,
                fallback_tenant_id=tenant_scope,
            )
            membership["company_id"] = str(
                membership.get("company_id") or membership["instance_id"] or tenant_scope
            )
            membership["membership_id"] = str(
                membership.get("membership_id")
                or FileGovernanceRepository._membership_id_for_user(
                    str(membership.get("user_id") or ""),
                    tenant_scope,
                )
            )
            membership["created_at"] = str(membership.get("created_at") or "")
            membership["updated_at"] = str(membership.get("updated_at") or membership["created_at"] or "")
            upgraded_memberships.append(membership)
        normalized["instance_memberships"] = upgraded_memberships

        upgraded_keys: list[dict[str, Any]] = []
        for raw_key in normalized.get("runtime_keys", []):
            key = dict(raw_key or {})
            tenant_scope = normalize_tenant_id(
                key.get("tenant_id") or key.get("account_id"),
                fallback_tenant_id=DEFAULT_BOOTSTRAP_TENANT_ID,
            )
            key["tenant_id"] = tenant_scope
            key["instance_id"] = normalize_tenant_id(
                key.get("instance_id") or tenant_scope,
                fallback_tenant_id=tenant_scope,
            )
            key["allowed_request_paths"] = list(key.get("allowed_request_paths") or ["smart_routing"])
            key["default_request_path"] = str(key.get("default_request_path") or "smart_routing")
            key["pinned_target_key"] = key.get("pinned_target_key")
            key["local_only_policy"] = str(key.get("local_only_policy") or "require_local_target")
            key["review_required_conditions"] = list(key.get("review_required_conditions") or [])
            upgraded_keys.append(key)
        normalized["runtime_keys"] = upgraded_keys

        upgraded_events: list[dict[str, Any]] = []
        for raw_event in normalized.get("audit_events", []):
            event = dict(raw_event or {})
            event_metadata = dict(event.get("metadata") or {})
            tenant_scope = normalize_tenant_id(
                event.get("tenant_id") or event_metadata.get("tenant_id"),
                fallback_tenant_id=DEFAULT_BOOTSTRAP_TENANT_ID,
            )
            instance_scope = normalize_tenant_id(
                event.get("instance_id") or event_metadata.get("instance_id") or tenant_scope,
                fallback_tenant_id=tenant_scope,
            )
            event["tenant_id"] = tenant_scope
            event["instance_id"] = instance_scope
            upgraded_events.append(event)
        normalized["audit_events"] = upgraded_events
        return normalized

    def load_state(self) -> GovernanceStateRecord:
        path = self._paths.state_path
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            return GovernanceStateRecord()
        try:
            raw = path.read_text(encoding="utf-8")
            if not raw.strip():
                return GovernanceStateRecord()
            payload = self._upgrade_payload(json.loads(raw))
            return GovernanceStateRecord(**payload)
        except (OSError, json.JSONDecodeError, ValueError):
            backup = path.with_suffix(path.suffix + ".corrupt")
            try:
                path.replace(backup)
            except OSError:
                pass
            return GovernanceStateRecord()

    def save_state(self, state: GovernanceStateRecord) -> GovernanceStateRecord:
        normalized = state.model_copy(update={"updated_at": self._now_iso()})
        path = self._paths.state_path
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(normalized.model_dump(), indent=2) + "\n", encoding="utf-8")
        tmp.replace(path)
        return normalized


class PostgresGovernanceRepository:
    def __init__(
        self,
        database_url: str,
        *,
        bootstrap_tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID,
        relational_dual_write_enabled: bool = True,
        relational_reads_enabled: bool = True,
    ):
        if not database_url.startswith("postgresql"):
            raise ValueError("Governance PostgreSQL backend requires a postgresql:// URL.")
        self._engine = create_engine(database_url, pool_pre_ping=True)
        # Storage migrations own the PostgreSQL schema. Calling create_all() here can
        # mint an unconstrained shadow schema before the real migrations run.
        self._session_factory = sessionmaker(self._engine, autoflush=False, expire_on_commit=False)
        self._bootstrap_tenant_id = normalize_tenant_id(
            bootstrap_tenant_id,
            fallback_tenant_id=DEFAULT_BOOTSTRAP_TENANT_ID,
        )
        self._relational_dual_write_enabled = relational_dual_write_enabled
        self._relational_reads_enabled = relational_reads_enabled

    @staticmethod
    def _now() -> datetime:
        return datetime.now(tz=UTC)

    @staticmethod
    def _membership_id_for_user(user_id: str, tenant_id: str | None = None) -> str:
        if tenant_id:
            return f"membership_{normalize_tenant_id(tenant_id)}_{user_id}"
        return f"membership_{user_id}"

    @staticmethod
    def _dt(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None

    def _required_dt(self, value: str | None) -> datetime:
        return self._dt(value) or self._now()

    @staticmethod
    def _iso(value: datetime | None) -> str | None:
        return value.isoformat() if value is not None else None

    def _session(self) -> Session:
        return self._session_factory()

    def _default_admin_membership(
        self,
        user: AdminUserRecord,
        *,
        created_by: str | None = None,
    ) -> AdminInstanceMembershipRecord:
        tenant_id = self._bootstrap_tenant_id
        created_at = user.created_at
        return AdminInstanceMembershipRecord(
            membership_id=self._membership_id_for_user(user.user_id, tenant_id),
            user_id=user.user_id,
            instance_id=tenant_id,
            tenant_id=tenant_id,
            company_id=tenant_id,
            role=user.role,
            status=user.status,
            created_at=created_at,
            updated_at=user.updated_at or created_at,
            created_by=created_by or user.created_by,
        )

    def _backfill_admin_memberships(self, state: GovernanceStateRecord) -> list[AdminInstanceMembershipRecord]:
        if state.instance_memberships:
            return [
                membership.model_copy(
                    update={
                        "membership_id": membership.membership_id or self._membership_id_for_user(membership.user_id, membership.tenant_id),
                        "instance_id": membership.instance_id or membership.tenant_id or self._bootstrap_tenant_id,
                        "tenant_id": normalize_tenant_id(
                            membership.tenant_id or membership.instance_id,
                            fallback_tenant_id=self._bootstrap_tenant_id,
                        ),
                        "company_id": membership.company_id or membership.instance_id or membership.tenant_id or self._bootstrap_tenant_id,
                    }
                )
                for membership in state.instance_memberships
            ]

        memberships: list[AdminInstanceMembershipRecord] = []
        for user in state.admin_users:
            memberships.append(self._default_admin_membership(user))
        return memberships

    def _should_sync_relational_shadow(self) -> bool:
        return self._relational_dual_write_enabled or self._relational_reads_enabled

    def _tenant_scope_for_account(self, account_id: str | None) -> str:
        return normalize_tenant_id(account_id, fallback_tenant_id=self._bootstrap_tenant_id)

    def _load_legacy_state(self, session: Session) -> tuple[GovernanceStateRecord, bool]:
        row = session.get(GovernanceStateORM, _STATE_KEY)
        if not row:
            return GovernanceStateRecord(), False
        payload = FileGovernanceRepository._upgrade_payload(row.payload)
        state = GovernanceStateRecord(**payload)
        changed = payload != row.payload
        if changed:
            row.payload = state.model_dump()
            row.updated_at = self._now()
        return state, changed

    def _save_legacy_state(self, session: Session, state: GovernanceStateRecord) -> GovernanceStateRecord:
        normalized = state.model_copy(update={"updated_at": self._now().isoformat()})
        row = session.get(GovernanceStateORM, _STATE_KEY)
        payload = normalized.model_dump()
        if row:
            row.payload = payload
            row.updated_at = self._now()
        else:
            session.add(
                GovernanceStateORM(
                    state_key=_STATE_KEY,
                    payload=payload,
                    updated_at=self._now(),
                )
            )
        return normalized

    def _ensure_tenant_row(
        self,
        tenant_rows: dict[str, GovernanceTenantORM],
        *,
        tenant_id: str,
        display_name: str,
        status: str,
        created_at: datetime,
        updated_at: datetime,
        attributes: dict[str, Any] | None = None,
        replace_existing: bool = False,
    ) -> None:
        if tenant_id in tenant_rows and not replace_existing:
            return
        tenant_rows[tenant_id] = GovernanceTenantORM(
            tenant_id=tenant_id,
            slug=tenant_id,
            display_name=display_name,
            status=status,
            created_at=created_at,
            updated_at=updated_at,
            attributes=attributes or {},
        )

    def _replace_relational_shadow(
        self,
        session: Session,
        state: GovernanceStateRecord,
        *,
        delete_missing_audit_events: bool,
    ) -> None:
        tenant_rows: dict[str, GovernanceTenantORM] = {}
        principal_rows: dict[str, GovernancePrincipalORM] = {}
        membership_rows: dict[str, GovernanceTenantMembershipORM] = {}
        service_account_rows: dict[str, GovernanceServiceAccountORM] = {}
        credential_rows: list[GovernanceAgentCredentialORM] = []
        auth_session_rows: list[GovernanceAuthSessionORM] = []
        audit_event_rows: list[GovernanceAuditEventORM] = []
        key_service_account_map: dict[str, str] = {}

        now = self._now()
        self._ensure_tenant_row(
            tenant_rows,
            tenant_id=self._bootstrap_tenant_id,
            display_name=_BOOTSTRAP_TENANT_DISPLAY_NAME,
            status="active",
            created_at=now,
            updated_at=now,
            attributes={"synthetic": True, "kind": "bootstrap"},
        )

        for user in state.admin_users:
            principal_rows[user.user_id] = GovernancePrincipalORM(
                principal_id=user.user_id,
                principal_type="admin_user",
                external_subject=None,
                username=user.username,
                display_name=user.display_name,
                status=user.status,
                created_at=self._required_dt(user.created_at),
                updated_at=self._required_dt(user.updated_at),
                attributes={
                    "password_hash": user.password_hash,
                    "password_salt": user.password_salt,
                    "must_rotate_password": user.must_rotate_password,
                    "last_login_at": user.last_login_at,
                    "created_by": user.created_by,
                },
            )

        admin_memberships = self._backfill_admin_memberships(state)
        for membership in admin_memberships:
            tenant_id = normalize_tenant_id(
                membership.tenant_id or membership.instance_id,
                fallback_tenant_id=self._bootstrap_tenant_id,
            )
            company_id = str(membership.company_id or membership.instance_id or tenant_id)
            self._ensure_tenant_row(
                tenant_rows,
                tenant_id=tenant_id,
                display_name=membership.instance_id,
                status=membership.status,
                created_at=self._required_dt(membership.created_at),
                updated_at=self._required_dt(membership.updated_at),
                attributes={
                    "instance_id": membership.instance_id,
                    "company_id": company_id,
                    "source": "admin_membership",
                },
            )
            membership_id = membership.membership_id or self._membership_id_for_user(membership.user_id, tenant_id)
            membership_rows[membership_id] = GovernanceTenantMembershipORM(
                membership_id=membership_id,
                tenant_id=tenant_id,
                principal_id=membership.user_id,
                membership_role=membership.role,
                status=membership.status,
                created_by_membership_id=self._membership_id_for_user(membership.created_by, tenant_id)
                if membership.created_by and self._membership_id_for_user(membership.created_by, tenant_id) in membership_rows
                else None,
                created_at=self._required_dt(membership.created_at),
                updated_at=self._required_dt(membership.updated_at),
                attributes={
                    "instance_id": membership.instance_id,
                    "company_id": company_id,
                    "created_by": membership.created_by,
                },
            )

        for account in state.gateway_accounts:
            tenant_id = normalize_tenant_id(
                account.tenant_id,
                fallback_tenant_id=self._bootstrap_tenant_id,
            )
            self._ensure_tenant_row(
                tenant_rows,
                tenant_id=tenant_id,
                display_name=account.label,
                status=account.status,
                created_at=self._required_dt(account.created_at),
                updated_at=self._required_dt(account.updated_at),
                attributes={
                    "synthetic": False,
                    "legacy_account_id": account.account_id,
                    "instance_id": account.instance_id,
                    "tenant_id": account.tenant_id,
                },
                replace_existing=True,
            )
            service_account_rows[account.account_id] = GovernanceServiceAccountORM(
                service_account_id=account.account_id,
                tenant_id=tenant_id,
                slug=account.account_id,
                display_name=account.label,
                status=account.status,
                owner_membership_id=None,
                created_at=self._required_dt(account.created_at),
                updated_at=self._required_dt(account.updated_at),
                last_used_at=self._dt(account.last_activity_at),
                attributes={
                    "legacy_account_id": account.account_id,
                    "instance_id": account.instance_id,
                    "tenant_id": account.tenant_id,
                    "provider_bindings": list(account.provider_bindings),
                    "notes": account.notes,
                    "synthetic": False,
                },
            )

        for key in state.runtime_keys:
            account_id = key.account_id
            if account_id:
                service_account_id = account_id
                tenant_id = normalize_tenant_id(
                    key.tenant_id,
                    fallback_tenant_id=self._bootstrap_tenant_id,
                )
                if service_account_id not in service_account_rows:
                    self._ensure_tenant_row(
                        tenant_rows,
                        tenant_id=tenant_id,
                        display_name=account_id,
                        status="active",
                        created_at=self._required_dt(key.created_at),
                        updated_at=self._required_dt(key.updated_at),
                        attributes={
                            "synthetic": True,
                            "legacy_account_id": account_id,
                            "instance_id": key.instance_id,
                            "tenant_id": key.tenant_id,
                        },
                    )
                    service_account_rows[service_account_id] = GovernanceServiceAccountORM(
                        service_account_id=service_account_id,
                        tenant_id=tenant_id,
                        slug=service_account_id,
                        display_name=account_id,
                        status="active",
                        owner_membership_id=None,
                        created_at=self._required_dt(key.created_at),
                        updated_at=self._required_dt(key.updated_at),
                        last_used_at=self._dt(key.last_used_at),
                        attributes={
                            "legacy_account_id": account_id,
                            "instance_id": key.instance_id,
                            "tenant_id": key.tenant_id,
                            "provider_bindings": [],
                            "notes": "",
                            "synthetic": True,
                            "synthetic_missing_account": True,
                        },
                    )
            else:
                service_account_id = _UNBOUND_RUNTIME_SERVICE_ACCOUNT_ID
                tenant_id = normalize_tenant_id(
                    key.tenant_id,
                    fallback_tenant_id=self._bootstrap_tenant_id,
                )
                if service_account_id not in service_account_rows:
                    service_account_rows[service_account_id] = GovernanceServiceAccountORM(
                        service_account_id=service_account_id,
                        tenant_id=tenant_id,
                        slug=service_account_id,
                        display_name="Bootstrap Runtime Keys",
                        status="active",
                        owner_membership_id=None,
                        created_at=self._required_dt(key.created_at),
                        updated_at=self._required_dt(key.updated_at),
                        last_used_at=self._dt(key.last_used_at),
                        attributes={
                            "legacy_account_id": None,
                            "instance_id": key.instance_id,
                            "tenant_id": key.tenant_id,
                            "provider_bindings": [],
                            "notes": "",
                            "synthetic": True,
                            "synthetic_unbound_account": True,
                        },
                    )

            key_service_account_map[key.key_id] = service_account_id
            issued_by_membership_id = None
            if key.created_by:
                candidate_membership_id = self._membership_id_for_user(key.created_by)
                candidate_membership = membership_rows.get(candidate_membership_id)
                if candidate_membership is not None and candidate_membership.tenant_id == tenant_id:
                    issued_by_membership_id = candidate_membership_id
            credential_rows.append(
                GovernanceAgentCredentialORM(
                    credential_id=key.key_id,
                    tenant_id=tenant_id,
                    service_account_id=service_account_id,
                    provider_key="runtime_gateway",
                    credential_kind="runtime_api_key",
                    slot=key.key_id,
                    secret_ref=f"legacy_runtime_key:{key.key_id}",
                    secret_hash=key.secret_hash,
                    secret_prefix=key.prefix,
                    status=key.status,
                    rotation_state="rotated" if key.rotated_from else ("revoked" if key.status == "revoked" else "active"),
                    rotated_from_credential_id=key.rotated_from,
                    issued_by_membership_id=issued_by_membership_id,
                    last_used_at=self._dt(key.last_used_at),
                    expires_at=self._dt(key.expires_at),
                    created_at=self._required_dt(key.created_at),
                    updated_at=self._required_dt(key.updated_at),
                    attributes={
                        "label": key.label,
                        "scopes": list(key.scopes),
                        "instance_id": key.instance_id,
                        "tenant_id": key.tenant_id,
                        "legacy_account_id": key.account_id,
                        "allowed_request_paths": list(key.allowed_request_paths),
                        "default_request_path": key.default_request_path,
                        "pinned_target_key": key.pinned_target_key,
                        "local_only_policy": key.local_only_policy,
                        "review_required_conditions": list(key.review_required_conditions),
                        "last_rotated_at": key.last_rotated_at,
                        "revoked_at": key.revoked_at,
                        "revoked_reason": key.revoked_reason,
                        "created_by": key.created_by,
                    },
                )
            )

        for session_record in state.admin_sessions:
            tenant_id = normalize_tenant_id(
                session_record.tenant_id or session_record.instance_id,
                fallback_tenant_id=self._bootstrap_tenant_id,
            )
            membership_id = session_record.membership_id or self._membership_id_for_user(session_record.user_id, tenant_id)
            if membership_id not in membership_rows:
                created_at = self._required_dt(session_record.created_at)
                principal_rows[session_record.user_id] = GovernancePrincipalORM(
                    principal_id=session_record.user_id,
                    principal_type="admin_user",
                    external_subject=None,
                    username=None,
                    display_name=session_record.user_id,
                    status="disabled",
                    created_at=created_at,
                    updated_at=created_at,
                    attributes={
                        "password_hash": "",
                        "password_salt": "",
                        "must_rotate_password": True,
                        "synthetic_missing_user": True,
                    },
                )
                membership_rows[membership_id] = GovernanceTenantMembershipORM(
                    membership_id=membership_id,
                    tenant_id=tenant_id,
                    principal_id=session_record.user_id,
                    membership_role=session_record.role,
                    status="disabled",
                    created_by_membership_id=None,
                    created_at=created_at,
                    updated_at=created_at,
                    attributes={"synthetic_missing_user": True},
                )
            auth_session_rows.append(
                GovernanceAuthSessionORM(
                    session_id=session_record.session_id,
                    tenant_id=tenant_id,
                    membership_id=membership_id,
                    session_hash=session_record.token_hash,
                    status="revoked" if session_record.revoked_at else "active",
                    issued_at=self._required_dt(session_record.created_at),
                    expires_at=self._required_dt(session_record.expires_at),
                    last_used_at=self._required_dt(session_record.last_used_at),
                    revoked_at=self._dt(session_record.revoked_at),
                    revoked_reason=session_record.revoked_reason,
                    attributes={
                        "role": session_record.role,
                        "session_type": session_record.session_type,
                        "issued_by_user_id": session_record.issued_by_user_id,
                        "approved_by_user_id": session_record.approved_by_user_id,
                        "approval_request_id": session_record.approval_request_id,
                        "approval_reference": session_record.approval_reference,
                        "justification": session_record.justification,
                        "notification_targets": list(session_record.notification_targets),
                        "legacy_user_id": session_record.user_id,
                        "instance_id": session_record.instance_id,
                        "tenant_id": session_record.tenant_id,
                    },
                )
            )

        for event in state.audit_events:
            event_tenant_id = normalize_tenant_id(event.tenant_id, fallback_tenant_id=self._bootstrap_tenant_id)
            self._ensure_tenant_row(
                tenant_rows,
                tenant_id=event_tenant_id,
                display_name=event_tenant_id,
                status="active",
                created_at=self._required_dt(event.created_at),
                updated_at=self._required_dt(event.created_at),
                attributes={"synthetic": True, "source": "audit_event"},
            )
            event_metadata = dict(event.metadata)
            event_metadata.setdefault("instance_id", event.instance_id)
            event_metadata.setdefault("tenant_id", event.tenant_id)
            actor_membership_id = None
            actor_service_account_id = None
            if event.actor_id:
                event_metadata.setdefault("legacy_actor_id", event.actor_id)
            if event.actor_type == "admin_user" and event.actor_id:
                candidate_membership_id = self._membership_id_for_user(event.actor_id)
                actor_membership_id = candidate_membership_id if candidate_membership_id in membership_rows else None
            elif event.actor_type == "runtime_key" and event.actor_id:
                actor_service_account_id = key_service_account_map.get(event.actor_id)
                event_metadata.setdefault("runtime_key_id", event.actor_id)
            request_id = None
            if event_metadata.get("request_id") is not None:
                candidate_request_id = str(event_metadata.get("request_id")).strip()
                request_id = candidate_request_id or None
            audit_event_rows.append(
                GovernanceAuditEventORM(
                    event_id=event.event_id,
                    tenant_id=event_tenant_id,
                    actor_membership_id=actor_membership_id,
                    actor_service_account_id=actor_service_account_id,
                    actor_type=event.actor_type,
                    action=event.action,
                    target_type=event.target_type,
                    target_id=event.target_id,
                    request_id=request_id,
                    company_id=event.company_id,
                    status=event.status,
                    details=event.details,
                    event_metadata=event_metadata,
                    created_at=self._required_dt(event.created_at),
                )
            )

        if delete_missing_audit_events:
            audit_rows_to_sync = audit_event_rows
        else:
            audit_rows_to_sync_map = {
                row.event_id: self._clone_relational_audit_row(row)
                for row in session.scalars(select(GovernanceAuditEventORM)).all()
            }
            for row in audit_event_rows:
                # Under the phase-23 default posture, relational audit rows are already the
                # PostgreSQL read truth. A stale JSON shadow may fill gaps, but it must not
                # overwrite an existing relational row for the same event_id during load.
                audit_rows_to_sync_map.setdefault(row.event_id, row)
            audit_rows_to_sync = list(audit_rows_to_sync_map.values())

        for model in (
            GovernanceAuditEventORM,
            GovernanceScopeGrantORM,
            GovernanceAgentCredentialORM,
            GovernanceAuthSessionORM,
            GovernanceServiceAccountORM,
            GovernanceTenantMembershipORM,
            GovernancePrincipalORM,
            GovernanceTenantORM,
        ):
            session.execute(delete(model))

        session.add_all(tenant_rows.values())
        session.flush()
        session.add_all(principal_rows.values())
        session.flush()
        session.add_all(membership_rows.values())
        session.flush()
        session.add_all(service_account_rows.values())
        session.flush()
        session.add_all(credential_rows)
        session.add_all(auth_session_rows)
        self._sync_relational_audit_events(
            session,
            audit_rows_to_sync,
            delete_missing=False,
        )

    @staticmethod
    def _merge_relational_audit_row(existing: GovernanceAuditEventORM, incoming: GovernanceAuditEventORM) -> None:
        existing.tenant_id = incoming.tenant_id
        existing.actor_membership_id = incoming.actor_membership_id
        existing.actor_service_account_id = incoming.actor_service_account_id
        existing.actor_type = incoming.actor_type
        existing.action = incoming.action
        existing.target_type = incoming.target_type
        existing.target_id = incoming.target_id
        existing.request_id = incoming.request_id
        existing.company_id = incoming.company_id
        existing.status = incoming.status
        existing.details = incoming.details
        existing.event_metadata = incoming.event_metadata
        existing.created_at = incoming.created_at

    @staticmethod
    def _clone_relational_audit_row(row: GovernanceAuditEventORM) -> GovernanceAuditEventORM:
        return GovernanceAuditEventORM(
            event_id=row.event_id,
            tenant_id=row.tenant_id,
            actor_membership_id=row.actor_membership_id,
            actor_service_account_id=row.actor_service_account_id,
            actor_type=row.actor_type,
            action=row.action,
            target_type=row.target_type,
            target_id=row.target_id,
            request_id=row.request_id,
            company_id=row.company_id,
            status=row.status,
            details=row.details,
            event_metadata=dict(row.event_metadata or {}),
            created_at=row.created_at,
        )

    def _sync_relational_audit_events(
        self,
        session: Session,
        audit_event_rows: list[GovernanceAuditEventORM],
        *,
        delete_missing: bool,
    ) -> None:
        if not audit_event_rows:
            return

        existing_rows = {
            row.event_id: row
            for row in session.scalars(select(GovernanceAuditEventORM)).all()
        }
        desired_ids = {row.event_id for row in audit_event_rows}

        if delete_missing:
            stale_ids = [event_id for event_id in existing_rows if event_id not in desired_ids]
            if stale_ids:
                session.execute(
                    delete(GovernanceAuditEventORM).where(GovernanceAuditEventORM.event_id.in_(stale_ids))
                )

        for row in audit_event_rows:
            existing = existing_rows.get(row.event_id)
            if existing is None:
                session.add(row)
                continue
            self._merge_relational_audit_row(existing, row)

    def _load_relational_audit_events(
        self,
        session: Session,
        *,
        membership_by_id: dict[str, GovernanceTenantMembershipORM],
    ) -> list[AuditEventRecord]:
        audit_rows = session.scalars(
            select(GovernanceAuditEventORM).order_by(
                GovernanceAuditEventORM.created_at.asc(),
                GovernanceAuditEventORM.event_id.asc(),
            )
        ).all()
        audit_events: list[AuditEventRecord] = []
        for row in audit_rows:
            metadata = dict(row.event_metadata or {})
            actor_id = None
            if row.actor_type == "admin_user":
                if row.actor_membership_id:
                    membership = membership_by_id.get(row.actor_membership_id)
                    actor_id = membership.principal_id if membership is not None else None
                if actor_id is None:
                    actor_id = metadata.get("legacy_actor_id")
            elif row.actor_type == "runtime_key":
                actor_id = metadata.get("runtime_key_id") or metadata.get("legacy_actor_id")
            else:
                actor_id = metadata.get("legacy_actor_id")
            audit_events.append(
                AuditEventRecord(
                    event_id=row.event_id,
                    actor_type=row.actor_type,  # type: ignore[arg-type]
                    actor_id=actor_id,
                    instance_id=str(
                        metadata.get("instance_id")
                        or metadata.get("tenant_id")
                        or row.tenant_id
                        or self._bootstrap_tenant_id
                    ),
                    tenant_id=row.tenant_id or self._bootstrap_tenant_id,
                    company_id=row.company_id,
                    action=row.action,
                    target_type=row.target_type,
                    target_id=row.target_id,
                    status=row.status,  # type: ignore[arg-type]
                    details=row.details,
                    metadata=metadata,
                    created_at=row.created_at.isoformat(),
                )
            )
        return audit_events

    def _state_with_relational_audit_events(
        self,
        session: Session,
        state: GovernanceStateRecord,
    ) -> GovernanceStateRecord:
        membership_rows = session.scalars(select(GovernanceTenantMembershipORM)).all()
        membership_by_id = {row.membership_id: row for row in membership_rows}
        audit_events = self._load_relational_audit_events(
            session,
            membership_by_id=membership_by_id,
        )
        if not audit_events:
            return state
        updated_state = state.model_copy(deep=True)
        updated_state.audit_events = audit_events
        return updated_state

    def _load_relational_state(self, session: Session, legacy_state: GovernanceStateRecord) -> GovernanceStateRecord:
        state = legacy_state.model_copy(deep=True)

        principal_rows = session.scalars(
            select(GovernancePrincipalORM).order_by(
                GovernancePrincipalORM.created_at.asc(),
                GovernancePrincipalORM.principal_id.asc(),
            )
        ).all()
        membership_rows = session.scalars(
            select(GovernanceTenantMembershipORM).order_by(
                GovernanceTenantMembershipORM.created_at.asc(),
                GovernanceTenantMembershipORM.membership_id.asc(),
            )
        ).all()
        membership_by_id = {row.membership_id: row for row in membership_rows}
        memberships_by_principal: dict[str, list[GovernanceTenantMembershipORM]] = {}
        for membership in membership_rows:
            memberships_by_principal.setdefault(membership.principal_id, []).append(membership)

        admin_memberships: list[AdminInstanceMembershipRecord] = []
        for membership in membership_rows:
            principal = next((item for item in principal_rows if item.principal_id == membership.principal_id), None)
            if principal is None or principal.principal_type != "admin_user":
                continue
            attrs = dict(membership.attributes or {})
            admin_memberships.append(
                AdminInstanceMembershipRecord(
                    membership_id=membership.membership_id,
                    user_id=membership.principal_id,
                    instance_id=str(attrs.get("instance_id") or membership.tenant_id or self._bootstrap_tenant_id),
                    tenant_id=str(membership.tenant_id or self._bootstrap_tenant_id),
                    company_id=str(attrs.get("company_id") or attrs.get("instance_id") or membership.tenant_id or self._bootstrap_tenant_id),
                    role=membership.membership_role,  # type: ignore[arg-type]
                    status=membership.status,  # type: ignore[arg-type]
                    created_at=membership.created_at.isoformat(),
                    updated_at=membership.updated_at.isoformat(),
                    created_by=attrs.get("created_by"),
                )
            )
        state.instance_memberships = admin_memberships

        admin_users: list[AdminUserRecord] = []
        for principal in principal_rows:
            if principal.principal_type != "admin_user":
                continue
            principal_memberships = memberships_by_principal.get(principal.principal_id, [])
            if not principal_memberships:
                continue
            membership = max(
                principal_memberships,
                key=lambda item: _ADMIN_ROLE_RANK.get(item.membership_role, -1),
            )
            attrs = dict(principal.attributes or {})
            admin_users.append(
                AdminUserRecord(
                    user_id=principal.principal_id,
                    username=principal.username or principal.principal_id,
                    display_name=principal.display_name,
                    role=membership.membership_role,  # type: ignore[arg-type]
                    status=principal.status,  # type: ignore[arg-type]
                    password_hash=str(attrs.get("password_hash", "")),
                    password_salt=str(attrs.get("password_salt", "")),
                    must_rotate_password=bool(attrs.get("must_rotate_password", True)),
                    created_at=principal.created_at.isoformat(),
                    updated_at=principal.updated_at.isoformat(),
                    last_login_at=attrs.get("last_login_at"),
                    created_by=attrs.get("created_by"),
                )
            )
        state.admin_users = admin_users

        auth_session_rows = session.scalars(
            select(GovernanceAuthSessionORM).order_by(
                GovernanceAuthSessionORM.issued_at.asc(),
                GovernanceAuthSessionORM.session_id.asc(),
            )
        ).all()
        admin_sessions: list[AdminSessionRecord] = []
        for session_row in auth_session_rows:
            membership = membership_by_id.get(session_row.membership_id)
            attrs = dict(session_row.attributes or {})
            role = attrs.get("role") or (membership.membership_role if membership is not None else "viewer")
            user_id = membership.principal_id if membership is not None else str(attrs.get("legacy_user_id", ""))
            admin_sessions.append(
                AdminSessionRecord(
                    session_id=session_row.session_id,
                    user_id=user_id,
                    token_hash=session_row.session_hash,
                    role=role,  # type: ignore[arg-type]
                    membership_id=session_row.membership_id,
                    instance_id=str(
                        attrs.get("instance_id")
                        or (membership.tenant_id if membership is not None else None)
                        or self._bootstrap_tenant_id
                    ),
                    tenant_id=str(
                        attrs.get("tenant_id")
                        or (membership.tenant_id if membership is not None else None)
                        or self._bootstrap_tenant_id
                    ),
                    session_type=attrs.get("session_type", "standard"),  # type: ignore[arg-type]
                    created_at=session_row.issued_at.isoformat(),
                    expires_at=session_row.expires_at.isoformat(),
                    last_used_at=session_row.last_used_at.isoformat(),
                    issued_by_user_id=attrs.get("issued_by_user_id"),
                    approved_by_user_id=attrs.get("approved_by_user_id"),
                    approval_request_id=attrs.get("approval_request_id"),
                    approval_reference=attrs.get("approval_reference"),
                    justification=attrs.get("justification"),
                    notification_targets=list(attrs.get("notification_targets", [])),
                    revoked_at=self._iso(session_row.revoked_at),
                    revoked_reason=session_row.revoked_reason,
                )
            )
        state.admin_sessions = admin_sessions

        service_account_rows = session.scalars(
            select(GovernanceServiceAccountORM).order_by(
                GovernanceServiceAccountORM.created_at.asc(),
                GovernanceServiceAccountORM.service_account_id.asc(),
            )
        ).all()
        gateway_accounts: list[GatewayAccountRecord] = []
        for row in service_account_rows:
            attrs = dict(row.attributes or {})
            if attrs.get("synthetic"):
                continue
            gateway_accounts.append(
                GatewayAccountRecord(
                    account_id=str(attrs.get("legacy_account_id") or row.service_account_id),
                    instance_id=str(attrs.get("instance_id") or attrs.get("tenant_id") or row.tenant_id or self._bootstrap_tenant_id),
                    tenant_id=str(attrs.get("tenant_id") or row.tenant_id or self._bootstrap_tenant_id),
                    label=row.display_name,
                    status=row.status,  # type: ignore[arg-type]
                    provider_bindings=list(attrs.get("provider_bindings", [])),
                    notes=str(attrs.get("notes", "")),
                    created_at=row.created_at.isoformat(),
                    updated_at=row.updated_at.isoformat(),
                    last_activity_at=self._iso(row.last_used_at),
                )
            )
        state.gateway_accounts = gateway_accounts

        credential_rows = session.scalars(
            select(GovernanceAgentCredentialORM).order_by(
                GovernanceAgentCredentialORM.created_at.desc(),
                GovernanceAgentCredentialORM.credential_id.asc(),
            )
        ).all()
        runtime_keys: list[RuntimeKeyRecord] = []
        for row in credential_rows:
            if row.credential_kind != "runtime_api_key":
                continue
            attrs = dict(row.attributes or {})
            runtime_keys.append(
                RuntimeKeyRecord(
                    key_id=row.credential_id,
                    instance_id=str(attrs.get("instance_id") or attrs.get("tenant_id") or row.tenant_id or self._bootstrap_tenant_id),
                    tenant_id=str(attrs.get("tenant_id") or row.tenant_id or self._bootstrap_tenant_id),
                    account_id=attrs.get("legacy_account_id"),
                    label=str(attrs.get("label", row.credential_id)),
                    prefix=row.secret_prefix or "",
                    secret_hash=row.secret_hash,
                    scopes=list(attrs.get("scopes", [])),
                    status=row.status,  # type: ignore[arg-type]
                    created_at=row.created_at.isoformat(),
                    updated_at=row.updated_at.isoformat(),
                    expires_at=self._iso(row.expires_at),
                    last_used_at=self._iso(row.last_used_at),
                    allowed_request_paths=list(attrs.get("allowed_request_paths", ["smart_routing"])),
                    default_request_path=str(attrs.get("default_request_path", "smart_routing")),
                    pinned_target_key=attrs.get("pinned_target_key"),
                    local_only_policy=str(attrs.get("local_only_policy", "require_local_target")),
                    review_required_conditions=list(attrs.get("review_required_conditions", [])),
                    last_rotated_at=attrs.get("last_rotated_at"),
                    rotated_from=row.rotated_from_credential_id,
                    revoked_at=attrs.get("revoked_at"),
                    revoked_reason=attrs.get("revoked_reason"),
                    created_by=attrs.get("created_by"),
                )
            )
        state.runtime_keys = runtime_keys

        state.audit_events = self._load_relational_audit_events(
            session,
            membership_by_id=membership_by_id,
        )

        return state

    @staticmethod
    def _has_relational_shadow_data(state: GovernanceStateRecord) -> bool:
        return any(
            [
                bool(state.admin_users),
                bool(state.instance_memberships),
                bool(state.admin_sessions),
                bool(state.gateway_accounts),
                bool(state.runtime_keys),
                bool(state.audit_events),
            ]
        )

    def load_state(self) -> GovernanceStateRecord:
        with self._session() as session:
            legacy_state, legacy_changed = self._load_legacy_state(session)
            if self._relational_reads_enabled:
                relational_state = self._load_relational_state(session, legacy_state)
                if self._has_relational_shadow_data(relational_state):
                    if legacy_changed:
                        session.commit()
                    return relational_state
            if self._should_sync_relational_shadow():
                self._replace_relational_shadow(
                    session,
                    legacy_state,
                    delete_missing_audit_events=False,
                )
            if legacy_changed or self._should_sync_relational_shadow():
                session.commit()
            audit_hydrated_state = self._state_with_relational_audit_events(session, legacy_state)
            if self._relational_reads_enabled:
                return self._load_relational_state(session, audit_hydrated_state)
            return audit_hydrated_state

    def save_state(self, state: GovernanceStateRecord) -> GovernanceStateRecord:
        with self._session() as session:
            normalized = self._save_legacy_state(session, state)
            if self._should_sync_relational_shadow():
                self._replace_relational_shadow(
                    session,
                    normalized,
                    delete_missing_audit_events=True,
                )
            session.commit()
            normalized = self._state_with_relational_audit_events(session, normalized)
            if self._relational_reads_enabled:
                return self._load_relational_state(session, normalized)
            return normalized


def get_governance_repository(settings: Settings) -> GovernanceRepository:
    if settings.governance_storage_backend == "postgresql":
        database_url = settings.governance_postgres_url.strip() or settings.harness_postgres_url
        return PostgresGovernanceRepository(
            database_url,
            bootstrap_tenant_id=settings.bootstrap_tenant_id,
            relational_dual_write_enabled=settings.governance_relational_dual_write_enabled,
            relational_reads_enabled=settings.governance_relational_reads_enabled,
        )
    return FileGovernanceRepository(paths=GovernanceStatePaths(state_path=Path(settings.governance_state_path)))
