import os
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from conftest import admin_headers as shared_admin_headers
from app.api.admin.control_plane import get_control_plane_service
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.control_plane import OAuthOperationRecord
from app.main import app
from app.storage.migrator import apply_storage_migrations
from app.storage.oauth_operations_repository import PostgresOAuthOperationsRepository
from app.storage.observability_repository import PostgresObservabilityRepository
from app.usage.analytics import get_usage_analytics_store
from app.usage.events import ErrorEvent, HealthEvent, UsageEvent


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _scoped_postgres_url(schema_name: str) -> tuple[str, object]:
    base_url = "postgresql+psycopg://forgegate:forgegate@localhost:5432/forgegate"
    admin_engine = create_engine(base_url, isolation_level="AUTOCOMMIT")
    scoped_url = f"{base_url}?options=-csearch_path%3D{schema_name}"
    return scoped_url, admin_engine


def test_usage_admin_endpoints_use_postgres_pushdown_without_loading_full_event_history(
    monkeypatch,
) -> None:
    schema_name = f"test_obs_sql_{uuid4().hex[:12]}"
    scoped_url, admin_engine = _scoped_postgres_url(schema_name)

    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))

    try:
        apply_storage_migrations(scoped_url)
        monkeypatch.setenv("FORGEGATE_OBSERVABILITY_STORAGE_BACKEND", "postgresql")
        monkeypatch.setenv("FORGEGATE_OBSERVABILITY_POSTGRES_URL", scoped_url)
        clear_runtime_dependency_caches()
        get_usage_analytics_store.cache_clear()
        get_control_plane_service.cache_clear()

        repository = PostgresObservabilityRepository(scoped_url)
        repository.append_usage_event(
            UsageEvent(
                tenant_id="tenant_a",
                provider="openai_api",
                model="gpt-4.1-mini",
                credential_type="runtime_key",
                auth_source="runtime",
                client_id="shared-client",
                consumer="tests",
                integration="pytest",
                traffic_type="runtime",
                stream_mode="non_stream",
                tool_call_count=0,
                input_tokens=12,
                output_tokens=8,
                total_tokens=20,
                actual_cost=0.15,
                hypothetical_cost=0.18,
                avoided_cost=0.03,
                duration_ms=120,
                created_at="2026-04-22T00:05:00+00:00",
            )
        )
        repository.append_usage_event(
            UsageEvent(
                tenant_id="tenant_b",
                provider="openai_api",
                model="gpt-4.1-mini",
                credential_type="runtime_key",
                auth_source="runtime",
                client_id="shared-client",
                consumer="tests",
                integration="pytest",
                traffic_type="runtime",
                stream_mode="stream",
                tool_call_count=1,
                input_tokens=7,
                output_tokens=5,
                total_tokens=12,
                actual_cost=0.11,
                hypothetical_cost=0.13,
                avoided_cost=0.02,
                duration_ms=95,
                created_at="2026-04-22T00:06:00+00:00",
            )
        )
        repository.append_error_event(
            ErrorEvent(
                tenant_id="tenant_a",
                provider="openai_api",
                model="gpt-4.1-mini",
                client_id="shared-client",
                consumer="tests",
                integration="pytest",
                route="/v1/chat/completions",
                stream_mode="non_stream",
                traffic_type="runtime",
                error_type="provider_upstream_error",
                status_code=502,
                integration_class="runtime",
                template_id=None,
                test_phase=None,
                profile_key="default_profile",
                duration_ms=180,
                created_at="2026-04-22T00:07:00+00:00",
            )
        )
        repository.append_health_event(
            HealthEvent(
                tenant_id="tenant_a",
                provider="openai_api",
                model="gpt-4.1-mini",
                check_type="provider",
                status="healthy",
                readiness_reason="recent probe ok",
                last_error=None,
                created_at="2026-04-22T00:08:00+00:00",
            )
        )

        def _unexpected_load(*args, **kwargs):
            raise AssertionError("route should use SQL-backed observability queries, not load_* history reads")

        monkeypatch.setattr(PostgresObservabilityRepository, "load_usage_events", _unexpected_load)
        monkeypatch.setattr(PostgresObservabilityRepository, "load_error_events", _unexpected_load)
        monkeypatch.setattr(PostgresObservabilityRepository, "load_health_events", _unexpected_load)

        client = TestClient(app)
        headers = _admin_headers(client)

        unfiltered = client.get("/admin/usage/?window=24h", headers=headers)
        assert unfiltered.status_code == 400
        assert unfiltered.json()["error"]["type"] == "tenant_filter_required"

        summary = client.get("/admin/usage/?window=24h&tenantId=tenant_a", headers=headers)
        assert summary.status_code == 200
        assert summary.json()["metrics"]["recorded_request_count"] == 1
        assert summary.json()["metrics"]["recorded_error_count"] == 1
        assert summary.json()["metrics"]["recorded_health_event_count"] == 1
        assert summary.json()["aggregations"]["by_provider"][0]["provider"] == "openai_api"
        assert summary.json()["latest_health"][0]["provider"] == "openai_api"
        aggregate_summary = repository.aggregate_summary(window_seconds=24 * 3600, tenant_id="tenant_a")
        assert aggregate_summary["runtime_duration_ms"]["sample_count"] == 2
        assert aggregate_summary["runtime_duration_ms"]["p95"] == 180

        provider_drilldown = client.get("/admin/usage/providers/openai_api?window=24h&tenantId=tenant_a", headers=headers)
        assert provider_drilldown.status_code == 200
        assert provider_drilldown.json()["drilldown"]["requests"] == 1
        assert provider_drilldown.json()["drilldown"]["errors"] == 1

        client_drilldown = client.get("/admin/usage/clients/shared-client?window=24h&tenantId=tenant_a", headers=headers)
        assert client_drilldown.status_code == 200
        assert client_drilldown.json()["drilldown"]["requests"] == 1
        assert client_drilldown.json()["drilldown"]["errors"] == 1

        providers = client.get("/admin/providers/?tenantId=tenant_a", headers=headers)
        assert providers.status_code == 200
        assert providers.json()["status"] == "ok"
    finally:
        clear_runtime_dependency_caches()
        get_usage_analytics_store.cache_clear()
        get_control_plane_service.cache_clear()
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()


