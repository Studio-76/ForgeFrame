"""Harness persistence facade using pluggable repositories."""

from __future__ import annotations

from typing import Any

from app.harness.models import HarnessModelInventoryItem, HarnessProfileRecord, HarnessVerificationRun
from app.storage.harness_repository import HarnessRepository


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

    def record_run(self, run: HarnessVerificationRun) -> HarnessVerificationRun:
        return self._repository.record_run(run)

    def list_runs(self, provider_key: str | None = None) -> list[HarnessVerificationRun]:
        return self._repository.list_runs(provider_key)

    def export_snapshot(self) -> dict[str, Any]:
        return self._repository.export_snapshot()
