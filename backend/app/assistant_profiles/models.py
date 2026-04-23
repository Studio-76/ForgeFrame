"""Assistant-profile contracts for personal assistant mode."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.knowledge.models import RecordLink
from app.tasks.models import WorkItemPriority


ASSISTANT_PROFILE_STATUSES = ("active", "paused")
AssistantProfileStatus = Literal["active", "paused"]

ASSISTANT_TONES = ("neutral", "warm", "direct", "formal")
AssistantTone = Literal["neutral", "warm", "direct", "formal"]

QUIET_HOURS_DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
QuietHoursDay = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

DIRECT_ACTION_POLICIES = ("never", "preview_required", "approval_required", "allow")
DirectActionPolicy = Literal["never", "preview_required", "approval_required", "allow"]

ASSISTANT_ACTION_MODES = ("suggest", "ask", "direct")
AssistantActionMode = Literal["suggest", "ask", "direct"]

ASSISTANT_ACTION_KINDS = ("draft_message", "send_notification", "create_follow_up", "schedule_calendar", "delegate_follow_up")
AssistantActionKind = Literal["draft_message", "send_notification", "create_follow_up", "schedule_calendar", "delegate_follow_up"]

ASSISTANT_ACTION_DECISIONS = ("allow", "requires_preview", "requires_approval", "blocked")
AssistantActionDecision = Literal["allow", "requires_preview", "requires_approval", "blocked"]


class QuietHoursSettings(BaseModel):
    enabled: bool = False
    timezone: str = Field(default="UTC", min_length=1, max_length=64)
    start_minute: int = Field(default=1320, ge=0, le=1439)
    end_minute: int = Field(default=420, ge=0, le=1439)
    days: list[QuietHoursDay] = Field(default_factory=lambda: ["mon", "tue", "wed", "thu", "fri"])
    allow_priority_override: bool = True
    override_min_priority: WorkItemPriority = "critical"


class DeliveryPreferences(BaseModel):
    primary_channel_id: str | None = Field(default=None, max_length=64)
    fallback_channel_id: str | None = Field(default=None, max_length=64)
    allowed_channel_ids: list[str] = Field(default_factory=list)
    preview_by_default: bool = True
    mute_during_quiet_hours: bool = True


class CommunicationRules(BaseModel):
    tone: AssistantTone = "neutral"
    locale: str = Field(default="en-US", min_length=2, max_length=16)
    signature: str | None = Field(default=None, max_length=4000)
    style_notes: str | None = Field(default=None, max_length=4000)


class ActionPolicies(BaseModel):
    suggestions_enabled: bool = True
    questions_enabled: bool = True
    direct_action_policy: DirectActionPolicy = "preview_required"
    allow_mail_actions: bool = True
    allow_calendar_actions: bool = False
    allow_task_actions: bool = True
    require_approval_reference: bool = True
    direct_channel_ids: list[str] = Field(default_factory=list)


class DelegationRules(BaseModel):
    delegate_contact_id: str | None = Field(default=None, max_length=64)
    escalation_contact_id: str | None = Field(default=None, max_length=64)
    allow_external_delegation: bool = False
    allow_auto_followups: bool = True


class AssistantProfileSummary(BaseModel):
    assistant_profile_id: str
    instance_id: str
    company_id: str
    display_name: str
    summary: str
    status: AssistantProfileStatus
    assistant_mode_enabled: bool
    is_default: bool
    timezone: str
    locale: str
    tone: AssistantTone
    preferred_contact_id: str | None = None
    primary_channel_id: str | None = None
    fallback_channel_id: str | None = None
    mail_source_id: str | None = None
    calendar_source_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class AssistantProfileDetail(AssistantProfileSummary):
    preferred_contact: RecordLink | None = None
    delegate_contact: RecordLink | None = None
    escalation_contact: RecordLink | None = None
    primary_channel: RecordLink | None = None
    fallback_channel: RecordLink | None = None
    mail_source: RecordLink | None = None
    calendar_source: RecordLink | None = None
    preferences: dict[str, Any] = Field(default_factory=dict)
    communication_rules: CommunicationRules = Field(default_factory=CommunicationRules)
    quiet_hours: QuietHoursSettings = Field(default_factory=QuietHoursSettings)
    delivery_preferences: DeliveryPreferences = Field(default_factory=DeliveryPreferences)
    action_policies: ActionPolicies = Field(default_factory=ActionPolicies)
    delegation_rules: DelegationRules = Field(default_factory=DelegationRules)


class CreateAssistantProfile(BaseModel):
    assistant_profile_id: str | None = Field(default=None, min_length=1, max_length=64)
    display_name: str = Field(min_length=1, max_length=191)
    summary: str = Field(default="", max_length=4000)
    status: AssistantProfileStatus = "active"
    assistant_mode_enabled: bool = True
    is_default: bool = False
    timezone: str = Field(default="UTC", min_length=1, max_length=64)
    locale: str = Field(default="en-US", min_length=2, max_length=16)
    tone: AssistantTone = "neutral"
    preferred_contact_id: str | None = Field(default=None, max_length=64)
    mail_source_id: str | None = Field(default=None, max_length=64)
    calendar_source_id: str | None = Field(default=None, max_length=64)
    preferences: dict[str, Any] = Field(default_factory=dict)
    communication_rules: CommunicationRules = Field(default_factory=CommunicationRules)
    quiet_hours: QuietHoursSettings = Field(default_factory=QuietHoursSettings)
    delivery_preferences: DeliveryPreferences = Field(default_factory=DeliveryPreferences)
    action_policies: ActionPolicies = Field(default_factory=ActionPolicies)
    delegation_rules: DelegationRules = Field(default_factory=DelegationRules)
    metadata: dict[str, Any] = Field(default_factory=dict)


class UpdateAssistantProfile(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=191)
    summary: str | None = Field(default=None, max_length=4000)
    status: AssistantProfileStatus | None = None
    assistant_mode_enabled: bool | None = None
    is_default: bool | None = None
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    locale: str | None = Field(default=None, min_length=2, max_length=16)
    tone: AssistantTone | None = None
    preferred_contact_id: str | None = Field(default=None, max_length=64)
    mail_source_id: str | None = Field(default=None, max_length=64)
    calendar_source_id: str | None = Field(default=None, max_length=64)
    preferences: dict[str, Any] | None = None
    communication_rules: CommunicationRules | None = None
    quiet_hours: QuietHoursSettings | None = None
    delivery_preferences: DeliveryPreferences | None = None
    action_policies: ActionPolicies | None = None
    delegation_rules: DelegationRules | None = None
    metadata: dict[str, Any] | None = None


class EvaluateAssistantAction(BaseModel):
    action_mode: AssistantActionMode
    action_kind: AssistantActionKind
    priority: WorkItemPriority = "normal"
    channel_id: str | None = Field(default=None, max_length=64)
    target_contact_id: str | None = Field(default=None, max_length=64)
    occurred_at: datetime | None = None
    requires_external_delivery: bool = True
    approval_reference: str | None = Field(default=None, max_length=191)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AssistantActionEvaluation(BaseModel):
    assistant_profile_id: str
    decision: AssistantActionDecision
    action_mode: AssistantActionMode
    action_kind: AssistantActionKind
    priority: WorkItemPriority
    evaluated_at: datetime
    effective_channel_id: str | None = None
    fallback_channel_id: str | None = None
    quiet_hours_active: bool
    preview_required: bool = False
    approval_required: bool = False
    delegate_contact_id: str | None = None
    reasons: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

