"""PostgreSQL storage migration discovery and execution helpers."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re

from sqlalchemy import text

from app.settings.config import Settings
from app.storage.db import build_postgres_engine

_MIGRATION_TABLE = "forgegate_schema_migrations"
_CREATE_INDEX_STATEMENT = re.compile(
    r"""
    ^\s*
    CREATE\s+
    (?:UNIQUE\s+)?
    INDEX\s+
    (?:IF\s+NOT\s+EXISTS\s+)?
    (?P<index_name>[^\s]+)\s+
    ON\s+
    (?P<table_name>[^\s(]+)\s*
    \(
    (?P<columns>.*)
    \)
    \s*
    (?:WHERE\b.*)?
    $
    """,
    re.IGNORECASE | re.DOTALL | re.VERBOSE,
)


@dataclass(frozen=True)
class StorageMigration:
    version: int
    name: str
    path: Path


def _migrations_dir() -> Path:
    return Path(__file__).resolve().parent / "migrations"


@dataclass(frozen=True)
class SimpleIndexTarget:
    relation_name: str
    schema_name: str | None
    table_name: str
    column_names: tuple[str, ...]


def _split_top_level_csv(expression: str) -> list[str]:
    chunks: list[str] = []
    current: list[str] = []
    depth = 0
    for char in expression:
        if char == "(":
            depth += 1
        elif char == ")" and depth > 0:
            depth -= 1
        if char == "," and depth == 0:
            chunk = "".join(current).strip()
            if chunk:
                chunks.append(chunk)
            current = []
            continue
        current.append(char)
    tail = "".join(current).strip()
    if tail:
        chunks.append(tail)
    return chunks


def _simple_identifier(token: str) -> str | None:
    stripped = token.strip()
    if not stripped or "(" in stripped or ")" in stripped:
        return None
    identifier = stripped.split()[0].strip('"')
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_$]*", identifier):
        return None
    return identifier


def _strip_sql_line_comments(statement: str) -> str:
    lines = []
    for raw_line in statement.splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        lines.append(raw_line)
    return "\n".join(lines).strip()


def _simple_index_target(statement: str) -> SimpleIndexTarget | None:
    normalized_statement = _strip_sql_line_comments(statement)
    match = _CREATE_INDEX_STATEMENT.match(normalized_statement)
    if match is None:
        return None
    relation_name = match.group("table_name").strip()
    if "." in relation_name:
        raw_schema, raw_table = relation_name.split(".", 1)
        schema_name = raw_schema.strip('"')
        table_name = raw_table.strip('"')
    else:
        schema_name = None
        table_name = relation_name.strip('"')
    column_names: list[str] = []
    for chunk in _split_top_level_csv(match.group("columns")):
        column_name = _simple_identifier(chunk)
        if column_name is None:
            return None
        column_names.append(column_name)
    if not column_names:
        return None
    return SimpleIndexTarget(
        relation_name=relation_name,
        schema_name=schema_name,
        table_name=table_name,
        column_names=tuple(column_names),
    )


def _missing_index_prerequisites(
    connection, statement: str
) -> tuple[SimpleIndexTarget, tuple[str, ...]] | None:
    target = _simple_index_target(statement)
    if target is None:
        return None
    relation_exists = connection.execute(
        text("SELECT to_regclass(:relation_name)"),
        {"relation_name": target.relation_name},
    ).scalar_one()
    if relation_exists is None:
        return target, ()
    schema_clause = (
        "table_schema = :schema_name"
        if target.schema_name is not None
        else "table_schema = current_schema()"
    )
    rows = connection.execute(
        text(
            f"""
            SELECT column_name
            FROM information_schema.columns
            WHERE {schema_clause}
              AND table_name = :table_name
            """
        ),
        {
            "schema_name": target.schema_name,
            "table_name": target.table_name,
        }
        if target.schema_name is not None
        else {"table_name": target.table_name},
    )
    existing_columns = {row[0] for row in rows}
    missing_columns = tuple(
        column_name
        for column_name in target.column_names
        if column_name not in existing_columns
    )
    if missing_columns:
        return target, missing_columns
    return None


def list_storage_migrations() -> list[StorageMigration]:
    migrations: list[StorageMigration] = []
    seen_versions: dict[int, Path] = {}
    for path in sorted(_migrations_dir().glob("*.sql")):
        stem = path.stem
        version_text, _, name = stem.partition("_")
        version = int(version_text)
        existing_path = seen_versions.get(version)
        if existing_path is not None:
            raise ValueError(
                "Duplicate storage migration version "
                f"{version:04d}: {existing_path.name} and {path.name}"
            )
        seen_versions[version] = path
        migrations.append(
            StorageMigration(
                version=version,
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
                missing_prerequisites = _missing_index_prerequisites(
                    connection, statement
                )
                if missing_prerequisites is not None:
                    target, missing_columns = missing_prerequisites
                    if missing_columns:
                        missing_columns_text = ", ".join(missing_columns)
                        raise ValueError(
                            "Storage migration "
                            f"{migration.version:04d}_{migration.name} cannot "
                            f"apply index on {target.relation_name}: missing "
                            f"required columns {missing_columns_text}"
                        )
                    raise ValueError(
                        "Storage migration "
                        f"{migration.version:04d}_{migration.name} cannot apply "
                        f"index on missing relation {target.relation_name}"
                    )
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
