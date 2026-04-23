"""Artifact-domain contracts for workspace, run, approval, and operator evidence."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


ARTIFACT_TYPES = (
    "file",
    "download",
    "preview_link",
    "log",
    "pr_link",
    "json",
    "csv",
    "pdf",
    "handoff_note",
    "external_action_preview",
)
ArtifactType = Literal[
    "file",
    "download",
    "preview_link",
    "log",
    "pr_link",
    "json",
    "csv",
    "pdf",
    "handoff_note",
    "external_action_preview",
]

ARTIFACT_STATUSES = ("active", "superseded", "archived")
ArtifactStatus = Literal["active", "superseded", "archived"]

ARTIFACT_ATTACHMENT_TARGET_KINDS = ("workspace", "run", "approval", "instance", "decision")
ArtifactAttachmentTargetKind = Literal["workspace", "run", "approval", "instance", "decision"]

ARTIFACT_WORKSPACE_ROLES = ("artifact", "preview", "handoff")
ArtifactWorkspaceRole = Literal["artifact", "preview", "handoff"]


class ArtifactAttachmentRecord(BaseModel):
    attachment_id: str
    artifact_id: str
    target_kind: ArtifactAttachmentTargetKind
    target_id: str
    role: str
    created_at: datetime


class ArtifactRecord(BaseModel):
    artifact_id: str
    instance_id: str
    company_id: str
    workspace_id: str | None = None
    artifact_type: ArtifactType
    label: str
    uri: str
    media_type: str | None = None
    preview_url: str | None = None
    size_bytes: int | None = None
    status: ArtifactStatus = "active"
    created_by_type: str = "system"
    created_by_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    attachments: list[ArtifactAttachmentRecord] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class CreateArtifactAttachment(BaseModel):
    target_kind: ArtifactAttachmentTargetKind
    target_id: str = Field(min_length=1, max_length=191)
    role: str = Field(default="related", min_length=1, max_length=64)


class CreateArtifact(BaseModel):
    workspace_id: str | None = Field(default=None, min_length=1, max_length=64)
    workspace_role: ArtifactWorkspaceRole | None = None
    artifact_type: ArtifactType
    label: str = Field(min_length=1, max_length=191)
    uri: str = Field(min_length=1, max_length=2000)
    media_type: str | None = Field(default=None, max_length=191)
    preview_url: str | None = Field(default=None, max_length=2000)
    size_bytes: int | None = Field(default=None, ge=0)
    status: ArtifactStatus = "active"
    attachments: list[CreateArtifactAttachment] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class UpdateArtifact(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=191)
    uri: str | None = Field(default=None, min_length=1, max_length=2000)
    media_type: str | None = Field(default=None, max_length=191)
    preview_url: str | None = Field(default=None, max_length=2000)
    size_bytes: int | None = Field(default=None, ge=0)
    status: ArtifactStatus | None = None
    metadata: dict[str, Any] | None = None
