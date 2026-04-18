"""Persistent storage for harness profiles, inventories, and verification runs."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.harness.models import HarnessModelInventoryItem, HarnessProfileRecord, HarnessVerificationRun
from app.storage.harness_repository import HarnessStoragePaths

_SCHEMA_VERSION = 2


class HarnessStore:
    def __init__(self, *, paths: HarnessStoragePaths):
        self._paths = paths
        self._profiles: dict[str, HarnessProfileRecord] = {}
        self._runs: list[HarnessVerificationRun] = []
        self._load()

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(tz=UTC).isoformat()

    def _read_json(self, path: Path, default: Any) -> Any:
        if not path.exists():
            return default
        try:
            raw = path.read_text(encoding="utf-8")
            return json.loads(raw) if raw.strip() else default
        except (OSError, json.JSONDecodeError):
            backup = path.with_suffix(path.suffix + ".corrupt")
            try:
                path.replace(backup)
            except OSError:
                pass
            return default

    def _atomic_write(self, path: Path, payload: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        tmp.replace(path)

    def _load(self) -> None:
        self._paths.profiles_path.parent.mkdir(parents=True, exist_ok=True)
        self._paths.runs_path.parent.mkdir(parents=True, exist_ok=True)

        profile_payload = self._read_json(self._paths.profiles_path, {"schema_version": _SCHEMA_VERSION, "profiles": []})
        run_payload = self._read_json(self._paths.runs_path, {"schema_version": _SCHEMA_VERSION, "runs": []})

        if isinstance(profile_payload, list):
            profiles_raw = profile_payload
        else:
            profiles_raw = profile_payload.get("profiles", [])

        if isinstance(run_payload, list):
            runs_raw = run_payload
        else:
            runs_raw = run_payload.get("runs", [])

        self._profiles = {item["provider_key"]: HarnessProfileRecord(**item) for item in profiles_raw}
        self._runs = [HarnessVerificationRun(**item) for item in runs_raw]
        self._flush_profiles()
        self._flush_runs()

    def _flush_profiles(self) -> None:
        payload = {
            "schema_version": _SCHEMA_VERSION,
            "updated_at": self._now_iso(),
            "profiles": [item.model_dump() for item in self.list_profiles()],
        }
        self._atomic_write(self._paths.profiles_path, payload)

    def _flush_runs(self) -> None:
        payload = {
            "schema_version": _SCHEMA_VERSION,
            "updated_at": self._now_iso(),
            "runs": [item.model_dump() for item in self._runs][-800:],
        }
        self._runs = [HarnessVerificationRun(**item) for item in payload["runs"]]
        self._atomic_write(self._paths.runs_path, payload)

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
            profile.last_verify_status = existing.last_verify_status
            profile.last_probe_at = existing.last_probe_at
            profile.last_probe_status = existing.last_probe_status
            profile.last_sync_at = existing.last_sync_at
            profile.last_sync_status = existing.last_sync_status
            profile.last_sync_error = existing.last_sync_error
            profile.last_error = existing.last_error
            profile.verify_success_count = existing.verify_success_count
            profile.verify_failure_count = existing.verify_failure_count
            profile.probe_success_count = existing.probe_success_count
            profile.probe_failure_count = existing.probe_failure_count
            if not profile.model_inventory:
                profile.model_inventory = existing.model_inventory
        else:
            now = self._now_iso()
            profile.created_at = now
            profile.updated_at = now

        if not profile.enabled:
            profile.lifecycle_status = "disabled"
        elif profile.last_error:
            profile.lifecycle_status = "degraded"
        elif profile.last_verify_status == "ok":
            profile.lifecycle_status = "ready"
        else:
            profile.lifecycle_status = "draft"

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
        profile.lifecycle_status = "disabled" if not enabled else "ready"
        self._flush_profiles()
        return profile

    def update_inventory(self, provider_key: str, inventory: list[HarnessModelInventoryItem], *, status: str, error: str | None = None) -> HarnessProfileRecord:
        profile = self.get_profile(provider_key)
        profile.model_inventory = inventory
        profile.last_sync_at = self._now_iso()
        profile.last_sync_status = status
        profile.last_sync_error = error
        profile.updated_at = self._now_iso()
        if error:
            profile.last_error = error
            profile.lifecycle_status = "degraded"
        elif status == "ok":
            profile.lifecycle_status = "ready"
        self._flush_profiles()
        return profile

    def record_run(self, run: HarnessVerificationRun) -> HarnessVerificationRun:
        self._runs.append(run)
        profile = self._profiles.get(run.provider_key)
        if profile:
            profile.updated_at = self._now_iso()
            if run.mode == "verify":
                profile.last_verified_at = run.executed_at
                profile.last_verify_status = "ok" if run.success else "failed"
                profile.verify_success_count += 1 if run.success else 0
                profile.verify_failure_count += 0 if run.success else 1
            if run.mode == "probe":
                profile.last_probe_at = run.executed_at
                profile.last_probe_status = "ok" if run.success else "failed"
                profile.probe_success_count += 1 if run.success else 0
                profile.probe_failure_count += 0 if run.success else 1
            if run.error:
                profile.last_error = run.error
                profile.lifecycle_status = "degraded"
            elif profile.enabled:
                profile.lifecycle_status = "ready"
            self._flush_profiles()
        self._flush_runs()
        return run

    def list_runs(self, provider_key: str | None = None) -> list[HarnessVerificationRun]:
        runs = self._runs if provider_key is None else [item for item in self._runs if item.provider_key == provider_key]
        return sorted(runs, key=lambda item: item.executed_at, reverse=True)

    def export_snapshot(self) -> dict[str, Any]:
        return {
            "schema_version": _SCHEMA_VERSION,
            "profiles": [item.model_dump() for item in self.list_profiles()],
            "runs": [item.model_dump() for item in self.list_runs()[:100]],
        }
