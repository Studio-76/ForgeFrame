"""PostgreSQL storage migration discovery and execution helpers."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import text

from app.settings.config import Settings
from app.storage.db import build_postgres_engine

_MIGRATION_TABLE = "forgegate_schema_migrations"


@dataclass(frozen=True)
class StorageMigration:
    version: int
    name: str
    path: Path


def _migrations_dir() -> Path:
    return Path(__file__).resolve().parent / "migrations"


def list_storage_migrations() -> list[StorageMigration]:
    migrations: list[StorageMigration] = []
    for path in sorted(_migrations_dir().glob("*.sql")):
        stem = path.stem
        version_text, _, name = stem.partition("_")
        migrations.append(
            StorageMigration(
                version=int(version_text),
                name=name or stem,
                path=path,
            )
        )
    return migrations


def storage_postgres_targets(settings: Settings) -> list[str]:
    targets: list[str] = []
    for enabled, database_url in [
        (settings.harness_storage_backend == "postgresql", settings.harness_postgres_url.strip()),
        (
            settings.control_plane_storage_backend == "postgresql",
            settings.control_plane_postgres_url.strip() or settings.harness_postgres_url.strip(),
        ),
        (
            settings.observability_storage_backend == "postgresql",
            settings.observability_postgres_url.strip() or settings.harness_postgres_url.strip(),
        ),
        (
            settings.governance_storage_backend == "postgresql",
            settings.governance_postgres_url.strip() or settings.harness_postgres_url.strip(),
        ),
    ]:
        if not enabled or not database_url:
            continue
        if database_url not in targets:
            targets.append(database_url)
    return targets


def apply_storage_migrations(database_url: str) -> dict[str, object]:
    engine = build_postgres_engine(database_url)
    migrations = list_storage_migrations()
    applied_versions: list[int] = []
    skipped_versions: list[int] = []

    with engine.begin() as connection:
        connection.execute(
            text(
                f"""
                CREATE TABLE IF NOT EXISTS {_MIGRATION_TABLE} (
                    version INTEGER PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        )
        existing_versions = {
            row[0]
            for row in connection.execute(
                text(f"SELECT version FROM {_MIGRATION_TABLE} ORDER BY version ASC")
            )
        }
        for migration in migrations:
            if migration.version in existing_versions:
                skipped_versions.append(migration.version)
                continue
            sql = migration.path.read_text(encoding="utf-8")
            statements = [
                statement.strip()
                for statement in sql.split(";")
                if statement.strip()
            ]
            for statement in statements:
                connection.exec_driver_sql(statement)
            connection.execute(
                text(
                    f"""
                    INSERT INTO {_MIGRATION_TABLE} (version, name)
                    VALUES (:version, :name)
                    """
                ),
                {"version": migration.version, "name": migration.name},
            )
            applied_versions.append(migration.version)

    return {
        "database_url": database_url,
        "applied_versions": applied_versions,
        "skipped_versions": skipped_versions,
        "latest_version": migrations[-1].version if migrations else 0,
    }
