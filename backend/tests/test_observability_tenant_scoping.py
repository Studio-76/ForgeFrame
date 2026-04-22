import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.api.admin.control_plane import get_control_plane_service
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service
from app.main import app
from app.settings.config import Settings
from app.storage.governance_repository import PostgresGovernanceRepository
from app.storage.migrator import apply_storage_migrations
from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID
from app.usage.analytics import get_usage_analytics_store


def _admin_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/admin/auth/login",
        json={"username": "admin", "password": os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"]},
    )
    assert response.status_code == 201
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    if response.json()["user"]["must_rotate_password"] is True:
        rotate = client.post(
            "/admin/auth/rotate-password",
            headers=headers,
            json={
                "current_password": os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"],
                "new_password": os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"],
            },
        )
        assert rotate.status_code == 200
    return headers


def _issue_runtime_key(client: TestClient, *, label: str) -> tuple[str, str]:
    headers = _admin_headers(client)
    account_response = client.post("/admin/accounts/", headers=headers, json={"label": label})
    assert account_response.status_code == 201
    account_id = account_response.json()["account"]["account_id"]

    key_response = client.post(
        "/admin/keys/",
        headers=headers,
        json={
            "label": f"{label} Key",
            "account_id": account_id,
            "scopes": ["models:read", "chat:write", "responses:write"],
        },
    )
    assert key_response.status_code == 201
    return account_id, key_response.json()["issued"]["token"]


def _read_jsonl(path: Path) -> list[dict[str, object]]:
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return []
    return [json.loads(line) for line in raw.splitlines() if line.strip()]


def _write_observability_events(*events: dict[str, object]) -> None:
    path = Path(os.environ["FORGEGATE_OBSERVABILITY_EVENTS_PATH"])
    path.write_text(
        "\n".join(json.dumps(event) for event in events) + "\n",
        encoding="utf-8",
    )
    get_usage_analytics_store.cache_clear()


def test_usage_summary_requires_tenant_filter_for_mixed_runtime_history(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    client = TestClient(app)
    headers = _admin_headers(client)
    tenant_a, token_a = _issue_runtime_key(client, label="Tenant A")
    tenant_b, token_b = _issue_runtime_key(client, label="Tenant B")

    first = client.post(
        "/v1/chat/completions",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"messages": [{"role": "user", "content": "tenant a request"}]},
    )
    assert first.status_code == 200

    second = client.post(
        "/v1/chat/completions",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"messages": [{"role": "user", "content": "tenant b request"}]},
    )
    assert second.status_code == 200

    summary = client.get("/admin/usage/", headers=headers)
    assert summary.status_code == 400
    assert summary.json()["error"]["type"] == "tenant_filter_required"

    filtered = client.get(f"/admin/usage/?tenantId={tenant_a}", headers=headers)
    assert filtered.status_code == 200
    assert filtered.json()["metrics"]["recorded_request_count"] == 1

    logs = client.get(f"/admin/logs/?tenantId={tenant_a}", headers=headers)
    assert logs.status_code == 200
    audit_history = client.get(f"/admin/logs/audit-events?tenantId={tenant_a}&window=all", headers=headers)
    assert audit_history.status_code == 200
    assert logs.json()["operability"]["metrics"]["runtime_requests"] == 1
    assert logs.json()["operability"]["logging"]["audit_event_count"] == audit_history.json()["summary"]["totalMatchingFilters"]
    assert audit_history.json()["items"]
    assert all(item["tenantId"] == tenant_a for item in audit_history.json()["items"])
    scoped_events = get_governance_service().list_audit_events(limit=50, tenant_id=tenant_a)
    assert all(item.metadata.get("account_id") != tenant_b for item in scoped_events)