def test_oauth_operations_endpoint_uses_postgres_tail_queries_without_loading_full_history(
    monkeypatch,
) -> None:
    schema_name = f"test_oauth_sql_{uuid4().hex[:12]}"
    scoped_url, admin_engine = _scoped_postgres_url(schema_name)

    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))

    try:
        apply_storage_migrations(scoped_url)
        monkeypatch.setenv("FORGEGATE_OBSERVABILITY_STORAGE_BACKEND", "postgresql")
        monkeypatch.setenv("FORGEGATE_OBSERVABILITY_POSTGRES_URL", scoped_url)
        clear_runtime_dependency_caches()
        get_usage_analytics_store.cache_clear()
        get_control_plane_service.cache_clear()

        repository = PostgresOAuthOperationsRepository(scoped_url)
        repository.append_operation(
            OAuthOperationRecord(
                tenant_id="tenant_a",
                provider_key="antigravity",
                action="probe",
                status="ok",
                details="Tenant A probe",
                executed_at="2026-04-22T00:10:00+00:00",
            )
        )
        repository.append_operation(
            OAuthOperationRecord(
                tenant_id="tenant_b",
                provider_key="antigravity",
                action="probe",
                status="failed",
                details="Tenant B probe",
                executed_at="2026-04-22T00:11:00+00:00",
            )
        )
        repository.append_operation(
            OAuthOperationRecord(
                tenant_id="tenant_a",
                provider_key="antigravity",
                action="bridge_sync",
                status="warning",
                details="Tenant A bridge sync",
                executed_at="2026-04-22T00:12:00+00:00",
            )
        )

        def _unexpected_load(*args, **kwargs):
            raise AssertionError("route should use SQL-backed oauth tail queries, not load_operations")

        monkeypatch.setattr(PostgresOAuthOperationsRepository, "load_operations", _unexpected_load)

        client = TestClient(app)
        headers = _admin_headers(client)

        unfiltered = client.get("/admin/providers/oauth-account/operations", headers=headers)
        assert unfiltered.status_code == 400
        assert unfiltered.json()["error"]["type"] == "tenant_filter_required"

        filtered = client.get("/admin/providers/oauth-account/operations?tenantId=tenant_a", headers=headers)
        assert filtered.status_code == 200
        assert filtered.json()["tenant_id"] == "tenant_a"
        assert filtered.json()["total_operations"] == 2
        antigravity = next(item for item in filtered.json()["operations"] if item["provider_key"] == "antigravity")
        assert antigravity["probe_count"] == 1
        assert antigravity["bridge_sync_count"] == 1
        assert antigravity["last_probe"]["tenant_id"] == "tenant_a"
        assert filtered.json()["recent"][-1]["action"] == "bridge_sync"
    finally:
        clear_runtime_dependency_caches()
        get_usage_analytics_store.cache_clear()
        get_control_plane_service.cache_clear()
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()
