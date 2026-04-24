"""OAuth/account operations history behavior."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal, Protocol, cast

from app.control_plane import OAuthOperationRecord
from app.tenancy import effective_tenant_filter, normalize_tenant_id


class SqlBackedOAuthOperationsRepository(Protocol):
    def effective_tenant_id(self, requested_tenant_id: str | None) -> str | None: ...

    def recent_operations(self, *, tenant_id: str | None, limit: int = 50) -> list[OAuthOperationRecord]: ...

    def latest_operation(
        self,
        provider_key: str,
        *,
        action: str,
        tenant_id: str | None = None,
    ) -> OAuthOperationRecord | None: ...

    def provider_operation_summary(self, *, tenant_id: str | None) -> dict[str, dict[str, Any]]: ...


class ControlPlaneOAuthOperationsDomainMixin:
    def _effective_truth_projection_tenant_id(self, tenant_id: str | None = None) -> str | None:
        requested_tenant_id = (tenant_id or "").strip() or None
        observability_tenant_id = self._analytics.effective_history_tenant_id(tenant_id=requested_tenant_id)
        oauth_tenant_id = self._effective_oauth_tenant_id(requested_tenant_id)
        return effective_tenant_filter(
            [observability_tenant_id, oauth_tenant_id],
            requested_tenant_id,
        )

    def _oauth_operations_target_status(
        self,
        provider_key: str,
        *,
        tenant_id: str | None = None,
    ):
        if provider_key in {"openai_codex", "gemini"}:
            return self._native_oauth_target_status(provider_key, tenant_id=tenant_id)
        return self._oauth_target_status(provider_key, tenant_id=tenant_id)

    def _sql_oauth_operations_repository(self) -> SqlBackedOAuthOperationsRepository | None:
        required = (
            "effective_tenant_id",
            "recent_operations",
            "latest_operation",
            "provider_operation_summary",
        )
        if all(callable(getattr(self._oauth_operations_repository, name, None)) for name in required):
            return cast(SqlBackedOAuthOperationsRepository, self._oauth_operations_repository)
        return None

    def _effective_oauth_tenant_id(self, tenant_id: str | None = None) -> str | None:
        repository = self._sql_oauth_operations_repository()
        if repository is not None:
            return repository.effective_tenant_id(tenant_id)
        operations = self._oauth_operations_repository.load_operations()
        return effective_tenant_filter([item.tenant_id for item in operations], tenant_id)

    def _oauth_operations(self, tenant_id: str | None = None) -> list[OAuthOperationRecord]:
        repository = self._sql_oauth_operations_repository()
        if repository is not None:
            return repository.recent_operations(tenant_id=tenant_id, limit=200)
        operations = self._oauth_operations_repository.load_operations()
        if tenant_id is None:
            return operations[-200:]
        return [item for item in operations if item.tenant_id == tenant_id][-200:]

    def latest_oauth_operation(
        self,
        provider_key: str,
        *,
        action: str,
        tenant_id: str | None = None,
    ) -> OAuthOperationRecord | None:
        repository = self._sql_oauth_operations_repository()
        if repository is not None:
            return repository.latest_operation(
                provider_key,
                action=action,
                tenant_id=tenant_id,
            )
        operations = self._oauth_operations(tenant_id)
        filtered = [item for item in operations if item.provider_key == provider_key and item.action == action]
        return filtered[-1] if filtered else None

    def oauth_operation_provider_summary(self, tenant_id: str | None = None) -> dict[str, dict[str, Any]]:
        repository = self._sql_oauth_operations_repository()
        if repository is not None:
            return repository.provider_operation_summary(tenant_id=tenant_id)
        operations = self._oauth_operations(tenant_id)
        cutoff_24h = datetime.now(tz=UTC).timestamp() - 24 * 3600
        summary: dict[str, dict[str, Any]] = {}
        for item in operations:
            provider_summary = summary.setdefault(
                item.provider_key,
                {
                    "failures": 0,
                    "failures_24h": 0,
                    "probe_count": 0,
                    "bridge_sync_count": 0,
                    "operation_count": 0,
                    "failure_rate": 0.0,
                    "last_failed_operation": None,
                    "last_probe": None,
                    "last_bridge_sync": None,
                },
            )
            provider_summary["operation_count"] = int(provider_summary["operation_count"]) + 1
            if item.action == "probe":
                provider_summary["probe_count"] = int(provider_summary["probe_count"]) + 1
                provider_summary["last_probe"] = item.model_dump()
            if item.action == "bridge_sync":
                provider_summary["bridge_sync_count"] = int(provider_summary["bridge_sync_count"]) + 1
                provider_summary["last_bridge_sync"] = item.model_dump()
            if item.status == "failed":
                provider_summary["failures"] = int(provider_summary["failures"]) + 1
                provider_summary["last_failed_operation"] = item.model_dump()
                if datetime.fromisoformat(item.executed_at).timestamp() >= cutoff_24h:
                    provider_summary["failures_24h"] = int(provider_summary["failures_24h"]) + 1
        for provider_summary in summary.values():
            total = int(provider_summary["operation_count"])
            provider_summary["failure_rate"] = int(provider_summary["failures"]) / max(1, total)
        return summary

    def oauth_account_operations_summary(self, tenant_id: str | None = None) -> dict[str, object]:
        providers = [
            "openai_codex",
            "gemini",
            "antigravity",
            "github_copilot",
            "claude_code",
            "nous_oauth",
            "qwen_oauth",
        ]
        effective_tenant_id = self._effective_oauth_tenant_id(tenant_id)
        operations = self._oauth_operations(effective_tenant_id)
        summary = self.oauth_operation_provider_summary(effective_tenant_id)
        per_provider: list[dict[str, object]] = []
        for provider_key in providers:
            status = self._oauth_operations_target_status(provider_key, tenant_id=effective_tenant_id)
            provider_summary = summary.get(
                provider_key,
                {
                    "failures": 0,
                    "failures_24h": 0,
                    "probe_count": 0,
                    "bridge_sync_count": 0,
                    "operation_count": 0,
                    "failure_rate": 0.0,
                    "last_failed_operation": None,
                    "last_probe": None,
                    "last_bridge_sync": None,
                },
            )
            per_provider.append(
                {
                    "provider_key": provider_key,
                    "configured": status.configured,
                    "probe_enabled": status.probe_enabled,
                    "bridge_profile_enabled": status.harness_profile_enabled,
                    "needs_attention": int(provider_summary["failures"]) >= 2,
                    "failures": int(provider_summary["failures"]),
                    "failures_24h": int(provider_summary["failures_24h"]),
                    "probe_count": int(provider_summary["probe_count"]),
                    "bridge_sync_count": int(provider_summary["bridge_sync_count"]),
                    "operation_count": int(provider_summary["operation_count"]),
                    "failure_rate": float(provider_summary["failure_rate"]),
                    "last_failed_operation": provider_summary["last_failed_operation"],
                    "last_probe": provider_summary["last_probe"],
                    "last_bridge_sync": provider_summary["last_bridge_sync"],
                }
            )
        return {
            "status": "ok",
            "operations": per_provider,
            "recent": [item.model_dump() for item in operations[-50:]],
            "tenant_id": effective_tenant_id,
            "total_operations": len(operations),
        }

    def _record_oauth_operation(
        self,
        provider_key: str,
        action: Literal["probe", "bridge_sync"],
        status: Literal["ok", "warning", "failed", "skipped"],
        details: str,
        executed_at: str,
        tenant_id: str | None = None,
    ) -> None:
        event = OAuthOperationRecord(
            tenant_id=normalize_tenant_id(
                tenant_id,
                fallback_tenant_id=self._default_tenant_id,
            ),
            provider_key=provider_key,
            action=action,
            status=status,
            details=details,
            executed_at=executed_at,
        )
        self._append_oauth_operation(event)

    def _append_oauth_operation(self, event: OAuthOperationRecord) -> None:
        self._oauth_operations_repository.append_operation(event)
