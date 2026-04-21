from pathlib import Path

from app.harness.models import HarnessImportRequest, HarnessProviderProfile, HarnessVerificationRequest
from app.harness.service import HarnessService
from app.harness.store import HarnessStore
from app.storage.harness_repository import FileHarnessRepository, HarnessRunQuery, HarnessStoragePaths


def _service(tmp_path: Path) -> HarnessService:
    repo = FileHarnessRepository(paths=HarnessStoragePaths(profiles_path=tmp_path / "profiles.json", runs_path=tmp_path / "runs.json"))
    return HarnessService(HarnessStore(repository=repo))


def test_sync_inventory_marks_removed_models_as_stale(tmp_path: Path) -> None:
    service = _service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="syncy",
            label="Syncy",
            integration_class="templated_http",
            endpoint_base_url="https://example.invalid/api",
            auth_scheme="none",
            models=["a", "b"],
        )
    )
    service.sync_profile_inventory("syncy")

    profile = service.get_profile("syncy")
    profile.models = ["a"]
    service._store.upsert_profile(profile)  # noqa: SLF001
    updated = service.sync_profile_inventory("syncy")

    stale_models = [item.model for item in updated.model_inventory if item.status == "stale"]
    assert "b" in stale_models


def test_runtime_usage_updates_profile_counters(tmp_path: Path) -> None:
    service = _service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="usagey",
            label="Usagey",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="none",
            models=["m"],
            stream_mapping={"enabled": True},
        )
    )

    service._store.record_profile_usage(provider_key="usagey", model="m", stream=True, total_tokens=123)  # noqa: SLF001
    profile = service.get_profile("usagey")

    assert profile.request_count == 1
    assert profile.stream_request_count == 1
    assert profile.total_tokens == 123


def test_run_query_filters_provider_and_mode(tmp_path: Path) -> None:
    service = _service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="r1",
            label="R1",
            integration_class="templated_http",
            endpoint_base_url="https://example.invalid/api",
            auth_scheme="none",
            models=["m"],
        )
    )
    service.sync_profile_inventory("r1")
    service.verify_profile(HarnessVerificationRequest(provider_key="r1", model="m", include_preview=False, live_probe=False, check_stream=False))

    sync_runs = service._store.list_runs(HarnessRunQuery(provider_key="r1", mode="sync", limit=50))  # noqa: SLF001
    verify_runs = service._store.list_runs(HarnessRunQuery(provider_key="r1", mode="verify", limit=50))  # noqa: SLF001
    assert sync_runs
    assert verify_runs


def test_profile_versioning_export_import_and_rollback(tmp_path: Path) -> None:
    service = _service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="versioned",
            label="Versioned",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="bearer",
            auth_value="secret-token",
            models=["alpha"],
        )
    )
    updated = service.upsert_profile(
        HarnessProviderProfile(
            provider_key="versioned",
            label="Versioned",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v2",
            auth_scheme="bearer",
            auth_value="secret-token",
            models=["beta"],
        )
    )

    assert updated.config_revision == 2
    assert updated.config_revision_parent == 1
    assert len(updated.config_history) == 1

    redacted_export = service.export_config_snapshot()
    assert redacted_export["redacted"] is True
    assert redacted_export["profiles"][0]["profile"]["auth_value"] == "***redacted***"

    full_export = service.export_config_snapshot(redact_secrets=False, include_runs=False)
    dry_run = service.import_config_snapshot(HarnessImportRequest(snapshot=full_export, dry_run=True))
    assert dry_run["dry_run"] is True
    assert dry_run["validated_profiles"] == ["versioned"]

    service.rollback_profile("versioned", 1)
    rolled_back = service.get_profile("versioned")
    assert rolled_back.config_revision == 3
    assert rolled_back.endpoint_base_url == "https://example.invalid/v1"
    assert rolled_back.models == ["alpha"]

    imported = service.import_config_snapshot(HarnessImportRequest(snapshot=full_export, dry_run=False))
    assert imported["dry_run"] is False
    assert imported["imported_profiles"] == ["versioned"]
    assert service.get_profile("versioned").last_imported_at is not None
