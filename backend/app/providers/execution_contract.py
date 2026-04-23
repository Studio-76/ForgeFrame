"""Internal provider-execution and secret-broker contracts for ForgeFrame.

These types sit behind the control-plane boundary from FOR-22.

- FOR-19 owns how normalized failures from this module surface through the
  public `/api/v1` error envelope and command resources.
- FOR-21 owns the retry, timeout, logging, metrics, trace, and audit controls
  that enforce the metadata contract defined here.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal, Protocol, runtime_checkable

from pydantic import BaseModel, Field, SecretStr, field_validator, model_validator


ExecutionPhase = Literal["execute", "cancel", "webhook_reconcile"]
ProviderExecutionStatus = Literal["succeeded", "retryable_error", "terminal_error", "cancelled", "awaiting_webhook"]
ProviderCancelStatus = Literal["cancelled", "already_terminal", "not_found", "pending"]
WebhookReconcileStatus = Literal["matched", "ignored", "rejected", "retry_later"]
SecretPurpose = Literal["provider_api_key", "oauth_access_token", "oauth_refresh_token", "webhook_signing_secret", "session_token"]
SecretRotationState = Literal["active", "rotating", "superseded", "revoked"]
SecretMaterializationMode = Literal["plaintext", "bearer_header", "provider_session"]
SecretRedactionTarget = Literal["log", "trace", "audit", "api_response"]
NormalizedProviderErrorCategory = Literal[
    "invalid_request",
    "authentication",
    "authorization",
    "not_found",
    "conflict",
    "rate_limited",
    "timeout",
    "cancelled",
    "protocol",
    "unavailable",
    "internal",
]
SecretAuditAction = Literal["lookup", "materialize", "release", "redact", "rotate_denied"]
SecretAuditOutcome = Literal["ok", "denied", "error"]


def _require_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("timestamp must be timezone-aware")
    return value.astimezone(UTC)


class AdapterCallMetadata(BaseModel):
    """Worker-to-adapter metadata that must survive retries and replays."""

    company_id: str
    workspace_id: str | None = None
    run_id: str
    run_attempt_id: str
    step_id: str
    request_id: str
    correlation_id: str
    causation_id: str
    idempotency_key: str
    attempt_number: int = Field(default=1, ge=1)
    timeout_ms: int = Field(default=30_000, gt=0)
    deadline_at: datetime
    cancellation_token: str
    cancel_requested: bool = False
    trace_id: str | None = None
    span_id: str | None = None

    @field_validator("deadline_at")
    @classmethod
    def _normalize_deadline(cls, value: datetime) -> datetime:
        return _require_utc(value)

    def as_adapter_headers(self) -> dict[str, str]:
        """Project stable execution metadata into header-like key/value pairs."""

        headers = {
            "X-ForgeFrame-Request-Id": self.request_id,
            "X-ForgeFrame-Correlation-Id": self.correlation_id,
            "X-ForgeFrame-Causation-Id": self.causation_id,
            "Idempotency-Key": self.idempotency_key,
            "X-ForgeFrame-Execution-Attempt": str(self.attempt_number),
            "X-ForgeFrame-Deadline-At": self.deadline_at.isoformat().replace("+00:00", "Z"),
            "X-ForgeFrame-Cancellation-Token": self.cancellation_token,
            "X-ForgeFrame-Cancel-Requested": "true" if self.cancel_requested else "false",
        }
        if self.trace_id:
            headers["X-ForgeFrame-Trace-Id"] = self.trace_id
        if self.span_id:
            headers["X-ForgeFrame-Span-Id"] = self.span_id
        return headers


class ProviderSecretReference(BaseModel):
    secret_id: str
    purpose: SecretPurpose
    version: int | None = Field(default=None, ge=1)
    required: bool = True
    redaction_label: str


class SecretLookupRequest(BaseModel):
    metadata: AdapterCallMetadata
    reference: ProviderSecretReference
    allow_rotating_version: bool = False


class SecretDescriptor(BaseModel):
    secret_id: str
    purpose: SecretPurpose
    current_version: int = Field(ge=1)
    rotation_state: SecretRotationState = "active"
    redaction_label: str
    available_versions: list[int] = Field(default_factory=list)


class SecretMaterializationRequest(BaseModel):
    metadata: AdapterCallMetadata
    reference: ProviderSecretReference
    reason: str
    lease_ttl_seconds: int = Field(default=300, gt=0, le=3600)
    mode: SecretMaterializationMode = "plaintext"


class SecretMaterializationLease(BaseModel):
    lease_id: str
    secret_id: str
    version: int = Field(ge=1)
    materialized_secret: SecretStr
    issued_at: datetime
    expires_at: datetime
    redacted_value: str
    audit_ref: str

    @field_validator("issued_at", "expires_at")
    @classmethod
    def _normalize_times(cls, value: datetime) -> datetime:
        return _require_utc(value)

    @model_validator(mode="after")
    def _validate_window(self) -> SecretMaterializationLease:
        if self.expires_at <= self.issued_at:
            raise ValueError("expires_at must be after issued_at")
        return self


class SecretAuditEvent(BaseModel):
    metadata: AdapterCallMetadata
    secret_id: str
    version: int | None = Field(default=None, ge=1)
    action: SecretAuditAction
    outcome: SecretAuditOutcome = "ok"
    reason: str
    lease_id: str | None = None
    error_code: str | None = None


class NormalizedProviderError(BaseModel):
    provider: str
    phase: ExecutionPhase
    category: NormalizedProviderErrorCategory
    code: str
    message: str
    safe_message: str
    retryable: bool = False
    upstream_status_code: int | None = None
    upstream_request_id: str | None = None
    retry_after_seconds: int | None = Field(default=None, ge=0)
    details: dict[str, object] = Field(default_factory=dict)


class ProviderExecutionRequest(BaseModel):
    provider: str
    operation: str
    model: str | None = None
    payload: dict[str, object] = Field(default_factory=dict)
    metadata: AdapterCallMetadata
    secret_references: list[ProviderSecretReference] = Field(default_factory=list)


class ProviderExecutionResult(BaseModel):
    provider: str
    operation: str
    status: ProviderExecutionStatus
    provider_request_id: str | None = None
    provider_execution_id: str | None = None
    response_payload: dict[str, object] = Field(default_factory=dict)
    normalized_error: NormalizedProviderError | None = None

    @model_validator(mode="after")
    def _validate_error_requirements(self) -> ProviderExecutionResult:
        if self.status in {"retryable_error", "terminal_error"} and self.normalized_error is None:
            raise ValueError("normalized_error is required for error outcomes")
        if self.status in {"succeeded", "cancelled", "awaiting_webhook"} and self.normalized_error is not None:
            raise ValueError("normalized_error is allowed only for error outcomes")
        return self


class ProviderCancelRequest(BaseModel):
    provider: str
    provider_execution_id: str
    reason: str
    metadata: AdapterCallMetadata
    secret_references: list[ProviderSecretReference] = Field(default_factory=list)


class ProviderCancelResult(BaseModel):
    provider: str
    provider_execution_id: str
    status: ProviderCancelStatus
    provider_request_id: str | None = None
    normalized_error: NormalizedProviderError | None = None


class ProviderWebhookEnvelope(BaseModel):
    provider: str
    event_id: str
    event_type: str
    request_id: str
    received_at: datetime
    headers: dict[str, str] = Field(default_factory=dict)
    payload: dict[str, object] = Field(default_factory=dict)
    correlation_id: str | None = None
    signature: str | None = None

    @field_validator("received_at")
    @classmethod
    def _normalize_received_at(cls, value: datetime) -> datetime:
        return _require_utc(value)


class ProviderWebhookReconcileResult(BaseModel):
    provider: str
    event_id: str
    status: WebhookReconcileStatus
    run_id: str | None = None
    provider_execution_id: str | None = None
    resume_token: str | None = None
    normalized_payload: dict[str, object] = Field(default_factory=dict)
    normalized_error: NormalizedProviderError | None = None


class SecretBrokerError(RuntimeError):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        secret_id: str | None = None,
        version: int | None = None,
        retryable: bool = False,
    ) -> None:
        self.code = code
        self.secret_id = secret_id
        self.version = version
        self.retryable = retryable
        super().__init__(message)


class SecretNotFoundError(SecretBrokerError):
    def __init__(self, *, secret_id: str) -> None:
        super().__init__(
            code="secret_not_found",
            message=f"Secret '{secret_id}' does not exist.",
            secret_id=secret_id,
        )


class SecretVersionConflictError(SecretBrokerError):
    def __init__(self, *, secret_id: str, version: int) -> None:
        super().__init__(
            code="secret_version_conflict",
            message=f"Secret '{secret_id}' version '{version}' is not active for this operation.",
            secret_id=secret_id,
            version=version,
        )


class SecretLeaseExpiredError(SecretBrokerError):
    def __init__(self, *, secret_id: str, version: int) -> None:
        super().__init__(
            code="secret_lease_expired",
            message=f"Secret lease for '{secret_id}' version '{version}' has expired.",
            secret_id=secret_id,
            version=version,
        )


class SecretBrokerUnavailableError(SecretBrokerError):
    def __init__(self, *, secret_id: str | None = None) -> None:
        super().__init__(
            code="secret_broker_unavailable",
            message="Secret broker is unavailable.",
            secret_id=secret_id,
            retryable=True,
        )


class SecretRedactionError(SecretBrokerError):
    def __init__(self, *, secret_id: str) -> None:
        super().__init__(
            code="secret_redaction_failed",
            message=f"Secret '{secret_id}' could not be redacted safely.",
            secret_id=secret_id,
        )


@runtime_checkable
class SecretBroker(Protocol):
    def lookup(self, request: SecretLookupRequest) -> SecretDescriptor:
        """Return metadata for a secret reference without exposing plaintext."""

    def materialize(self, request: SecretMaterializationRequest) -> SecretMaterializationLease:
        """Return a short-lived secret lease for an execution or cancel step."""

    def release(self, lease: SecretMaterializationLease, *, metadata: AdapterCallMetadata) -> None:
        """Release a secret lease early when the caller no longer needs plaintext."""

    def audit(self, event: SecretAuditEvent) -> None:
        """Persist a secret-access audit record."""

    def redact(self, *, reference: ProviderSecretReference, plaintext: str, target: SecretRedactionTarget) -> str:
        """Redact provider-secret material for logs, traces, audit, or API surfaces."""


@runtime_checkable
class ProviderExecutionAdapter(Protocol):
    provider_name: str

    def execute(self, request: ProviderExecutionRequest, secret_broker: SecretBroker) -> ProviderExecutionResult:
        """Execute a provider side effect using brokered secret material."""

    def cancel(self, request: ProviderCancelRequest, secret_broker: SecretBroker) -> ProviderCancelResult:
        """Attempt remote cancellation or confirm local terminal state."""

    def reconcile_webhook(self, envelope: ProviderWebhookEnvelope, secret_broker: SecretBroker) -> ProviderWebhookReconcileResult:
        """Verify and reconcile an inbound provider webhook event."""

    def normalize_error(
        self,
        *,
        phase: ExecutionPhase,
        error: Exception,
        metadata: AdapterCallMetadata | None = None,
    ) -> NormalizedProviderError:
        """Map provider-specific failures into ForgeFrame's normalized error contract."""

