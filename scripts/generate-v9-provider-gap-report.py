from __future__ import annotations

import base64
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD", "report-bootstrap")
os.environ.setdefault("FORGEFRAME_HARNESS_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEFRAME_CONTROL_PLANE_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEFRAME_OBSERVABILITY_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEFRAME_GOVERNANCE_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEFRAME_INSTANCES_STORAGE_BACKEND", "file")
os.environ.setdefault("FORGEFRAME_DEFAULT_PROVIDER", "forgeframe_baseline")
os.environ.setdefault("FORGEFRAME_DEFAULT_MODEL", "forgeframe-baseline-chat-v1")

from app.api.admin.control_plane import ControlPlaneService
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.core.model_registry import ModelRegistry
from app.harness.service import HarnessService
from app.harness.store import HarnessStore
from app.instances.service import InstanceService
from app.main import app
from app.providers import ProviderRegistry
from app.settings.config import Settings
from app.storage.control_plane_repository import get_control_plane_state_repository
from app.storage.harness_repository import FileHarnessRepository, HarnessStoragePaths
from app.storage.instance_repository import get_instance_repository
from app.storage.oauth_operations_repository import get_oauth_operations_repository
from app.storage.observability_repository import get_observability_repository
from app.usage.analytics import UsageAnalyticsStore
from fastapi.testclient import TestClient


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


