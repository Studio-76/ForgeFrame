"""Governance service for auth, accounts, keys, settings and audit."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any
from uuid import uuid4

from app.approvals.models import APPROVAL_STATUSES, build_elevated_access_approval_id
from app.auth.oauth.openai import resolve_codex_auth_state
from app.auth.local_auth import (
    hash_password,
    hash_token,
    issue_runtime_key_token,
    issue_session_token,
    new_secret_salt,
    role_allows,
    verify_password,
)
from app.governance.errors import (
    GovernanceConflictError,
    GovernanceEligibilityError,
    GovernanceNotFoundError,
    RuntimeAuthorizationError,
)
from app.harness.service import HarnessService, get_harness_service
from app.governance.models import (
    AdminLoginResult,
    AdminLoginFailureRecord,
    AdminInstanceMembershipRecord,
    AdminSessionRecord,
    AdminUserRecord,
    AuditEventRecord,
    AuthenticatedAdmin,
    ElevatedAccessRequestRecord,
    GatewayAccountRecord,
    GovernanceStateRecord,
    IssuedApiKey,
    MutableSettingRecord,
    SecretRotationEventRecord,
    RuntimeGatewayIdentity,
    RuntimeRequestPathDecision,
    RuntimeKeyRecord,
)
from app.settings.config import Settings, get_settings
from app.storage.governance_repository import GovernanceRepository, get_governance_repository
from app.tenancy import TenantFilterRequiredError, effective_tenant_filter, normalize_tenant_id

_INSECURE_BOOTSTRAP_ADMIN_PASSWORDS = (
    "",
    "forgegate-admin",
    "forgeframe-admin",
    "replace-with-a-strong-password",
    "replace-with-a-generated-bootstrap-password",
)
_ELEVATED_SESSION_TYPES = {"impersonation", "break_glass"}
_ELEVATED_ACCESS_ACTIVE_SESSION_CONFLICT_MESSAGE = (
    "An elevated session is already active for this subject. Review the active session before creating a new request."
)
_ELEVATED_ACCESS_RECOVERY_LABEL = "Recovery required"
_ELEVATED_ACCESS_RECOVERY_MESSAGE = (
    "No eligible admin approver is available in this environment. Elevated access requires approval "
    "from a different admin. Add or restore a second admin, or use the documented recovery procedure "
    "before requesting access."
)
_ELEVATED_ACCESS_RECOVERY_SECONDARY_MESSAGE = (
    "ForgeFrame will not create a pending approval item or issue elevated access while no eligible "
    "approver exists."
)
_ELEVATED_ACCESS_APPROVAL_AVAILABLE_LABEL = "Approval available"
_ELEVATED_ACCESS_APPROVAL_AVAILABLE_MESSAGE = (
    "A different admin can review elevated-access requests in this environment."
)
_ELEVATED_ACCESS_APPROVAL_AVAILABLE_SECONDARY_MESSAGE = (
    "ForgeFrame keeps elevated-access requests pending until a different admin approves them."
)
_INSTANCE_PERMISSION_KEYS_BY_ROLE: dict[str, frozenset[str]] = {
    "owner": frozenset(
        {
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
        }
    ),
    "admin": frozenset(
        {
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
        }
    ),
    "operator": frozenset(
        {
            "instance.read",
            "providers.read",
            "provider_targets.read",
            "routing.read",
            "approvals.read",
            "execution.read",
            "execution.operate",
            "security.read",
            "audit.read",
            "settings.read",
        }
    ),
    "viewer": frozenset({"instance.read", "audit.read", "settings.read"}),
}
_ADMIN_ROLE_RANK = {"viewer": 0, "operator": 1, "admin": 2, "owner": 3}
_RUNTIME_REQUEST_PATHS = {
    "smart_routing",
    "pinned_target",
    "local_only",
    "queue_background",
    "blocked",
    "review_required",
}


class GovernanceService:
    def __init__(
        self,
        settings: Settings,
        repository: GovernanceRepository | None = None,
        harness_service: HarnessService | None = None,
    ):
        self._settings = settings
        self._repository = repository or get_governance_repository(settings)
        self._harness = harness_service or get_harness_service()
        self._state = self._repository.load_state()
        if self._backfill_audit_event_scope():
            self._state = self._repository.save_state(self._state)
        self._prune_expired_sessions()
        self._prune_expired_elevated_access_requests()
        self._ensure_bootstrap_admin()
        if self._ensure_admin_memberships():
            self._persist()

    @staticmethod
    def _now() -> datetime:
        return datetime.now(tz=UTC)

    def _now_iso(self) -> str:
        return self._now().isoformat()

    def _persist(self) -> GovernanceStateRecord:
        self._state = self._repository.save_state(self._state)
        return self._state

    def _session_is_active(self, session: AdminSessionRecord) -> bool:
        return session.revoked_at is None and datetime.fromisoformat(session.expires_at) > self._now()

    @staticmethod
    def _normalize_notification_targets(targets: list[str]) -> list[str]:
        normalized = [item.strip() for item in targets if item.strip()]
        return sorted(dict.fromkeys(normalized))

    @property
    def _elevated_access_approval_ttl_minutes(self) -> int:
        return max(
            5,
            min(
                self._settings.impersonation_session_max_minutes,
                self._settings.break_glass_session_max_minutes,
            ),
        )

    @staticmethod
    def _request_action_prefix(request_type: str) -> str:
        return "admin_impersonation" if request_type == "impersonation" else "admin_break_glass"

    @staticmethod
    def _request_target_label(record: ElevatedAccessRequestRecord, user: AdminUserRecord | None) -> str:
        if user is None:
            return record.target_user_id
        return user.username

    def _eligible_elevated_access_approvers(
        self,
        *,
        requested_by_user_id: str | None,
    ) -> list[AdminUserRecord]:
        return [
            user
            for user in self._state.admin_users
            if role_allows(user.role, "admin")
            and user.status == "active"
            and user.user_id != requested_by_user_id
        ]

    def _elevated_access_approver_posture(
        self,
        *,
        requested_by_user_id: str | None,
    ) -> dict[str, object]:
        eligible_approvers = self._eligible_elevated_access_approvers(
            requested_by_user_id=requested_by_user_id,
        )
        recovery_required = len(eligible_approvers) == 0
        return {
            "state": "recovery_required" if recovery_required else "approval_available",
            "label": (
                _ELEVATED_ACCESS_RECOVERY_LABEL
                if recovery_required
                else _ELEVATED_ACCESS_APPROVAL_AVAILABLE_LABEL
            ),
            "approval_requires_distinct_admin": True,
            "eligible_admin_approver_count": len(eligible_approvers),
            "blocked_reason": "no_eligible_second_admin" if recovery_required else None,
            "primary_message": (
                _ELEVATED_ACCESS_RECOVERY_MESSAGE
                if recovery_required
                else _ELEVATED_ACCESS_APPROVAL_AVAILABLE_MESSAGE
            ),
            "secondary_message": (
                _ELEVATED_ACCESS_RECOVERY_SECONDARY_MESSAGE
                if recovery_required
                else _ELEVATED_ACCESS_APPROVAL_AVAILABLE_SECONDARY_MESSAGE
            ),
        }

    def elevated_access_approver_posture(
        self,
        *,
        actor: AuthenticatedAdmin | None = None,
    ) -> dict[str, object]:
        return self._elevated_access_approver_posture(
            requested_by_user_id=actor.user_id if actor is not None else None,
        )

    def _raise_recovery_required_for_elevated_access(
        self,
        *,
        request_type: str,
        actor: AuthenticatedAdmin,
        target_user: AdminUserRecord,
    ) -> None:
        posture = self._elevated_access_approver_posture(requested_by_user_id=actor.user_id)
        if posture["state"] != "recovery_required":
            return
        action_prefix = self._request_action_prefix(request_type)
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action=f"{action_prefix}_recovery_required",
            target_type="admin_user",
            target_id=target_user.user_id,
            status="warning",
            details=(
                f"{request_type.replace('_', '-').title()} request for '{target_user.username}' blocked because "
                "no eligible admin approver is available."
            ),
            metadata={
                "request_type": request_type,
                "target_user_id": target_user.user_id,
                "target_role": target_user.role,
                "blocked_reason": posture["blocked_reason"],
                "eligible_admin_approver_count": posture["eligible_admin_approver_count"],
            },
        )
        self._persist()
        raise GovernanceEligibilityError(
            str(posture["primary_message"]),
            details={
                **posture,
                "request_type": request_type,
                "target_user_id": target_user.user_id,
                "target_role": target_user.role,
            },
        )

    def _active_elevated_session_matches_user(
        self,
        session: AdminSessionRecord,
        user_id: str,
    ) -> bool:
        if session.user_id == user_id:
            return True
        if session.session_type != "impersonation":
            return False
        # Impersonation sessions are stored under the target user_id, but the
        # original requester must also be treated as an active elevated subject.
        # Prefer the linked approval request when available and keep
        # issued_by_user_id as a fallback for older records.
        if session.approval_request_id is not None:
            request = self._find_elevated_access_request(session.approval_request_id)
            if request is not None and request.requested_by_user_id == user_id:
                return True
        return session.issued_by_user_id == user_id

    def _find_active_elevated_session_for_user(self, user_id: str) -> AdminSessionRecord | None:
        return next(
            (
                session
                for session in self._state.admin_sessions
                if self._active_elevated_session_matches_user(session, user_id)
                and session.session_type in _ELEVATED_SESSION_TYPES
                and self._session_is_active(session)
            ),
            None,
        )

    def _find_active_elevated_session_conflict(self, *user_ids: str) -> tuple[str, AdminSessionRecord] | None:
        checked_user_ids: set[str] = set()
        for user_id in user_ids:
            if user_id in checked_user_ids:
                continue
            checked_user_ids.add(user_id)
            session = self._find_active_elevated_session_for_user(user_id)
            if session is not None:
                return user_id, session
        return None

    def _ensure_no_active_elevated_session_conflicts(self, *user_ids: str) -> None:
        if self._find_active_elevated_session_conflict(*user_ids) is not None:
            raise GovernanceConflictError(_ELEVATED_ACCESS_ACTIVE_SESSION_CONFLICT_MESSAGE)

    def _ensure_no_active_elevated_session_conflict(self, user_id: str) -> None:
        self._ensure_no_active_elevated_session_conflicts(user_id)

    def get_elevated_access_request_conflict_state(self, *, request_id: str) -> dict[str, object]:
        self._prune_expired_elevated_access_requests()
        record = self._find_elevated_access_request(request_id)
        if record is None:
            raise GovernanceNotFoundError("elevated_access_request_not_found")
        if record.gate_status != "open":
            return {
                "has_conflict": False,
                "blocked_reason": None,
                "message": None,
                "subject_user_id": None,
                "session_id": None,
                "session_type": None,
                "session_expires_at": None,
            }
        conflict = self._find_active_elevated_session_conflict(
            record.requested_by_user_id,
            record.target_user_id,
        )
        if conflict is None:
            return {
                "has_conflict": False,
                "blocked_reason": None,
                "message": None,
                "subject_user_id": None,
                "session_id": None,
                "session_type": None,
                "session_expires_at": None,
            }
        subject_user_id, session = conflict
        return {
            "has_conflict": True,
            "blocked_reason": "elevated_access_active_session_conflict",
            "message": _ELEVATED_ACCESS_ACTIVE_SESSION_CONFLICT_MESSAGE,
            "subject_user_id": subject_user_id,
            "session_id": session.session_id,
            "session_type": session.session_type,
            "session_expires_at": session.expires_at,
        }

    @staticmethod
    def _normalize_scope_value(value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    @staticmethod
    def _normalize_runtime_request_paths(values: list[object] | None) -> list[str]:
        if not values:
            return ["smart_routing"]
        normalized: list[str] = []
        for value in values:
            candidate = str(value).strip().lower()
            if not candidate:
                continue
            if candidate not in _RUNTIME_REQUEST_PATHS:
                raise ValueError(f"Unsupported runtime request path '{candidate}'.")
            if candidate not in normalized:
                normalized.append(candidate)
        return normalized or ["smart_routing"]

    @classmethod
    def _normalize_runtime_request_policy(
        cls,
        *,
        allowed_request_paths: list[object] | None,
        default_request_path: object | None,
        pinned_target_key: object | None,
        local_only_policy: object | None,
        review_required_conditions: list[object] | None,
    ) -> dict[str, object]:
        allowed = cls._normalize_runtime_request_paths(allowed_request_paths)
        requested_default = str(default_request_path or "").strip().lower() or "smart_routing"
        if requested_default not in _RUNTIME_REQUEST_PATHS:
            raise ValueError(f"Unsupported default runtime request path '{requested_default}'.")
        if requested_default not in allowed:
            allowed = [requested_default, *allowed]

        normalized_pinned_target = cls._normalize_scope_value(pinned_target_key)
        normalized_local_only = str(local_only_policy or "").strip().lower() or "require_local_target"
        if normalized_local_only not in {"prefer_local", "require_local_target"}:
            raise ValueError(f"Unsupported local_only policy '{normalized_local_only}'.")
        normalized_review_conditions = [
            condition
            for condition in (
                cls._normalize_scope_value(item)
                for item in (review_required_conditions or [])
            )
            if condition is not None
        ]
        return {
            "allowed_request_paths": allowed,
            "default_request_path": requested_default,
            "pinned_target_key": normalized_pinned_target,
            "local_only_policy": normalized_local_only,
            "review_required_conditions": normalized_review_conditions,
        }

    @staticmethod
    def _role_rank(role: str) -> int:
        return _ADMIN_ROLE_RANK.get(role, -1)

    def _default_instance_id(self) -> str:
        return normalize_tenant_id(
            self._settings.bootstrap_tenant_id,
            fallback_tenant_id=self._settings.bootstrap_tenant_id,
        )

    def _default_tenant_scope(self) -> str:
        return normalize_tenant_id(
            self._settings.bootstrap_tenant_id,
            fallback_tenant_id=self._default_instance_id(),
        )

    def _default_company_scope(self) -> str:
        return self._default_instance_id()

    def _membership_id(self, user_id: str, tenant_id: str | None = None) -> str:
        normalized_tenant = normalize_tenant_id(
            tenant_id,
            fallback_tenant_id=self._default_tenant_scope(),
        )
        return f"membership_{normalized_tenant}_{user_id}"

    def _permission_keys_for_role(self, role: str) -> set[str]:
        return set(_INSTANCE_PERMISSION_KEYS_BY_ROLE.get(role, frozenset()))

    def _known_instance_scopes(self) -> list[tuple[str, str, str]]:
        scopes: dict[str, tuple[str, str, str]] = {
            self._default_instance_id(): (
                self._default_instance_id(),
                self._default_tenant_scope(),
                self._default_company_scope(),
            )
        }
        try:
            from app.instances.service import get_instance_service

            for instance in get_instance_service().list_instances():
                normalized_instance_id = self._normalize_instance_scope(instance.instance_id)
                scopes[normalized_instance_id] = (
                    normalized_instance_id,
                    normalize_tenant_id(
                        instance.tenant_id,
                        fallback_tenant_id=normalized_instance_id,
                    ),
                    self._normalize_scope_value(instance.company_id) or normalized_instance_id,
                )
        except Exception:
            return list(scopes.values())
        return list(scopes.values())

    def _upsert_admin_membership(
        self,
        user: AdminUserRecord,
        *,
        instance_id: str,
        tenant_id: str,
        company_id: str,
        role: str | None = None,
        status: str | None = None,
        created_by: str | None = None,
    ) -> bool:
        normalized_instance_id = self._normalize_instance_scope(instance_id)
        normalized_tenant_id = normalize_tenant_id(
            tenant_id,
            fallback_tenant_id=normalized_instance_id,
        )
        normalized_company_id = self._normalize_scope_value(company_id) or normalized_instance_id
        now = self._now_iso()
        membership_id = self._membership_id(user.user_id, normalized_tenant_id)
        membership_role = role or user.role
        membership_status = status or user.status

        for index, membership in enumerate(self._state.instance_memberships):
            if membership.user_id != user.user_id:
                continue
            if not self._membership_matches_instance(
                membership,
                instance_id=normalized_instance_id,
                tenant_id=normalized_tenant_id,
            ):
                continue
            updated = membership.model_copy(
                update={
                    "membership_id": membership_id,
                    "instance_id": normalized_instance_id,
                    "tenant_id": normalized_tenant_id,
                    "company_id": normalized_company_id,
                    "role": membership_role,
                    "status": membership_status,
                    "updated_at": user.updated_at or now,
                    "created_by": membership.created_by or created_by or user.created_by,
                }
            )
            if updated != membership:
                self._state.instance_memberships[index] = updated
                return True
            return False

        created_at = user.created_at or now
        self._state.instance_memberships.append(
            AdminInstanceMembershipRecord(
                membership_id=membership_id,
                user_id=user.user_id,
                instance_id=normalized_instance_id,
                tenant_id=normalized_tenant_id,
                company_id=normalized_company_id,
                role=membership_role,  # type: ignore[arg-type]
                status=membership_status,  # type: ignore[arg-type]
                created_at=created_at,
                updated_at=user.updated_at or now,
                created_by=created_by or user.created_by,
            )
        )
        return True

    def _all_instance_memberships_for_user(self, user_id: str) -> list[AdminInstanceMembershipRecord]:
        return [
            membership
            for membership in self._state.instance_memberships
            if membership.user_id == user_id
        ]

    def _instance_memberships_for_user(self, user_id: str) -> list[AdminInstanceMembershipRecord]:
        return [
            membership
            for membership in self._all_instance_memberships_for_user(user_id)
            if membership.user_id == user_id and membership.status == "active"
        ]

    def _membership_matches_instance(
        self,
        membership: AdminInstanceMembershipRecord,
        *,
        instance_id: str | None,
        tenant_id: str | None,
    ) -> bool:
        membership_instance_id = self._normalize_instance_scope(membership.instance_id)
        membership_tenant_id = normalize_tenant_id(
            membership.tenant_id,
            fallback_tenant_id=self._default_tenant_scope(),
        )
        return membership_instance_id == self._normalize_instance_scope(instance_id) or membership_tenant_id == normalize_tenant_id(
            tenant_id,
            fallback_tenant_id=self._default_tenant_scope(),
        )

    def _primary_membership_for_user(self, user_id: str) -> AdminInstanceMembershipRecord | None:
        memberships = sorted(
            self._instance_memberships_for_user(user_id),
            key=lambda item: (self._role_rank(item.role), item.created_at),
            reverse=True,
        )
        return memberships[0] if memberships else None

    def _sync_user_role_from_memberships(self, user: AdminUserRecord) -> None:
        memberships = self._instance_memberships_for_user(user.user_id)
        if not memberships:
            return
        highest_role = max(memberships, key=lambda item: self._role_rank(item.role)).role
        if user.role != highest_role:
            user.role = highest_role

    def _sync_memberships_from_user_defaults(self, user: AdminUserRecord) -> bool:
        changed = False
        role_rank = self._role_rank(user.role)
        for index, membership in enumerate(self._all_instance_memberships_for_user(user.user_id)):
            updates: dict[str, object] = {}
            if membership.status != user.status:
                updates["status"] = user.status
            if self._role_rank(membership.role) > role_rank:
                updates["role"] = user.role
            if not updates:
                continue
            updates["updated_at"] = user.updated_at or self._now_iso()
            self._state.instance_memberships[index] = membership.model_copy(update=updates)
            changed = True
        return changed

    def _ensure_admin_memberships(self) -> bool:
        changed = False
        for user in self._state.admin_users:
            if not self._all_instance_memberships_for_user(user.user_id):
                if self._upsert_admin_membership(
                    user,
                    instance_id=self._default_instance_id(),
                    tenant_id=self._default_tenant_scope(),
                    company_id=self._default_company_scope(),
                    role=user.role,
                    status=user.status,
                    created_by=user.created_by,
                ):
                    changed = True
            if self._sync_memberships_from_user_defaults(user):
                changed = True
            self._sync_user_role_from_memberships(user)
        return changed

    def _effective_session_membership_role(
        self,
        session: AdminSessionRecord,
        membership: AdminInstanceMembershipRecord,
    ) -> str:
        if (
            session.membership_id == membership.membership_id
            and self._role_rank(session.role) > self._role_rank(membership.role)
        ):
            return session.role
        return membership.role

    def _effective_actor_membership_role(
        self,
        actor: AuthenticatedAdmin,
        membership: AdminInstanceMembershipRecord,
    ) -> str:
        if (
            actor.membership_id == membership.membership_id
            and self._role_rank(actor.role) > self._role_rank(membership.role)
        ):
            return actor.role
        return membership.role

    def _memberships_for_instance_scope(
        self,
        user_id: str,
        *,
        instance_id: str | None,
        tenant_id: str | None,
    ) -> list[AdminInstanceMembershipRecord]:
        return [
            membership
            for membership in self._instance_memberships_for_user(user_id)
            if self._membership_matches_instance(
                membership,
                instance_id=instance_id,
                tenant_id=tenant_id,
            )
        ]

    def _normalize_instance_scope(self, instance_id: str | None) -> str:
        return normalize_tenant_id(
            instance_id,
            fallback_tenant_id=self._default_instance_id(),
        )

    def _tenant_scope_for_instance(self, instance_id: str | None) -> str:
        normalized_instance_id = self._normalize_scope_value(instance_id)
        if normalized_instance_id is None:
            return self._default_tenant_scope()

        for account in self._state.gateway_accounts:
            if self._normalize_instance_scope(account.instance_id) == normalized_instance_id:
                return normalize_tenant_id(
                    account.tenant_id,
                    fallback_tenant_id=self._default_tenant_scope(),
                )

        for key in self._state.runtime_keys:
            if self._normalize_instance_scope(key.instance_id) == normalized_instance_id:
                return normalize_tenant_id(
                    key.tenant_id,
                    fallback_tenant_id=self._default_tenant_scope(),
                )

        return normalize_tenant_id(
            normalized_instance_id,
            fallback_tenant_id=self._default_tenant_scope(),
        )

    def _tenant_scope_for_account(self, account_id: str | None) -> str:
        account = self._find_account_by_id(account_id)
        if account is not None:
            return normalize_tenant_id(
                account.tenant_id,
                fallback_tenant_id=self._default_tenant_scope(),
            )
        return normalize_tenant_id(
            account_id,
            fallback_tenant_id=self._default_tenant_scope(),
        )

    def _instance_scope_for_account(self, account_id: str | None) -> str:
        account = self._find_account_by_id(account_id)
        if account is not None:
            return self._normalize_instance_scope(account.instance_id)
        return self._default_instance_id()

    def _effective_tenant_scope(self, tenant_id: str | None) -> str | None:
        tenant_filter = self._normalize_scope_value(tenant_id)
        if tenant_filter is None:
            return None
        return normalize_tenant_id(
            tenant_filter,
            fallback_tenant_id=self._default_tenant_scope(),
        )

    def _effective_instance_scope(self, instance_id: str | None) -> str | None:
        instance_filter = self._normalize_scope_value(instance_id)
        if instance_filter is None:
            return None
        return self._normalize_instance_scope(instance_filter)

    def _runtime_key_account_id(self, key_id: str | None) -> str | None:
        if not key_id:
            return None
        record = next((item for item in self._state.runtime_keys if item.key_id == key_id), None)
        return record.account_id if record is not None else None

    def _runtime_key_instance_scope(self, key_id: str | None) -> str:
        record = self._find_runtime_key_by_id(key_id)
        if record is not None:
            return self._normalize_instance_scope(record.instance_id)
        return self._default_instance_id()

    def _runtime_key_tenant_scope(self, key_id: str | None) -> str:
        record = self._find_runtime_key_by_id(key_id)
        if record is not None:
            return normalize_tenant_id(
                record.tenant_id,
                fallback_tenant_id=self._default_tenant_scope(),
            )
        return self._default_tenant_scope()

    def _find_account_by_id(self, account_id: str | None) -> GatewayAccountRecord | None:
        if not account_id:
            return None
        return next((item for item in self._state.gateway_accounts if item.account_id == account_id), None)

    def _find_runtime_key_by_id(self, key_id: str | None) -> RuntimeKeyRecord | None:
        if not key_id:
            return None
        return next((item for item in self._state.runtime_keys if item.key_id == key_id), None)

    def _effective_audit_tenant_scope(
        self,
        *,
        tenant_id: str | None,
        company_id: str | None,
        require_explicit_scope: bool,
    ) -> str | None:
        if not require_explicit_scope:
            return self._effective_tenant_scope(tenant_id)

        company_filter = self._normalize_scope_value(company_id)
        tenant_ids = [
            event.tenant_id
            for event in self._state.audit_events
            if company_filter is None or self._normalize_scope_value(event.company_id) == company_filter
        ]
        effective_tenant_id = effective_tenant_filter(tenant_ids, tenant_id)
        if effective_tenant_id is None:
            return None
        return normalize_tenant_id(
            effective_tenant_id,
            fallback_tenant_id=self._default_tenant_scope(),
        )

    def _audit_events_for_scope(
        self,
        *,
        tenant_id: str | None = None,
        company_id: str | None = None,
        require_explicit_scope: bool = False,
    ) -> list[AuditEventRecord]:
        effective_tenant_id = self._effective_audit_tenant_scope(
            tenant_id=tenant_id,
            company_id=company_id,
            require_explicit_scope=require_explicit_scope,
        )
        company_filter = self._normalize_scope_value(company_id)
        events = sorted(
            self._state.audit_events,
            key=lambda item: (item.created_at, item.event_id),
            reverse=True,
        )
        if effective_tenant_id is not None:
            events = [
                item
                for item in events
                if normalize_tenant_id(
                    item.tenant_id,
                    fallback_tenant_id=self._default_tenant_scope(),
                ) == effective_tenant_id
            ]
        if company_filter is not None:
            events = [
                item
                for item in events
                if self._normalize_scope_value(item.company_id) == company_filter
            ]
        return events

    def _audit_actor_search_values(self, event: AuditEventRecord) -> tuple[str, ...]:
        values: list[str] = []
        if event.actor_id:
            values.append(event.actor_id)
        if event.actor_type == "admin_user":
            user = self._find_user_by_id(event.actor_id)
            if user is not None:
                values.extend([user.username, user.display_name])
        elif event.actor_type == "runtime_key":
            key = self._find_runtime_key_by_id(event.actor_id)
            if key is not None:
                values.extend([key.label, key.prefix])
                account = self._find_account_by_id(key.account_id)
                if account is not None:
                    values.extend([account.account_id, account.label])
        elif event.actor_type == "system":
            values.append("system")
        elif event.actor_type == "anonymous":
            values.append("anonymous")
        normalized = tuple(
            dict.fromkeys(
                value.strip().lower()
                for value in values
                if isinstance(value, str) and value.strip()
            )
        )
        return normalized

    def _audit_event_matches_actor(self, event: AuditEventRecord, actor: str | None) -> bool:
        normalized_actor = self._normalize_scope_value(actor)
        if normalized_actor is None:
            return True
        actor_query = normalized_actor.lower()
        return any(actor_query in value for value in self._audit_actor_search_values(event))

    def query_audit_events(
        self,
        *,
        limit: int = 200,
        tenant_id: str | None = None,
        company_id: str | None = None,
        require_explicit_scope: bool = True,
        window_seconds: int | None = None,
        action: str | None = None,
        actor: str | None = None,
        target_type: str | None = None,
        target_id: str | None = None,
        status: str | None = None,
        cursor_created_at: str | None = None,
        cursor_event_id: str | None = None,
    ) -> list[AuditEventRecord]:
        events = self._audit_events_for_scope(
            tenant_id=tenant_id,
            company_id=company_id,
            require_explicit_scope=require_explicit_scope,
        )

        normalized_action = self._normalize_scope_value(action)
        normalized_target_type = self._normalize_scope_value(target_type)
        normalized_target_id = self._normalize_scope_value(target_id)
        normalized_status = self._normalize_scope_value(status)
        cutoff = self._now() - timedelta(seconds=max(0, window_seconds)) if window_seconds is not None else None

        filtered: list[AuditEventRecord] = []
        for event in events:
            if cutoff is not None and datetime.fromisoformat(event.created_at) < cutoff:
                continue
            if normalized_action is not None and event.action != normalized_action:
                continue
            if normalized_target_type is not None and event.target_type != normalized_target_type:
                continue
            if normalized_target_id is not None and self._normalize_scope_value(event.target_id) != normalized_target_id:
                continue
            if normalized_status is not None and event.status != normalized_status:
                continue
            if not self._audit_event_matches_actor(event, actor):
                continue
            if cursor_created_at is not None and cursor_event_id is not None:
                if (event.created_at, event.event_id) >= (cursor_created_at, cursor_event_id):
                    continue
            filtered.append(event)
            if len(filtered) >= max(1, limit):
                break

        return filtered

    def get_audit_event(
        self,
        event_id: str,
        *,
        tenant_id: str | None = None,
        company_id: str | None = None,
        require_explicit_scope: bool = True,
    ) -> AuditEventRecord | None:
        events = self._audit_events_for_scope(
            tenant_id=tenant_id,
            company_id=company_id,
            require_explicit_scope=require_explicit_scope,
        )
        return next((item for item in events if item.event_id == event_id), None)

    def audit_event_retention_summary(
        self,
        *,
        tenant_id: str | None = None,
        company_id: str | None = None,
        require_explicit_scope: bool = False,
    ) -> dict[str, object]:
        events = self._audit_events_for_scope(
            tenant_id=tenant_id,
            company_id=company_id,
            require_explicit_scope=require_explicit_scope,
        )
        effective_limit = max(100, self._settings.audit_event_retention_limit)
        return {
            "event_limit": effective_limit,
            "oldest_available_at": events[-1].created_at if events else None,
            "retention_limited": len(self._state.audit_events) >= effective_limit,
        }

    def _resolve_audit_scope(
        self,
        *,
        actor_type: str,
        actor_id: str | None,
        target_type: str,
        target_id: str | None,
        metadata: dict[str, Any] | None,
        instance_id: str | None = None,
        tenant_id: str | None = None,
        company_id: str | None = None,
    ) -> tuple[str, str, str | None]:
        payload = metadata or {}
        resolved_instance_id = self._normalize_scope_value(instance_id) or self._normalize_scope_value(payload.get("instance_id"))
        resolved_company_id = self._normalize_scope_value(company_id) or self._normalize_scope_value(payload.get("company_id"))
        resolved_tenant_id = self._normalize_scope_value(tenant_id) or self._normalize_scope_value(payload.get("tenant_id"))

        if resolved_instance_id is not None:
            normalized_instance_id = self._normalize_instance_scope(resolved_instance_id)
            return (
                normalized_instance_id,
                normalize_tenant_id(
                    resolved_tenant_id,
                    fallback_tenant_id=self._tenant_scope_for_instance(normalized_instance_id),
                ),
                resolved_company_id,
            )

        if resolved_tenant_id is not None:
            normalized_tenant_id = normalize_tenant_id(
                resolved_tenant_id,
                fallback_tenant_id=self._default_tenant_scope(),
            )
            return (
                self._normalize_instance_scope(normalized_tenant_id),
                normalized_tenant_id,
                resolved_company_id,
            )

        account_id = self._normalize_scope_value(payload.get("account_id"))
        if account_id is not None:
            return (
                self._instance_scope_for_account(account_id),
                self._tenant_scope_for_account(account_id),
                resolved_company_id,
            )

        if target_type == "gateway_account":
            return (
                self._instance_scope_for_account(target_id),
                self._tenant_scope_for_account(target_id),
                resolved_company_id,
            )

        if target_type == "runtime_key":
            return (
                self._runtime_key_instance_scope(target_id),
                self._runtime_key_tenant_scope(target_id),
                resolved_company_id,
            )

        if actor_type == "runtime_key":
            return (
                self._runtime_key_instance_scope(actor_id),
                self._runtime_key_tenant_scope(actor_id),
                resolved_company_id,
            )

        return (
            self._default_instance_id(),
            self._default_tenant_scope(),
            resolved_company_id,
        )

    def _backfill_audit_event_scope(self) -> bool:
        changed = False
        for event in self._state.audit_events:
            instance_id, tenant_id, company_id = self._resolve_audit_scope(
                actor_type=event.actor_type,
                actor_id=event.actor_id,
                target_type=event.target_type,
                target_id=event.target_id,
                metadata=event.metadata,
                instance_id=event.instance_id,
                tenant_id=event.tenant_id,
                company_id=event.company_id,
            )
            if event.instance_id != instance_id:
                event.instance_id = instance_id
                changed = True
            if event.tenant_id != tenant_id:
                event.tenant_id = tenant_id
                changed = True
            if event.company_id != company_id:
                event.company_id = company_id
                changed = True
        return changed

    def _append_audit(
        self,
        *,
        actor_type: str,
        actor_id: str | None,
        action: str,
        target_type: str,
        target_id: str | None,
        status: str,
        details: str,
        metadata: dict[str, Any] | None = None,
        instance_id: str | None = None,
        tenant_id: str | None = None,
        company_id: str | None = None,
    ) -> AuditEventRecord:
        resolved_instance_id, resolved_tenant_id, resolved_company_id = self._resolve_audit_scope(
            actor_type=actor_type,
            actor_id=actor_id,
            target_type=target_type,
            target_id=target_id,
            metadata=metadata,
            instance_id=instance_id,
            tenant_id=tenant_id,
            company_id=company_id,
        )
        event_metadata = dict(metadata or {})
        event_metadata.setdefault("instance_id", resolved_instance_id)
        event_metadata.setdefault("tenant_id", resolved_tenant_id)
        if resolved_company_id is not None:
            event_metadata.setdefault("company_id", resolved_company_id)
        event = AuditEventRecord(
            event_id=f"audit_{uuid4().hex[:12]}",
            actor_type=actor_type,
            actor_id=actor_id,
            instance_id=resolved_instance_id,
            tenant_id=resolved_tenant_id,
            company_id=resolved_company_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            status=status,
            details=details,
            metadata=event_metadata,
            created_at=self._now_iso(),
        )
        self._state.audit_events.append(event)
        limit = max(100, self._settings.audit_event_retention_limit)
        self._state.audit_events = self._state.audit_events[-limit:]
        return event

    def _deny_runtime_account_status(self, *, record: RuntimeKeyRecord, account: GatewayAccountRecord) -> None:
        self._append_audit(
            actor_type="runtime_key",
            actor_id=record.key_id,
            action="runtime_account_status_denied",
            target_type="gateway_account",
            target_id=account.account_id,
            status="failed",
            details=f"Runtime key '{record.label}' denied because account '{account.label}' is {account.status}.",
            metadata={
                "account_id": account.account_id,
                "account_status": account.status,
                "provider_bindings": list(account.provider_bindings),
                "runtime_key_id": record.key_id,
            },
        )
        self._persist()
        raise RuntimeAuthorizationError(
            status_code=403,
            error_type="gateway_account_inactive",
            message=f"Gateway account '{account.label}' is {account.status} and cannot access runtime APIs.",
            details={
                "account_id": account.account_id,
                "account_status": account.status,
            },
        )

    def _deny_unbound_runtime_key(self, *, record: RuntimeKeyRecord, binding_state: str) -> None:
        account_id = self._normalize_scope_value(record.account_id)
        if binding_state == "account_not_found" and account_id is not None:
            details = (
                f"Runtime key '{record.label}' denied because its bound gateway account '{account_id}' no longer exists."
            )
        else:
            details = f"Runtime key '{record.label}' denied because it is not bound to a gateway account."
        self._append_audit(
            actor_type="runtime_key",
            actor_id=record.key_id,
            action="runtime_key_binding_denied",
            target_type="runtime_key",
            target_id=record.key_id,
            status="failed",
            details=details,
            metadata={
                "account_id": account_id,
                "binding_state": binding_state,
                "runtime_key_id": record.key_id,
            },
        )
        self._persist()
        raise RuntimeAuthorizationError(
            status_code=403,
            error_type="runtime_key_unbound",
            message="Runtime key must be bound to a gateway account before it can access runtime APIs.",
            details={
                "account_id": account_id,
                "binding_state": binding_state,
            },
        )

    def audit_runtime_provider_binding_denied(
        self,
        *,
        identity: RuntimeGatewayIdentity,
        provider: str | None,
        requested_model: str | None = None,
    ) -> None:
        if provider is None:
            details = "Runtime key denied because no active models match the account's provider bindings."
            target_type = "gateway_account"
            target_id = identity.account_id
        else:
            details = f"Runtime key denied access to provider '{provider}' by provider binding policy."
            target_type = "provider"
            target_id = provider
        self._append_audit(
            actor_type="runtime_key",
            actor_id=identity.key_id,
            action="runtime_provider_binding_denied",
            target_type=target_type,
            target_id=target_id,
            status="failed",
            details=details,
            metadata={
                "account_id": identity.account_id,
                "account_status": identity.account_status,
                "provider": provider,
                "provider_bindings": list(identity.provider_bindings),
                "requested_model": requested_model,
                "runtime_key_id": identity.key_id,
            },
        )
        self._persist()

    def _issue_admin_session(
        self,
        *,
        user: AdminUserRecord,
        role: str,
        session_type: str,
        issued_by_user_id: str | None,
        approved_by_user_id: str | None = None,
        approval_request_id: str | None = None,
        approval_reference: str | None = None,
        justification: str | None = None,
        notification_targets: list[str] | None = None,
        ttl_minutes: int | None = None,
    ) -> AdminLoginResult:
        now = self._now()
        primary_membership = self._primary_membership_for_user(user.user_id)
        session_ttl = timedelta(
            minutes=max(1, ttl_minutes)
            if ttl_minutes is not None
            else max(60, self._settings.admin_session_ttl_hours * 60)
        )
        token = issue_session_token()
        session = AdminSessionRecord(
            session_id=f"sess_{uuid4().hex[:12]}",
            user_id=user.user_id,
            token_hash=hash_token(token),
            role=role,  # type: ignore[arg-type]
            membership_id=primary_membership.membership_id if primary_membership is not None else None,
            instance_id=(
                self._normalize_instance_scope(primary_membership.instance_id)
                if primary_membership is not None
                else self._default_instance_id()
            ),
            tenant_id=(
                normalize_tenant_id(
                    primary_membership.tenant_id,
                    fallback_tenant_id=self._default_tenant_scope(),
                )
                if primary_membership is not None
                else self._default_tenant_scope()
            ),
            session_type=session_type,  # type: ignore[arg-type]
            created_at=now.isoformat(),
            expires_at=(now + session_ttl).isoformat(),
            last_used_at=now.isoformat(),
            issued_by_user_id=issued_by_user_id,
            approved_by_user_id=approved_by_user_id,
            approval_request_id=approval_request_id,
            approval_reference=approval_reference,
            justification=justification,
            notification_targets=self._normalize_notification_targets(notification_targets or []),
        )
        user.last_login_at = now.isoformat()
        user.updated_at = now.isoformat()
        self._state.admin_sessions.append(session)
        return AdminLoginResult(
            access_token=token,
            expires_at=session.expires_at,
            user=self._build_authenticated_admin(session, user),
        )

    def _build_authenticated_admin(self, session: AdminSessionRecord, user: AdminUserRecord) -> AuthenticatedAdmin:
        memberships = self._instance_memberships_for_user(user.user_id)
        active_membership = next(
            (membership for membership in memberships if membership.membership_id == session.membership_id),
            None,
        )
        instance_permissions: dict[str, set[str]] = {}
        for membership in memberships:
            effective_role = self._effective_session_membership_role(session, membership)
            normalized_instance_id = self._normalize_instance_scope(membership.instance_id)
            instance_permissions.setdefault(normalized_instance_id, set()).update(
                self._permission_keys_for_role(effective_role)
            )

        return AuthenticatedAdmin(
            session_id=session.session_id,
            user_id=user.user_id,
            username=user.username,
            display_name=user.display_name,
            role=session.role,
            membership_id=session.membership_id,
            active_instance_id=self._normalize_instance_scope(
                session.instance_id or (active_membership.instance_id if active_membership is not None else None)
            ),
            active_tenant_id=normalize_tenant_id(
                session.tenant_id or (active_membership.tenant_id if active_membership is not None else None),
                fallback_tenant_id=self._default_tenant_scope(),
            ),
            session_type=session.session_type,
            read_only=session.session_type == "impersonation",
            must_rotate_password=user.must_rotate_password,
            expires_at=session.expires_at,
            issued_by_user_id=session.issued_by_user_id,
            approved_by_user_id=session.approved_by_user_id,
            approval_request_id=session.approval_request_id,
            approval_reference=session.approval_reference,
            justification=session.justification,
            notification_targets=list(session.notification_targets),
            instance_memberships=memberships,
            instance_permissions={
                instance_id: sorted(permission_keys)
                for instance_id, permission_keys in instance_permissions.items()
            },
        )

    def admin_membership_for_instance(
        self,
        *,
        actor: AuthenticatedAdmin,
        instance: "InstanceRecord",
    ) -> AdminInstanceMembershipRecord | None:
        if self._ensure_admin_memberships():
            self._persist()
        memberships = self._memberships_for_instance_scope(
            actor.user_id,
            instance_id=instance.instance_id,
            tenant_id=instance.tenant_id,
        )
        if not memberships:
            return None
        return max(
            memberships,
            key=lambda membership: self._role_rank(
                self._effective_actor_membership_role(actor, membership)
            ),
        )

    def authorize_admin_instance_permission(
        self,
        *,
        actor: AuthenticatedAdmin,
        instance: "InstanceRecord",
        permission_key: str,
    ) -> AdminInstanceMembershipRecord:
        membership = self.admin_membership_for_instance(actor=actor, instance=instance)
        if membership is None:
            raise PermissionError("instance_membership_required")

        granted_permissions: set[str] = set()
        for item in self._memberships_for_instance_scope(
            actor.user_id,
            instance_id=instance.instance_id,
            tenant_id=instance.tenant_id,
        ):
            granted_permissions.update(
                self._permission_keys_for_role(self._effective_actor_membership_role(actor, item))
            )
        if permission_key not in granted_permissions:
            raise PermissionError(f"missing_instance_permission:{permission_key}")
        return membership

    def admin_has_instance_permission(
        self,
        *,
        actor: AuthenticatedAdmin,
        instance: "InstanceRecord",
        permission_key: str,
    ) -> bool:
        try:
            self.authorize_admin_instance_permission(
                actor=actor,
                instance=instance,
                permission_key=permission_key,
            )
        except PermissionError:
            return False
        return True

    def list_authorized_instance_ids(
        self,
        *,
        actor: AuthenticatedAdmin,
        permission_key: str,
    ) -> list[str]:
        authorized_ids: list[str] = []
        for instance_id, permission_keys in actor.instance_permissions.items():
            if permission_key not in permission_keys:
                continue
            authorized_ids.append(self._normalize_instance_scope(instance_id))
        return sorted(dict.fromkeys(authorized_ids))

    def list_accessible_instances(
        self,
        *,
        actor: AuthenticatedAdmin,
        instances: list["InstanceRecord"],
        permission_key: str,
    ) -> list["InstanceRecord"]:
        authorized_ids = set(
            self.list_authorized_instance_ids(
                actor=actor,
                permission_key=permission_key,
            )
        )
        if not authorized_ids:
            return []
        return [
            instance
            for instance in instances
            if self._normalize_instance_scope(instance.instance_id) in authorized_ids
        ]

    def _prune_login_failures(self) -> None:
        cutoff = self._now() - timedelta(minutes=max(1, self._settings.admin_login_rate_limit_window_minutes))
        self._state.admin_login_failures = [
            failure
            for failure in self._state.admin_login_failures
            if datetime.fromisoformat(failure.failed_at) > cutoff
        ]

    def _record_login_failure(self, username: str) -> None:
        self._prune_login_failures()
        self._state.admin_login_failures.append(
            AdminLoginFailureRecord(
                username=username.strip().lower(),
                failed_at=self._now_iso(),
            )
        )

    def _clear_login_failures(self, username: str) -> None:
        normalized = username.strip().lower()
        self._state.admin_login_failures = [
            failure for failure in self._state.admin_login_failures if failure.username != normalized
        ]

    def _ensure_login_not_rate_limited(self, username: str) -> None:
        normalized = username.strip().lower()
        self._prune_login_failures()
        failures = [failure for failure in self._state.admin_login_failures if failure.username == normalized]
        if len(failures) < max(1, self._settings.admin_login_rate_limit_attempts):
            return
        self._append_audit(
            actor_type="anonymous",
            actor_id=normalized or None,
            action="admin_login",
            target_type="admin_session",
            target_id=None,
            status="failed",
            details="Admin login blocked by rate limit.",
            metadata={
                "rate_limited": True,
                "window_minutes": self._settings.admin_login_rate_limit_window_minutes,
                "attempt_limit": self._settings.admin_login_rate_limit_attempts,
            },
        )
        self._persist()
        raise ValueError("login_rate_limited")

    def _revoke_sessions_for_user(
        self,
        user_id: str,
        *,
        reason: str,
        actor_user_id: str,
        exclude_session_id: str | None = None,
    ) -> int:
        revoked = 0
        for session in self._state.admin_sessions:
            if session.user_id != user_id or session.revoked_at is not None or session.session_id == exclude_session_id:
                continue
            session.revoked_at = self._now_iso()
            session.revoked_reason = reason
            revoked += 1
        if revoked:
            self._append_audit(
                actor_type="admin_user",
                actor_id=actor_user_id,
                action="admin_session_bulk_revoke",
                target_type="admin_user",
                target_id=user_id,
                status="ok",
                details=f"Revoked {revoked} admin session(s) for '{user_id}'.",
                metadata={"reason": reason, "revoked_session_count": revoked},
            )
        return revoked

    def _bootstrap_admin_user(self) -> AdminUserRecord | None:
        bootstrap_user = next((user for user in self._state.admin_users if user.created_by == "system"), None)
        if bootstrap_user is not None:
            return bootstrap_user
        if len(self._state.admin_users) == 1 and role_allows(self._state.admin_users[0].role, "admin"):
            return self._state.admin_users[0]
        return None

    def _bootstrap_admin_uses_insecure_password(self, user: AdminUserRecord | None) -> bool:
        if user is None:
            return True
        return any(
            value and verify_password(value, salt=user.password_salt, expected_hash=user.password_hash)
            for value in _INSECURE_BOOTSTRAP_ADMIN_PASSWORDS
            if value
        )

    def _ensure_bootstrap_admin(self) -> None:
        now = self._now_iso()
        if not self._state.admin_users:
            salt = new_secret_salt()
            user = AdminUserRecord(
                user_id=f"admin_{uuid4().hex[:10]}",
                username=self._settings.bootstrap_admin_username,
                display_name="ForgeFrame Bootstrap Admin",
                role="admin",
                status="active",
                password_hash=hash_password(self._settings.bootstrap_admin_password, salt),
                password_salt=salt,
                must_rotate_password=True,
                created_at=now,
                updated_at=now,
                created_by="system",
            )
            self._state.admin_users.append(user)
            self._append_audit(
                actor_type="system",
                actor_id=None,
                action="bootstrap_admin_created",
                target_type="admin_user",
                target_id=user.user_id,
                status="warning",
                details="Bootstrap admin account created.",
                metadata={"username": user.username},
            )
            self._persist()
            return

        user = self._bootstrap_admin_user()
        if user is None or not user.must_rotate_password:
            return
        if verify_password(self._settings.bootstrap_admin_password, salt=user.password_salt, expected_hash=user.password_hash):
            return

        salt = new_secret_salt()
        user.password_salt = salt
        user.password_hash = hash_password(self._settings.bootstrap_admin_password, salt)
        user.updated_at = now
        revoked_sessions = 0
        for session in self._state.admin_sessions:
            if session.user_id != user.user_id or session.revoked_at is not None:
                continue
            session.revoked_at = now
            session.revoked_reason = "bootstrap_secret_reloaded"
            revoked_sessions += 1
        self._append_audit(
            actor_type="system",
            actor_id=None,
            action="bootstrap_admin_secret_reload",
            target_type="admin_user",
            target_id=user.user_id,
            status="warning",
            details="Bootstrap admin password reloaded from startup configuration.",
            metadata={"username": user.username, "revoked_session_count": revoked_sessions},
        )
        self._persist()

    def _prune_expired_sessions(self) -> None:
        now = self._now()
        self._state.admin_sessions = [
            session
            for session in self._state.admin_sessions
            if session.revoked_at is not None or datetime.fromisoformat(session.expires_at) > now
        ]
        self._prune_login_failures()

    def bootstrap_status(self) -> dict[str, object]:
        user = self._bootstrap_admin_user()
        default_password = self._bootstrap_admin_uses_insecure_password(user)
        active_sessions = len([session for session in self._state.admin_sessions if session.revoked_at is None])
        return {
            "admin_auth_enabled": self._settings.admin_auth_enabled,
            "bootstrap_username": user.username if user else self._settings.bootstrap_admin_username,
            "must_rotate_password": bool(user.must_rotate_password) if user else True,
            "default_password_in_use": default_password,
            "admin_user_count": len(self._state.admin_users),
            "active_session_count": active_sessions,
            "governance_storage_backend": self._settings.governance_storage_backend,
        }

    def _find_user_by_username(self, username: str) -> AdminUserRecord | None:
        normalized = username.strip().lower()
        return next((user for user in self._state.admin_users if user.username.lower() == normalized), None)

    def _find_user_by_id(self, user_id: str) -> AdminUserRecord | None:
        return next((user for user in self._state.admin_users if user.user_id == user_id), None)

    def _find_admin_session_by_id(self, session_id: str) -> AdminSessionRecord | None:
        return next((session for session in self._state.admin_sessions if session.session_id == session_id), None)

    def _find_elevated_access_request(self, request_id: str) -> ElevatedAccessRequestRecord | None:
        return next((record for record in self._state.elevated_access_requests if record.request_id == request_id), None)

    def _authorize_elevated_access_request_read(
        self,
        *,
        actor: AuthenticatedAdmin,
        record: ElevatedAccessRequestRecord,
    ) -> None:
        if not role_allows(actor.role, "admin") and record.requested_by_user_id != actor.user_id:
            raise PermissionError("elevated_access_request_forbidden")

    def _authorize_shared_elevated_access_approval_read(
        self,
        *,
        actor: AuthenticatedAdmin,
    ) -> None:
        if not role_allows(actor.role, "operator"):
            raise PermissionError("elevated_access_request_forbidden")

    def _elevated_access_session_status(self, record: ElevatedAccessRequestRecord) -> str:
        if record.issuance_status != "issued" or not record.issued_session_id:
            return "not_issued"
        session = self._find_admin_session_by_id(record.issued_session_id)
        if session is None:
            return "not_issued"
        if session.revoked_at is not None:
            return "revoked"
        if datetime.fromisoformat(session.expires_at) <= self._now():
            return "expired"
        return "active"

    def _serialize_elevated_access_request(self, record: ElevatedAccessRequestRecord) -> dict[str, object]:
        users = {user.user_id: user for user in self._state.admin_users}
        requested_by = users.get(record.requested_by_user_id)
        target_user = users.get(record.target_user_id)
        decided_by = users.get(record.decided_by_user_id) if record.decided_by_user_id else None
        issued_by = users.get(record.issued_by_user_id) if record.issued_by_user_id else None
        return {
            **record.model_dump(),
            "approval_id": build_elevated_access_approval_id(record.request_id),
            "requested_by_username": requested_by.username if requested_by is not None else None,
            "requested_by_display_name": requested_by.display_name if requested_by is not None else None,
            "target_username": target_user.username if target_user is not None else None,
            "target_display_name": target_user.display_name if target_user is not None else None,
            "decided_by_username": decided_by.username if decided_by is not None else None,
            "issued_by_username": issued_by.username if issued_by is not None else None,
            "ready_to_issue": record.gate_status == "approved" and record.issuance_status == "pending",
            "session_status": self._elevated_access_session_status(record),
        }

    def _prune_expired_elevated_access_requests(self) -> None:
        now = self._now()
        changed = False
        for record in self._state.elevated_access_requests:
            if record.gate_status != "open":
                continue
            if datetime.fromisoformat(record.approval_expires_at) > now:
                continue
            record.gate_status = "timed_out"
            record.updated_at = now.isoformat()
            action_prefix = self._request_action_prefix(record.request_type)
            target_user = self._find_user_by_id(record.target_user_id)
            self._append_audit(
                actor_type="system",
                actor_id=None,
                action=f"{action_prefix}_timed_out",
                target_type="elevated_access_request",
                target_id=record.request_id,
                status="warning",
                details=f"Pending {record.request_type.replace('_', '-')} request for '{self._request_target_label(record, target_user)}' timed out before approval.",
                metadata={
                    "request_type": record.request_type,
                    "request_id": record.request_id,
                    "target_user_id": record.target_user_id,
                    "approval_reference": record.approval_reference,
                },
            )
            changed = True
        if changed:
            self._persist()

    def login(self, username: str, password: str) -> AdminLoginResult:
        self._ensure_login_not_rate_limited(username)
        user = self._find_user_by_username(username)
        if user is None or user.status != "active" or not verify_password(password, salt=user.password_salt, expected_hash=user.password_hash):
            self._record_login_failure(username)
            self._append_audit(
                actor_type="anonymous",
                actor_id=username,
                action="admin_login",
                target_type="admin_session",
                target_id=None,
                status="failed",
                details="Invalid admin credentials.",
            )
            self._persist()
            raise ValueError("invalid_credentials")

        self._clear_login_failures(username)
        if self._ensure_admin_memberships():
            self._persist()
        result = self._issue_admin_session(
            user=user,
            role=user.role,
            session_type="standard",
            issued_by_user_id=user.user_id,
        )
        self._append_audit(
            actor_type="admin_user",
            actor_id=user.user_id,
            action="admin_login",
            target_type="admin_session",
            target_id=result.user.session_id,
            status="ok",
            details="Admin session issued.",
        )
        self._persist()
        return result

    def authenticate_admin_token(self, token: str) -> AuthenticatedAdmin:
        if not token.strip():
            raise PermissionError("missing_admin_token")
        token_hash = hash_token(token)
        self._prune_expired_sessions()
        session = next((item for item in self._state.admin_sessions if item.token_hash == token_hash and item.revoked_at is None), None)
        if session is None:
            raise PermissionError("invalid_admin_session")
        if datetime.fromisoformat(session.expires_at) <= self._now():
            raise PermissionError("expired_admin_session")
        user = self._find_user_by_id(session.user_id)
        if user is None or user.status != "active":
            raise PermissionError("admin_user_disabled")
        if self._ensure_admin_memberships():
            self._persist()
        session.last_used_at = self._now_iso()
        self._persist()
        return self._build_authenticated_admin(session, user)

    def revoke_admin_session(self, token: str) -> None:
        token_hash = hash_token(token)
        for session in self._state.admin_sessions:
            if session.token_hash != token_hash or session.revoked_at is not None:
                continue
            session.revoked_at = self._now_iso()
            session.revoked_reason = "self_logout"
            self._append_audit(
                actor_type="admin_user",
                actor_id=session.user_id,
                action="admin_logout",
                target_type="admin_session",
                target_id=session.session_id,
                status="ok",
                details="Admin session revoked.",
            )
            self._persist()
            return

    def list_admin_users(self) -> list[AdminUserRecord]:
        return sorted(self._state.admin_users, key=lambda item: (item.username.lower(), item.created_at))

    def list_admin_instance_memberships(self, user_id: str) -> list[AdminInstanceMembershipRecord]:
        user = self._find_user_by_id(user_id)
        if user is None:
            raise ValueError("admin_user_not_found")
        return sorted(
            self._all_instance_memberships_for_user(user_id),
            key=lambda item: (item.instance_id, item.created_at, item.membership_id),
        )

    def upsert_admin_instance_membership(
        self,
        *,
        user_id: str,
        instance: "InstanceRecord",
        role: str,
        actor: AuthenticatedAdmin,
        status: str = "active",
    ) -> AdminInstanceMembershipRecord:
        user = self._find_user_by_id(user_id)
        if user is None:
            raise ValueError("admin_user_not_found")
        if role not in _ADMIN_ROLE_RANK:
            raise ValueError("unsupported_admin_role")
        if status not in {"active", "disabled"}:
            raise ValueError("unsupported_admin_status")
        if self._role_rank(role) > self._role_rank(user.role):
            raise ValueError("membership_role_exceeds_admin_role")
        changed = self._upsert_admin_membership(
            user,
            instance_id=instance.instance_id,
            tenant_id=instance.tenant_id,
            company_id=instance.company_id,
            role=role,
            status=status,
            created_by=actor.user_id,
        )
        memberships = self._memberships_for_instance_scope(
            user.user_id,
            instance_id=instance.instance_id,
            tenant_id=instance.tenant_id,
        )
        membership = max(memberships, key=lambda item: (self._role_rank(item.role), item.created_at)) if memberships else None
        if membership is None:
            raise ValueError("admin_instance_membership_not_found")
        if changed:
            self._append_audit(
                actor_type="admin_user",
                actor_id=actor.user_id,
                action="admin_instance_membership_upsert",
                target_type="admin_instance_membership",
                target_id=membership.membership_id,
                status="ok",
                details=(
                    f"Admin instance membership for '{user.username}' upserted on "
                    f"instance '{instance.instance_id}' with role '{membership.role}'."
                ),
                metadata={
                    "user_id": user.user_id,
                    "instance_id": instance.instance_id,
                    "tenant_id": instance.tenant_id,
                    "company_id": instance.company_id,
                    "role": membership.role,
                    "membership_status": membership.status,
                },
                instance_id=instance.instance_id,
                tenant_id=instance.tenant_id,
                company_id=instance.company_id,
            )
            if user.user_id != actor.user_id:
                self._revoke_sessions_for_user(
                    user.user_id,
                    reason="instance_membership_updated",
                    actor_user_id=actor.user_id,
                )
            self._persist()
        return membership

    def remove_admin_instance_membership(
        self,
        *,
        user_id: str,
        instance: "InstanceRecord",
        actor: AuthenticatedAdmin,
    ) -> None:
        user = self._find_user_by_id(user_id)
        if user is None:
            raise ValueError("admin_user_not_found")
        matching_memberships = self._memberships_for_instance_scope(
            user_id,
            instance_id=instance.instance_id,
            tenant_id=instance.tenant_id,
        )
        if not matching_memberships:
            raise ValueError("admin_instance_membership_not_found")
        remaining_memberships = [
            membership
            for membership in self._all_instance_memberships_for_user(user_id)
            if membership.membership_id not in {item.membership_id for item in matching_memberships}
        ]
        if not remaining_memberships:
            raise ValueError("admin_user_membership_required")
        self._state.instance_memberships = [
            membership
            for membership in self._state.instance_memberships
            if membership.membership_id not in {item.membership_id for item in matching_memberships}
        ]
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action="admin_instance_membership_remove",
            target_type="admin_instance_membership",
            target_id=matching_memberships[0].membership_id,
            status="warning",
            details=(
                f"Admin instance membership for '{user.username}' removed from "
                f"instance '{instance.instance_id}'."
            ),
            metadata={
                "user_id": user.user_id,
                "instance_id": instance.instance_id,
                "tenant_id": instance.tenant_id,
                "company_id": instance.company_id,
                "removed_membership_ids": [item.membership_id for item in matching_memberships],
            },
            instance_id=instance.instance_id,
            tenant_id=instance.tenant_id,
            company_id=instance.company_id,
        )
        if user.user_id != actor.user_id:
            self._revoke_sessions_for_user(
                user.user_id,
                reason="instance_membership_removed",
                actor_user_id=actor.user_id,
            )
        self._persist()

    def create_admin_user(
        self,
        *,
        username: str,
        display_name: str,
        role: str,
        password: str,
        actor: AuthenticatedAdmin,
    ) -> AdminUserRecord:
        normalized_username = username.strip().lower()
        if not normalized_username:
            raise ValueError("username_required")
        if self._find_user_by_username(normalized_username) is not None:
            raise ValueError("admin_username_conflict")
        if role not in _ADMIN_ROLE_RANK:
            raise ValueError("unsupported_admin_role")
        now = self._now_iso()
        salt = new_secret_salt()
        user = AdminUserRecord(
            user_id=f"admin_{uuid4().hex[:10]}",
            username=normalized_username,
            display_name=display_name.strip() or normalized_username,
            role=role,  # type: ignore[arg-type]
            status="active",
            password_hash=hash_password(password, salt),
            password_salt=salt,
            must_rotate_password=True,
            created_at=now,
            updated_at=now,
            created_by=actor.user_id,
        )
        self._state.admin_users.append(user)
        self._ensure_admin_memberships()
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action="admin_user_create",
            target_type="admin_user",
            target_id=user.user_id,
            status="ok",
            details=f"Admin user '{user.username}' created.",
            metadata={"role": user.role},
        )
        self._persist()
        return user

    def update_admin_user(
        self,
        user_id: str,
        *,
        display_name: str | None,
        role: str | None,
        status: str | None,
        must_rotate_password: bool | None,
        actor: AuthenticatedAdmin,
    ) -> AdminUserRecord:
        user = self._find_user_by_id(user_id)
        if user is None:
            raise ValueError("admin_user_not_found")
        if must_rotate_password is False:
            raise ValueError("password_rotation_clear_requires_self_rotation")
        previous_role = user.role
        previous_status = user.status
        if role is not None and role not in _ADMIN_ROLE_RANK:
            raise ValueError("unsupported_admin_role")
        if status is not None and status not in {"active", "disabled"}:
            raise ValueError("unsupported_admin_status")
        if status == "disabled" and role_allows(user.role, "admin"):
            active_admins = [
                item
                for item in self._state.admin_users
                if role_allows(item.role, "admin")
                and item.status == "active"
                and item.user_id != user.user_id
            ]
            if not active_admins:
                raise ValueError("cannot_disable_last_active_admin")
        if display_name is not None:
            user.display_name = display_name.strip() or user.display_name
        if role is not None:
            user.role = role  # type: ignore[assignment]
        if status is not None:
            user.status = status  # type: ignore[assignment]
        if must_rotate_password is True:
            user.must_rotate_password = True
        user.updated_at = self._now_iso()
        self._ensure_admin_memberships()
        if previous_role != user.role:
            self._append_audit(
                actor_type="admin_user",
                actor_id=actor.user_id,
                action="admin_role_change",
                target_type="admin_user",
                target_id=user.user_id,
                status="ok",
                details=f"Admin role for '{user.username}' changed from {previous_role} to {user.role}.",
                metadata={"previous_role": previous_role, "new_role": user.role},
            )
        if previous_status != user.status:
            self._append_audit(
                actor_type="admin_user",
                actor_id=actor.user_id,
                action="admin_status_change",
                target_type="admin_user",
                target_id=user.user_id,
                status="ok",
                details=f"Admin status for '{user.username}' changed from {previous_status} to {user.status}.",
                metadata={"previous_status": previous_status, "new_status": user.status},
            )
        if previous_role != user.role:
            self._revoke_sessions_for_user(user.user_id, reason="role_changed", actor_user_id=actor.user_id)
        if previous_status != user.status and user.status == "disabled":
            self._revoke_sessions_for_user(user.user_id, reason="user_disabled", actor_user_id=actor.user_id)
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action="admin_user_update",
            target_type="admin_user",
            target_id=user.user_id,
            status="ok",
            details=f"Admin user '{user.username}' updated.",
            metadata={"role": user.role, "status": user.status},
        )
        self._persist()
        return user

    def _rotate_admin_password_record(
        self,
        user: AdminUserRecord,
        *,
        new_password: str,
        actor: AuthenticatedAdmin,
        must_rotate_password: bool,
    ) -> AdminUserRecord:
        if verify_password(new_password, salt=user.password_salt, expected_hash=user.password_hash):
            raise ValueError("new_password_must_differ")
        salt = new_secret_salt()
        user.password_salt = salt
        user.password_hash = hash_password(new_password, salt)
        user.must_rotate_password = must_rotate_password
        user.updated_at = self._now_iso()
        self._revoke_sessions_for_user(
            user.user_id,
            reason="password_rotated",
            actor_user_id=actor.user_id,
            exclude_session_id=actor.session_id if actor.user_id == user.user_id else None,
        )
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action="admin_password_rotate",
            target_type="admin_user",
            target_id=user.user_id,
            status="ok",
            details=f"Admin password rotated for '{user.username}'.",
        )
        self._persist()
        return user

    def rotate_admin_password(
        self,
        user_id: str,
        *,
        new_password: str,
        actor: AuthenticatedAdmin,
    ) -> AdminUserRecord:
        user = self._find_user_by_id(user_id)
        if user is None:
            raise ValueError("admin_user_not_found")
        return self._rotate_admin_password_record(
            user,
            new_password=new_password,
            actor=actor,
            must_rotate_password=True,
        )

    def rotate_own_admin_password(
        self,
        admin: AuthenticatedAdmin,
        *,
        current_password: str,
        new_password: str,
    ) -> AdminUserRecord:
        user = self._find_user_by_id(admin.user_id)
        if user is None:
            raise ValueError("admin_user_not_found")
        if not verify_password(current_password, salt=user.password_salt, expected_hash=user.password_hash):
            raise ValueError("invalid_current_password")
        return self._rotate_admin_password_record(
            user,
            new_password=new_password,
            actor=admin,
            must_rotate_password=False,
        )

    def list_admin_sessions(self, *, include_revoked: bool = False) -> list[dict[str, object]]:
        sessions = self._state.admin_sessions
        if not include_revoked:
            sessions = [session for session in sessions if session.revoked_at is None]
        users = {user.user_id: user for user in self._state.admin_users}
        ordered = sorted(sessions, key=lambda item: item.last_used_at, reverse=True)
        return [
            {
                **session.model_dump(),
                "username": users.get(session.user_id).username if users.get(session.user_id) else "unknown",
                "display_name": users.get(session.user_id).display_name if users.get(session.user_id) else "Unknown User",
                "user_status": users.get(session.user_id).status if users.get(session.user_id) else "disabled",
                "issued_by_username": users.get(session.issued_by_user_id).username if session.issued_by_user_id and users.get(session.issued_by_user_id) else None,
                "approved_by_username": (
                    users.get(session.approved_by_user_id).username
                    if session.approved_by_user_id and users.get(session.approved_by_user_id)
                    else None
                ),
                "active": self._session_is_active(session),
                "expired": datetime.fromisoformat(session.expires_at) <= self._now(),
                "elevated": session.session_type in {"impersonation", "break_glass"},
                "read_only": session.session_type == "impersonation",
            }
            for session in ordered
        ]

    def revoke_admin_session_by_id(self, session_id: str, *, actor: AuthenticatedAdmin, reason: str = "admin_revoked") -> AdminSessionRecord:
        session = next((item for item in self._state.admin_sessions if item.session_id == session_id), None)
        if session is None:
            raise ValueError("admin_session_not_found")
        if session.revoked_at is None:
            session.revoked_at = self._now_iso()
            session.revoked_reason = reason
            self._append_audit(
                actor_type="admin_user",
                actor_id=actor.user_id,
                action="admin_session_revoke",
                target_type="admin_session",
                target_id=session.session_id,
                status="ok",
                details=f"Admin session '{session.session_id}' revoked.",
                metadata={"reason": reason},
            )
            self._persist()
        return session

    @staticmethod
    def _rotation_summary(events: list[dict[str, object]]) -> dict[str, object]:
        if not events:
            return {
                "history_count": 0,
                "last_rotation_at": None,
                "last_rotation_reference": None,
                "last_rotation_kind": None,
            }
        ordered = sorted(events, key=lambda item: str(item["recorded_at"]), reverse=True)
        latest = ordered[0]
        return {
            "history_count": len(events),
            "last_rotation_at": latest["recorded_at"],
            "last_rotation_reference": latest.get("reference"),
            "last_rotation_kind": latest["kind"],
        }

    @staticmethod
    def _serialize_secret_rotation_event(
        record: SecretRotationEventRecord,
        *,
        history_source: str = "governance_recorded_event",
    ) -> dict[str, object]:
        payload = record.model_dump()
        payload["history_source"] = history_source
        return payload

    def _runtime_provider_secret_posture(self) -> list[dict[str, object]]:
        openai_codex_oauth = self._settings.openai_codex_auth_mode == "oauth"
        gemini_oauth = self._settings.gemini_auth_mode == "oauth"
        codex_auth_state = resolve_codex_auth_state(self._settings)
        return [
            {
                "provider": "openai_api",
                "configured": bool(self._settings.openai_api_key.strip()),
                "auth_mode": "api_key",
                "rotation_support": "manual_env_rotation",
                "secret_storage": "environment_variable",
                "credential_reference": "FORGEFRAME_OPENAI_API_KEY",
            },
            {
                "provider": "openai_codex",
                "configured": bool(
                    (self._settings.openai_codex_oauth_access_token if openai_codex_oauth else self._settings.openai_codex_api_key).strip()
                ),
                "auth_mode": self._settings.openai_codex_auth_mode,
                "rotation_support": "oauth_token_rotation" if openai_codex_oauth else "manual_env_rotation",
                "secret_storage": "environment_variable",
                "credential_reference": (
                    "FORGEFRAME_OPENAI_CODEX_OAUTH_ACCESS_TOKEN" if openai_codex_oauth else "FORGEFRAME_OPENAI_CODEX_API_KEY"
                ),
                "oauth_mode": codex_auth_state.oauth_mode if openai_codex_oauth else None,
                "oauth_flow_support": codex_auth_state.oauth_flow_support if openai_codex_oauth else None,
                "oauth_operator_truth": codex_auth_state.oauth_operator_truth if openai_codex_oauth else None,
            },
            {
                "provider": "gemini",
                "configured": bool(
                    (self._settings.gemini_oauth_access_token if gemini_oauth else self._settings.gemini_api_key).strip()
                ),
                "auth_mode": self._settings.gemini_auth_mode,
                "rotation_support": "oauth_token_rotation" if gemini_oauth else "manual_env_rotation",
                "secret_storage": "environment_variable",
                "credential_reference": "FORGEFRAME_GEMINI_OAUTH_ACCESS_TOKEN" if gemini_oauth else "FORGEFRAME_GEMINI_API_KEY",
            },
            {
                "provider": "anthropic",
                "configured": bool(self._settings.anthropic_api_key.strip()),
                "auth_mode": "api_key",
                "rotation_support": "manual_env_rotation",
                "secret_storage": "environment_variable",
                "credential_reference": "FORGEFRAME_ANTHROPIC_API_KEY",
            },
            {
                "provider": "antigravity",
                "configured": bool(self._settings.antigravity_oauth_access_token.strip()),
                "auth_mode": "oauth_account",
                "rotation_support": "oauth_token_rotation",
                "secret_storage": "environment_variable",
                "credential_reference": "FORGEFRAME_ANTIGRAVITY_OAUTH_ACCESS_TOKEN",
            },
            {
                "provider": "github_copilot",
                "configured": bool(self._settings.github_copilot_oauth_access_token.strip()),
                "auth_mode": "oauth_account",
                "rotation_support": "oauth_token_rotation",
                "secret_storage": "environment_variable",
                "credential_reference": "FORGEFRAME_GITHUB_COPILOT_OAUTH_ACCESS_TOKEN",
            },
            {
                "provider": "claude_code",
                "configured": bool(self._settings.claude_code_oauth_access_token.strip()),
                "auth_mode": "oauth_account",
                "rotation_support": "oauth_token_rotation",
                "secret_storage": "environment_variable",
                "credential_reference": "FORGEFRAME_CLAUDE_CODE_OAUTH_ACCESS_TOKEN",
            },
        ]

    def _derived_harness_rotation_events(self) -> list[dict[str, object]]:
        events: list[dict[str, object]] = []
        for profile in self._harness.list_profiles():
            if profile.auth_scheme == "none":
                continue
            revision_snapshots: dict[int, dict[str, object]] = {}
            for entry in profile.config_history:
                try:
                    revision = int(entry.get("revision", -1))
                except (TypeError, ValueError):
                    continue
                revision_snapshots[revision] = entry
            for revision in range(2, profile.config_revision + 1):
                snapshot = revision_snapshots.get(revision)
                recorded_at = str((snapshot or {}).get("saved_at") or profile.updated_at or self._now_iso())
                events.append(
                    {
                        "event_id": f"harness_revision_{profile.provider_key}_{revision}",
                        "target_type": "harness_profile",
                        "target_id": profile.provider_key,
                        "kind": "harness_profile_rotation",
                        "recorded_at": recorded_at,
                        "recorded_by_user_id": None,
                        "reference": f"config_revision_{revision}",
                        "notes": "Derived from harness profile config history.",
                        "metadata": {
                            "auth_scheme": profile.auth_scheme,
                            "config_revision": revision,
                            "profile_label": profile.label,
                        },
                        "history_source": "harness_config_history",
                    }
                )
        return events

    def harness_secret_posture(self) -> list[dict[str, object]]:
        events_by_profile: dict[str, list[dict[str, object]]] = {}
        for record in self._state.secret_rotation_events:
            if record.target_type != "harness_profile":
                continue
            events_by_profile.setdefault(record.target_id, []).append(self._serialize_secret_rotation_event(record))
        for event in self._derived_harness_rotation_events():
            events_by_profile.setdefault(str(event["target_id"]), []).append(event)

        posture: list[dict[str, object]] = []
        for profile in sorted(self._harness.list_profiles(), key=lambda item: item.provider_key):
            if profile.auth_scheme == "none":
                continue
            configured = bool(profile.auth_value.strip())
            summary = self._rotation_summary(events_by_profile.get(profile.provider_key, []))
            posture.append(
                {
                    "provider_key": profile.provider_key,
                    "label": profile.label,
                    "configured": configured,
                    "auth_mode": profile.auth_scheme,
                    "rotation_support": "harness_profile_rotation",
                    "secret_storage": "repository_backed_configuration",
                    "credential_reference": f"harness_profile:{profile.provider_key}",
                    "config_revision": profile.config_revision,
                    "history_source": "harness_config_history",
                    "needs_rotation_evidence": configured and int(summary["history_count"]) == 0,
                    **summary,
                }
            )
        return posture

    def list_secret_rotation_events(self, *, limit: int = 200) -> list[dict[str, object]]:
        explicit_events = [self._serialize_secret_rotation_event(record) for record in self._state.secret_rotation_events]
        ordered = sorted(
            [*explicit_events, *self._derived_harness_rotation_events()],
            key=lambda item: str(item["recorded_at"]),
            reverse=True,
        )
        return ordered[: max(1, limit)]

    def record_secret_rotation(
        self,
        *,
        target_type: str,
        target_id: str,
        kind: str,
        actor: AuthenticatedAdmin,
        reference: str | None = None,
        notes: str | None = None,
    ) -> SecretRotationEventRecord:
        normalized_target_type = target_type.strip().lower()
        if normalized_target_type not in {"provider", "harness_profile"}:
            raise ValueError("unsupported_rotation_target")

        normalized_target_id = target_id.strip()
        if not normalized_target_id:
            raise ValueError("rotation_target_required")

        normalized_kind = kind.strip().lower()
        allowed_kinds = {"manual_env_rotation", "oauth_token_rotation", "api_key_rotation", "harness_profile_rotation"}
        if normalized_kind not in allowed_kinds:
            raise ValueError("unsupported_rotation_kind")

        if normalized_target_type == "provider":
            known_providers = {str(item["provider"]) for item in self._runtime_provider_secret_posture()}
            if normalized_target_id not in known_providers:
                raise ValueError("provider_not_found")
            if normalized_kind == "harness_profile_rotation":
                raise ValueError("unsupported_rotation_kind_for_provider")
        else:
            try:
                profile = self._harness.get_profile(normalized_target_id)
            except ValueError as exc:
                raise ValueError("harness_profile_not_found") from exc
            if profile.auth_scheme == "none":
                raise ValueError("harness_profile_has_no_secret")
            if normalized_kind != "harness_profile_rotation":
                raise ValueError("unsupported_rotation_kind_for_harness_profile")

        record = SecretRotationEventRecord(
            event_id=f"rotate_{uuid4().hex[:12]}",
            target_type=normalized_target_type,  # type: ignore[arg-type]
            target_id=normalized_target_id,
            kind=normalized_kind,  # type: ignore[arg-type]
            recorded_at=self._now_iso(),
            recorded_by_user_id=actor.user_id,
            reference=reference.strip() if reference and reference.strip() else None,
            notes=notes.strip() if notes and notes.strip() else None,
            metadata={"recorded_via": "admin_security_api"},
        )
        self._state.secret_rotation_events.append(record)
        limit = max(100, self._settings.audit_event_retention_limit)
        self._state.secret_rotation_events = self._state.secret_rotation_events[-limit:]
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action="secret_rotation_record",
            target_type=normalized_target_type,
            target_id=normalized_target_id,
            status="ok",
            details=f"Secret rotation evidence recorded for '{normalized_target_id}'.",
            metadata={
                "kind": normalized_kind,
                "reference": record.reference,
            },
        )
        self._persist()
        return record

    def provider_secret_posture(self) -> list[dict[str, object]]:
        explicit_events: dict[str, list[dict[str, object]]] = {}
        for record in self._state.secret_rotation_events:
            if record.target_type != "provider":
                continue
            explicit_events.setdefault(record.target_id, []).append(self._serialize_secret_rotation_event(record))

        posture = []
        for provider in self._runtime_provider_secret_posture():
            summary = self._rotation_summary(explicit_events.get(str(provider["provider"]), []))
            posture.append(
                {
                    **provider,
                    "history_source": "governance_recorded_event",
                    "needs_rotation_evidence": bool(provider["configured"]) and int(summary["history_count"]) == 0,
                    **summary,
                }
            )

        harness_profiles = self.harness_secret_posture()
        if harness_profiles:
            harness_events = [
                self._serialize_secret_rotation_event(record)
                for record in self._state.secret_rotation_events
                if record.target_type == "harness_profile"
            ]
            harness_events.extend(self._derived_harness_rotation_events())
            harness_summary = self._rotation_summary(harness_events)
            latest_harness_event = (
                max(harness_events, key=lambda item: str(item["recorded_at"]))
                if harness_events
                else None
            )
            auth_modes = sorted({str(item["auth_mode"]) for item in harness_profiles})
            posture.append(
                {
                    "provider": "generic_harness",
                    "configured": any(bool(item["configured"]) for item in harness_profiles),
                    "auth_mode": auth_modes[0] if len(auth_modes) == 1 else "mixed_profiles",
                    "rotation_support": "harness_profile_rotation",
                    "secret_storage": "repository_backed_configuration",
                    "credential_reference": "harness_profiles",
                    "profile_count": len(harness_profiles),
                    "history_source": "harness_config_history",
                    "needs_rotation_evidence": any(bool(item["configured"]) for item in harness_profiles) and int(harness_summary["history_count"]) == 0,
                    **harness_summary,
                    "last_rotation_reference": (
                        f"{latest_harness_event['target_id']}:{latest_harness_event.get('reference')}"
                        if latest_harness_event and latest_harness_event.get("reference")
                        else harness_summary["last_rotation_reference"]
                    ),
                }
            )

        return posture

    def secret_storage_controls(self) -> list[dict[str, object]]:
        return [
            {
                "credential_class": "admin_password",
                "storage": "pbkdf2_sha256",
                "plaintext_persisted": False,
                "notes": "Admin passwords are salted and hashed before persistence.",
            },
            {
                "credential_class": "admin_session_token",
                "storage": "sha256_hash",
                "plaintext_persisted": False,
                "notes": "Bearer session tokens are only returned once and stored hashed at rest.",
            },
            {
                "credential_class": "runtime_gateway_key",
                "storage": "sha256_hash",
                "plaintext_persisted": False,
                "notes": "Runtime keys are one-time display secrets with persisted hash only.",
            },
            {
                "credential_class": "provider_secret",
                "storage": "environment_variable",
                "plaintext_persisted": True,
                "notes": "Provider credentials remain operator-managed env/OAuth material and should be backed by external secret management.",
            },
            {
                "credential_class": "harness_profile_secret",
                "storage": "repository_backed_configuration",
                "plaintext_persisted": True,
                "notes": "Generic harness auth material is stored with the profile record and requires database/filesystem controls plus redacted rotation evidence.",
            },
        ]

    def credential_lifecycle_policy(
        self,
        *,
        actor: AuthenticatedAdmin | None = None,
    ) -> dict[str, object]:
        approver_posture = self.elevated_access_approver_posture(actor=actor)
        return {
            "human_sessions": {
                "ttl_hours": self._settings.admin_session_ttl_hours,
                "rotation_trigger": "password_rotation_or_admin_revocation",
                "session_types": ["standard", "impersonation", "break_glass"],
            },
            "elevated_access_requests": {
                "approval_ttl_minutes": self._elevated_access_approval_ttl_minutes,
                "gate_statuses": list(APPROVAL_STATUSES),
                "issuance_states": ["pending", "issued"],
                "requester_claim_required": True,
                "self_approval_allowed": False,
                "approver_availability": approver_posture,
            },
            "service_account_keys": {
                "ttl_days": self._settings.runtime_key_ttl_days,
                "rotation_warning_days": self._settings.runtime_key_rotation_warning_days,
                "revocation_modes": ["disable", "revoke", "rotate"],
                "hashing": "sha256",
            },
            "impersonation_sessions": {
                "max_ttl_minutes": self._settings.impersonation_session_max_minutes,
                "approval_reference_required": True,
                "notification_targets_required": True,
                "approval_required_before_issue": True,
                "read_only": True,
                "write_capable_admin_routes": False,
            },
            "break_glass_sessions": {
                "max_ttl_minutes": self._settings.break_glass_session_max_minutes,
                "approval_reference_required": True,
                "notification_targets_required": True,
                "approval_required_before_issue": True,
                "eligible_roles": ["owner", "admin", "operator"],
            },
            "audit": {
                "retention_event_limit": self._settings.audit_event_retention_limit,
                "covered_actions": [
                    "admin_login",
                    "admin_role_change",
                    "runtime_key_issue",
                    "runtime_key_rotate",
                    "admin_token_exchange",
                    "admin_impersonation_requested",
                    "admin_impersonation_approved",
                    "admin_impersonation_rejected",
                    "admin_impersonation_cancelled",
                    "admin_impersonation_recovery_required",
                    "admin_impersonation_timed_out",
                    "admin_impersonation_start",
                    "admin_break_glass_requested",
                    "admin_break_glass_approved",
                    "admin_break_glass_rejected",
                    "admin_break_glass_cancelled",
                    "admin_break_glass_recovery_required",
                    "admin_break_glass_timed_out",
                    "admin_break_glass_start",
                    "secret_rotation_record",
                ],
            },
            "rate_limits": {
                "admin_login": {
                    "attempt_limit": self._settings.admin_login_rate_limit_attempts,
                    "window_minutes": self._settings.admin_login_rate_limit_window_minutes,
                }
            },
            "observability": {
                "required_metrics": [
                    "auth_latency_ms",
                    "auth_denials_total",
                    "credential_rotations_total",
                    "active_break_glass_sessions",
                    "active_impersonation_sessions",
                    "suspicious_auth_failures_total",
                ],
                "required_alerts": [
                    "break_glass_session_started",
                    "impersonation_session_started",
                    "repeated_login_failures",
                    "runtime_key_expiring",
                ],
            },
        }

    def list_accounts(
        self,
        *,
        instance_id: str | None = None,
        tenant_id: str | None = None,
    ) -> list[GatewayAccountRecord]:
        effective_instance_id = self._effective_instance_scope(instance_id)
        effective_tenant_id = self._effective_tenant_scope(tenant_id)
        accounts = sorted(self._state.gateway_accounts, key=lambda item: item.label.lower())
        if effective_instance_id is not None:
            accounts = [
                item
                for item in accounts
                if self._normalize_instance_scope(item.instance_id) == effective_instance_id
            ]
        if effective_tenant_id is None:
            return accounts
        return [
            item
            for item in accounts
            if normalize_tenant_id(item.tenant_id, fallback_tenant_id=self._default_tenant_scope()) == effective_tenant_id
        ]

    def create_account(
        self,
        *,
        instance_id: str | None,
        tenant_id: str | None,
        label: str,
        provider_bindings: list[str] | None,
        notes: str,
        actor: AuthenticatedAdmin,
    ) -> GatewayAccountRecord:
        now = self._now_iso()
        normalized_instance_id = self._normalize_instance_scope(instance_id)
        normalized_tenant_id = normalize_tenant_id(
            tenant_id,
            fallback_tenant_id=self._tenant_scope_for_instance(normalized_instance_id),
        )
        account = GatewayAccountRecord(
            account_id=f"acct_{uuid4().hex[:10]}",
            instance_id=normalized_instance_id,
            tenant_id=normalized_tenant_id,
            label=label.strip(),
            provider_bindings=sorted(set(provider_bindings or [])),
            notes=notes.strip(),
            created_at=now,
            updated_at=now,
        )
        self._state.gateway_accounts.append(account)
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action="account_create",
            target_type="gateway_account",
            target_id=account.account_id,
            status="ok",
            details=f"Account '{account.label}' created.",
            instance_id=account.instance_id,
            tenant_id=account.tenant_id,
            metadata={"account_id": account.account_id},
        )
        self._persist()
        return account

    def update_account(
        self,
        account_id: str,
        *,
        instance_id: str | None,
        label: str | None,
        provider_bindings: list[str] | None,
        notes: str | None,
        status: str | None,
        actor: AuthenticatedAdmin,
    ) -> GatewayAccountRecord:
        account = next((item for item in self._state.gateway_accounts if item.account_id == account_id), None)
        if account is None:
            raise ValueError(f"Account '{account_id}' not found.")
        if instance_id is not None and self._normalize_instance_scope(account.instance_id) != self._normalize_instance_scope(instance_id):
            raise ValueError(f"Account '{account_id}' is not bound to instance '{instance_id}'.")
        if label is not None:
            account.label = label.strip()
        if provider_bindings is not None:
            account.provider_bindings = sorted(set(provider_bindings))
        if notes is not None:
            account.notes = notes.strip()
        if status is not None:
            if status not in {"active", "suspended", "disabled"}:
                raise ValueError(f"Unsupported account status '{status}'.")
            account.status = status  # type: ignore[assignment]
        account.updated_at = self._now_iso()
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action="account_update",
            target_type="gateway_account",
            target_id=account.account_id,
            status="ok",
            details=f"Account '{account.label}' updated.",
            instance_id=account.instance_id,
            tenant_id=account.tenant_id,
            metadata={"account_id": account.account_id},
        )
        self._persist()
        return account

    def list_runtime_keys(
        self,
        *,
        instance_id: str | None = None,
        tenant_id: str | None = None,
    ) -> list[RuntimeKeyRecord]:
        effective_instance_id = self._effective_instance_scope(instance_id)
        effective_tenant_id = self._effective_tenant_scope(tenant_id)
        keys = sorted(self._state.runtime_keys, key=lambda item: item.created_at, reverse=True)
        if effective_instance_id is not None:
            keys = [
                item
                for item in keys
                if self._normalize_instance_scope(item.instance_id) == effective_instance_id
            ]
        if effective_tenant_id is None:
            return keys
        return [
            item
            for item in keys
            if normalize_tenant_id(item.tenant_id, fallback_tenant_id=self._default_tenant_scope()) == effective_tenant_id
        ]

    def issue_runtime_key(
        self,
        *,
        instance_id: str | None,
        tenant_id: str | None,
        account_id: str | None,
        label: str,
        scopes: list[str],
        actor: AuthenticatedAdmin,
        rotated_from: str | None = None,
        allowed_request_paths: list[object] | None = None,
        default_request_path: object | None = None,
        pinned_target_key: object | None = None,
        local_only_policy: object | None = None,
        review_required_conditions: list[object] | None = None,
    ) -> IssuedApiKey:
        now = self._now_iso()
        normalized_account_id = self._normalize_scope_value(account_id)
        account = self._find_account_by_id(normalized_account_id)
        if normalized_account_id is not None and account is None:
            raise ValueError(f"Account '{normalized_account_id}' not found.")
        request_path_policy = self._normalize_runtime_request_policy(
            allowed_request_paths=allowed_request_paths,
            default_request_path=default_request_path,
            pinned_target_key=pinned_target_key,
            local_only_policy=local_only_policy,
            review_required_conditions=review_required_conditions,
        )

        normalized_instance_id = self._normalize_instance_scope(
            account.instance_id if account is not None else instance_id
        )
        normalized_tenant_id = normalize_tenant_id(
            account.tenant_id if account is not None else tenant_id,
            fallback_tenant_id=self._tenant_scope_for_instance(normalized_instance_id),
        )

        if account is not None:
            if instance_id is not None and normalized_instance_id != self._normalize_instance_scope(instance_id):
                raise ValueError(
                    f"Account '{normalized_account_id}' is not bound to instance '{instance_id}'."
                )
            if normalized_tenant_id != normalize_tenant_id(
                account.tenant_id,
                fallback_tenant_id=self._default_tenant_scope(),
            ):
                raise ValueError(
                    f"Account '{normalized_account_id}' tenant scope does not match the requested runtime key scope."
                )

        token = issue_runtime_key_token()
        prefix = token[:16]
        record = RuntimeKeyRecord(
            key_id=f"key_{uuid4().hex[:12]}",
            instance_id=normalized_instance_id,
            tenant_id=normalized_tenant_id,
            account_id=normalized_account_id,
            label=label.strip(),
            prefix=prefix,
            secret_hash=hash_token(token),
            scopes=sorted(set(scopes)),
            created_at=now,
            updated_at=now,
            expires_at=(self._now() + timedelta(days=max(1, self._settings.runtime_key_ttl_days))).isoformat(),
            last_rotated_at=now,
            rotated_from=rotated_from,
            created_by=actor.user_id,
            allowed_request_paths=request_path_policy["allowed_request_paths"],  # type: ignore[arg-type]
            default_request_path=request_path_policy["default_request_path"],  # type: ignore[arg-type]
            pinned_target_key=request_path_policy["pinned_target_key"],  # type: ignore[arg-type]
            local_only_policy=request_path_policy["local_only_policy"],  # type: ignore[arg-type]
            review_required_conditions=request_path_policy["review_required_conditions"],  # type: ignore[arg-type]
        )
        self._state.runtime_keys.append(record)
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action="runtime_key_issue",
            target_type="runtime_key",
            target_id=record.key_id,
            status="ok",
            details=f"Runtime key '{record.label}' issued.",
            instance_id=record.instance_id,
            tenant_id=record.tenant_id,
            metadata={
                "account_id": normalized_account_id,
                "scopes": record.scopes,
                "expires_at": record.expires_at,
                "default_request_path": record.default_request_path,
                "allowed_request_paths": list(record.allowed_request_paths),
                "pinned_target_key": record.pinned_target_key,
            },
        )
        self._persist()
        return IssuedApiKey(
            key_id=record.key_id,
            instance_id=record.instance_id,
            tenant_id=record.tenant_id,
            token=token,
            prefix=record.prefix,
            account_id=record.account_id,
            label=record.label,
            scopes=record.scopes,
            created_at=record.created_at,
            allowed_request_paths=list(record.allowed_request_paths),
            default_request_path=record.default_request_path,
            pinned_target_key=record.pinned_target_key,
            local_only_policy=record.local_only_policy,
            review_required_conditions=list(record.review_required_conditions),
        )

    def rotate_runtime_key(
        self,
        key_id: str,
        actor: AuthenticatedAdmin,
        *,
        instance_id: str | None = None,
    ) -> IssuedApiKey:
        current = next((item for item in self._state.runtime_keys if item.key_id == key_id), None)
        if current is None:
            raise ValueError(f"Runtime key '{key_id}' not found.")
        if instance_id is not None and self._normalize_instance_scope(current.instance_id) != self._normalize_instance_scope(instance_id):
            raise ValueError(f"Runtime key '{key_id}' is not bound to instance '{instance_id}'.")
        current.status = "revoked"
        current.updated_at = self._now_iso()
        current.revoked_at = self._now_iso()
        current.revoked_reason = "rotated"
        issued = self.issue_runtime_key(
            instance_id=current.instance_id,
            tenant_id=current.tenant_id,
            account_id=current.account_id,
            label=f"{current.label} (rotated)",
            scopes=current.scopes,
            actor=actor,
            rotated_from=current.key_id,
            allowed_request_paths=list(current.allowed_request_paths),
            default_request_path=current.default_request_path,
            pinned_target_key=current.pinned_target_key,
            local_only_policy=current.local_only_policy,
            review_required_conditions=list(current.review_required_conditions),
        )
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action="runtime_key_rotate",
            target_type="runtime_key",
            target_id=issued.key_id,
            status="ok",
            details=f"Runtime key '{current.label}' rotated.",
            instance_id=current.instance_id,
            tenant_id=current.tenant_id,
            metadata={"rotated_from": current.key_id, "rotated_to": issued.key_id},
        )
        self._persist()
        return issued

    def set_runtime_key_status(
        self,
        key_id: str,
        status: str,
        actor: AuthenticatedAdmin,
        *,
        instance_id: str | None = None,
    ) -> RuntimeKeyRecord:
        record = next((item for item in self._state.runtime_keys if item.key_id == key_id), None)
        if record is None:
            raise ValueError(f"Runtime key '{key_id}' not found.")
        if instance_id is not None and self._normalize_instance_scope(record.instance_id) != self._normalize_instance_scope(instance_id):
            raise ValueError(f"Runtime key '{key_id}' is not bound to instance '{instance_id}'.")
        if status not in {"active", "disabled", "revoked"}:
            raise ValueError(f"Unsupported runtime key status '{status}'.")
        record.status = status  # type: ignore[assignment]
        record.updated_at = self._now_iso()
        if status == "revoked":
            record.revoked_at = self._now_iso()
            record.revoked_reason = "admin_revoked"
        elif status == "active":
            record.revoked_at = None
            record.revoked_reason = None
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action="runtime_key_status",
            target_type="runtime_key",
            target_id=record.key_id,
            status="ok",
            details=f"Runtime key '{record.label}' set to {status}.",
            instance_id=record.instance_id,
            tenant_id=record.tenant_id,
            metadata={"account_id": record.account_id},
        )
        self._persist()
        return record

    def update_runtime_key_request_path_policy(
        self,
        key_id: str,
        *,
        actor: AuthenticatedAdmin,
        instance_id: str | None = None,
        allowed_request_paths: list[object] | None = None,
        default_request_path: object | None = None,
        pinned_target_key: object | None = None,
        local_only_policy: object | None = None,
        review_required_conditions: list[object] | None = None,
    ) -> RuntimeKeyRecord:
        record = next((item for item in self._state.runtime_keys if item.key_id == key_id), None)
        if record is None:
            raise ValueError(f"Runtime key '{key_id}' not found.")
        if instance_id is not None and self._normalize_instance_scope(record.instance_id) != self._normalize_instance_scope(instance_id):
            raise ValueError(f"Runtime key '{key_id}' is not bound to instance '{instance_id}'.")
        policy = self._normalize_runtime_request_policy(
            allowed_request_paths=allowed_request_paths if allowed_request_paths is not None else list(record.allowed_request_paths),
            default_request_path=default_request_path if default_request_path is not None else record.default_request_path,
            pinned_target_key=pinned_target_key,
            local_only_policy=local_only_policy if local_only_policy is not None else record.local_only_policy,
            review_required_conditions=review_required_conditions if review_required_conditions is not None else list(record.review_required_conditions),
        )
        record.allowed_request_paths = policy["allowed_request_paths"]  # type: ignore[assignment]
        record.default_request_path = policy["default_request_path"]  # type: ignore[assignment]
        record.pinned_target_key = policy["pinned_target_key"]  # type: ignore[assignment]
        record.local_only_policy = policy["local_only_policy"]  # type: ignore[assignment]
        record.review_required_conditions = policy["review_required_conditions"]  # type: ignore[assignment]
        record.updated_at = self._now_iso()
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action="runtime_key_request_path_policy_update",
            target_type="runtime_key",
            target_id=record.key_id,
            status="ok",
            details=f"Runtime key '{record.label}' request-path policy updated.",
            instance_id=record.instance_id,
            tenant_id=record.tenant_id,
            metadata={
                "allowed_request_paths": list(record.allowed_request_paths),
                "default_request_path": record.default_request_path,
                "pinned_target_key": record.pinned_target_key,
                "local_only_policy": record.local_only_policy,
                "review_required_conditions": list(record.review_required_conditions),
            },
        )
        self._persist()
        return record

    def authenticate_runtime_key(self, token: str) -> RuntimeGatewayIdentity | None:
        if not token.strip():
            return None
        token_hash = hash_token(token)
        record = next((item for item in self._state.runtime_keys if item.secret_hash == token_hash and item.status == "active"), None)
        if record is None:
            return None
        if record.expires_at and datetime.fromisoformat(record.expires_at) <= self._now():
            record.status = "revoked"
            record.revoked_at = self._now_iso()
            record.revoked_reason = "expired"
            record.updated_at = self._now_iso()
            self._append_audit(
                actor_type="system",
                actor_id=None,
                action="runtime_key_expired",
                target_type="runtime_key",
                target_id=record.key_id,
                status="warning",
                details=f"Runtime key '{record.label}' expired during authentication.",
            )
            self._persist()
            return None
        account_id = self._normalize_scope_value(record.account_id)
        if account_id is None:
            self._deny_unbound_runtime_key(record=record, binding_state="missing_account_id")
        account = self._find_account_by_id(account_id)
        if account is None:
            self._deny_unbound_runtime_key(record=record, binding_state="account_not_found")
        if account.status != "active":
            self._deny_runtime_account_status(record=record, account=account)
        record.last_used_at = self._now_iso()
        record.updated_at = self._now_iso()
        account.last_activity_at = self._now_iso()
        account.updated_at = self._now_iso()
        self._persist()
        return RuntimeGatewayIdentity(
            key_id=record.key_id,
            instance_id=record.instance_id,
            tenant_id=record.tenant_id,
            account_id=account.account_id,
            account_label=account.label,
            account_status=account.status,
            provider_bindings=list(account.provider_bindings),
            scopes=list(record.scopes),
            client_id=record.prefix,
            consumer=account.label,
            integration="runtime_gateway",
            allowed_request_paths=list(record.allowed_request_paths),
            default_request_path=record.default_request_path,
            pinned_target_key=record.pinned_target_key,
            local_only_policy=record.local_only_policy,
            review_required_conditions=list(record.review_required_conditions),
        )

    def resolve_runtime_request_path(
        self,
        *,
        identity: RuntimeGatewayIdentity,
        requested_path: str | None = None,
        runtime_route: str | None = None,
    ) -> RuntimeRequestPathDecision:
        allowed = self._normalize_runtime_request_paths(list(identity.allowed_request_paths))
        normalized_default = self._normalize_runtime_request_policy(
            allowed_request_paths=allowed,
            default_request_path=identity.default_request_path,
            pinned_target_key=identity.pinned_target_key,
            local_only_policy=identity.local_only_policy,
            review_required_conditions=list(identity.review_required_conditions),
        )
        selected_via = "default"
        if requested_path and requested_path.strip():
            candidate = requested_path.strip().lower()
            if candidate not in _RUNTIME_REQUEST_PATHS:
                raise RuntimeAuthorizationError(
                    status_code=403,
                    error_type="request_path_blocked",
                    message=f"Runtime request path '{candidate}' is not supported.",
                    details={},
                )
            selected = candidate
            selected_via = "header"
        else:
            selected = str(normalized_default["default_request_path"])

        if selected not in allowed:
            self._append_audit(
                actor_type="runtime_key",
                actor_id=identity.key_id,
                action="runtime_request_path_denied",
                target_type="runtime_route",
                target_id=runtime_route,
                status="failed",
                details=f"Runtime request path '{selected}' is not allowed for key '{identity.key_id}'.",
                metadata={
                    "runtime_key_id": identity.key_id,
                    "requested_path": selected,
                    "allowed_request_paths": list(allowed),
                    "runtime_route": runtime_route,
                },
            )
            self._persist()
            raise RuntimeAuthorizationError(
                status_code=403,
                error_type="request_path_blocked",
                message=f"Runtime request path '{selected}' is blocked for this API key.",
                details={},
            )
        if selected == "blocked":
            self._append_audit(
                actor_type="runtime_key",
                actor_id=identity.key_id,
                action="runtime_request_path_blocked",
                target_type="runtime_route",
                target_id=runtime_route,
                status="failed",
                details=f"Runtime request path '{selected}' blocked the request.",
                metadata={
                    "runtime_key_id": identity.key_id,
                    "allowed_request_paths": list(allowed),
                    "runtime_route": runtime_route,
                },
            )
            self._persist()
            raise RuntimeAuthorizationError(
                status_code=403,
                error_type="request_path_blocked",
                message="Runtime request path is blocked for this API key.",
                details={},
            )
        if selected == "review_required":
            self._append_audit(
                actor_type="runtime_key",
                actor_id=identity.key_id,
                action="runtime_request_path_review_required",
                target_type="runtime_route",
                target_id=runtime_route,
                status="warning",
                details=f"Runtime request path '{selected}' requires operator review.",
                metadata={
                    "runtime_key_id": identity.key_id,
                    "review_required_conditions": list(identity.review_required_conditions),
                    "runtime_route": runtime_route,
                },
            )
            self._persist()
            raise RuntimeAuthorizationError(
                status_code=403,
                error_type="request_path_review_required",
                message="Runtime request path requires review before execution.",
                details={},
            )
        if selected == "pinned_target" and not self._normalize_scope_value(identity.pinned_target_key):
            raise RuntimeAuthorizationError(
                status_code=403,
                error_type="request_path_blocked",
                message="Pinned-target request path is configured without a target binding.",
                details={},
            )
        return RuntimeRequestPathDecision(
            request_path=selected,  # type: ignore[arg-type]
            default_request_path=str(normalized_default["default_request_path"]),  # type: ignore[arg-type]
            allowed_request_paths=list(allowed),  # type: ignore[arg-type]
            pinned_target_key=self._normalize_scope_value(identity.pinned_target_key),
            local_only_policy=str(normalized_default["local_only_policy"]),  # type: ignore[arg-type]
            review_required_conditions=list(identity.review_required_conditions),
            selected_via=selected_via,  # type: ignore[arg-type]
        )

    def list_setting_overrides(self) -> list[MutableSettingRecord]:
        return sorted(self._state.setting_overrides, key=lambda item: (item.category, item.key))

    def upsert_setting_override(self, *, key: str, value: Any, category: str, actor: AuthenticatedAdmin) -> MutableSettingRecord:
        existing = next((item for item in self._state.setting_overrides if item.key == key), None)
        record = MutableSettingRecord(
            key=key,
            value=value,
            category=category,
            updated_at=self._now_iso(),
            updated_by=actor.user_id,
        )
        if existing is None:
            self._state.setting_overrides.append(record)
        else:
            index = self._state.setting_overrides.index(existing)
            self._state.setting_overrides[index] = record
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action="setting_override_upsert",
            target_type="setting",
            target_id=key,
            status="ok",
            details=f"Setting '{key}' updated.",
        )
        self._persist()
        return record

    def remove_setting_override(self, *, key: str, actor: AuthenticatedAdmin) -> None:
        before = len(self._state.setting_overrides)
        self._state.setting_overrides = [item for item in self._state.setting_overrides if item.key != key]
        if len(self._state.setting_overrides) == before:
            raise ValueError(f"Setting override '{key}' not found.")
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action="setting_override_remove",
            target_type="setting",
            target_id=key,
            status="ok",
            details=f"Setting '{key}' reset to default.",
        )
        self._persist()

    def list_audit_events(
        self,
        *,
        limit: int = 200,
        tenant_id: str | None = None,
        company_id: str | None = None,
    ) -> list[AuditEventRecord]:
        events = self._audit_events_for_scope(
            tenant_id=tenant_id,
            company_id=company_id,
            require_explicit_scope=False,
        )
        return events[: max(1, limit)]

    def record_admin_audit_event(
        self,
        *,
        actor: AuthenticatedAdmin,
        action: str,
        target_type: str,
        target_id: str | None,
        status: str,
        details: str,
        metadata: dict[str, Any] | None = None,
        instance_id: str | None = None,
        tenant_id: str | None = None,
        company_id: str | None = None,
    ) -> AuditEventRecord:
        event = self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            status=status,
            details=details,
            metadata=metadata,
            instance_id=instance_id,
            tenant_id=tenant_id,
            company_id=company_id,
        )
        self._persist()
        return event

    def _create_elevated_access_request(
        self,
        *,
        request_type: str,
        requested_by_user_id: str,
        target_user: AdminUserRecord,
        session_role: str,
        approval_reference: str,
        justification: str,
        notification_targets: list[str],
        duration_minutes: int,
    ) -> ElevatedAccessRequestRecord:
        now = self._now()
        normalized_reference = approval_reference.strip()
        normalized_justification = justification.strip()
        normalized_targets = self._normalize_notification_targets(notification_targets)
        record = ElevatedAccessRequestRecord(
            request_id=f"elev_{uuid4().hex[:12]}",
            request_type=request_type,  # type: ignore[arg-type]
            requested_by_user_id=requested_by_user_id,
            target_user_id=target_user.user_id,
            target_role=target_user.role,
            session_role=session_role,  # type: ignore[arg-type]
            approval_reference=normalized_reference,
            justification=normalized_justification,
            notification_targets=normalized_targets,
            duration_minutes=max(1, duration_minutes),
            approval_expires_at=(now + timedelta(minutes=self._elevated_access_approval_ttl_minutes)).isoformat(),
            created_at=now.isoformat(),
            updated_at=now.isoformat(),
        )
        self._state.elevated_access_requests.append(record)

        action_prefix = self._request_action_prefix(request_type)
        self._append_audit(
            actor_type="admin_user",
            actor_id=requested_by_user_id,
            action=f"{action_prefix}_requested",
            target_type="elevated_access_request",
            target_id=record.request_id,
            status="warning",
            details=f"{request_type.replace('_', '-').title()} approval request created for '{target_user.username}'.",
            metadata={
                "request_type": request_type,
                "request_id": record.request_id,
                "target_user_id": target_user.user_id,
                "approval_reference": normalized_reference,
                "notification_targets": normalized_targets,
                "duration_minutes": record.duration_minutes,
                "approval_expires_at": record.approval_expires_at,
            },
        )
        self._persist()
        return record

    def list_elevated_access_requests(
        self,
        *,
        actor: AuthenticatedAdmin,
        gate_status: str | None = None,
    ) -> list[dict[str, object]]:
        self._prune_expired_elevated_access_requests()
        normalized_status = gate_status.strip().lower() if gate_status else None
        requests = sorted(self._state.elevated_access_requests, key=lambda item: item.created_at, reverse=True)
        if not role_allows(actor.role, "admin"):
            requests = [item for item in requests if item.requested_by_user_id == actor.user_id]
        if normalized_status is not None:
            requests = [item for item in requests if item.gate_status == normalized_status]
        return [self._serialize_elevated_access_request(item) for item in requests]

    def list_elevated_access_requests_for_approval_review(
        self,
        *,
        actor: AuthenticatedAdmin,
        gate_status: str | None = None,
    ) -> list[dict[str, object]]:
        self._prune_expired_elevated_access_requests()
        self._authorize_shared_elevated_access_approval_read(actor=actor)
        normalized_status = gate_status.strip().lower() if gate_status else None
        requests = sorted(self._state.elevated_access_requests, key=lambda item: item.created_at, reverse=True)
        if normalized_status is not None:
            requests = [item for item in requests if item.gate_status == normalized_status]
        return [self._serialize_elevated_access_request(item) for item in requests]

    def get_elevated_access_request(
        self,
        *,
        request_id: str,
        actor: AuthenticatedAdmin,
    ) -> dict[str, object]:
        self._prune_expired_elevated_access_requests()
        record = self._find_elevated_access_request(request_id)
        if record is None:
            raise GovernanceNotFoundError("elevated_access_request_not_found")
        self._authorize_elevated_access_request_read(actor=actor, record=record)
        return self._serialize_elevated_access_request(record)

    def get_elevated_access_request_for_approval_review(
        self,
        *,
        request_id: str,
        actor: AuthenticatedAdmin,
    ) -> dict[str, object]:
        self._prune_expired_elevated_access_requests()
        record = self._find_elevated_access_request(request_id)
        if record is None:
            raise GovernanceNotFoundError("elevated_access_request_not_found")
        self._authorize_shared_elevated_access_approval_read(actor=actor)
        return self._serialize_elevated_access_request(record)

    def request_impersonation_session(
        self,
        *,
        target_user_id: str,
        actor: AuthenticatedAdmin,
        justification: str,
        approval_reference: str,
        notification_targets: list[str],
        duration_minutes: int,
    ) -> dict[str, object]:
        self._prune_expired_elevated_access_requests()
        if not role_allows(actor.role, "admin"):
            raise PermissionError("admin_role_required")
        target_user = self._find_user_by_id(target_user_id)
        if target_user is None or target_user.status != "active":
            raise ValueError("admin_user_not_found")
        minutes = max(1, duration_minutes)
        if minutes > self._settings.impersonation_session_max_minutes:
            raise ValueError("impersonation_ttl_exceeds_policy")
        self._raise_recovery_required_for_elevated_access(
            request_type="impersonation",
            actor=actor,
            target_user=target_user,
        )
        self._ensure_no_active_elevated_session_conflicts(actor.user_id, target_user.user_id)
        record = self._create_elevated_access_request(
            request_type="impersonation",
            requested_by_user_id=actor.user_id,
            target_user=target_user,
            session_role=target_user.role,
            approval_reference=approval_reference,
            justification=justification,
            notification_targets=notification_targets,
            duration_minutes=minutes,
        )
        return self._serialize_elevated_access_request(record)

    def request_break_glass_session(
        self,
        *,
        actor: AuthenticatedAdmin,
        justification: str,
        approval_reference: str,
        notification_targets: list[str],
        duration_minutes: int,
    ) -> dict[str, object]:
        self._prune_expired_elevated_access_requests()
        if not role_allows(actor.role, "operator"):
            raise PermissionError("break_glass_role_not_eligible")
        actor_user = self._find_user_by_id(actor.user_id)
        if actor_user is None or actor_user.status != "active":
            raise ValueError("admin_user_not_found")
        minutes = max(1, duration_minutes)
        if minutes > self._settings.break_glass_session_max_minutes:
            raise ValueError("break_glass_ttl_exceeds_policy")
        self._raise_recovery_required_for_elevated_access(
            request_type="break_glass",
            actor=actor,
            target_user=actor_user,
        )
        self._ensure_no_active_elevated_session_conflict(actor.user_id)
        record = self._create_elevated_access_request(
            request_type="break_glass",
            requested_by_user_id=actor.user_id,
            target_user=actor_user,
            session_role="admin",
            approval_reference=approval_reference,
            justification=justification,
            notification_targets=notification_targets,
            duration_minutes=minutes,
        )
        return self._serialize_elevated_access_request(record)

    def _decide_elevated_access_request(
        self,
        *,
        request_id: str,
        actor: AuthenticatedAdmin,
        approved: bool,
        decision_note: str,
    ) -> dict[str, object]:
        self._prune_expired_elevated_access_requests()
        record = self._find_elevated_access_request(request_id)
        if record is None:
            raise GovernanceNotFoundError("elevated_access_request_not_found")
        if not role_allows(actor.role, "admin"):
            raise PermissionError("admin_role_required")
        if actor.user_id == record.requested_by_user_id:
            raise PermissionError("elevated_access_self_approval_forbidden")
        if record.gate_status != "open":
            raise GovernanceConflictError("elevated_access_request_not_open")
        if approved:
            self._ensure_no_active_elevated_session_conflicts(
                record.requested_by_user_id,
                record.target_user_id,
            )

        record.gate_status = "approved" if approved else "rejected"
        record.decision_note = decision_note.strip()
        record.decided_at = self._now_iso()
        record.decided_by_user_id = actor.user_id
        record.updated_at = record.decided_at

        action_prefix = self._request_action_prefix(record.request_type)
        target_user = self._find_user_by_id(record.target_user_id)
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action=f"{action_prefix}_{'approved' if approved else 'rejected'}",
            target_type="elevated_access_request",
            target_id=record.request_id,
            status="ok" if approved else "warning",
            details=(
                f"{record.request_type.replace('_', '-').title()} request for '{self._request_target_label(record, target_user)}' "
                f"{'approved' if approved else 'rejected'}."
            ),
            metadata={
                "request_type": record.request_type,
                "request_id": record.request_id,
                "target_user_id": record.target_user_id,
                "approval_reference": record.approval_reference,
                "decision_note": record.decision_note,
            },
        )
        self._persist()
        return self._serialize_elevated_access_request(record)

    def approve_elevated_access_request(
        self,
        *,
        request_id: str,
        actor: AuthenticatedAdmin,
        decision_note: str,
    ) -> dict[str, object]:
        return self._decide_elevated_access_request(
            request_id=request_id,
            actor=actor,
            approved=True,
            decision_note=decision_note,
        )

    def reject_elevated_access_request(
        self,
        *,
        request_id: str,
        actor: AuthenticatedAdmin,
        decision_note: str,
    ) -> dict[str, object]:
        return self._decide_elevated_access_request(
            request_id=request_id,
            actor=actor,
            approved=False,
            decision_note=decision_note,
        )

    def cancel_elevated_access_request(
        self,
        *,
        request_id: str,
        actor: AuthenticatedAdmin,
    ) -> dict[str, object]:
        self._prune_expired_elevated_access_requests()
        record = self._find_elevated_access_request(request_id)
        if record is None:
            raise GovernanceNotFoundError("elevated_access_request_not_found")
        if actor.read_only:
            raise PermissionError("impersonation_session_read_only")
        if not role_allows(actor.role, "operator"):
            raise PermissionError("operator_role_required")
        if record.requested_by_user_id != actor.user_id:
            raise PermissionError("elevated_access_cancel_forbidden")
        if record.gate_status != "open":
            raise GovernanceConflictError("elevated_access_request_not_open")

        now = self._now_iso()
        record.gate_status = "cancelled"
        record.decided_at = now
        record.decided_by_user_id = actor.user_id
        record.updated_at = now

        action_prefix = self._request_action_prefix(record.request_type)
        target_user = self._find_user_by_id(record.target_user_id)
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action=f"{action_prefix}_cancelled",
            target_type="elevated_access_request",
            target_id=record.request_id,
            status="warning",
            details=(
                f"{record.request_type.replace('_', '-').title()} request for "
                f"'{self._request_target_label(record, target_user)}' was cancelled before approval."
            ),
            metadata={
                "request_type": record.request_type,
                "request_id": record.request_id,
                "target_user_id": record.target_user_id,
                "approval_reference": record.approval_reference,
            },
        )
        self._persist()
        return self._serialize_elevated_access_request(record)

    def issue_elevated_access_session(
        self,
        *,
        request_id: str,
        actor: AuthenticatedAdmin,
    ) -> tuple[dict[str, object], AdminLoginResult]:
        self._prune_expired_elevated_access_requests()
        record = self._find_elevated_access_request(request_id)
        if record is None:
            raise GovernanceNotFoundError("elevated_access_request_not_found")
        if record.requested_by_user_id != actor.user_id:
            raise PermissionError("elevated_access_issue_forbidden")
        if record.gate_status != "approved":
            raise GovernanceConflictError("elevated_access_request_not_approved")
        if record.issuance_status == "issued":
            raise GovernanceConflictError("elevated_access_request_already_issued")

        target_user = self._find_user_by_id(record.target_user_id)
        if target_user is None or target_user.status != "active":
            raise ValueError("admin_user_not_found")
        self._ensure_no_active_elevated_session_conflicts(
            record.requested_by_user_id,
            record.target_user_id,
        )

        if record.request_type == "impersonation":
            session_user = target_user
            session_role = target_user.role
            session_type = "impersonation"
            start_action = "admin_impersonation_start"
            start_target_type = "admin_user"
            start_target_id = target_user.user_id
            exchange_details = f"Impersonation token issued for '{target_user.username}' after approval."
            start_details = f"Impersonation session started for '{target_user.username}'."
        else:
            session_user = self._find_user_by_id(actor.user_id)
            if session_user is None or session_user.status != "active":
                raise ValueError("admin_user_not_found")
            session_role = "admin"
            session_type = "break_glass"
            start_action = "admin_break_glass_start"
            start_target_type = "admin_user"
            start_target_id = actor.user_id
            exchange_details = f"Break-glass token issued for '{actor.username}' after approval."
            start_details = f"Break-glass session started for '{actor.username}'."

        result = self._issue_admin_session(
            user=session_user,
            role=session_role,
            session_type=session_type,
            issued_by_user_id=actor.user_id,
            approved_by_user_id=record.decided_by_user_id,
            approval_request_id=record.request_id,
            approval_reference=record.approval_reference,
            justification=record.justification,
            notification_targets=record.notification_targets,
            ttl_minutes=record.duration_minutes,
        )
        record.issuance_status = "issued"
        record.issued_at = self._now_iso()
        record.issued_by_user_id = actor.user_id
        record.issued_session_id = result.user.session_id
        record.updated_at = record.issued_at

        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action="admin_token_exchange",
            target_type="admin_session",
            target_id=result.user.session_id,
            status="warning",
            details=exchange_details,
            metadata={
                "exchange_type": record.request_type,
                "request_id": record.request_id,
                "target_user_id": target_user.user_id,
                "approved_by_user_id": record.decided_by_user_id,
                "approval_reference": record.approval_reference,
                "notification_targets": list(record.notification_targets),
            },
        )
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action=start_action,
            target_type=start_target_type,
            target_id=start_target_id,
            status="warning",
            details=start_details,
            metadata={
                "session_id": result.user.session_id,
                "request_id": record.request_id,
                "approved_by_user_id": record.decided_by_user_id,
            },
        )
        self._persist()
        return self._serialize_elevated_access_request(record), result


@lru_cache(maxsize=1)
def get_governance_service() -> GovernanceService:
    settings = get_settings()
    return GovernanceService(settings, harness_service=get_harness_service())
