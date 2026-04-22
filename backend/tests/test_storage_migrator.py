from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text

from app.storage.migrator import _simple_index_target, apply_storage_migrations, list_storage_migrations

BASE_POSTGRES_URL = "postgresql+psycopg://forgegate:forgegate@localhost:5432/forgegate"


def _scoped_storage_url(schema_name: str) -> str:
    return f"{BASE_POSTGRES_URL}?options=-csearch_path%3D{schema_name}"


def _migration_versions(admin_engine, schema_name: str) -> list[int]:
    with admin_engine.connect() as connection:
        relation_exists = connection.execute(
            text("SELECT to_regclass(:relation_name)"),
            {"relation_name": f"{schema_name}.forgegate_schema_migrations"},
        ).scalar_one()
        if relation_exists is None:
            return []
        return connection.execute(
            text(
                f'''
                SELECT version
                FROM "{schema_name}".forgegate_schema_migrations
                ORDER BY version ASC
                '''
            )
        ).scalars().all()


def test_storage_migrations_are_discovered_in_order() -> None:
    migrations = list_storage_migrations()

    assert [migration.version for migration in migrations] == sorted(
        migration.version for migration in migrations
    )
    assert migrations[-1].version >= 15


def test_storage_migrations_include_governance_relational_schema() -> None:
    migrations = list_storage_migrations()

    assert any(
        migration.version == 9 and "governance_relational_tenant_auth" in migration.name
        for migration in migrations
    )
    assert any(
        migration.version == 10 and "governance_relational_integrity_guards" in migration.name
        for migration in migrations
    )
    assert any(
        migration.version == 11 and "governance_legacy_shape_repair" in migration.name
        for migration in migrations
    )
    assert any(
        migration.version == 12 and "governance_principal_default_repair" in migration.name
        for migration in migrations
    )
    assert any(
        migration.version == 13 and "governance_shadow_legacy_default_repair" in migration.name
        for migration in migrations
    )
    assert any(
        migration.version == 14 and "audit_events_backfill" in migration.name
        for migration in migrations
    )
    assert any(
        migration.version == 15 and "observability_query_index_pack" in migration.name
        for migration in migrations
    )


def test_storage_migrations_reject_duplicate_versions(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    migrations_dir = tmp_path / "migrations"
    migrations_dir.mkdir()
    (migrations_dir / "0014_first.sql").write_text("SELECT 1;\n", encoding="utf-8")
    (migrations_dir / "0014_second.sql").write_text("SELECT 2;\n", encoding="utf-8")

    monkeypatch.setattr("app.storage.migrator._migrations_dir", lambda: migrations_dir)

    with pytest.raises(ValueError, match=r"Duplicate storage migration version 0014"):
        list_storage_migrations()


def test_storage_migrator_parses_simple_create_index_targets() -> None:
    target = _simple_index_target(
        """
        -- Observability query-pack header.
        CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_traffic_created_at
            ON usage_events(tenant_id, traffic_type, created_at DESC)
        """
    )

    assert target is not None
    assert target.relation_name == "usage_events"
    assert target.schema_name is None
    assert target.table_name == "usage_events"
    assert target.column_names == ("tenant_id", "traffic_type", "created_at")


def test_apply_storage_migrations_fails_when_partial_index_relation_is_missing(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    migrations_dir = tmp_path / "migrations"
    migrations_dir.mkdir()
    (migrations_dir / "0001_add_missing_relation_index.sql").write_text(
        """
        CREATE INDEX IF NOT EXISTS request_idempotency_records_expires_idx
            ON request_idempotency_records(expires_at)
            WHERE expires_at IS NOT NULL;
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr("app.storage.migrator._migrations_dir", lambda: migrations_dir)

    schema_name = f"test_storage_migrator_skip_{uuid4().hex[:12]}"
    scoped_url = _scoped_storage_url(schema_name)
    admin_engine = create_engine(BASE_POSTGRES_URL, isolation_level="AUTOCOMMIT")

    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))

    try:
        with pytest.raises(
            ValueError,
            match=r"cannot apply index on missing relation request_idempotency_records",
        ):
            apply_storage_migrations(scoped_url)
        assert _migration_versions(admin_engine, schema_name) == []
    finally:
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()


def test_apply_storage_migrations_fails_when_partial_index_column_is_missing(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    migrations_dir = tmp_path / "migrations"
    migrations_dir.mkdir()
    (migrations_dir / "0001_add_missing_column_index.sql").write_text(
        """
        CREATE INDEX IF NOT EXISTS request_idempotency_records_expires_idx
            ON request_idempotency_records(expires_at)
            WHERE expires_at IS NOT NULL;
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr("app.storage.migrator._migrations_dir", lambda: migrations_dir)

    schema_name = f"test_storage_migrator_missing_col_{uuid4().hex[:12]}"
    scoped_url = _scoped_storage_url(schema_name)
    admin_engine = create_engine(BASE_POSTGRES_URL, isolation_level="AUTOCOMMIT")

    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))
        connection.execute(
            text(
                f'''
                CREATE TABLE "{schema_name}".request_idempotency_records (
                    id VARCHAR(64) PRIMARY KEY
                )
                '''
            )
        )

    try:
        with pytest.raises(
            ValueError,
            match=r"missing required columns expires_at",
        ):
            apply_storage_migrations(scoped_url)
        assert _migration_versions(admin_engine, schema_name) == []
    finally:
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()
