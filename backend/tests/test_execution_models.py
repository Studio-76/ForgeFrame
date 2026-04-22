from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.execution.models import (
    CreateRun,
    CreateRunCommand,
    CreateRunSecretBinding,
    RunRecord,
)


def test_create_run_defaults_to_queued_state() -> None:
    payload = CreateRun(run_kind="provider_dispatch")

    assert payload.state == "queued"
    assert payload.active_attempt_no == 1
    assert payload.version == 0


def test_run_models_reject_unknown_state_values() -> None:
    with pytest.raises(ValidationError):
        CreateRun(run_kind="provider_dispatch", state="drifting")

    with pytest.raises(ValidationError):
        CreateRunCommand(
            command_type="unknown",
            actor_type="agent",
            actor_id="agent_1",
            idempotency_key="idem_1",
            request_fingerprint_hash="fp_1",
        )


def test_secret_binding_purpose_stays_aligned_with_provider_contract() -> None:
    binding = CreateRunSecretBinding(
        run_id="run_123",
        attempt_id="attempt_1",
        step_key="provider_call",
        secret_reference_id="secret_ref_1",
        required_version=1,
        purpose="provider_api_key",
    )

    assert binding.purpose == "provider_api_key"

    with pytest.raises(ValidationError):
        CreateRunSecretBinding(
            run_id="run_123",
            attempt_id="attempt_1",
            step_key="provider_call",
            secret_reference_id="secret_ref_1",
            required_version=1,
            purpose="raw_password",
        )


def test_run_record_requires_nonnegative_version() -> None:
    now = datetime(2026, 4, 21, 20, 0, tzinfo=UTC)

    record = RunRecord(
        id="run_123",
        company_id="cmp_123",
        run_kind="provider_dispatch",
        created_at=now,
        updated_at=now,
    )

    assert record.version == 0

    with pytest.raises(ValidationError):
        RunRecord(
            id="run_123",
            company_id="cmp_123",
            run_kind="provider_dispatch",
            version=-1,
            created_at=now,
            updated_at=now,
        )
