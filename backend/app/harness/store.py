"""Harness persistence facade using pluggable repositories."""

from __future__ import annotations

from typing import Any

from app.harness.models import (
    HarnessModelInventoryItem,
    HarnessProfileRecord,
    HarnessVerificationRun,
)
from app.storage.harness_repository import HarnessRepository, HarnessRunQuery


class HarnessStore:
    def __init__(self, *, repository: HarnessRepository):
        self._repository = repository

    def _record_run_instance_id(self, run: HarnessVerificationRun) -> str | None:
        normalized_instance_id = (run.instance_id or "").strip() or None
        if normalized_instance_id is not None:
            return normalized_instance_id
        matching_profiles = [profile for profile in self._repository.list_profiles() if profile.provider_key == run.provider_key]
        if len(matching_profiles) != 1:
            return None
        return (matching_profiles[0].instance_id or "").strip() or None

    def list_profiles(self, instance_id: str | None = None) -> list[HarnessProfileRecord]:
        return self._repository.list_profiles(instance_id)

    def get_profile(self, provider_key: str, instance_id: str | None = None) -> HarnessProfileRecord:
        return self._repository.get_profile(provider_key, instance_id)

    def upsert_profile(self, profile: HarnessProfileRecord) -> HarnessProfileRecord:
        return self._repository.upsert_profile(profile)

    def delete_profile(self, provider_key: str, instance_id: str | None = None) -> None:
        self._repository.delete_profile(provider_key, instance_id)

    def set_profile_active(self, provider_key: str, enabled: bool, instance_id: str | None = None) -> HarnessProfileRecord:
        return self._repository.set_profile_active(provider_key, enabled, instance_id)

    def update_inventory(
        self,
        provider_key: str,
        inventory: list[HarnessModelInventoryItem],
        *,
        status: str,
        error: str | None = None,
        instance_id: str | None = None,
    ) -> HarnessProfileRecord:
        return self._repository.update_inventory(provider_key, inventory, status=status, error=error, instance_id=instance_id)

    def record_profile_usage(
        self,
        *,
        provider_key: str,
        instance_id: str | None = None,
        model: str,
        stream: bool,
        total_tokens: int,
        actual_cost: float = 0.0,
        hypothetical_cost: float = 0.0,
        avoided_cost: float = 0.0,
    ) -> HarnessProfileRecord | None:
        return self._repository.record_profile_usage(
            provider_key=provider_key,
            instance_id=instance_id,
            model=model,
            stream=stream,
            total_tokens=total_tokens,
            actual_cost=actual_cost,
            hypothetical_cost=hypothetical_cost,
            avoided_cost=avoided_cost,
        )

    def record_run(self, run: HarnessVerificationRun) -> HarnessVerificationRun:
        resolved_instance_id = self._record_run_instance_id(run)
        if resolved_instance_id is None:
            return self._repository.record_run(run)
        return self._repository.record_run(run.model_copy(update={"instance_id": resolved_instance_id}))

    def list_runs(self, query: HarnessRunQuery | None = None) -> list[HarnessVerificationRun]:
        return self._repository.list_runs(query)

    def runs_summary(self, provider_key: str | None = None, instance_id: str | None = None) -> dict[str, int]:
        return self._repository.runs_summary(provider_key, instance_id)

    def export_snapshot(self, instance_id: str | None = None) -> dict[str, Any]:
        return self._repository.export_snapshot(instance_id)
