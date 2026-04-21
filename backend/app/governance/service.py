"""Governance service for auth, accounts, keys, settings and audit."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any
from uuid import uuid4

from app.auth.local_auth import (
    hash_password,
    hash_token,
    issue_runtime_key_token,
    issue_session_token,
    new_secret_salt,
    verify_password,
)
from app.governance.models import (
    AdminLoginResult,
    AdminSessionRecord,
    AdminUserRecord,
    AuditEventRecord,
    AuthenticatedAdmin,
    GatewayAccountRecord,
    GovernanceStateRecord,
    IssuedApiKey,
    MutableSettingRecord,
    RuntimeGatewayIdentity,
    RuntimeKeyRecord,
)
from app.settings.config import Settings, get_settings
from app.storage.governance_repository import GovernanceRepository, get_governance_repository


class GovernanceService:
    def __init__(self, settings: Settings, repository: GovernanceRepository | None = None):
        self._settings = settings
        self._repository = repository or get_governance_repository(settings)
        self._state = self._repository.load_state()
        self._prune_expired_sessions()
        self._ensure_bootstrap_admin()

    @staticmethod
    def _now() -> datetime:
        return datetime.now(tz=UTC)

    def _now_iso(self) -> str:
        return self._now().isoformat()

    def _persist(self) -> GovernanceStateRecord:
        self._state = self._repository.save_state(self._state)
        return self._state

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
    ) -> None:
        self._state.audit_events.append(
            AuditEventRecord(
                event_id=f"audit_{uuid4().hex[:12]}",
                actor_type=actor_type,
                actor_id=actor_id,
                action=action,
                target_type=target_type,
                target_id=target_id,
                status=status,
                details=details,
                metadata=metadata or {},
                created_at=self._now_iso(),
            )
        )
        self._state.audit_events = self._state.audit_events[-500:]

    def _ensure_bootstrap_admin(self) -> None:
        if self._state.admin_users:
            return
        now = self._now_iso()
        salt = new_secret_salt()
        user = AdminUserRecord(
            user_id=f"admin_{uuid4().hex[:10]}",
            username=self._settings.bootstrap_admin_username,
            display_name="ForgeGate Bootstrap Admin",
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

    def _prune_expired_sessions(self) -> None:
        now = self._now()
        self._state.admin_sessions = [
            session
            for session in self._state.admin_sessions
            if session.revoked_at is None and datetime.fromisoformat(session.expires_at) > now
        ]

    def bootstrap_status(self) -> dict[str, object]:
        user = self._state.admin_users[0] if self._state.admin_users else None
        default_password = self._settings.bootstrap_admin_password == "forgegate-admin"
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

    def login(self, username: str, password: str) -> AdminLoginResult:
        user = self._find_user_by_username(username)
        if user is None or user.status != "active" or not verify_password(password, salt=user.password_salt, expected_hash=user.password_hash):
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

        now = self._now()
        token = issue_session_token()
        session = AdminSessionRecord(
            session_id=f"sess_{uuid4().hex[:12]}",
            user_id=user.user_id,
            token_hash=hash_token(token),
            role=user.role,
            created_at=now.isoformat(),
            expires_at=(now + timedelta(hours=max(1, self._settings.admin_session_ttl_hours))).isoformat(),
            last_used_at=now.isoformat(),
        )
        user.last_login_at = now.isoformat()
        user.updated_at = now.isoformat()
        self._state.admin_sessions.append(session)
        self._append_audit(
            actor_type="admin_user",
            actor_id=user.user_id,
            action="admin_login",
            target_type="admin_session",
            target_id=session.session_id,
            status="ok",
            details="Admin session issued.",
        )
        self._persist()
        return AdminLoginResult(
            access_token=token,
            expires_at=session.expires_at,
            user=AuthenticatedAdmin(
                session_id=session.session_id,
                user_id=user.user_id,
                username=user.username,
                display_name=user.display_name,
                role=user.role,
                must_rotate_password=user.must_rotate_password,
            ),
        )

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
        session.last_used_at = self._now_iso()
        self._persist()
        return AuthenticatedAdmin(
            session_id=session.session_id,
            user_id=user.user_id,
            username=user.username,
            display_name=user.display_name,
            role=user.role,
            must_rotate_password=user.must_rotate_password,
        )

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
        if role not in {"admin", "operator", "viewer"}:
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
        if role is not None and role not in {"admin", "operator", "viewer"}:
            raise ValueError("unsupported_admin_role")
        if status is not None and status not in {"active", "disabled"}:
            raise ValueError("unsupported_admin_status")
        if status == "disabled" and user.role == "admin":
            active_admins = [item for item in self._state.admin_users if item.role == "admin" and item.status == "active" and item.user_id != user.user_id]
            if not active_admins:
                raise ValueError("cannot_disable_last_active_admin")
        if display_name is not None:
            user.display_name = display_name.strip() or user.display_name
        if role is not None:
            user.role = role  # type: ignore[assignment]
        if status is not None:
            user.status = status  # type: ignore[assignment]
        if must_rotate_password is not None:
            user.must_rotate_password = must_rotate_password
        user.updated_at = self._now_iso()
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

    def rotate_admin_password(
        self,
        user_id: str,
        *,
        new_password: str,
        actor: AuthenticatedAdmin,
        must_rotate_password: bool = False,
    ) -> AdminUserRecord:
        user = self._find_user_by_id(user_id)
        if user is None:
            raise ValueError("admin_user_not_found")
        salt = new_secret_salt()
        user.password_salt = salt
        user.password_hash = hash_password(new_password, salt)
        user.must_rotate_password = must_rotate_password
        user.updated_at = self._now_iso()
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
        return self.rotate_admin_password(
            user.user_id,
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
                "active": session.revoked_at is None and datetime.fromisoformat(session.expires_at) > self._now(),
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

    def provider_secret_posture(self) -> list[dict[str, object]]:
        return [
            {
                "provider": "openai_api",
                "configured": bool(self._settings.openai_api_key.strip()),
                "auth_mode": "api_key",
                "rotation_support": "manual_env_rotation",
            },
            {
                "provider": "openai_codex",
                "configured": bool(
                    (self._settings.openai_codex_oauth_access_token if self._settings.openai_codex_auth_mode == "oauth" else self._settings.openai_codex_api_key).strip()
                ),
                "auth_mode": self._settings.openai_codex_auth_mode,
                "rotation_support": "oauth_or_api_key_manual_rotation",
            },
            {
                "provider": "gemini",
                "configured": bool(
                    (self._settings.gemini_oauth_access_token if self._settings.gemini_auth_mode == "oauth" else self._settings.gemini_api_key).strip()
                ),
                "auth_mode": self._settings.gemini_auth_mode,
                "rotation_support": "oauth_or_api_key_manual_rotation",
            },
            {
                "provider": "anthropic",
                "configured": bool(self._settings.anthropic_api_key.strip()),
                "auth_mode": "api_key",
                "rotation_support": "manual_env_rotation",
            },
            {
                "provider": "antigravity",
                "configured": bool(self._settings.antigravity_oauth_access_token.strip()),
                "auth_mode": "oauth_account",
                "rotation_support": "oauth_token_rotation",
            },
            {
                "provider": "github_copilot",
                "configured": bool(self._settings.github_copilot_oauth_access_token.strip()),
                "auth_mode": "oauth_account",
                "rotation_support": "oauth_token_rotation",
            },
            {
                "provider": "claude_code",
                "configured": bool(self._settings.claude_code_oauth_access_token.strip()),
                "auth_mode": "oauth_account",
                "rotation_support": "oauth_token_rotation",
            },
        ]

    def list_accounts(self) -> list[GatewayAccountRecord]:
        return sorted(self._state.gateway_accounts, key=lambda item: item.label.lower())

    def create_account(self, *, label: str, provider_bindings: list[str] | None, notes: str, actor: AuthenticatedAdmin) -> GatewayAccountRecord:
        now = self._now_iso()
        account = GatewayAccountRecord(
            account_id=f"acct_{uuid4().hex[:10]}",
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
        )
        self._persist()
        return account

    def update_account(
        self,
        account_id: str,
        *,
        label: str | None,
        provider_bindings: list[str] | None,
        notes: str | None,
        status: str | None,
        actor: AuthenticatedAdmin,
    ) -> GatewayAccountRecord:
        account = next((item for item in self._state.gateway_accounts if item.account_id == account_id), None)
        if account is None:
            raise ValueError(f"Account '{account_id}' not found.")
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
        )
        self._persist()
        return account

    def list_runtime_keys(self) -> list[RuntimeKeyRecord]:
        return sorted(self._state.runtime_keys, key=lambda item: item.created_at, reverse=True)

    def issue_runtime_key(
        self,
        *,
        account_id: str | None,
        label: str,
        scopes: list[str],
        actor: AuthenticatedAdmin,
        rotated_from: str | None = None,
    ) -> IssuedApiKey:
        now = self._now_iso()
        token = issue_runtime_key_token()
        prefix = token[:16]
        record = RuntimeKeyRecord(
            key_id=f"key_{uuid4().hex[:12]}",
            account_id=account_id,
            label=label.strip(),
            prefix=prefix,
            secret_hash=hash_token(token),
            scopes=sorted(set(scopes)),
            created_at=now,
            updated_at=now,
            rotated_from=rotated_from,
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
            metadata={"account_id": account_id, "scopes": record.scopes},
        )
        self._persist()
        return IssuedApiKey(
            key_id=record.key_id,
            token=token,
            prefix=record.prefix,
            account_id=record.account_id,
            label=record.label,
            scopes=record.scopes,
            created_at=record.created_at,
        )

    def rotate_runtime_key(self, key_id: str, actor: AuthenticatedAdmin) -> IssuedApiKey:
        current = next((item for item in self._state.runtime_keys if item.key_id == key_id), None)
        if current is None:
            raise ValueError(f"Runtime key '{key_id}' not found.")
        current.status = "revoked"
        current.updated_at = self._now_iso()
        return self.issue_runtime_key(
            account_id=current.account_id,
            label=f"{current.label} (rotated)",
            scopes=current.scopes,
            actor=actor,
            rotated_from=current.key_id,
        )

    def set_runtime_key_status(self, key_id: str, status: str, actor: AuthenticatedAdmin) -> RuntimeKeyRecord:
        record = next((item for item in self._state.runtime_keys if item.key_id == key_id), None)
        if record is None:
            raise ValueError(f"Runtime key '{key_id}' not found.")
        if status not in {"active", "disabled", "revoked"}:
            raise ValueError(f"Unsupported runtime key status '{status}'.")
        record.status = status  # type: ignore[assignment]
        record.updated_at = self._now_iso()
        self._append_audit(
            actor_type="admin_user",
            actor_id=actor.user_id,
            action="runtime_key_status",
            target_type="runtime_key",
            target_id=record.key_id,
            status="ok",
            details=f"Runtime key '{record.label}' set to {status}.",
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
        record.last_used_at = self._now_iso()
        record.updated_at = self._now_iso()
        account = next((item for item in self._state.gateway_accounts if item.account_id == record.account_id), None)
        if account is not None:
            account.last_activity_at = self._now_iso()
            account.updated_at = self._now_iso()
        self._persist()
        return RuntimeGatewayIdentity(
            key_id=record.key_id,
            account_id=record.account_id,
            account_label=account.label if account else None,
            scopes=list(record.scopes),
            client_id=record.prefix,
            consumer=account.label if account else "runtime_key",
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

    def list_audit_events(self, *, limit: int = 200) -> list[AuditEventRecord]:
        return sorted(self._state.audit_events, key=lambda item: item.created_at, reverse=True)[: max(1, limit)]


@lru_cache(maxsize=1)
def get_governance_service() -> GovernanceService:
    settings = get_settings()
    return GovernanceService(settings)
