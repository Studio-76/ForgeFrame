"""Conversation, thread, session, message, and inbox contracts for ForgeFrame work interaction."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


CONVERSATION_STATUSES = ("open", "paused", "closed", "archived")
ConversationStatus = Literal["open", "paused", "closed", "archived"]

TRIAGE_STATUSES = ("new", "relevant", "delegated", "blocked", "done")
TriageStatus = Literal["new", "relevant", "delegated", "blocked", "done"]

WORK_ITEM_PRIORITIES = ("low", "normal", "high", "critical")
WorkItemPriority = Literal["low", "normal", "high", "critical"]

THREAD_STATUSES = ("open", "closed", "archived")
ThreadStatus = Literal["open", "closed", "archived"]

SESSION_KINDS = ("runtime", "operator", "assistant", "external")
ConversationSessionKind = Literal["runtime", "operator", "assistant", "external"]

MESSAGE_ROLES = ("user", "assistant", "system", "operator", "tool")
ConversationMessageRole = Literal["user", "assistant", "system", "operator", "tool"]

INBOX_STATUSES = ("open", "snoozed", "closed", "archived")
InboxStatus = Literal["open", "snoozed", "closed", "archived"]

PARTICIPANT_KINDS = ("agent", "user", "contact", "system")
ConversationParticipantKind = Literal["agent", "user", "contact", "system"]

PARTICIPANT_STATUSES = ("active", "mentioned", "roundtable", "handoff_pending", "review_requested", "blocked", "archived")
ConversationParticipantStatus = Literal["active", "mentioned", "roundtable", "handoff_pending", "review_requested", "blocked", "archived"]

MENTION_STATUSES = ("active", "acknowledged", "resolved")
ConversationMentionStatus = Literal["active", "acknowledged", "resolved"]

CONVERSATION_EVENT_TYPES = ("mention_event", "handoff_event", "review_request_event", "blocker_event", "roundtable_event")
ConversationEventType = Literal["mention_event", "handoff_event", "review_request_event", "blocker_event", "roundtable_event"]


class ConversationParticipantRecord(BaseModel):
    participant_id: str
    conversation_id: str
    thread_id: str | None = None
    participant_kind: ConversationParticipantKind
    participant_status: ConversationParticipantStatus
    agent_id: str | None = None
    participant_ref: str | None = None
    display_label: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ConversationMentionRecord(BaseModel):
    mention_id: str
    conversation_id: str
    thread_id: str
    message_id: str
    agent_id: str
    token: str
    agent_display_name: str
    status: ConversationMentionStatus = "active"
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ConversationEventRecord(BaseModel):
    event_id: str
    conversation_id: str
    thread_id: str
    source_message_id: str | None = None
    event_type: ConversationEventType
    source_agent_id: str | None = None
    target_agent_id: str | None = None
    related_object_type: str | None = None
    related_object_id: str | None = None
    summary: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ConversationThreadSummary(BaseModel):
    thread_id: str
    conversation_id: str
    title: str
    status: ThreadStatus = "open"
    latest_message_at: datetime | None = None
    message_count: int = 0
    session_count: int = 0
    created_at: datetime
    updated_at: datetime


class ConversationSessionRecord(BaseModel):
    session_id: str
    conversation_id: str
    thread_id: str
    session_kind: ConversationSessionKind
    continuity_key: str | None = None
    started_by_type: str = "system"
    started_by_id: str | None = None
    message_count: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)
    started_at: datetime
    ended_at: datetime | None = None


class ConversationMessageRecord(BaseModel):
    message_id: str
    conversation_id: str
    thread_id: str
    session_id: str | None = None
    message_role: ConversationMessageRole
    author_type: str = "system"
    author_id: str | None = None
    body: str
    structured_payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class InboxSummary(BaseModel):
    inbox_id: str
    instance_id: str
    company_id: str
    conversation_id: str | None = None
    thread_id: str | None = None
    workspace_id: str | None = None
    title: str
    summary: str = ""
    triage_status: TriageStatus = "new"
    priority: WorkItemPriority = "normal"
    status: InboxStatus = "open"
    contact_ref: str | None = None
    run_id: str | None = None
    artifact_id: str | None = None
    approval_id: str | None = None
    decision_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    latest_message_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ConversationSummary(BaseModel):
    conversation_id: str
    instance_id: str
    company_id: str
    workspace_id: str | None = None
    subject: str
    summary: str = ""
    status: ConversationStatus = "open"
    triage_status: TriageStatus = "new"
    priority: WorkItemPriority = "normal"
    contact_ref: str | None = None
    run_id: str | None = None
    artifact_id: str | None = None
    approval_id: str | None = None
    decision_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    active_thread_id: str | None = None
    thread_count: int = 0
    session_count: int = 0
    message_count: int = 0
    inbox_count: int = 0
    participant_count: int = 0
    mention_count: int = 0
    event_count: int = 0
    participant_agent_ids: list[str] = Field(default_factory=list)
    latest_message_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ConversationDetail(ConversationSummary):
    threads: list[ConversationThreadSummary] = Field(default_factory=list)
    sessions: list[ConversationSessionRecord] = Field(default_factory=list)
    messages: list[ConversationMessageRecord] = Field(default_factory=list)
    inbox_items: list[InboxSummary] = Field(default_factory=list)
    participants: list[ConversationParticipantRecord] = Field(default_factory=list)
    mentions: list[ConversationMentionRecord] = Field(default_factory=list)
    events: list[ConversationEventRecord] = Field(default_factory=list)


class InboxDetail(InboxSummary):
    conversation: ConversationSummary | None = None


class CreateConversation(BaseModel):
    conversation_id: str | None = Field(default=None, min_length=1, max_length=64)
    workspace_id: str | None = Field(default=None, max_length=64)
    subject: str = Field(min_length=1, max_length=191)
    summary: str = Field(default="", max_length=4000)
    status: ConversationStatus = "open"
    triage_status: TriageStatus = "new"
    priority: WorkItemPriority = "normal"
    contact_ref: str | None = Field(default=None, max_length=191)
    run_id: str | None = Field(default=None, max_length=64)
    artifact_id: str | None = Field(default=None, max_length=64)
    approval_id: str | None = Field(default=None, max_length=191)
    decision_id: str | None = Field(default=None, max_length=191)
    metadata: dict[str, Any] = Field(default_factory=dict)
    initial_thread_title: str = Field(default="Primary", min_length=1, max_length=191)
    initial_session_kind: ConversationSessionKind = "operator"
    initial_continuity_key: str | None = Field(default=None, max_length=191)
    initial_message_role: ConversationMessageRole = "user"
    initial_message_body: str = Field(min_length=1, max_length=12000)
    participant_agent_ids: list[str] = Field(default_factory=list)
    initial_mention_agent_ids: list[str] = Field(default_factory=list)
    create_inbox_entry: bool = True
    inbox_title: str | None = Field(default=None, max_length=191)
    inbox_summary: str | None = Field(default=None, max_length=4000)


class UpdateConversation(BaseModel):
    subject: str | None = Field(default=None, min_length=1, max_length=191)
    summary: str | None = Field(default=None, max_length=4000)
    workspace_id: str | None = Field(default=None, max_length=64)
    status: ConversationStatus | None = None
    triage_status: TriageStatus | None = None
    priority: WorkItemPriority | None = None
    contact_ref: str | None = Field(default=None, max_length=191)
    run_id: str | None = Field(default=None, max_length=64)
    artifact_id: str | None = Field(default=None, max_length=64)
    approval_id: str | None = Field(default=None, max_length=191)
    decision_id: str | None = Field(default=None, max_length=191)
    metadata: dict[str, Any] | None = None
    active_thread_id: str | None = Field(default=None, max_length=64)


class AppendConversationMessage(BaseModel):
    thread_id: str | None = Field(default=None, max_length=64)
    session_id: str | None = Field(default=None, max_length=64)
    thread_title: str | None = Field(default=None, min_length=1, max_length=191)
    start_new_session: bool = False
    session_kind: ConversationSessionKind = "operator"
    continuity_key: str | None = Field(default=None, max_length=191)
    message_role: ConversationMessageRole = "operator"
    body: str = Field(min_length=1, max_length=12000)
    mention_agent_ids: list[str] = Field(default_factory=list)
    handoff_to_agent_id: str | None = Field(default=None, max_length=64)
    review_request_agent_id: str | None = Field(default=None, max_length=64)
    blocker_agent_id: str | None = Field(default=None, max_length=64)
    roundtable_agent_ids: list[str] = Field(default_factory=list)
    structured_payload: dict[str, Any] = Field(default_factory=dict)


class CreateInboxItem(BaseModel):
    inbox_id: str | None = Field(default=None, min_length=1, max_length=64)
    conversation_id: str | None = Field(default=None, max_length=64)
    thread_id: str | None = Field(default=None, max_length=64)
    workspace_id: str | None = Field(default=None, max_length=64)
    title: str = Field(min_length=1, max_length=191)
    summary: str = Field(default="", max_length=4000)
    triage_status: TriageStatus = "new"
    priority: WorkItemPriority = "normal"
    status: InboxStatus = "open"
    contact_ref: str | None = Field(default=None, max_length=191)
    run_id: str | None = Field(default=None, max_length=64)
    artifact_id: str | None = Field(default=None, max_length=64)
    approval_id: str | None = Field(default=None, max_length=191)
    decision_id: str | None = Field(default=None, max_length=191)
    metadata: dict[str, Any] = Field(default_factory=dict)


class UpdateInboxItem(BaseModel):
    conversation_id: str | None = Field(default=None, max_length=64)
    thread_id: str | None = Field(default=None, max_length=64)
    workspace_id: str | None = Field(default=None, max_length=64)
    title: str | None = Field(default=None, min_length=1, max_length=191)
    summary: str | None = Field(default=None, max_length=4000)
    triage_status: TriageStatus | None = None
    priority: WorkItemPriority | None = None
    status: InboxStatus | None = None
    contact_ref: str | None = Field(default=None, max_length=191)
    run_id: str | None = Field(default=None, max_length=64)
    artifact_id: str | None = Field(default=None, max_length=64)
    approval_id: str | None = Field(default=None, max_length=191)
    decision_id: str | None = Field(default=None, max_length=191)
    metadata: dict[str, Any] | None = None
