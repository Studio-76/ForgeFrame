"""Harness persistence facade using pluggable repositories."""

from __future__ import annotations

from typing import Any

from app.harness.models import HarnessModelInventoryItem, HarnessProfileRecord, HarnessVerificationRun
from app.storage.harness_repository import HarnessRepository, HarnessRunQuery


class HarnessStore:
    def __init__(self, *, repository: HarnessRepository):
        self._repository = repository

    def list_profiles(self) -> list[HarnessProfileRecord]:
        return self._repository.list_profiles()

    def get_profile(self, provider_key: str) -> HarnessProfileRecord:
        return self._repository.get_profile(provider_key)

    def upsert_profile(self, profile: HarnessProfileRecord) -> HarnessProfileRecord:
        return self._repository.upsert_profile(profile)

    def delete_profile(self, provider_key: str) -> None:
        self._repository.delete_profile(provider_key)

    def set_profile_active(self, provider_key: str, enabled: bool) -> HarnessProfileRecord:
        return self._repository.set_profile_active(provider_key, enabled)

    def update_inventory(self, provider_key: str, inventory: list[HarnessModelInventoryItem], *, status: str, error: str | None = None) -> HarnessProfileRecord:
        return self._repository.update_inventory(provider_key, inventory, status=status, error=error)

    def record_profile_usage(self, *, provider_key: str, model: str, stream: bool, total_tokens: int, actual_cost: float = 0.0, hypothetical_cost: float = 0.0, avoided_cost: float = 0.0) -> HarnessProfileRecord | None:
        return self._repository.record_profile_usage(
            provider_key=provider_key,
            model=model,
            stream=stream,
            total_tokens=total_tokens,
            actual_cost=actual_cost,
            hypothetical_cost=hypothetical_cost,
            avoided_cost=avoided_cost,
        )

    def record_run(self, run: HarnessVerificationRun) -> HarnessVerificationRun:
        return self._repository.record_run(run)

    def list_runs(self, query: HarnessRunQuery | None = None) -> list[HarnessVerificationRun]:
        return self._repository.list_runs(query)

    def runs_summary(self, provider_key: str | None = None) -> dict[str, int]:
        return self._repository.runs_summary(provider_key)

    def export_snapshot(self) -> dict[str, Any]:
        return self._repository.export_snapshot()
