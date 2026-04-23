import json
import os
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from conftest import admin_headers as shared_admin_headers
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.auth.local_auth import hash_password, new_secret_salt
from app.governance.models import AdminUserRecord, AuditEventRecord, GatewayAccountRecord, GovernanceStateRecord
from app.governance.service import get_governance_service
from app.main import app
from app.storage.migrator import apply_storage_migrations


TEST_BOOTSTRAP_ADMIN_PASSWORD = "ForgeFrame-Test-Admin-Secret-123"


def _clear_dependency_caches() -> None:
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()


def _admin_login(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def test_postgres_admin_logs_routes_prefer_relational_audit_truth_over_stale_legacy_shadow(
    monkeypatch,
) -> None:
    schema_name = f"test_admin_logs_audit_postgres_{uuid4().hex[:12]}"
    base_url = "postgresql+psycopg://forgegate:forgegate@localhost:5432/forgegate"
    scoped_url = f"{base_url}?options=-csearch_path%3D{schema_name}"
    admin_engine = create_engine(base_url, isolation_level="AUTOCOMMIT")

    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))

    try:
        initial_result = apply_storage_migrations(scoped_url)
        assert initial_result["latest_version"] >= 14

        salt = new_secret_salt()
        legacy_state = GovernanceStateRecord(
            admin_users=[
                AdminUserRecord(
                    user_id="admin_seed",
                    username="admin",
                    display_name="ForgeFrame Admin",
                    role="admin",
                    status="active",
                    password_hash=hash_password(TEST_BOOTSTRAP_ADMIN_PASSWORD, salt),
                    password_salt=salt,
                    must_rotate_password=False,
                    created_at="2026-04-21T00:00:00+00:00",
                    updated_at="2026-04-21T00:00:00+00:00",
                    created_by="system",
                )
            ],
            gateway_accounts=[
                GatewayAccountRecord(
                    account_id="acct_seed",
                    label="Tenant A",
                    provider_bindings=["openai_api"],
                    notes="legacy seed account",
                    created_at="2026-04-21T00:10:00+00:00",
                    updated_at="2026-04-21T00:10:00+00:00",
                )
            ],
            audit_events=[
                AuditEventRecord(
                    event_id="audit_seed_account",
                    actor_type="admin_user",
                    actor_id="admin_seed",
                    tenant_id="acct_seed",
                    action="account_create",
                    target_type="gateway_account",
                    target_id="acct_seed",
                    status="ok",
                    details="legacy-json-details",
                    metadata={"account_id": "acct_seed"},
                    created_at="2026-04-21T00:20:00+00:00",
                )
            ],
        )

        with admin_engine.begin() as connection:
            connection.execute(
                text(
                    f'''
                    DELETE FROM "{schema_name}".forgegate_schema_migrations
                    WHERE version = 14
                    '''
                )
            )
            connection.execute(text(f'DELETE FROM "{schema_name}".audit_events'))
            connection.execute(text(f'DELETE FROM "{schema_name}".tenants'))
            connection.execute(
                text(
                    f'''
                    DELETE FROM "{schema_name}".governance_state
                    WHERE state_key = :state_key
                    '''
                ),
                {"state_key": "default"},
            )
            connection.execute(
                text(
                    f'''
                    INSERT INTO "{schema_name}".governance_state (state_key, payload, updated_at)
                    VALUES (:state_key, CAST(:payload AS jsonb), NOW())
                    '''
                ),
                {
                    "state_key": "default",
                    "payload": json.dumps(legacy_state.model_dump()),
                },
            )

        repair_result = apply_storage_migrations(scoped_url)
        assert repair_result["latest_version"] >= 14
        assert 14 in repair_result["applied_versions"]

        with admin_engine.begin() as connection:
            connection.execute(
                text(
                    f'''
                    UPDATE "{schema_name}".audit_events
                    SET details = :details
                    WHERE event_id = :event_id
                    '''
                ),
                {
                    "details": "relational-truth-details",
                    "event_id": "audit_seed_account",
                },
            )

        monkeypatch.setenv("FORGEGATE_GOVERNANCE_STORAGE_BACKEND", "postgresql")
        monkeypatch.setenv("FORGEGATE_GOVERNANCE_POSTGRES_URL", scoped_url)
        monkeypatch.setenv("FORGEGATE_GOVERNANCE_RELATIONAL_DUAL_WRITE_ENABLED", "true")
        monkeypatch.setenv("FORGEGATE_GOVERNANCE_RELATIONAL_READS_ENABLED", "false")
        monkeypatch.setenv("FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD", TEST_BOOTSTRAP_ADMIN_PASSWORD)
        _clear_dependency_caches()

        client = TestClient(app)
        headers = _admin_login(client)

        audit_history = client.get(
            "/admin/logs/audit-events?tenantId=acct_seed&window=all",
            headers=headers,
        )
        assert audit_history.status_code == 200
        audit_history_payload = audit_history.json()
        assert audit_history_payload["items"]
        assert audit_history_payload["items"][0]["eventId"] == "audit_seed_account"
        assert audit_history_payload["items"][0]["summary"] == "relational-truth-details"

        overview = client.get("/admin/logs/?tenantId=acct_seed", headers=headers)
        assert overview.status_code == 200
        overview_payload = overview.json()
        assert overview_payload["audit_preview"]
        assert overview_payload["audit_preview"][0]["eventId"] == "audit_seed_account"
        assert overview_payload["audit_preview"][0]["summary"] == "relational-truth-details"

        with admin_engine.connect() as connection:
            stored_details = connection.execute(
                text(
                    f'''
                    SELECT details
                    FROM "{schema_name}".audit_events
                    WHERE event_id = :event_id
                    '''
                ),
                {"event_id": "audit_seed_account"},
            ).scalar_one()
        assert stored_details == "relational-truth-details"
    finally:
        _clear_dependency_caches()
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()
