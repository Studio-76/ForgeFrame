"""Shared execution-model contracts for run persistence and worker orchestration."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.approvals.models import APPROVAL_STATUSES, ApprovalStatus
from app.providers.execution_contract import SecretPurpose


RUN_COMMAND_TYPES = (
    "create",
    "cancel",
    "retry",
    "approval_resume",
    "approval_reject",
    "timeout_reconcile",
    "webhook_reconcile",
)
RunCommandType = Literal[
    "create",
    "cancel",
    "retry",
    "approval_resume",
    "approval_reject",
    "timeout_reconcile",
    "webhook_reconcile",
]

RUN_COMMAND_ACTOR_TYPES = ("agent", "user", "system")
RunCommandActorType = Literal["agent", "user", "system"]

RUN_COMMAND_STATUSES = ("accepted", "rejected", "completed")
RunCommandStatus = Literal["accepted", "rejected", "completed"]

RUN_STATES = (
    "queued",
    "dispatching",
    "executing",
    "waiting_on_approval",
    "cancel_requested",
    "retry_backoff",
    "compensating",
    "succeeded",
    "failed",
    "cancelled",
    "timed_out",
    "compensated",
    "dead_lettered",
)
RunState = Literal[
    "queued",
    "dispatching",
    "executing",
    "waiting_on_approval",
    "cancel_requested",
    "retry_backoff",
    "compensating",
    "succeeded",
    "failed",
    "cancelled",
    "timed_out",
    "compensated",
    "dead_lettered",
]

RUN_FAILURE_CLASSES = (
    "validation",
    "policy",
    "provider_transient",
    "provider_terminal",
    "timeout",
    "cancelled",
    "internal",
)
RunFailureClass = Literal[
    "validation",
    "policy",
    "provider_transient",
    "provider_terminal",
    "timeout",
    "cancelled",
    "internal",
]

RUN_ATTEMPT_STATES = (
    "queued",
    "dispatching",
    "executing",
    "waiting_on_approval",
    "cancel_requested",
    "retry_backoff",
    "compensating",
    "succeeded",
    "failed",
    "cancelled",
    "timed_out",
    "compensated",
    "dead_lettered",
)
RunAttemptState = Literal[
    "queued",
    "dispatching",
    "executing",
    "waiting_on_approval",
    "cancel_requested",
    "retry_backoff",
    "compensating",
    "succeeded",
    "failed",
    "cancelled",
    "timed_out",
    "compensated",
    "dead_lettered",
]

RUN_APPROVAL_GATE_STATUSES = APPROVAL_STATUSES
RunApprovalGateStatus = ApprovalStatus

RUN_RESUME_DISPOSITIONS = ("resume", "fail", "compensate", "cancel")
RunResumeDisposition = Literal["resume", "fail", "compensate", "cancel"]

RUN_OUTBOX_EVENT_TYPES = (
    "run_dispatch",
    "run_resume",
    "run_cancel",
    "approval_notify",
    "timeout_check",
    "dead_letter",
    "webhook_reconcile",
)
RunOutboxEventType = Literal[
    "run_dispatch",
    "run_resume",
    "run_cancel",
    "approval_notify",
    "timeout_check",
    "dead_letter",
    "webhook_reconcile",
]

RUN_OUTBOX_PUBLISH_STATES = ("pending", "leased", "published", "dead")
RunOutboxPublishState = Literal["pending", "leased", "published", "dead"]

RUN_EXTERNAL_CALL_STATUSES = (
    "started",
    "succeeded",
    "retryable_failure",
    "terminal_failure",
    "cancel_requested",
    "cancelled",
)
RunExternalCallStatus = Literal[
    "started",
    "succeeded",
    "retryable_failure",
    "terminal_failure",
    "cancel_requested",
    "cancelled",
]

SECRET_REFERENCE_ROTATION_STATUSES = ("active", "rotating", "revoked", "retired")
SecretReferenceRotationStatus = Literal["active", "rotating", "revoked", "retired"]

SECRET_REFERENCE_VERIFICATION_STATUSES = ("pending", "verified", "failed")
SecretReferenceVerificationStatus = Literal["pending", "verified", "failed"]

RUN_SECRET_BINDING_STATUSES = ("declared", "materialized", "expired", "revoked")
RunSecretBindingStatus = Literal["declared", "materialized", "expired", "revoked"]

SECRET_PURPOSES = (
    "provider_api_key",
    "oauth_access_token",
    "oauth_refresh_token",
    "webhook_signing_secret",
    "session_token",
)


class RunCommandRecord(BaseModel):
    id: str
    company_id: str
    run_id: str | None = None
    command_type: RunCommandType
    actor_type: RunCommandActorType
    actor_id: str
    idempotency_key: str
    request_fingerprint_hash: str
    command_status: RunCommandStatus = "accepted"
    accepted_transition: str | None = None
    response_snapshot: dict[str, Any] | None = None
    expires_at: datetime | None = None
    issued_at: datetime
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class RunRecord(BaseModel):
    id: str
    company_id: str
    workspace_id: str | None = None
    issue_id: str | None = None
    run_kind: str
    state: RunState = "queued"
    status_reason: str | None = None
    active_attempt_no: int = Field(default=1, ge=1)
    current_attempt_id: str | None = None
    current_approval_link_id: str | None = None
    latest_command_id: str | None = None
    current_step_key: str | None = None
    result_summary: dict[str, Any] | None = None
    failure_class: RunFailureClass | None = None
    next_wakeup_at: datetime | None = None
    cancel_requested_at: datetime | None = None
    terminal_at: datetime | None = None
    version: int = Field(default=0, ge=0)
    created_at: datetime
    updated_at: datetime


class RunAttemptRecord(BaseModel):
    id: str
    company_id: str
    run_id: str
    attempt_no: int = Field(ge=1)
    attempt_state: RunAttemptState = "queued"
    worker_key: str | None = None
    lease_token: str | None = None
    lease_acquired_at: datetime | None = None
    lease_expires_at: datetime | None = None
    last_heartbeat_at: datetime | None = None
    scheduled_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    retry_count: int = Field(default=0, ge=0)
    backoff_until: datetime | None = None
    execution_deadline_at: datetime | None = None
    last_error_code: str | None = None
    last_error_detail: str | None = None
    version: int = Field(default=0, ge=0)
    created_at: datetime
    updated_at: datetime


class RunApprovalLinkRecord(BaseModel):
    id: str
    company_id: str
    run_id: str
    attempt_id: str
    approval_id: str
    gate_key: str
    gate_status: RunApprovalGateStatus = "open"
    resume_disposition: RunResumeDisposition = "resume"
    opened_at: datetime
    decided_at: datetime | None = None
    resume_enqueued_at: datetime | None = None
    decision_actor_type: RunCommandActorType | None = None
    decision_actor_id: str | None = None
    version: int = Field(default=0, ge=0)
    created_at: datetime
    updated_at: datetime


class RunOutboxEntryRecord(BaseModel):
    id: str
    company_id: str
    run_id: str | None = None
    attempt_id: str | None = None
    event_type: RunOutboxEventType
    payload: dict[str, Any]
    publish_state: RunOutboxPublishState = "pending"
    dedupe_key: str
    available_at: datetime
    lease_token: str | None = None
    lease_expires_at: datetime | None = None
    publish_attempts: int = Field(default=0, ge=0)
    published_at: datetime | None = None
    dead_lettered_at: datetime | None = None
    last_publish_error: str | None = None
    created_at: datetime
    updated_at: datetime


class RunExternalCallRecord(BaseModel):
    id: str
    company_id: str
    run_id: str
    attempt_id: str
    step_key: str
    provider_key: str
    operation_key: str
    provider_request_id: str | None = None
    correlation_id: str
    call_status: RunExternalCallStatus = "started"
    idempotency_token: str | None = None
    request_summary: dict[str, Any] | None = None
    response_summary: dict[str, Any] | None = None
    http_status: int | None = None
    error_code: str | None = None
    error_class: str | None = None
    error_detail: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class SecretReferenceRecord(BaseModel):
    id: str
    company_id: str
    workspace_id: str | None = None
    company_secret_id: str | None = None
    provider_key: str
    secret_kind: str
    reference_locator: str
    version: int = Field(default=1, ge=1)
    rotation_status: SecretReferenceRotationStatus = "active"
    verification_status: SecretReferenceVerificationStatus = "pending"
    last_verified_at: datetime | None = None
    redaction_profile: str
    metadata: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class RunSecretBindingRecord(BaseModel):
    id: str
    company_id: str
    run_id: str
    attempt_id: str
    step_key: str
    secret_reference_id: str
    required_version: int = Field(ge=1)
    purpose: SecretPurpose
    binding_status: RunSecretBindingStatus = "declared"
    materialized_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CreateRunCommand(BaseModel):
    run_id: str | None = None
    command_type: RunCommandType
    actor_type: RunCommandActorType
    actor_id: str = Field(min_length=1)
    idempotency_key: str = Field(min_length=1)
    request_fingerprint_hash: str = Field(min_length=1)
    command_status: RunCommandStatus = "accepted"
    accepted_transition: str | None = None
    response_snapshot: dict[str, Any] | None = None
    expires_at: datetime | None = None


class CreateRun(BaseModel):
    workspace_id: str | None = None
    issue_id: str | None = None
    run_kind: str = Field(min_length=1)
    state: RunState = "queued"
    status_reason: str | None = None
    active_attempt_no: int = Field(default=1, ge=1)
    current_attempt_id: str | None = None
    current_approval_link_id: str | None = None
    latest_command_id: str | None = None
    current_step_key: str | None = None
    result_summary: dict[str, Any] | None = None
    failure_class: RunFailureClass | None = None
    next_wakeup_at: datetime | None = None
    cancel_requested_at: datetime | None = None
    terminal_at: datetime | None = None
    version: int = Field(default=0, ge=0)


class CreateRunAttempt(BaseModel):
    run_id: str = Field(min_length=1)
    attempt_no: int = Field(ge=1)
    attempt_state: RunAttemptState = "queued"
    worker_key: str | None = None
    lease_token: str | None = None
    lease_acquired_at: datetime | None = None
    lease_expires_at: datetime | None = None
    last_heartbeat_at: datetime | None = None
    scheduled_at: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    retry_count: int = Field(default=0, ge=0)
    backoff_until: datetime | None = None
    execution_deadline_at: datetime | None = None
    last_error_code: str | None = None
    last_error_detail: str | None = None
    version: int = Field(default=0, ge=0)


class CreateRunApprovalLink(BaseModel):
    run_id: str = Field(min_length=1)
    attempt_id: str = Field(min_length=1)
    approval_id: str = Field(min_length=1)
    gate_key: str = Field(min_length=1)
    gate_status: RunApprovalGateStatus = "open"
    resume_disposition: RunResumeDisposition = "resume"
    opened_at: datetime | None = None
    decided_at: datetime | None = None
    resume_enqueued_at: datetime | None = None
    decision_actor_type: RunCommandActorType | None = None
    decision_actor_id: str | None = None
    version: int = Field(default=0, ge=0)


class CreateRunOutboxEntry(BaseModel):
    run_id: str | None = None
    attempt_id: str | None = None
    event_type: RunOutboxEventType
    payload: dict[str, Any]
    publish_state: RunOutboxPublishState = "pending"
    dedupe_key: str = Field(min_length=1)
    available_at: datetime | None = None
    lease_token: str | None = None
    lease_expires_at: datetime | None = None
    publish_attempts: int = Field(default=0, ge=0)
    published_at: datetime | None = None
    dead_lettered_at: datetime | None = None
    last_publish_error: str | None = None


class CreateRunExternalCall(BaseModel):
    run_id: str = Field(min_length=1)
    attempt_id: str = Field(min_length=1)
    step_key: str = Field(min_length=1)
    provider_key: str = Field(min_length=1)
    operation_key: str = Field(min_length=1)
    provider_request_id: str | None = None
    correlation_id: str = Field(min_length=1)
    call_status: RunExternalCallStatus = "started"
    idempotency_token: str | None = None
    request_summary: dict[str, Any] | None = None
    response_summary: dict[str, Any] | None = None
    http_status: int | None = None
    error_code: str | None = None
    error_class: str | None = None
    error_detail: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class CreateSecretReference(BaseModel):
    workspace_id: str | None = None
    company_secret_id: str | None = None
    provider_key: str = Field(min_length=1)
    secret_kind: str = Field(min_length=1)
    reference_locator: str = Field(min_length=1)
    version: int = Field(default=1, ge=1)
    rotation_status: SecretReferenceRotationStatus = "active"
    verification_status: SecretReferenceVerificationStatus = "pending"
    last_verified_at: datetime | None = None
    redaction_profile: str = Field(min_length=1)
    metadata: dict[str, Any] | None = None


class CreateRunSecretBinding(BaseModel):
    run_id: str = Field(min_length=1)
    attempt_id: str = Field(min_length=1)
    step_key: str = Field(min_length=1)
    secret_reference_id: str = Field(min_length=1)
    required_version: int = Field(ge=1)
    purpose: SecretPurpose
    binding_status: RunSecretBindingStatus = "declared"
    materialized_at: datetime | None = None