def _seed_local_compatibility_evidence() -> list[str]:
    clear_runtime_dependency_caches()
    client = TestClient(app)
    results: list[str] = []

    def _record(name: str, ok: bool, detail: str) -> None:
        state = "ok" if ok else "failed"
        results.append(f"- `{name}`: `{state}` ({detail})")

    def _admin_headers() -> dict[str, str]:
        bootstrap_password = os.environ["FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD"]
        active_password = bootstrap_password
        response = client.post(
            "/admin/auth/login",
            json={"username": "admin", "password": active_password},
        )
        if response.status_code == 401:
            active_password = f"{bootstrap_password}-rotated"
            response = client.post(
                "/admin/auth/login",
                json={"username": "admin", "password": active_password},
            )
        if response.status_code != 201:
            raise RuntimeError(f"admin login failed with status={response.status_code}")
        payload = response.json()
        access_token = str(payload["access_token"])
        headers = {"Authorization": f"Bearer {access_token}"}
        if payload.get("user", {}).get("must_rotate_password") is True:
            rotated_password = f"{bootstrap_password}-rotated"
            rotate = client.post(
                "/admin/auth/rotate-password",
                headers=headers,
                json={"current_password": active_password, "new_password": rotated_password},
            )
            if rotate.status_code != 200:
                raise RuntimeError(f"admin password rotation failed with status={rotate.status_code}")
            relogin = client.post(
                "/admin/auth/login",
                json={"username": "admin", "password": rotated_password},
            )
            if relogin.status_code != 201:
                raise RuntimeError(f"admin relogin failed with status={relogin.status_code}")
            access_token = str(relogin.json()["access_token"])
            headers = {"Authorization": f"Bearer {access_token}"}
        return headers

    def _ensure_runtime_headers(admin_headers: dict[str, str]) -> tuple[dict[str, str], str | None]:
        accounts_response = client.get("/admin/accounts/", headers=admin_headers)
        if accounts_response.status_code != 200:
            raise RuntimeError(f"account listing failed with status={accounts_response.status_code}")
        accounts = list(accounts_response.json().get("accounts", []))
        account = next((item for item in accounts if str(item.get("label") or "") == "V9 Report Seed"), None)
        if account is None:
            create_account = client.post(
                "/admin/accounts/",
                headers=admin_headers,
                json={
                    "label": "V9 Report Seed",
                    "provider_bindings": ["forgeframe_baseline"],
                    "notes": "Local compatibility evidence seed for the V9 provider gap report.",
                },
            )
            if create_account.status_code != 201:
                raise RuntimeError(f"account creation failed with status={create_account.status_code}")
            account = create_account.json()["account"]
        else:
            bindings = {str(item) for item in account.get("provider_bindings", [])}
            if "forgeframe_baseline" not in bindings or str(account.get("status") or "") != "active":
                update_account = client.patch(
                    f"/admin/accounts/{account['account_id']}",
                    headers=admin_headers,
                    json={
                        "provider_bindings": sorted(bindings | {"forgeframe_baseline"}),
                        "status": "active",
                    },
                )
                if update_account.status_code != 200:
                    raise RuntimeError(f"account patch failed with status={update_account.status_code}")
                account = update_account.json()["account"]

        issue_key = client.post(
            "/admin/keys/",
            headers=admin_headers,
            json={
                "label": "V9 Report Seed",
                "account_id": account["account_id"],
                "scopes": ["models:read", "chat:write", "responses:write"],
                "allowed_request_paths": ["smart_routing"],
                "default_request_path": "smart_routing",
                "local_only_policy": "require_local_target",
            },
        )
        if issue_key.status_code != 201:
            raise RuntimeError(f"runtime key issue failed with status={issue_key.status_code}")
        issued = issue_key.json()["issued"]
        return {"Authorization": f"Bearer {issued['token']}"}, str(issued["key_id"])

    runtime_key_id: str | None = None
    try:
        admin_headers = _admin_headers()
        runtime_headers, runtime_key_id = _ensure_runtime_headers(admin_headers)

        response = client.post(
            "/v1/chat/completions",
            json={"messages": [{"role": "user", "content": "compat chat"}]},
            headers=runtime_headers,
        )
        _record("chat_simple", response.status_code == 200, f"status={response.status_code}")

        with client.stream(
            "POST",
            "/v1/chat/completions",
            json={"messages": [{"role": "user", "content": "compat chat stream"}], "stream": True},
            headers=runtime_headers,
        ) as stream_response:
            stream_body = "".join(stream_response.iter_text())
            _record(
                "streaming_chat",
                stream_response.status_code == 200 and "[DONE]" in stream_body,
                f"status={stream_response.status_code}",
            )

        response = client.post(
            "/v1/responses",
            json={"input": "compat responses"},
            headers=runtime_headers,
        )
        _record("responses_simple", response.status_code == 200, f"status={response.status_code}")

        response = client.post(
            "/v1/responses",
            json={
                "input": [
                    {"type": "message", "role": "user", "content": [{"type": "input_text", "text": "compat tool input"}]},
                    {"type": "function_call", "call_id": "call_in", "name": "lookup", "arguments": "{\"q\":\"forgeframe\"}"},
                    {"type": "function_call_output", "call_id": "call_in", "output": "lookup result"},
                ],
            },
            headers=runtime_headers,
        )
        _record("responses_input_items_and_tools", response.status_code == 200, f"status={response.status_code}")

        response = client.post(
            "/v1/responses",
            json={
                "input": "compat structured output",
                "text": {"format": {"type": "json_object"}},
            },
            headers=runtime_headers,
        )
        _record("structured_output", response.status_code == 200, f"status={response.status_code}")

        with client.stream(
            "POST",
            "/v1/responses",
            json={"input": "compat responses stream", "stream": True},
            headers=runtime_headers,
        ) as stream_response:
            stream_body = "".join(stream_response.iter_text())
            _record(
                "streaming_responses",
                stream_response.status_code == 200 and "response.completed" in stream_body,
                f"status={stream_response.status_code}",
            )

        response = client.post(
            "/v1/responses",
            json={"input": "compat error", "model": "missing-model-for-signoff"},
            headers=runtime_headers,
        )
        _record("error_semantics", response.status_code == 404, f"status={response.status_code}")

        response = client.post(
            "/v1/files",
            json={
                "purpose": "assistants",
                "filename": "compat.txt",
                "content_type": "text/plain",
                "content_base64": base64.b64encode(b"forgeframe compatibility file").decode("ascii"),
            },
            headers=runtime_headers,
        )
        _record("files", response.status_code == 201, f"status={response.status_code}")

        response = client.post(
            "/v1/embeddings",
            json={"input": "compat embeddings proof"},
            headers=runtime_headers,
        )
        _record("embeddings", response.status_code == 200, f"status={response.status_code}")
    except Exception as exc:
        _record("seed_setup", False, str(exc))
    finally:
        if runtime_key_id is not None:
            try:
                admin_headers = _admin_headers()
                client.post(f"/admin/keys/{runtime_key_id}/revoke", headers=admin_headers)
            except Exception:
                pass
        client.close()
        clear_runtime_dependency_caches()

    return results


def _render_report(service: ControlPlaneService, seed_results: list[str]) -> str:
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
        "## Local Report Evidence Seeding",
        "",
        *(seed_results or ["- none"]),
        "",
        "## Method",
        "",
        "- Report is computed from the local ForgeFrame control-plane, provider catalog seed, harness state, observability state, and OpenAI compatibility signoff projection.",
        "- Before rendering, the report runner sends best-effort local baseline traffic through the public compatibility surface so repo-local evidence for chat/responses/files/embeddings can appear when those paths are actually wired.",
        "- Missing credentials or missing live traffic remain blocked-by-live-evidence and are not promoted to green.",
        "- This report is a repo/runtime projection from the local workspace, not a claim of globally verified production signoff.",
    ]
    return "\n".join(report_lines) + "\n"


def main() -> None:
    report_path = REPO_ROOT / "docs" / "v9-provider-work" / "V9_PROVIDER_GAP_REPORT.md"
    settings = _build_settings()
    seed_results = _seed_local_compatibility_evidence()
    service = _build_service(settings)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(_render_report(service, seed_results), encoding="utf-8")
    print(report_path)


if __name__ == "__main__":
    main()
