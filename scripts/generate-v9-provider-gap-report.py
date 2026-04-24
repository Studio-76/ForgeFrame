from __future__ import annotations

import os
from datetime import UTC, datetime
from pathlib import Path

os.environ.setdefault("FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD", "report-bootstrap")
os.environ.setdefault("FORGEFRAME_HARNESS_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEFRAME_CONTROL_PLANE_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEFRAME_OBSERVABILITY_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEFRAME_GOVERNANCE_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEFRAME_INSTANCES_STORAGE_BACKEND", "file")

from app.api.admin.control_plane import ControlPlaneService
from app.core.model_registry import ModelRegistry
from app.harness.service import HarnessService
from app.harness.store import HarnessStore
from app.instances.service import InstanceService
from app.providers import ProviderRegistry
from app.settings.config import Settings
from app.storage.control_plane_repository import get_control_plane_state_repository
from app.storage.harness_repository import FileHarnessRepository, HarnessStoragePaths
from app.storage.instance_repository import get_instance_repository
from app.storage.oauth_operations_repository import get_oauth_operations_repository
from app.storage.observability_repository import get_observability_repository
from app.usage.analytics import UsageAnalyticsStore


def _build_settings() -> Settings:
    return Settings(
        bootstrap_admin_password=os.getenv("FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD", "report-bootstrap"),
        harness_storage_backend="file",
        control_plane_storage_backend="file",
        observability_storage_backend="file",
        governance_storage_backend="file",
        instances_storage_backend="file",
    )


def _build_service(settings: Settings) -> ControlPlaneService:
    harness = HarnessService(
        HarnessStore(
            repository=FileHarnessRepository(
                paths=HarnessStoragePaths(
                    profiles_path=Path(settings.harness_profiles_path),
                    runs_path=Path(settings.harness_runs_path),
                )
            )
        )
    )
    instance_service = InstanceService(settings, repository=get_instance_repository(settings))
    instance = instance_service.resolve_instance(allow_default=True)
    registry = ModelRegistry(settings, instance_id=instance.instance_id)
    providers = ProviderRegistry(settings, harness_service=harness)
    analytics = UsageAnalyticsStore(
        repository=get_observability_repository(settings),
        default_tenant_id=settings.bootstrap_tenant_id,
    )
    return ControlPlaneService(
        settings,
        instance,
        registry,
        providers,
        analytics,
        harness,
        state_repository=get_control_plane_state_repository(settings),
        oauth_operations_repository=get_oauth_operations_repository(settings),
    )


def _render_report(service: ControlPlaneService) -> str:
    generated_at = datetime.now(tz=UTC).isoformat()
    catalog = [item.model_dump(mode="json") for item in service.list_provider_catalog()]
    catalog_summary = service.provider_catalog_summary().model_dump(mode="json")
    compatibility = service.openai_compatibility_signoff()
    compatibility_summary = compatibility["summary"]
    compatibility_rows = compatibility["rows"]

    provider_lines: list[str] = []
    for entry in sorted(catalog, key=lambda item: (item["maturity_status"], item["provider_id"])):
        if entry["maturity_status"] in {"runtime-ready", "fully-integrated"} and entry["live_signoff_status"] in {"pending-review", "signed-off"}:
            continue
        provider_lines.append(
            f"- `{entry['provider_id']}`: maturity=`{entry['maturity_status']}`, signoff=`{entry['live_signoff_status']}`, "
            f"missing={', '.join(entry['missing_evidence']) if entry['missing_evidence'] else 'none'}, "
            f"next=`{entry['safe_next_action']}`"
        )

    compatibility_lines: list[str] = []
    for check in compatibility_rows:
        if check["status"] == "supported":
            continue
        compatibility_lines.append(
            f"- `{check['corpus_class']}`: status=`{check['status']}`, route=`{check.get('route') or 'n/a'}`, "
            f"evidence=`{check.get('evidence_source') or 'unknown'}`, reason=`{check.get('deviation_reason') or check.get('notes') or 'n/a'}`"
        )

    report_lines = [
        "# V9 Provider GAP Report",
        "",
        f"Generated at: `{generated_at}`",
        "",
        "## Provider Catalog Summary",
        "",
        f"- total providers: `{catalog_summary['total_providers']}`",
        f"- documented only: `{catalog_summary['documented_only']}`",
        f"- contract ready: `{catalog_summary['contract_ready']}`",
        f"- adapter ready without live proof: `{catalog_summary['adapter_ready_without_live_proof']}`",
        f"- onboarding only: `{catalog_summary['onboarding_only']}`",
        f"- bridge only: `{catalog_summary['bridge_only']}`",
        f"- partial runtime: `{catalog_summary['partial_runtime']}`",
        f"- runtime ready: `{catalog_summary['runtime_ready']}`",
        f"- fully integrated: `{catalog_summary['fully_integrated']}`",
        f"- blocked live signoffs: `{catalog_summary['blocked_live_signoffs']}`",
        "",
        "## OpenAI Compatibility Summary",
        "",
        f"- overall status: `{compatibility_summary['overall_status']}`",
        f"- supported: `{compatibility_summary['supported']}`",
        f"- partial: `{compatibility_summary['partial']}`",
        f"- unsupported: `{compatibility_summary['unsupported']}`",
        f"- blocked by live evidence: `{compatibility_summary['blocked_by_live_evidence']}`",
        f"- signoff claimable: `{compatibility_summary['signoff_claimable']}`",
        "",
        "## Provider Gaps",
        "",
        *(provider_lines or ["- none"]),
        "",
        "## Compatibility Gaps",
        "",
        *(compatibility_lines or ["- none"]),
        "",
        "## Method",
        "",
        "- Report is computed from the local ForgeFrame control-plane, provider catalog seed, harness state, observability state, and OpenAI compatibility signoff projection.",
        "- Missing credentials or missing live traffic remain blocked-by-live-evidence and are not promoted to green.",
        "- This report is a repo/runtime projection from the local workspace, not a claim of globally verified production signoff.",
    ]
    return "\n".join(report_lines) + "\n"


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    report_path = repo_root / "docs" / "v9-provider-work" / "V9_PROVIDER_GAP_REPORT.md"
    settings = _build_settings()
    service = _build_service(settings)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(_render_report(service), encoding="utf-8")
    print(report_path)


if __name__ == "__main__":
    main()
