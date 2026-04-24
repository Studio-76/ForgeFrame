"""Knowledge-source, contact, and memory contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


CONTACT_STATUSES = ("active", "snoozed", "archived")
ContactStatus = Literal["active", "snoozed", "archived"]

KNOWLEDGE_SOURCE_KINDS = ("mail", "calendar", "contacts", "drive", "knowledge_base")
KnowledgeSourceKind = Literal["mail", "calendar", "contacts", "drive", "knowledge_base"]

KNOWLEDGE_SOURCE_STATUSES = ("active", "paused", "error")
KnowledgeSourceStatus = Literal["active", "paused", "error"]

VISIBILITY_SCOPES = ("instance", "team", "personal", "restricted")
VisibilityScope = Literal["instance", "team", "personal", "restricted"]

MEMORY_KINDS = ("fact", "preference", "constraint", "summary")
MemoryKind = Literal["fact", "preference", "constraint", "summary"]

MEMORY_STATUSES = ("active", "corrected", "deleted")
MemoryStatus = Literal["active", "corrected", "deleted"]

MEMORY_SENSITIVITIES = ("normal", "sensitive", "restricted")
MemorySensitivity = Literal["normal", "sensitive", "restricted"]

MEMORY_TRUTH_STATES = ("active", "corrected", "revoked", "superseded", "expired", "deleted")
MemoryTruthState = Literal["active", "corrected", "revoked", "superseded", "expired", "deleted"]

MEMORY_SOURCE_TRUST_CLASSES = ("human_verified", "operator_verified", "runtime_inferred", "external_unverified")
MemorySourceTrustClass = Literal["human_verified", "operator_verified", "runtime_inferred", "external_unverified"]


class RecordLink(BaseModel):
    record_id: str
    label: str
    status: str | None = None


class ContactSummary(BaseModel):
    contact_id: str
    instance_id: str
    company_id: str
    contact_ref: str
    source_id: str | None = None
    display_name: str
    primary_email: str | None = None
    primary_phone: str | None = None
    organization: str | None = None
    title: str | None = None
    status: ContactStatus
    visibility_scope: VisibilityScope
    metadata: dict[str, Any] = Field(default_factory=dict)
    conversation_count: int = 0
    memory_count: int = 0
    created_at: datetime
    updated_at: datetime


class KnowledgeSourceSummary(BaseModel):
    source_id: str
    instance_id: str
    company_id: str
    source_kind: KnowledgeSourceKind
    label: str
    description: str = ""
    connection_target: str
    status: KnowledgeSourceStatus
    visibility_scope: VisibilityScope
    last_synced_at: datetime | None = None
    last_error: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    contact_count: int = 0
    memory_count: int = 0
    created_at: datetime
    updated_at: datetime


class MemorySummary(BaseModel):
    memory_id: str
    instance_id: str
    company_id: str
    source_id: str | None = None
    contact_id: str | None = None
    conversation_id: str | None = None
    task_id: str | None = None
    notification_id: str | None = None
    workspace_id: str | None = None
    memory_kind: MemoryKind
    title: str
    body: str
    status: MemoryStatus
    truth_state: MemoryTruthState = "active"
    source_trust_class: MemorySourceTrustClass = "operator_verified"
    visibility_scope: VisibilityScope
    sensitivity: MemorySensitivity
    correction_note: str | None = None
    supersedes_memory_id: str | None = None
    learned_from_event_id: str | None = None
    human_override: bool = False
    expires_at: datetime | None = None
    deleted_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ContactDetail(ContactSummary):
    source: KnowledgeSourceSummary | None = None
    recent_conversations: list[RecordLink] = Field(default_factory=list)
    recent_memory: list[MemorySummary] = Field(default_factory=list)


class KnowledgeSourceDetail(KnowledgeSourceSummary):
    contacts: list[ContactSummary] = Field(default_factory=list)
    memory_entries: list[MemorySummary] = Field(default_factory=list)


class MemoryDetail(MemorySummary):
    source: KnowledgeSourceSummary | None = None
    contact: ContactSummary | None = None
    conversation: RecordLink | None = None
    task: RecordLink | None = None
    notification: RecordLink | None = None
    workspace: RecordLink | None = None


class CreateContact(BaseModel):
    contact_id: str | None = Field(default=None, min_length=1, max_length=64)
    contact_ref: str | None = Field(default=None, min_length=1, max_length=191)
    source_id: str | None = Field(default=None, max_length=64)
    display_name: str = Field(min_length=1, max_length=191)
    primary_email: str | None = Field(default=None, max_length=191)
    primary_phone: str | None = Field(default=None, max_length=64)
    organization: str | None = Field(default=None, max_length=191)
    title: str | None = Field(default=None, max_length=191)
    status: ContactStatus = "active"
    visibility_scope: VisibilityScope = "team"
    metadata: dict[str, Any] = Field(default_factory=dict)


class UpdateContact(BaseModel):
    contact_ref: str | None = Field(default=None, min_length=1, max_length=191)
    source_id: str | None = Field(default=None, max_length=64)
    display_name: str | None = Field(default=None, min_length=1, max_length=191)
    primary_email: str | None = Field(default=None, max_length=191)
    primary_phone: str | None = Field(default=None, max_length=64)
    organization: str | None = Field(default=None, max_length=191)
    title: str | None = Field(default=None, max_length=191)
    status: ContactStatus | None = None
    visibility_scope: VisibilityScope | None = None
    metadata: dict[str, Any] | None = None


class CreateKnowledgeSource(BaseModel):
    source_id: str | None = Field(default=None, min_length=1, max_length=64)
    source_kind: KnowledgeSourceKind
    label: str = Field(min_length=1, max_length=191)
    description: str = Field(default="", max_length=4000)
    connection_target: str = Field(min_length=1, max_length=400)
    status: KnowledgeSourceStatus = "active"
    visibility_scope: VisibilityScope = "team"
    last_synced_at: datetime | None = None
    last_error: str | None = Field(default=None, max_length=4000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class UpdateKnowledgeSource(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=191)
    description: str | None = Field(default=None, max_length=4000)
    connection_target: str | None = Field(default=None, min_length=1, max_length=400)
    status: KnowledgeSourceStatus | None = None
    visibility_scope: VisibilityScope | None = None
    last_synced_at: datetime | None = None
    last_error: str | None = Field(default=None, max_length=4000)
    metadata: dict[str, Any] | None = None


class CreateMemory(BaseModel):
    memory_id: str | None = Field(default=None, min_length=1, max_length=64)
    source_id: str | None = Field(default=None, max_length=64)
    contact_id: str | None = Field(default=None, max_length=64)
    conversation_id: str | None = Field(default=None, max_length=64)
    task_id: str | None = Field(default=None, max_length=64)
    notification_id: str | None = Field(default=None, max_length=64)
    workspace_id: str | None = Field(default=None, max_length=64)
    memory_kind: MemoryKind
    title: str = Field(min_length=1, max_length=191)
    body: str = Field(min_length=1, max_length=4000)
    visibility_scope: VisibilityScope = "team"
    sensitivity: MemorySensitivity = "normal"
    source_trust_class: MemorySourceTrustClass = "operator_verified"
    correction_note: str | None = Field(default=None, max_length=4000)
    learned_from_event_id: str | None = Field(default=None, max_length=64)
    human_override: bool = False
    expires_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class UpdateMemory(BaseModel):
    source_id: str | None = Field(default=None, max_length=64)
    contact_id: str | None = Field(default=None, max_length=64)
    conversation_id: str | None = Field(default=None, max_length=64)
    task_id: str | None = Field(default=None, max_length=64)
    notification_id: str | None = Field(default=None, max_length=64)
    workspace_id: str | None = Field(default=None, max_length=64)
    memory_kind: MemoryKind | None = None
    title: str | None = Field(default=None, min_length=1, max_length=191)
    body: str | None = Field(default=None, min_length=1, max_length=4000)
    visibility_scope: VisibilityScope | None = None
    sensitivity: MemorySensitivity | None = None
    source_trust_class: MemorySourceTrustClass | None = None
    correction_note: str | None = Field(default=None, max_length=4000)
    learned_from_event_id: str | None = Field(default=None, max_length=64)
    human_override: bool | None = None
    expires_at: datetime | None = None
    metadata: dict[str, Any] | None = None


class CorrectMemory(BaseModel):
    title: str = Field(min_length=1, max_length=191)
    body: str = Field(min_length=1, max_length=4000)
    correction_note: str = Field(min_length=1, max_length=4000)
    memory_kind: MemoryKind | None = None
    visibility_scope: VisibilityScope | None = None
    sensitivity: MemorySensitivity | None = None
    source_trust_class: MemorySourceTrustClass | None = None
    expires_at: datetime | None = None
    metadata: dict[str, Any] | None = None


class DeleteMemory(BaseModel):
    deletion_note: str | None = Field(default=None, max_length=4000)


class RevokeMemory(BaseModel):
    revocation_note: str = Field(min_length=1, max_length=4000)


class MemoryActionResult(BaseModel):
    memory: MemoryDetail
    action: str
