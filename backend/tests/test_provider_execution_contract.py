from datetime import UTC, datetime, timedelta

import pytest
from pydantic import SecretStr, ValidationError

from app.providers.execution_contract import (
    AdapterCallMetadata,
    NormalizedProviderError,
    ProviderExecutionResult,
    ProviderSecretReference,
    SecretBrokerUnavailableError,
    SecretMaterializationLease,
    SecretVersionConflictError,
)


def _metadata() -> AdapterCallMetadata:
    return AdapterCallMetadata(
        company_id="cmp_123",
        workspace_id="ws_456",
        run_id="run_123",
        run_attempt_id="attempt_1",
        step_id="step_provider_call",
        request_id="req_123",
        correlation_id="corr_123",
        causation_id="cmd_123",
        idempotency_key="idem_123",
        attempt_number=2,
        timeout_ms=15_000,
        deadline_at=datetime(2026, 4, 21, 18, 40, tzinfo=UTC),
        cancellation_token="cancel_123",
        cancel_requested=True,
        trace_id="trace_123",
        span_id="span_123",
    )


def test_adapter_call_metadata_projects_stable_headers() -> None:
    headers = _metadata().as_adapter_headers()

    assert headers == {
        "X-ForgeFrame-Request-Id": "req_123",
        "X-ForgeFrame-Correlation-Id": "corr_123",
        "X-ForgeFrame-Causation-Id": "cmd_123",
        "Idempotency-Key": "idem_123",
        "X-ForgeFrame-Execution-Attempt": "2",
        "X-ForgeFrame-Deadline-At": "2026-04-21T18:40:00Z",
        "X-ForgeFrame-Cancellation-Token": "cancel_123",
        "X-ForgeFrame-Cancel-Requested": "true",
        "X-ForgeFrame-Trace-Id": "trace_123",
        "X-ForgeFrame-Span-Id": "span_123",
    }


def test_provider_execution_result_requires_normalized_error_for_failures() -> None:
    error = NormalizedProviderError(
        provider="openai_api",
        phase="execute",
        category="timeout",
        code="provider_timeout",
        message="upstream timed out",
        safe_message="Provider timed out.",
        retryable=True,
    )

    result = ProviderExecutionResult(
        provider="openai_api",
        operation="chat_completion",
        status="retryable_error",
        normalized_error=error,
    )

    assert result.normalized_error is not None
    assert result.normalized_error.retryable is True

    with pytest.raises(ValidationError):
        ProviderExecutionResult(
            provider="openai_api",
            operation="chat_completion",
            status="retryable_error",
        )


def test_secret_materialization_lease_redacts_serialized_secret_and_validates_expiry() -> None:
    issued_at = datetime(2026, 4, 21, 18, 40, tzinfo=UTC)
    lease = SecretMaterializationLease(
        lease_id="lease_123",
        secret_id="sec_openai",
        version=3,
        materialized_secret=SecretStr("super-secret"),
        issued_at=issued_at,
        expires_at=issued_at + timedelta(minutes=5),
        redacted_value="sk-***",
        audit_ref="audit_123",
    )

    assert lease.materialized_secret.get_secret_value() == "super-secret"
    assert lease.model_dump(mode="json")["materialized_secret"] == "**********"

    with pytest.raises(ValidationError):
        SecretMaterializationLease(
            lease_id="lease_123",
            secret_id="sec_openai",
            version=3,
            materialized_secret=SecretStr("super-secret"),
            issued_at=issued_at,
            expires_at=issued_at - timedelta(seconds=1),
            redacted_value="sk-***",
            audit_ref="audit_123",
        )


def test_secret_broker_failure_types_expose_stable_codes() -> None:
    unavailable = SecretBrokerUnavailableError(secret_id="sec_openai")
    assert unavailable.code == "secret_broker_unavailable"
    assert unavailable.retryable is True

    version_conflict = SecretVersionConflictError(secret_id="sec_openai", version=2)
    assert version_conflict.code == "secret_version_conflict"
    assert version_conflict.retryable is False


def test_provider_secret_reference_tracks_rotation_version_and_redaction_label() -> None:
    reference = ProviderSecretReference(
        secret_id="sec_openai",
        purpose="provider_api_key",
        version=4,
        redaction_label="openai_api_key",
    )

    assert reference.version == 4
    assert reference.redaction_label == "openai_api_key"