def test_windowed_usage_endpoints_require_tenant_filter_for_mixed_history_outside_window() -> None:
    recent_timestamp = (datetime.now(tz=UTC) - timedelta(hours=1)).isoformat()
    stale_timestamp = (datetime.now(tz=UTC) - timedelta(days=2)).isoformat()
    _write_observability_events(
        {
            "kind": "usage",
            "data": {
                "tenant_id": "tenant_a",
                "provider": "openai_api",
                "model": "gpt-4.1-mini",
                "credential_type": "runtime_key",
                "auth_source": "runtime",
                "client_id": "shared-client",
                "consumer": "tests",
                "integration": "pytest",
                "traffic_type": "runtime",
                "input_tokens": 10,
                "output_tokens": 5,
                "total_tokens": 15,
                "actual_cost": 0.12,
                "hypothetical_cost": 0.14,
                "avoided_cost": 0.02,
                "created_at": recent_timestamp,
            },
        },
        {
            "kind": "usage",
            "data": {
                "tenant_id": "tenant_b",
                "provider": "openai_api",
                "model": "gpt-4.1-mini",
                "credential_type": "runtime_key",
                "auth_source": "runtime",
                "client_id": "shared-client",
                "consumer": "tests",
                "integration": "pytest",
                "traffic_type": "runtime",
                "input_tokens": 12,
                "output_tokens": 7,
                "total_tokens": 19,
                "actual_cost": 0.16,
                "hypothetical_cost": 0.18,
                "avoided_cost": 0.02,
                "created_at": stale_timestamp,
            },
        },
    )

    client = TestClient(app)
    headers = _admin_headers(client)

    usage_summary = client.get("/admin/usage/?window=24h", headers=headers)
    assert usage_summary.status_code == 400
    assert usage_summary.json()["error"]["type"] == "tenant_filter_required"

    logs = client.get("/admin/logs/", headers=headers)
    assert logs.status_code == 400
    assert logs.json()["error"]["type"] == "tenant_filter_required"

    dashboard = client.get("/admin/dashboard/", headers=headers)
    assert dashboard.status_code == 400
    assert dashboard.json()["error"]["type"] == "tenant_filter_required"

    provider_drilldown = client.get("/admin/usage/providers/openai_api?window=24h", headers=headers)
    assert provider_drilldown.status_code == 400
    assert provider_drilldown.json()["error"]["type"] == "tenant_filter_required"

    client_drilldown = client.get("/admin/usage/clients/shared-client?window=24h", headers=headers)
    assert client_drilldown.status_code == 400
    assert client_drilldown.json()["error"]["type"] == "tenant_filter_required"

    filtered_summary = client.get("/admin/usage/?window=24h&tenantId=tenant_a", headers=headers)
    assert filtered_summary.status_code == 200
    assert filtered_summary.json()["metrics"]["recorded_request_count"] == 1

    filtered_logs = client.get("/admin/logs/?tenantId=tenant_a", headers=headers)
    assert filtered_logs.status_code == 200
    assert filtered_logs.json()["operability"]["metrics"]["runtime_requests"] == 1

    filtered_dashboard = client.get("/admin/dashboard/?tenantId=tenant_a", headers=headers)
    assert filtered_dashboard.status_code == 200
    assert filtered_dashboard.json()["kpis"]["runtime_requests_24h"] == 1

    filtered_provider_drilldown = client.get("/admin/usage/providers/openai_api?window=24h&tenantId=tenant_a", headers=headers)
    assert filtered_provider_drilldown.status_code == 200
    assert filtered_provider_drilldown.json()["drilldown"]["requests"] == 1

    filtered_client_drilldown = client.get("/admin/usage/clients/shared-client?window=24h&tenantId=tenant_a", headers=headers)
    assert filtered_client_drilldown.status_code == 200
    assert filtered_client_drilldown.json()["drilldown"]["requests"] == 1


