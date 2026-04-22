"""Admin-facing execution API contracts."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.execution.models import (
    RunAttemptState,
    RunCommandStatus,
    RunCommandType,
    RunFailureClass,
    RunOutboxEventType,
    RunOutboxPublishState,
    RunState,
)


class RunReplayRequest(BaseModel):
    reason: str = Field(min_length=8, max_length=500)
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=191)


class ExecutionRunAttemptView(BaseModel):
    id: str
    attempt_no: int
    attempt_state: RunAttemptState
    retry_count: int
    scheduled_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    backoff_until: datetime | None = None
    last_error_code: str | None = None
    last_error_detail: str | None = None
    version: int


class ExecutionRunCommandView(BaseModel):
    id: str
    command_type: RunCommandType
    command_status: RunCommandStatus
    actor_type: str
    actor_id: str
    idempotency_key: str
    accepted_transition: str | None = None
    response_snapshot: dict[str, object] | None = None
    issued_at: datetime
    completed_at: datetime | None = None


class ExecutionRunOutboxView(BaseModel):
    id: str
    event_type: RunOutboxEventType
    publish_state: RunOutboxPublishState
    available_at: datetime
    publish_attempts: int
    published_at: datetime | None = None
    dead_lettered_at: datetime | None = None
    last_publish_error: str | None = None
    payload: dict[str, object]


class ExecutionRunSummary(BaseModel):
    run_id: str
    run_kind: str
    state: RunState
    issue_id: str | None = None
    active_attempt_no: int
    failure_class: RunFailureClass | None = None
    status_reason: str | None = None
    current_attempt: ExecutionRunAttemptView | None = None
    next_wakeup_at: datetime | None = None
    terminal_at: datetime | None = None
    result_summary: dict[str, object] | None = None
    replayable: bool
    created_at: datetime
    updated_at: datetime


class ExecutionRunDetail(ExecutionRunSummary):
    attempts: list[ExecutionRunAttemptView] = Field(default_factory=list)
    commands: list[ExecutionRunCommandView] = Field(default_factory=list)
    outbox: list[ExecutionRunOutboxView] = Field(default_factory=list)


class ExecutionReplayAuditReference(BaseModel):
    event_id: str
    action: str
    target_type: str
    target_id: str | None = None
    status: str
    tenant_id: str
    company_id: str | None = None


class ExecutionReplayResult(BaseModel):
    command_id: str
    run_id: str
    attempt_id: str | None = None
    run_state: str
    outbox_event: str | None = None
    deduplicated: bool = False
    replay_reason: str
    audit: ExecutionReplayAuditReference | None = None
