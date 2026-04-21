"""OAuth/account operations history behavior."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from app.control_plane import OAuthOperationRecord


class ControlPlaneOAuthOperationsDomainMixin:
    def oauth_account_operations_summary(self) -> dict[str, object]:
        providers = ["openai_codex", "gemini", "antigravity", "github_copilot", "claude_code"]
        per_provider: list[dict[str, object]] = []
        cutoff_24h = datetime.now(tz=UTC).timestamp() - 24 * 3600
        for provider_key in providers:
            status = (
                self._oauth_target_status(provider_key)
                if provider_key in {"antigravity", "github_copilot", "claude_code"}
                else None
            )
            provider_ops = [item for item in self._oauth_operations if item.provider_key == provider_key]
            last_probe = next((item for item in reversed(provider_ops) if item.action == "probe"), None)
            last_bridge_sync = next((item for item in reversed(provider_ops) if item.action == "bridge_sync"), None)
            last_failed = next((item for item in reversed(provider_ops) if item.status == "failed"), None)
            failures = len([item for item in provider_ops if item.status == "failed"])
            total = len(provider_ops)
            failures_24h = len(
                [
                    item
                    for item in provider_ops
                    if item.status == "failed"
                    and datetime.fromisoformat(item.executed_at).timestamp() >= cutoff_24h
                ]
            )
            probes_total = len([item for item in provider_ops if item.action == "probe"])
            bridge_total = len([item for item in provider_ops if item.action == "bridge_sync"])
            per_provider.append(
                {
                    "provider_key": provider_key,
                    "configured": (
                        status.configured
                        if status
                        else bool(
                            (
                                self._settings.openai_codex_oauth_access_token
                                if provider_key == "openai_codex"
                                else self._settings.gemini_oauth_access_token
                            ).strip()
                        )
                    ),
                    "probe_enabled": (
                        status.probe_enabled
                        if status
                        else (
                            self._settings.openai_codex_bridge_enabled
                            if provider_key == "openai_codex"
                            else self._settings.gemini_probe_enabled
                        )
                    ),
                    "bridge_profile_enabled": status.harness_profile_enabled if status else False,
                    "needs_attention": failures >= 2,
                    "failures": failures,
                    "failures_24h": failures_24h,
                    "probe_count": probes_total,
                    "bridge_sync_count": bridge_total,
                    "operation_count": total,
                    "failure_rate": failures / max(1, total),
                    "last_failed_operation": last_failed.model_dump() if last_failed else None,
                    "last_probe": last_probe.model_dump() if last_probe else None,
                    "last_bridge_sync": last_bridge_sync.model_dump() if last_bridge_sync else None,
                }
            )
        return {
            "status": "ok",
            "operations": per_provider,
            "recent": [item.model_dump() for item in self._oauth_operations[-50:]],
            "total_operations": len(self._oauth_operations),
        }

    def _record_oauth_operation(
        self,
        provider_key: str,
        action: Literal["probe", "bridge_sync"],
        status: Literal["ok", "warning", "failed", "skipped"],
        details: str,
        executed_at: str,
    ) -> None:
        event = OAuthOperationRecord(
            provider_key=provider_key,
            action=action,
            status=status,
            details=details,
            executed_at=executed_at,
        )
        self._oauth_operations.append(event)
        self._append_oauth_operation(event)
        if len(self._oauth_operations) > 200:
            self._oauth_operations = self._oauth_operations[-200:]

    def _load_oauth_operations(self) -> list[OAuthOperationRecord]:
        return self._oauth_operations_repository.load_operations()[-200:]

    def _append_oauth_operation(self, event: OAuthOperationRecord) -> None:
        self._oauth_operations_repository.append_operation(event)
