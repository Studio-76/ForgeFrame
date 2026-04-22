from app.storage.execution_repository import (
    RunApprovalLinkORM,
    RunAttemptORM,
    RunCommandORM,
    RunExternalCallORM,
    RunOutboxORM,
    RunSecretBindingORM,
)


def _foreign_key_pairs(table_name: str, orm_type: object) -> set[tuple[tuple[str, ...], str, tuple[str, ...]]]:
    table = orm_type.__table__  # type: ignore[attr-defined]
    pairs: set[tuple[tuple[str, ...], str, tuple[str, ...]]] = set()
    for constraint in table.foreign_key_constraints:
        local_columns = tuple(column.name for column in constraint.columns)
        remote_table = next(iter(constraint.elements)).column.table.name
        remote_columns = tuple(element.column.name for element in constraint.elements)
        pairs.add((local_columns, remote_table, remote_columns))
    return pairs


def test_execution_tables_use_same_company_composite_foreign_keys() -> None:
    assert (
        ("company_id", "run_id"),
        "runs",
        ("company_id", "id"),
    ) in _foreign_key_pairs("run_commands", RunCommandORM)
    assert (
        ("company_id", "run_id"),
        "runs",
        ("company_id", "id"),
    ) in _foreign_key_pairs("run_attempts", RunAttemptORM)
    assert (
        ("company_id", "attempt_id"),
        "run_attempts",
        ("company_id", "id"),
    ) in _foreign_key_pairs("run_approval_links", RunApprovalLinkORM)
    assert (
        ("company_id", "attempt_id"),
        "run_attempts",
        ("company_id", "id"),
    ) in _foreign_key_pairs("run_outbox", RunOutboxORM)
    assert (
        ("company_id", "attempt_id"),
        "run_attempts",
        ("company_id", "id"),
    ) in _foreign_key_pairs("run_external_calls", RunExternalCallORM)
    assert (
        ("company_id", "secret_reference_id"),
        "secret_references",
        ("company_id", "id"),
    ) in _foreign_key_pairs("run_secret_bindings", RunSecretBindingORM)
