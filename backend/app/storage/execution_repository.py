"""Storage ORM substrate for transactional run persistence."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.execution.models import (
    EXECUTION_WORKER_STATES,
    RUN_APPROVAL_GATE_STATUSES,
    RUN_ATTEMPT_STATES,
    RUN_COMMAND_ACTOR_TYPES,
    RUN_COMMAND_STATUSES,
    RUN_COMMAND_TYPES,
    RUN_EXECUTION_LANES,
    RUN_EXTERNAL_CALL_STATUSES,
    RUN_FAILURE_CLASSES,
    RUN_LEASE_STATUSES,
    RUN_OPERATOR_STATES,
    RUN_OUTBOX_EVENT_TYPES,
    RUN_OUTBOX_PUBLISH_STATES,
    RUN_RESUME_DISPOSITIONS,
    RUN_SECRET_BINDING_STATUSES,
    RUN_STATES,
    SECRET_PURPOSES,
    SECRET_REFERENCE_ROTATION_STATUSES,
    SECRET_REFERENCE_VERIFICATION_STATUSES,
)
from app.storage.harness_repository import Base

REQUEST_IDEMPOTENCY_RECORD_STATES = ("in_progress", "completed")


def _enum_check(name: str, column: str, values: tuple[str, ...], *, nullable: bool = False) -> CheckConstraint:
    joined = ", ".join(f"'{value}'" for value in values)
    predicate = f"{column} IN ({joined})"
    if nullable:
        predicate = f"{column} IS NULL OR {predicate}"
    return CheckConstraint(predicate, name=name)


def _now() -> datetime:
    return datetime.now(tz=UTC)


class SecretReferenceORM(Base):
    __tablename__ = "secret_references"
    __table_args__ = (
        CheckConstraint("version >= 1", name="secret_references_version_positive_ck"),
        _enum_check(
            "secret_references_rotation_status_ck",
            "rotation_status",
            SECRET_REFERENCE_ROTATION_STATUSES,
        ),
        _enum_check(
            "secret_references_verification_status_ck",
            "verification_status",
            SECRET_REFERENCE_VERIFICATION_STATUSES,
        ),
        Index("secret_references_company_id_id_uq", "company_id", "id", unique=True),
        Index(
            "secret_references_company_locator_version_uq",
            "company_id",
            "provider_key",
            "secret_kind",
            "reference_locator",
            "version",
            unique=True,
        ),
        Index(
            "secret_references_company_workspace_provider_kind_idx",
            "company_id",
            "workspace_id",
            "provider_key",
            "secret_kind",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    workspace_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    company_secret_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    provider_key: Mapped[str] = mapped_column(String(191), nullable=False)
    secret_kind: Mapped[str] = mapped_column(String(64), nullable=False)
    reference_locator: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    rotation_status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    verification_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    redaction_profile: Mapped[str] = mapped_column(String(64), nullable=False)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class ExecutionWorkerORM(Base):
    __tablename__ = "execution_workers"
    __table_args__ = (
        CheckConstraint("active_attempts >= 0", name="execution_workers_active_attempts_nonnegative_ck"),
        _enum_check("execution_workers_execution_lane_ck", "execution_lane", RUN_EXECUTION_LANES),
        _enum_check("execution_workers_worker_state_ck", "worker_state", EXECUTION_WORKER_STATES),
        Index("execution_workers_company_worker_key_uq", "company_id", "worker_key", unique=True),
        Index("execution_workers_company_state_heartbeat_idx", "company_id", "worker_state", "heartbeat_expires_at"),
        Index("execution_workers_company_current_attempt_idx", "company_id", "current_attempt_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    instance_id: Mapped[str] = mapped_column(String(64), nullable=False)
    worker_key: Mapped[str] = mapped_column(String(191), nullable=False)
    execution_lane: Mapped[str] = mapped_column(String(64), default="background_agentic", nullable=False)
    worker_state: Mapped[str] = mapped_column(String(32), default="starting", nullable=False)
    active_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    current_attempt_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lease_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
    process_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    stopped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    heartbeat_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class RunORM(Base):
    __tablename__ = "runs"
    __table_args__ = (
        CheckConstraint("active_attempt_no >= 1", name="runs_active_attempt_no_positive_ck"),
        CheckConstraint("version >= 0", name="runs_version_nonnegative_ck"),
        _enum_check("runs_state_ck", "state", RUN_STATES),
        _enum_check("runs_execution_lane_ck", "execution_lane", RUN_EXECUTION_LANES),
        _enum_check("runs_operator_state_ck", "operator_state", RUN_OPERATOR_STATES),
        _enum_check("runs_failure_class_ck", "failure_class", RUN_FAILURE_CLASSES, nullable=True),
        Index("runs_company_id_id_uq", "company_id", "id", unique=True),
        Index("runs_company_state_next_wakeup_idx", "company_id", "state", "next_wakeup_at"),
        Index("runs_company_lane_operator_idx", "company_id", "execution_lane", "operator_state"),
        Index("runs_company_issue_created_idx", "company_id", "issue_id", "created_at"),
        Index("runs_company_current_approval_idx", "company_id", "current_approval_link_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    workspace_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    issue_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    run_kind: Mapped[str] = mapped_column(String(64), nullable=False)
    state: Mapped[str] = mapped_column(String(32), default="queued", nullable=False)
    execution_lane: Mapped[str] = mapped_column(String(64), default="background_agentic", nullable=False)
    operator_state: Mapped[str] = mapped_column(String(32), default="admitted", nullable=False)
    status_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    active_attempt_no: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    current_attempt_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    current_approval_link_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    latest_command_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    current_step_key: Mapped[str | None] = mapped_column(String(191), nullable=True)
    result_summary: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=True,
    )
    failure_class: Mapped[str | None] = mapped_column(String(32), nullable=True)
    next_wakeup_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    terminal_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class RequestIdempotencyRecordORM(Base):
    __tablename__ = "request_idempotency_records"
    __table_args__ = (
        _enum_check(
            "request_idempotency_records_state_ck",
            "record_state",
            REQUEST_IDEMPOTENCY_RECORD_STATES,
        ),
        CheckConstraint(
            "response_status_code IS NULL OR (response_status_code >= 100 AND response_status_code <= 599)",
            name="request_idempotency_records_status_code_ck",
        ),
        Index(
            "request_idempotency_records_scope_subject_key_uq",
            "scope_key",
            "subject_key",
            "idempotency_key",
            unique=True,
        ),
        Index(
            "request_idempotency_records_expires_idx",
            "expires_at",
            postgresql_where="expires_at IS NOT NULL",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    scope_key: Mapped[str] = mapped_column(String(191), nullable=False)
    subject_key: Mapped[str] = mapped_column(String(191), nullable=False)
    request_path: Mapped[str] = mapped_column(Text, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(191), nullable=False)
    request_fingerprint_hash: Mapped[str] = mapped_column(String(191), nullable=False)
    record_state: Mapped[str] = mapped_column(String(32), default="in_progress", nullable=False)
    request_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=True,
    )
    response_status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_headers: Mapped[dict[str, str] | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=True,
    )
    response_body: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=True,
    )
    resource_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class RunCommandORM(Base):
    __tablename__ = "run_commands"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "run_id"],
            ["runs.company_id", "runs.id"],
            name="run_commands_company_run_fk",
        ),
        _enum_check("run_commands_command_type_ck", "command_type", RUN_COMMAND_TYPES),
        _enum_check("run_commands_actor_type_ck", "actor_type", RUN_COMMAND_ACTOR_TYPES),
        _enum_check("run_commands_command_status_ck", "command_status", RUN_COMMAND_STATUSES),
        Index(
            "run_commands_company_idempotency_uq",
            "company_id",
            "actor_type",
            "actor_id",
            "command_type",
            "idempotency_key",
            unique=True,
        ),
        Index("run_commands_company_run_issued_idx", "company_id", "run_id", "issued_at"),
        Index(
            "run_commands_company_expires_idx",
            "company_id",
            "expires_at",
            postgresql_where="expires_at IS NOT NULL",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    command_type: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_type: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(64), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(191), nullable=False)
    request_fingerprint_hash: Mapped[str] = mapped_column(String(191), nullable=False)
    command_status: Mapped[str] = mapped_column(String(32), default="accepted", nullable=False)
    accepted_transition: Mapped[str | None] = mapped_column(String(64), nullable=True)
    response_snapshot: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=True,
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class RunAttemptORM(Base):
    __tablename__ = "run_attempts"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "run_id"],
            ["runs.company_id", "runs.id"],
            name="run_attempts_company_run_fk",
            ondelete="CASCADE",
        ),
        CheckConstraint("attempt_no >= 1", name="run_attempts_attempt_no_positive_ck"),
        CheckConstraint("retry_count >= 0", name="run_attempts_retry_count_nonnegative_ck"),
        CheckConstraint("version >= 0", name="run_attempts_version_nonnegative_ck"),
        _enum_check("run_attempts_attempt_state_ck", "attempt_state", RUN_ATTEMPT_STATES),
        _enum_check("run_attempts_operator_state_ck", "operator_state", RUN_OPERATOR_STATES),
        _enum_check("run_attempts_lease_status_ck", "lease_status", RUN_LEASE_STATUSES),
        Index("run_attempts_company_id_id_uq", "company_id", "id", unique=True),
        Index("run_attempts_company_run_attempt_no_uq", "company_id", "run_id", "attempt_no", unique=True),
        Index("run_attempts_company_operator_state_idx", "company_id", "operator_state", "scheduled_at"),
        Index(
            "run_attempts_company_scheduled_idx",
            "company_id",
            "scheduled_at",
            postgresql_where="attempt_state in ('queued', 'retry_backoff')",
        ),
        Index(
            "run_attempts_company_lease_expiry_idx",
            "company_id",
            "lease_expires_at",
            postgresql_where="attempt_state in ('dispatching', 'executing', 'cancel_requested', 'compensating')",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    run_id: Mapped[str] = mapped_column(String(64), nullable=False)
    attempt_no: Mapped[int] = mapped_column(Integer, nullable=False)
    attempt_state: Mapped[str] = mapped_column(String(32), default="queued", nullable=False)
    operator_state: Mapped[str] = mapped_column(String(32), default="admitted", nullable=False)
    worker_key: Mapped[str | None] = mapped_column(String(191), nullable=True)
    lease_status: Mapped[str] = mapped_column(String(32), default="not_leased", nullable=False)
    lease_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lease_acquired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    backoff_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    execution_deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class RunApprovalLinkORM(Base):
    __tablename__ = "run_approval_links"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "run_id"],
            ["runs.company_id", "runs.id"],
            name="run_approval_links_company_run_fk",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["company_id", "attempt_id"],
            ["run_attempts.company_id", "run_attempts.id"],
            name="run_approval_links_company_attempt_fk",
            ondelete="CASCADE",
        ),
        CheckConstraint("version >= 0", name="run_approval_links_version_nonnegative_ck"),
        _enum_check("run_approval_links_gate_status_ck", "gate_status", RUN_APPROVAL_GATE_STATUSES),
        _enum_check(
            "run_approval_links_resume_disposition_ck",
            "resume_disposition",
            RUN_RESUME_DISPOSITIONS,
        ),
        _enum_check(
            "run_approval_links_decision_actor_type_ck",
            "decision_actor_type",
            RUN_COMMAND_ACTOR_TYPES,
            nullable=True,
        ),
        Index("run_approval_links_company_approval_uq", "company_id", "approval_id", unique=True),
        Index("run_approval_links_company_run_opened_idx", "company_id", "run_id", "opened_at"),
        Index(
            "run_approval_links_company_gate_status_opened_idx",
            "company_id",
            "gate_status",
            "opened_at",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    run_id: Mapped[str] = mapped_column(String(64), nullable=False)
    attempt_id: Mapped[str] = mapped_column(String(64), nullable=False)
    approval_id: Mapped[str] = mapped_column(String(64), nullable=False)
    gate_key: Mapped[str] = mapped_column(String(191), nullable=False)
    gate_status: Mapped[str] = mapped_column(String(32), default="open", nullable=False)
    resume_disposition: Mapped[str] = mapped_column(String(32), default="resume", nullable=False)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resume_enqueued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_actor_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    decision_actor_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class RunOutboxORM(Base):
    __tablename__ = "run_outbox"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "run_id"],
            ["runs.company_id", "runs.id"],
            name="run_outbox_company_run_fk",
        ),
        ForeignKeyConstraint(
            ["company_id", "attempt_id"],
            ["run_attempts.company_id", "run_attempts.id"],
            name="run_outbox_company_attempt_fk",
        ),
        CheckConstraint("publish_attempts >= 0", name="run_outbox_publish_attempts_nonnegative_ck"),
        _enum_check("run_outbox_event_type_ck", "event_type", RUN_OUTBOX_EVENT_TYPES),
        _enum_check("run_outbox_publish_state_ck", "publish_state", RUN_OUTBOX_PUBLISH_STATES),
        Index("run_outbox_company_dedupe_uq", "company_id", "dedupe_key", unique=True),
        Index(
            "run_outbox_company_available_idx",
            "company_id",
            "available_at",
            postgresql_where="publish_state = 'pending'",
        ),
        Index(
            "run_outbox_company_lease_expiry_idx",
            "company_id",
            "lease_expires_at",
            postgresql_where="publish_state = 'leased'",
        ),
        Index("run_outbox_company_run_created_idx", "company_id", "run_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    attempt_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
    )
    publish_state: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    dedupe_key: Mapped[str] = mapped_column(String(191), nullable=False)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    lease_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    publish_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dead_lettered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_publish_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class RunExternalCallORM(Base):
    __tablename__ = "run_external_calls"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "run_id"],
            ["runs.company_id", "runs.id"],
            name="run_external_calls_company_run_fk",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["company_id", "attempt_id"],
            ["run_attempts.company_id", "run_attempts.id"],
            name="run_external_calls_company_attempt_fk",
            ondelete="CASCADE",
        ),
        _enum_check("run_external_calls_call_status_ck", "call_status", RUN_EXTERNAL_CALL_STATUSES),
        Index("run_external_calls_company_run_started_idx", "company_id", "run_id", "started_at"),
        Index(
            "run_external_calls_company_provider_request_idx",
            "company_id",
            "provider_key",
            "provider_request_id",
        ),
        Index("run_external_calls_company_correlation_idx", "company_id", "correlation_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    run_id: Mapped[str] = mapped_column(String(64), nullable=False)
    attempt_id: Mapped[str] = mapped_column(String(64), nullable=False)
    step_key: Mapped[str] = mapped_column(String(191), nullable=False)
    provider_key: Mapped[str] = mapped_column(String(191), nullable=False)
    operation_key: Mapped[str] = mapped_column(String(191), nullable=False)
    provider_request_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    correlation_id: Mapped[str] = mapped_column(String(191), nullable=False)
    call_status: Mapped[str] = mapped_column(String(32), default="started", nullable=False)
    idempotency_token: Mapped[str | None] = mapped_column(String(191), nullable=True)
    request_summary: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=True,
    )
    response_summary: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=True,
    )
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_class: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class RunSecretBindingORM(Base):
    __tablename__ = "run_secret_bindings"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "run_id"],
            ["runs.company_id", "runs.id"],
            name="run_secret_bindings_company_run_fk",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["company_id", "attempt_id"],
            ["run_attempts.company_id", "run_attempts.id"],
            name="run_secret_bindings_company_attempt_fk",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["company_id", "secret_reference_id"],
            ["secret_references.company_id", "secret_references.id"],
            name="run_secret_bindings_company_secret_reference_fk",
            ondelete="CASCADE",
        ),
        CheckConstraint("required_version >= 1", name="run_secret_bindings_required_version_positive_ck"),
        _enum_check(
            "run_secret_bindings_binding_status_ck",
            "binding_status",
            RUN_SECRET_BINDING_STATUSES,
        ),
        _enum_check("run_secret_bindings_purpose_ck", "purpose", SECRET_PURPOSES),
        Index(
            "run_secret_bindings_company_attempt_step_secret_uq",
            "company_id",
            "attempt_id",
            "step_key",
            "secret_reference_id",
            unique=True,
        ),
        Index("run_secret_bindings_company_run_created_idx", "company_id", "run_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    run_id: Mapped[str] = mapped_column(String(64), nullable=False)
    attempt_id: Mapped[str] = mapped_column(String(64), nullable=False)
    step_key: Mapped[str] = mapped_column(String(191), nullable=False)
    secret_reference_id: Mapped[str] = mapped_column(String(64), nullable=False)
    required_version: Mapped[int] = mapped_column(Integer, nullable=False)
    purpose: Mapped[str] = mapped_column(String(64), nullable=False)
    binding_status: Mapped[str] = mapped_column(String(32), default="declared", nullable=False)
    materialized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
