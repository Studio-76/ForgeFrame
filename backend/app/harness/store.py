"""Persistent storage for harness profiles, inventories, and verification runs."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.harness.models import HarnessModelInventoryItem, HarnessProfileRecord, HarnessVerificationRun


class HarnessStore:
    def __init__(self, *, profiles_path: Path, runs_path: Path):
        self._profiles_path = profiles_path
        self._runs_path = runs_path
        self._profiles: dict[str, HarnessProfileRecord] = {}
        self._runs: list[HarnessVerificationRun] = []
        self._load()

    def _load(self) -> None:
        self._profiles_path.parent.mkdir(parents=True, exist_ok=True)
        self._runs_path.parent.mkdir(parents=True, exist_ok=True)
        if not self._profiles_path.exists():
            self._profiles_path.write_text("[]\n", encoding="utf-8")
        if not self._runs_path.exists():
            self._runs_path.write_text("[]\n", encoding="utf-8")

        profile_payload = json.loads(self._profiles_path.read_text(encoding="utf-8") or "[]")
        run_payload = json.loads(self._runs_path.read_text(encoding="utf-8") or "[]")
        self._profiles = {item["provider_key"]: HarnessProfileRecord(**item) for item in profile_payload}
        self._runs = [HarnessVerificationRun(**item) for item in run_payload]

    def _flush_profiles(self) -> None:
        payload = [item.model_dump() for item in self.list_profiles()]
        self._profiles_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    def _flush_runs(self) -> None:
        payload = [item.model_dump() for item in self._runs][-300:]
        self._runs = [HarnessVerificationRun(**item) for item in payload]
        self._runs_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(tz=UTC).isoformat()

    def list_profiles(self) -> list[HarnessProfileRecord]:
        return sorted(self._profiles.values(), key=lambda item: item.provider_key)

    def get_profile(self, provider_key: str) -> HarnessProfileRecord:
        profile = self._profiles.get(provider_key)
        if not profile:
            raise ValueError(f"Harness profile '{provider_key}' not found.")
        return profile

    def upsert_profile(self, profile: HarnessProfileRecord) -> HarnessProfileRecord:
        existing = self._profiles.get(profile.provider_key)
        if existing:
            profile.created_at = existing.created_at
            profile.updated_at = self._now_iso()
            profile.last_verified_at = existing.last_verified_at
            profile.last_sync_at = existing.last_sync_at
            profile.last_sync_status = existing.last_sync_status
            profile.last_sync_error = existing.last_sync_error
            if not profile.model_inventory:
                profile.model_inventory = existing.model_inventory
        else:
            now = self._now_iso()
            profile.created_at = now
            profile.updated_at = now
        self._profiles[profile.provider_key] = profile
        self._flush_profiles()
        return profile

    def delete_profile(self, provider_key: str) -> None:
        if provider_key not in self._profiles:
            raise ValueError(f"Harness profile '{provider_key}' not found.")
        del self._profiles[provider_key]
        self._flush_profiles()

    def set_profile_active(self, provider_key: str, enabled: bool) -> HarnessProfileRecord:
        profile = self.get_profile(provider_key)
        profile.enabled = enabled
        profile.updated_at = self._now_iso()
        self._flush_profiles()
        return profile

    def update_inventory(self, provider_key: str, inventory: list[HarnessModelInventoryItem], *, status: str, error: str | None = None) -> HarnessProfileRecord:
        profile = self.get_profile(provider_key)
        profile.model_inventory = inventory
        profile.last_sync_at = self._now_iso()
        profile.last_sync_status = status
        profile.last_sync_error = error
        profile.updated_at = self._now_iso()
        self._flush_profiles()
        return profile

    def record_run(self, run: HarnessVerificationRun) -> HarnessVerificationRun:
        self._runs.append(run)
        profile = self._profiles.get(run.provider_key)
        if profile:
            profile.last_verified_at = run.executed_at
            profile.updated_at = self._now_iso()
            self._flush_profiles()
        self._flush_runs()
        return run

    def list_runs(self, provider_key: str | None = None) -> list[HarnessVerificationRun]:
        runs = self._runs if provider_key is None else [item for item in self._runs if item.provider_key == provider_key]
        return sorted(runs, key=lambda item: item.executed_at, reverse=True)

    def export_snapshot(self) -> dict[str, Any]:
        return {
            "profiles": [item.model_dump() for item in self.list_profiles()],
            "runs": [item.model_dump() for item in self.list_runs()[:50]],
        }
