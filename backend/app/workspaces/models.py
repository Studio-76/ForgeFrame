"""Workspace and handoff-domain contracts for ForgeFrame work interaction."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.artifacts.models import ArtifactRecord


WORKSPACE_STATUSES = ("draft", "previewing", "in_review", "handoff_ready", "handed_off", "archived")
WorkspaceStatus = Literal["draft", "previewing", "in_review", "handoff_ready", "handed_off", "archived"]

WORKSPACE_PREVIEW_STATUSES = ("missing", "draft", "ready", "approved", "rejected")
WorkspacePreviewStatus = Literal["missing", "draft", "ready", "approved", "rejected"]

WORKSPACE_REVIEW_STATUSES = ("not_requested", "pending", "approved", "rejected")
WorkspaceReviewStatus = Literal["not_requested", "pending", "approved", "rejected"]

WORKSPACE_HANDOFF_STATUSES = ("not_ready", "ready", "delivered")
WorkspaceHandoffStatus = Literal["not_ready", "ready", "delivered"]

WORKSPACE_EVENT_KINDS = (
    "created",
    "updated",
    "preview_ready",
    "review_requested",
    "review_approved",
    "review_rejected",
    "handoff_prepared",
    "handoff_delivered",
)
WorkspaceEventKind = Literal[
    "created",
    "updated",
    "preview_ready",
    "review_requested",
    "review_approved",
    "review_rejected",
    "handoff_prepared",
    "handoff_delivered",
]


class WorkspaceRunSummary(BaseModel):
    run_id: str
    run_kind: str
    state: str
    execution_lane: str
    issue_id: str | None = None
    updated_at: datetime


class WorkspaceApprovalSummary(BaseModel):
    approval_id: str
    shared_approval_id: str
    gate_status: str
    gate_key: str
    opened_at: datetime
    decided_at: datetime | None = None


class WorkspaceEventRecord(BaseModel):
    event_id: str
    workspace_id: str
    event_kind: WorkspaceEventKind
    note: str | None = None
    artifact_id: str | None = None
    approval_id: str | None = None
    run_id: str | None = None
    actor_type: str = "system"
    actor_id: str | None = None
    created_at: datetime


class WorkspaceSummary(BaseModel):
    workspace_id: str
    instance_id: str
    company_id: str
    issue_id: str | None = None
    title: str
    summary: str = ""
    status: WorkspaceStatus = "draft"
    preview_status: WorkspacePreviewStatus = "missing"
    review_status: WorkspaceReviewStatus = "not_requested"
    handoff_status: WorkspaceHandoffStatus = "not_ready"
    owner_type: str = "system"
    owner_id: str | None = None
    active_run_id: str | None = None
    latest_approval_id: str | None = None
    preview_artifact_id: str | None = None
    handoff_artifact_id: str | None = None
    pr_reference: str | None = None
    handoff_reference: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    run_count: int = 0
    approval_count: int = 0
    artifact_count: int = 0
    latest_event_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class WorkspaceDetail(WorkspaceSummary):
    runs: list[WorkspaceRunSummary] = Field(default_factory=list)
    approvals: list[WorkspaceApprovalSummary] = Field(default_factory=list)
    artifacts: list[ArtifactRecord] = Field(default_factory=list)
    events: list[WorkspaceEventRecord] = Field(default_factory=list)


class CreateWorkspace(BaseModel):
    workspace_id: str | None = Field(default=None, min_length=1, max_length=64)
    issue_id: str | None = Field(default=None, max_length=191)
    title: str = Field(min_length=1, max_length=191)
    summary: str = Field(default="", max_length=4000)
    preview_status: WorkspacePreviewStatus = "draft"
    review_status: WorkspaceReviewStatus = "not_requested"
    handoff_status: WorkspaceHandoffStatus = "not_ready"
    owner_type: str = Field(default="user", min_length=1, max_length=32)
    owner_id: str | None = Field(default=None, max_length=64)
    active_run_id: str | None = Field(default=None, max_length=64)
    latest_approval_id: str | None = Field(default=None, max_length=191)
    pr_reference: str | None = Field(default=None, max_length=2000)
    handoff_reference: str | None = Field(default=None, max_length=2000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class UpdateWorkspace(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=191)
    summary: str | None = Field(default=None, max_length=4000)
    issue_id: str | None = Field(default=None, max_length=191)
    preview_status: WorkspacePreviewStatus | None = None
    review_status: WorkspaceReviewStatus | None = None
    handoff_status: WorkspaceHandoffStatus | None = None
    owner_type: str | None = Field(default=None, min_length=1, max_length=32)
    owner_id: str | None = Field(default=None, max_length=64)
    active_run_id: str | None = Field(default=None, max_length=64)
    latest_approval_id: str | None = Field(default=None, max_length=191)
    preview_artifact_id: str | None = Field(default=None, max_length=64)
    handoff_artifact_id: str | None = Field(default=None, max_length=64)
    pr_reference: str | None = Field(default=None, max_length=2000)
    handoff_reference: str | None = Field(default=None, max_length=2000)
    metadata: dict[str, Any] | None = None
    archive: bool = False
    event_note: str | None = Field(default=None, max_length=4000)