def test_dashboard_filters_governance_kpis_and_omits_global_security_for_tenant_scope(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    client = TestClient(app)
    headers = _admin_headers(client)
    tenant_a, _token_a = _issue_runtime_key(client, label="Tenant A")
    _tenant_b, _token_b = _issue_runtime_key(client, label="Tenant B")

    global_dashboard = client.get("/admin/dashboard/", headers=headers)
    assert global_dashboard.status_code == 200
    assert global_dashboard.json()["kpis"]["accounts"] == 2
    assert global_dashboard.json()["kpis"]["runtime_keys"] == 2
    assert "security" in global_dashboard.json()

    filtered_dashboard = client.get(f"/admin/dashboard/?tenantId={tenant_a}", headers=headers)
    assert filtered_dashboard.status_code == 200
    assert filtered_dashboard.json()["kpis"]["accounts"] == 1
    assert filtered_dashboard.json()["kpis"]["runtime_keys"] == 1
    assert "security" not in filtered_dashboard.json()


def test_runtime_access_inventory_supports_tenant_scoped_reads(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    client = TestClient(app)
    headers = _admin_headers(client)
    tenant_a, _token_a = _issue_runtime_key(client, label="Tenant A")
    tenant_b, _token_b = _issue_runtime_key(client, label="Tenant B")

    accounts_response = client.get(f"/admin/accounts/?tenantId={tenant_a}", headers=headers)
    assert accounts_response.status_code == 200
    accounts_payload = accounts_response.json()
    assert [item["account_id"] for item in accounts_payload["accounts"]] == [tenant_a]
    assert accounts_payload["accounts"][0]["runtime_key_count"] == 1

    keys_response = client.get(f"/admin/keys/?tenantId={tenant_a}", headers=headers)
    assert keys_response.status_code == 200
    keys_payload = keys_response.json()
    assert len(keys_payload["keys"]) == 1
    assert keys_payload["keys"][0]["account_id"] == tenant_a

    assert tenant_b not in json.dumps(accounts_payload)
    assert tenant_b not in json.dumps(keys_payload)


def test_observability_and_oauth_writes_persist_tenant_ids(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()

    client = TestClient(app)
    headers = _admin_headers(client)
    tenant_a, token_a = _issue_runtime_key(client, label="Tenant A")

    runtime_ok = client.post(
        "/v1/chat/completions",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"messages": [{"role": "user", "content": "persist tenant id"}]},
    )
    assert runtime_ok.status_code == 200

    runtime_error = client.post(
        "/v1/chat/completions",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"model": "missing-tenant-model", "messages": [{"role": "user", "content": "error path"}]},
    )
    assert runtime_error.status_code == 404

    health_response = client.post("/admin/providers/health/run", headers=headers)
    assert health_response.status_code == 200

    probe_response = client.post("/admin/providers/oauth-account/probe/antigravity", headers=headers, json={})
    assert probe_response.status_code == 200

    events = _read_jsonl(Path(os.environ["FORGEGATE_OBSERVABILITY_EVENTS_PATH"]))
    usage_events = [item["data"] for item in events if item["kind"] == "usage"]
    error_events = [item["data"] for item in events if item["kind"] == "error"]
    health_events = [item["data"] for item in events if item["kind"] == "health"]

    assert any(item["tenant_id"] == tenant_a for item in usage_events)
    assert any(item["tenant_id"] == tenant_a for item in error_events)
    assert health_events
    assert all(item["tenant_id"] == DEFAULT_BOOTSTRAP_TENANT_ID for item in health_events)

    oauth_operations = _read_jsonl(Path(os.environ["FORGEGATE_OAUTH_OPERATIONS_PATH"]))
    assert oauth_operations
    assert all(item["tenant_id"] == DEFAULT_BOOTSTRAP_TENANT_ID for item in oauth_operations)


def test_oauth_operations_endpoint_requires_tenant_filter_for_mixed_history() -> None:
    path = Path(os.environ["FORGEGATE_OAUTH_OPERATIONS_PATH"])
    path.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "tenant_id": "tenant_a",
                        "provider_key": "antigravity",
                        "action": "probe",
                        "status": "ok",
                        "details": "Tenant A probe",
                        "executed_at": "2026-04-21T20:00:00+00:00",
                    }
                ),
                json.dumps(
                    {
                        "tenant_id": "tenant_b",
                        "provider_key": "antigravity",
                        "action": "probe",
                        "status": "failed",
                        "details": "Tenant B probe",
                        "executed_at": "2026-04-21T21:00:00+00:00",
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    get_control_plane_service.cache_clear()

    client = TestClient(app)
    headers = _admin_headers(client)

    unfiltered = client.get("/admin/providers/oauth-account/operations", headers=headers)
    assert unfiltered.status_code == 400
    assert unfiltered.json()["error"]["type"] == "tenant_filter_required"

    unfiltered_onboarding = client.get("/admin/providers/oauth-account/onboarding", headers=headers)
    assert unfiltered_onboarding.status_code == 400
    assert unfiltered_onboarding.json()["error"]["type"] == "tenant_filter_required"

    unfiltered_provider_snapshot = client.get("/admin/providers/", headers=headers)
    assert unfiltered_provider_snapshot.status_code == 400
    assert unfiltered_provider_snapshot.json()["error"]["type"] == "tenant_filter_required"

    unfiltered_beta_targets = client.get("/admin/providers/beta-targets", headers=headers)
    assert unfiltered_beta_targets.status_code == 400
    assert unfiltered_beta_targets.json()["error"]["type"] == "tenant_filter_required"

    unfiltered_oauth_targets = client.get("/admin/providers/oauth-account/targets", headers=headers)
    assert unfiltered_oauth_targets.status_code == 400
    assert unfiltered_oauth_targets.json()["error"]["type"] == "tenant_filter_required"

    provider_snapshot = client.get("/admin/providers/?tenantId=tenant_a", headers=headers)
    assert provider_snapshot.status_code == 200

    beta_targets = client.get("/admin/providers/beta-targets?tenantId=tenant_a", headers=headers)
    assert beta_targets.status_code == 200
    antigravity_beta = next(item for item in beta_targets.json()["targets"] if item["provider_key"] == "antigravity")
    assert antigravity_beta["verify_probe_readiness"] == "planned"
    assert antigravity_beta["evidence"]["live_probe"]["details"] == "Tenant A probe"

    oauth_targets = client.get("/admin/providers/oauth-account/targets?tenantId=tenant_a", headers=headers)
    assert oauth_targets.status_code == 200
    antigravity_target = next(item for item in oauth_targets.json()["targets"] if item["provider_key"] == "antigravity")
    assert antigravity_target["evidence"]["live_probe"]["status"] == "observed"
    assert antigravity_target["evidence"]["live_probe"]["details"] == "Tenant A probe"

    onboarding = client.get("/admin/providers/oauth-account/onboarding?tenantId=tenant_a", headers=headers)
    assert onboarding.status_code == 200
    antigravity = next(item for item in onboarding.json()["targets"] if item["provider_key"] == "antigravity")
    assert antigravity["evidence"]["live_probe"]["status"] == "observed"
    assert antigravity["evidence"]["live_probe"]["details"] == "Tenant A probe"

    filtered = client.get("/admin/providers/oauth-account/operations?tenantId=tenant_a", headers=headers)
    assert filtered.status_code == 200
    assert filtered.json()["total_operations"] == 1
    assert filtered.json()["recent"][0]["tenant_id"] == "tenant_a"


def test_governance_audit_scope_persists_company_and_tenant_metadata_in_postgres(monkeypatch, tmp_path: Path) -> None:
    schema_name = f"test_governance_audit_{uuid4().hex[:12]}"
    base_url = "postgresql+psycopg://forgegate:forgegate@localhost:5432/forgegate"
    admin_engine = create_engine(base_url, isolation_level="AUTOCOMMIT")
    scoped_url = f"{base_url}?options=-csearch_path%3D{schema_name}"

    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))

    try:
        apply_storage_migrations(scoped_url)
        monkeypatch.setenv("FORGEGATE_GOVERNANCE_STORAGE_BACKEND", "postgresql")
        monkeypatch.setenv("FORGEGATE_GOVERNANCE_POSTGRES_URL", scoped_url)
        clear_runtime_dependency_caches()
        get_governance_service.cache_clear()

        settings = Settings(
            governance_storage_backend="postgresql",
            governance_postgres_url=scoped_url,
            governance_state_path=str(tmp_path / "ignored_governance_state.json"),
        )
        repository = PostgresGovernanceRepository(scoped_url)
        service = GovernanceService(settings, repository=repository, harness_service=object())
        actor = AuthenticatedAdmin(
            session_id="sess_test_admin",
            user_id="admin_test_user",
            username="admin",
            display_name="ForgeGate Admin",
            role="admin",
        )

        account = service.create_account(label="Tenant A", provider_bindings=None, notes="", actor=actor)
        service.record_admin_audit_event(
            actor=actor,
            action="execution_run_replay",
            target_type="execution_run",
            target_id="run_alpha",
            status="ok",
            details="Replay admitted for run 'run_alpha'.",
            company_id="company_alpha",
        )

        reloaded = GovernanceService(settings, repository=PostgresGovernanceRepository(scoped_url), harness_service=object())
        tenant_events = reloaded.list_audit_events(limit=50, tenant_id=account.account_id)
        assert tenant_events
        assert any(item.action == "account_create" for item in tenant_events)
        assert all(item.tenant_id == account.account_id for item in tenant_events)

        company_events = reloaded.list_audit_events(limit=50, company_id="company_alpha")
        assert len(company_events) == 1
        assert company_events[0].action == "execution_run_replay"
        assert company_events[0].company_id == "company_alpha"
        assert company_events[0].tenant_id == DEFAULT_BOOTSTRAP_TENANT_ID

        with admin_engine.connect() as connection:
            payload = connection.execute(
                text(f'SELECT payload FROM "{schema_name}".governance_state WHERE state_key = :state_key'),
                {"state_key": "default"},
            ).scalar_one()
        stored_events = payload["audit_events"]
        assert any(item["action"] == "account_create" and item["tenant_id"] == account.account_id for item in stored_events)
        assert any(item["action"] == "execution_run_replay" and item["company_id"] == "company_alpha" for item in stored_events)
    finally:
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()
