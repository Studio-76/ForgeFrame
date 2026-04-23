"""Shared approval lifecycle contracts for control-plane approval surfaces."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.artifacts.models import ArtifactRecord


APPROVAL_STATUSES = ("open", "approved", "rejected", "timed_out", "cancelled")
ApprovalStatus = Literal["open", "approved", "rejected", "timed_out", "cancelled"]

APPROVAL_SOURCE_KINDS = ("execution_run", "elevated_access")
ApprovalSourceKind = Literal["execution_run", "elevated_access"]

APPROVAL_TYPES = ("execution_run", "break_glass", "impersonation")
ApprovalType = Literal["execution_run", "break_glass", "impersonation"]

APPROVAL_SESSION_STATUSES = ("not_issued", "active", "expired", "revoked")
ApprovalSessionStatus = Literal["not_issued", "active", "expired", "revoked"]

_EXECUTION_APPROVAL_PREFIX = "run"
_ELEVATED_ACCESS_APPROVAL_PREFIX = "elevated"


def build_execution_approval_id(*, company_id: str, approval_id: str, instance_id: str | None = None) -> str:
    normalized_instance_id = (instance_id or "").strip()
    if normalized_instance_id:
        return f"{_EXECUTION_APPROVAL_PREFIX}:{normalized_instance_id}:{company_id}:{approval_id}"
    return f"{_EXECUTION_APPROVAL_PREFIX}:{company_id}:{approval_id}"


def build_elevated_access_approval_id(request_id: str) -> str:
    return f"{_ELEVATED_ACCESS_APPROVAL_PREFIX}:{request_id}"


def parse_shared_approval_id(value: str) -> tuple[ApprovalSourceKind, dict[str, str]]:
    normalized = value.strip()
    if normalized.startswith(f"{_ELEVATED_ACCESS_APPROVAL_PREFIX}:"):
        request_id = normalized.split(":", 1)[1].strip()
        if request_id:
            return "elevated_access", {"request_id": request_id}
        raise ValueError("shared_approval_id_invalid")
    if normalized.startswith(f"{_EXECUTION_APPROVAL_PREFIX}:"):
        parts = normalized.split(":")
        if len(parts) == 4 and parts[1].strip() and parts[2].strip() and parts[3].strip():
            return "execution_run", {
                "instance_id": parts[1].strip(),
                "company_id": parts[2].strip(),
                "approval_id": parts[3].strip(),
            }
        if len(parts) == 3 and parts[1].strip() and parts[2].strip():
            return "execution_run", {"company_id": parts[1].strip(), "approval_id": parts[2].strip()}
        raise ValueError("shared_approval_id_invalid")
    raise ValueError("shared_approval_id_invalid")


class ApprovalActorSummary(BaseModel):
    user_id: str | None = None
    username: str | None = None
    display_name: str | None = None
    role: str | None = None


class ApprovalSummary(BaseModel):
    approval_id: str
    source_kind: ApprovalSourceKind
    native_approval_id: str
    approval_type: ApprovalType
    status: ApprovalStatus
    title: str
    opened_at: datetime
    decided_at: datetime | None = None
    expires_at: datetime | None = None
    instance_id: str | None = None
    company_id: str | None = None
    issue_id: str | None = None
    workspace_id: str | None = None
    requester: ApprovalActorSummary | None = None
    target: ApprovalActorSummary | None = None
    decision_actor: ApprovalActorSummary | None = None
    ready_to_issue: bool = False
    session_status: ApprovalSessionStatus | None = None


class ApprovalDetail(ApprovalSummary):
    evidence: dict[str, Any] = Field(default_factory=dict)
    source: dict[str, Any] = Field(default_factory=dict)
    artifacts: list[ArtifactRecord] = Field(default_factory=list)
    workspace: dict[str, Any] = Field(default_factory=dict)
    actions: dict[str, Any] = Field(default_factory=dict)
