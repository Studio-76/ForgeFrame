"""Admin-facing execution API contracts."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.artifacts.models import ArtifactRecord
from app.execution.models import (
    RunExecutionLane,
    RunAttemptState,
    RunCommandStatus,
    RunCommandType,
    RunFailureClass,
    RunLeaseStatus,
    RunOperatorState,
    RunOutboxEventType,
    RunOutboxPublishState,
    RunState,
)
from app.product_taxonomy import RuntimeNativeMapping
from app.workspaces.models import WorkspaceSummary


class RunReplayRequest(BaseModel):
    reason: str = Field(min_length=8, max_length=500)
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=191)


class RunOperatorActionRequest(BaseModel):
    reason: str = Field(min_length=4, max_length=500)
    execution_lane: RunExecutionLane | None = None
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=191)


class ExecutionRunAttemptView(BaseModel):
    id: str
    attempt_no: int
    attempt_state: RunAttemptState
    operator_state: RunOperatorState
    lease_status: RunLeaseStatus
    worker_key: str | None = None
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
    instance_id: str
    run_id: str
    workspace_id: str | None = None
    run_kind: str
    state: RunState
    operator_state: RunOperatorState
    execution_lane: RunExecutionLane
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
    workspace: WorkspaceSummary | None = None
    artifacts: list[ArtifactRecord] = Field(default_factory=list)
    native_mapping: RuntimeNativeMapping | None = None


class ExecutionReplayAuditReference(BaseModel):
    event_id: str
    action: str
    target_type: str
    target_id: str | None = None
    status: str
    instance_id: str
    tenant_id: str
    company_id: str | None = None


class ExecutionReplayResult(BaseModel):
    command_id: str
    run_id: str
    attempt_id: str | None = None
    run_state: str
    operator_state: str | None = None
    execution_lane: str | None = None
    outbox_event: str | None = None
    deduplicated: bool = False
    replay_reason: str
    audit: ExecutionReplayAuditReference | None = None


class ExecutionOperatorActionResult(BaseModel):
    command_id: str
    run_id: str
    attempt_id: str | None = None
    related_run_id: str | None = None
    run_state: str
    operator_state: str | None = None
    execution_lane: str | None = None
    outbox_event: str | None = None
    reason: str


class ExecutionQueueLaneSummary(BaseModel):
    execution_lane: RunExecutionLane
    display_name: str
    total_runs: int
    runnable_runs: int
    paused_runs: int
    waiting_on_approval_runs: int
    retry_scheduled_runs: int
    quarantined_runs: int
    oldest_scheduled_at: datetime | None = None
    longest_wait_seconds: int | None = None


class ExecutionQueueRunView(BaseModel):
    run_id: str
    workspace_id: str | None = None
    run_kind: str
    state: RunState
    operator_state: RunOperatorState
    execution_lane: RunExecutionLane
    issue_id: str | None = None
    attempt_id: str | None = None
    attempt_state: RunAttemptState | None = None
    lease_status: RunLeaseStatus | None = None
    scheduled_at: datetime | None = None
    next_wakeup_at: datetime | None = None
    status_reason: str | None = None
    updated_at: datetime


class ExecutionDispatchWorkerView(BaseModel):
    worker_key: str
    worker_state: str
    instance_id: str
    execution_lane: str
    active_attempts: int
    leased_runs: list[str] = Field(default_factory=list)
    current_run_id: str | None = None
    current_attempt_id: str | None = None
    oldest_lease_expires_at: datetime | None = None
    heartbeat_expires_at: datetime | None = None
    last_heartbeat_at: datetime | None = None
    last_claimed_at: datetime | None = None
    last_completed_at: datetime | None = None
    last_error_code: str | None = None
    last_error_detail: str | None = None


class ExecutionDispatchAttemptView(BaseModel):
    run_id: str
    attempt_id: str
    run_kind: str
    state: RunState
    operator_state: RunOperatorState
    execution_lane: RunExecutionLane
    worker_key: str | None = None
    lease_status: RunLeaseStatus
    lease_expires_at: datetime | None = None
    last_heartbeat_at: datetime | None = None
    next_wakeup_at: datetime | None = None
    status_reason: str | None = None
    updated_at: datetime


class ExecutionDispatchSnapshot(BaseModel):
    outbox_counts: dict[str, int]
    event_counts: dict[str, int]
    leased_attempts: list[ExecutionDispatchAttemptView] = Field(default_factory=list)
    stalled_attempts: list[ExecutionDispatchAttemptView] = Field(default_factory=list)
    workers: list[ExecutionDispatchWorkerView] = Field(default_factory=list)
    quarantined_runs: int = 0
    paused_runs: int = 0
    waiting_on_approval_runs: int = 0


class ExecutionLeaseReconcileResult(BaseModel):
    run_id: str
    attempt_id: str
    reconciled_to_state: str
    dead_letter_reason: str
