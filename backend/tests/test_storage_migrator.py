from app.storage.migrator import list_storage_migrations


def test_storage_migrations_are_discovered_in_order() -> None:
    migrations = list_storage_migrations()

    assert [migration.version for migration in migrations] == sorted(
        migration.version for migration in migrations
    )
    assert migrations[-1].version >= 4
