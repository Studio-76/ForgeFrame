"""Admin-facing contact, knowledge-source, and memory service."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord
from app.knowledge.models import (
    ContactChannel,
    ContactConsent,
    ContactDetail,
    ContactProvenance,
    ContactSummary,
    CorrectMemory,
    CreateContact,
    CreateKnowledgeSource,
    CreateMemory,
    DeleteMemory,
    KnowledgeSourceConfigField,
    KnowledgeSourceDetail,
    KnowledgeSourceIndexCounts,
    KnowledgeSourceSyncPosture,
    KnowledgeSourceSummary,
    MemoryActionResult,
    MemoryDetail,
    MemorySummary,
    RevokeMemory,
    RecordLink,
    UpdateContact,
    UpdateKnowledgeSource,
    UpdateMemory,
)
from app.storage.conversation_repository import ConversationORM
from app.storage.knowledge_repository import ContactORM, KnowledgeSourceORM, MemoryEntryORM
from app.storage.skill_repository import SkillORM
from app.storage.tasking_repository import NotificationORM, TaskORM
from app.storage.workspace_repository import WorkspaceORM

SessionFactory = Callable[[], Session]


class KnowledgeContextAdminService:
    def __init__(self, session_factory: SessionFactory) -> None:
        self._session_factory = session_factory

    @staticmethod
    def _now() -> datetime:
        return datetime.now(tz=UTC)

    @staticmethod
    def _new_id(prefix: str) -> str:
        return f"{prefix}_{uuid4().hex[:20]}"

    @staticmethod
    def _can_view_sensitive(actor: AuthenticatedAdmin) -> bool:
        return actor.role in {"owner", "admin"}

    @staticmethod
    def _load_source(session: Session, *, instance: InstanceRecord, source_id: str) -> KnowledgeSourceORM:
        return KnowledgeContextAdminService._load_source_by_scope(
            session,
            company_id=instance.company_id,
            instance_id=instance.instance_id,
            source_id=source_id,
        )

    @staticmethod
    def _load_source_by_scope(session: Session, *, company_id: str, instance_id: str, source_id: str) -> KnowledgeSourceORM:
        row = session.get(KnowledgeSourceORM, source_id)
        if row is None or row.company_id != company_id or row.instance_id != instance_id:
            raise ValueError(f"Knowledge source '{source_id}' was not found.")
        return row

    @staticmethod
    def _load_contact(session: Session, *, instance: InstanceRecord, contact_id: str) -> ContactORM:
        row = session.get(ContactORM, contact_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Contact '{contact_id}' was not found.")
        return row

    @staticmethod
    def _load_memory(session: Session, *, instance: InstanceRecord, memory_id: str) -> MemoryEntryORM:
        row = session.get(MemoryEntryORM, memory_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Memory entry '{memory_id}' was not found.")
        return row

    @staticmethod
    def _load_conversation(session: Session, *, instance: InstanceRecord, conversation_id: str) -> ConversationORM:
        row = session.get(ConversationORM, conversation_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Conversation '{conversation_id}' was not found.")
        return row

    @staticmethod
    def _load_task(session: Session, *, instance: InstanceRecord, task_id: str) -> TaskORM:
        row = session.get(TaskORM, task_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Task '{task_id}' was not found.")
        return row

    @staticmethod
    def _load_notification(session: Session, *, instance: InstanceRecord, notification_id: str) -> NotificationORM:
        row = session.get(NotificationORM, notification_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Notification '{notification_id}' was not found.")
        return row

    @staticmethod
    def _load_workspace(session: Session, *, instance: InstanceRecord, workspace_id: str) -> WorkspaceORM:
        row = session.get(WorkspaceORM, workspace_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Workspace '{workspace_id}' was not found.")
        return row

    @staticmethod
    def _metadata_record(value: object) -> dict[str, object]:
        return dict(value) if isinstance(value, dict) else {}

    @staticmethod
    def _string_value(value: object) -> str | None:
        if not isinstance(value, str):
            return None
        normalized = value.strip()
        return normalized or None

    @classmethod
    def _parse_datetime_value(cls, value: object) -> datetime | None:
        normalized = cls._string_value(value)
        if normalized is None:
            return None
        candidate = normalized[:-1] + "+00:00" if normalized.endswith("Z") else normalized
        try:
            return datetime.fromisoformat(candidate)
        except ValueError:
            return None

    @classmethod
    def _contact_channels(cls, row: ContactORM) -> tuple[list[ContactChannel], list[str]]:
        metadata = cls._metadata_record(row.metadata_json)
        channels: list[ContactChannel] = []
        warnings: list[str] = []
        seen_routes: set[tuple[str, str]] = set()
        primary_routes: dict[str, str] = {}

        def append_channel(
            *,
            kind: str,
            label: str,
            address: str | None,
            is_primary: bool,
            source: str | None = None,
            route_status: str | None = None,
            warning: str | None = None,
        ) -> None:
            normalized_kind = kind if kind in {"email", "phone", "slack", "other"} else "other"
            normalized_address = (address or "").strip()
            normalized_status = route_status if route_status in {"reachable", "warning", "blocked"} else None
            channel_warning = warning
            if not normalized_address:
                normalized_address = "[missing address]"
                normalized_status = normalized_status or "warning"
                channel_warning = channel_warning or f"{label} is missing an address."
            route_key = (normalized_kind, normalized_address.casefold())
            if normalized_address != "[missing address]" and route_key in seen_routes:
                warnings.append(f"Duplicate {normalized_kind} route '{normalized_address}' is recorded multiple times.")
                return
            seen_routes.add(route_key)
            if is_primary and normalized_address != "[missing address]":
                previous_primary = primary_routes.get(normalized_kind)
                if previous_primary and previous_primary.casefold() != normalized_address.casefold():
                    warnings.append(
                        f"Conflicting primary {normalized_kind} routes are recorded: '{previous_primary}' and '{normalized_address}'.",
                    )
                else:
                    primary_routes[normalized_kind] = normalized_address
            channels.append(
                ContactChannel(
                    kind=normalized_kind,  # type: ignore[arg-type]
                    label=label,
                    address=normalized_address,
                    is_primary=is_primary,
                    source=source,
                    route_status=(normalized_status or "reachable"),  # type: ignore[arg-type]
                    warning=channel_warning,
                ),
            )
            if channel_warning:
                warnings.append(channel_warning)

        if row.primary_email:
            append_channel(kind="email", label="Primary email", address=row.primary_email, is_primary=True, source="contact profile")
        if row.primary_phone:
            append_channel(kind="phone", label="Primary phone", address=row.primary_phone, is_primary=True, source="contact profile")

        metadata_channels = metadata.get("channels")
        if isinstance(metadata_channels, list):
            for index, item in enumerate(metadata_channels):
                if isinstance(item, str):
                    append_channel(
                        kind="other",
                        label=f"Route {index + 1}",
                        address=item,
                        is_primary=False,
                        source="metadata",
                    )
                    continue
                if not isinstance(item, dict):
                    warnings.append(f"Channel entry #{index + 1} is not a structured route object.")
                    continue
                kind = cls._string_value(item.get("kind")) or cls._string_value(item.get("type")) or "other"
                label = cls._string_value(item.get("label")) or f"{kind.title()} route"
                address = (
                    cls._string_value(item.get("address"))
                    or cls._string_value(item.get("value"))
                    or cls._string_value(item.get("target"))
                    or cls._string_value(item.get("handle"))
                )
                source = cls._string_value(item.get("source")) or cls._string_value(item.get("provenance"))
                warning = cls._string_value(item.get("warning"))
                route_status = cls._string_value(item.get("route_status")) or cls._string_value(item.get("status"))
                is_primary = bool(item.get("is_primary"))
                append_channel(
                    kind=kind,
                    label=label,
                    address=address,
                    is_primary=is_primary,
                    source=source or "metadata",
                    route_status=route_status,
                    warning=warning,
                )

        legacy_secondary_email = cls._string_value(metadata.get("secondary_email")) or cls._string_value(metadata.get("alternate_email"))
        if legacy_secondary_email:
            append_channel(kind="email", label="Secondary email", address=legacy_secondary_email, is_primary=False, source="metadata")
        legacy_secondary_phone = cls._string_value(metadata.get("secondary_phone")) or cls._string_value(metadata.get("alternate_phone"))
        if legacy_secondary_phone:
            append_channel(kind="phone", label="Secondary phone", address=legacy_secondary_phone, is_primary=False, source="metadata")
        legacy_slack = cls._string_value(metadata.get("slack_handle")) or cls._string_value(metadata.get("slack_channel"))
        if legacy_slack:
            append_channel(kind="slack", label="Slack", address=legacy_slack, is_primary=False, source="metadata")

        reachable_routes = [channel for channel in channels if channel.route_status == "reachable"]
        if not reachable_routes:
            warnings.append("No reachable channel is recorded for this contact.")
        return channels, list(dict.fromkeys(warnings))

    @classmethod
    def _contact_provenance(cls, row: ContactORM) -> ContactProvenance:
        metadata = cls._metadata_record(row.metadata_json)
        provenance = cls._metadata_record(metadata.get("provenance"))
        return ContactProvenance(
            provider=(
                cls._string_value(provenance.get("provider"))
                or cls._string_value(provenance.get("system"))
                or cls._string_value(metadata.get("source_provider"))
            ),
            import_reference=(
                cls._string_value(provenance.get("import_reference"))
                or cls._string_value(provenance.get("external_id"))
                or cls._string_value(provenance.get("record_id"))
            ),
            imported_at=(
                cls._parse_datetime_value(provenance.get("imported_at"))
                or cls._parse_datetime_value(metadata.get("imported_at"))
            ),
            last_verified_at=(
                cls._parse_datetime_value(provenance.get("last_verified_at"))
                or cls._parse_datetime_value(metadata.get("last_verified_at"))
            ),
            note=(
                cls._string_value(provenance.get("note"))
                or cls._string_value(provenance.get("summary"))
                or cls._string_value(metadata.get("source_note"))
            ),
        )

    @classmethod
    def _contact_consent(cls, row: ContactORM) -> ContactConsent:
        metadata = cls._metadata_record(row.metadata_json)
        consent = cls._metadata_record(metadata.get("consent"))
        return ContactConsent(
            status=(
                cls._string_value(consent.get("status"))
                or cls._string_value(consent.get("state"))
                or cls._string_value(metadata.get("consent_status"))
                or "unknown"
            ),
            captured_at=(
                cls._parse_datetime_value(consent.get("captured_at"))
                or cls._parse_datetime_value(consent.get("updated_at"))
                or cls._parse_datetime_value(metadata.get("consent_captured_at"))
            ),
            note=(
                cls._string_value(consent.get("note"))
                or cls._string_value(consent.get("policy_basis"))
                or cls._string_value(metadata.get("consent_note"))
            ),
        )

    @classmethod
    def _contact_visibility_note(cls, row: ContactORM) -> str | None:
        metadata = cls._metadata_record(row.metadata_json)
        visibility = cls._metadata_record(metadata.get("visibility"))
        return (
            cls._string_value(visibility.get("note"))
            or cls._string_value(visibility.get("summary"))
            or cls._string_value(metadata.get("visibility_note"))
        )

    @classmethod
    def _source_scope_label(cls, row: KnowledgeSourceORM) -> str:
        metadata = cls._metadata_record(row.metadata_json)
        scope_hint = cls._string_value(metadata.get("scope")) or cls._string_value(metadata.get("knowledge_scope"))
        if scope_hint:
            normalized = scope_hint.lower().replace("_", " ").strip()
            if "tenant" in normalized:
                return "tenant knowledge"
            if "personal" in normalized:
                return "personal recall"
            if "instance" in normalized:
                return "instance knowledge"
            if "restricted" in normalized:
                return "restricted knowledge"
        if row.visibility_scope == "personal":
            return "personal recall"
        if row.visibility_scope == "instance":
            return "instance knowledge"
        if row.visibility_scope == "restricted":
            return "restricted knowledge"
        return "tenant knowledge"

    @classmethod
    def _source_sync_posture(cls, row: KnowledgeSourceORM) -> KnowledgeSourceSyncPosture:
        metadata = cls._metadata_record(row.metadata_json)
        configured_next_step = (
            cls._string_value(cls._metadata_record(metadata.get("error_guidance")).get("next_step"))
            or cls._string_value(metadata.get("sync_next_step"))
        )
        if row.last_error:
            next_step = configured_next_step or "Inspect connector configuration, repair the upstream credential or target, then resync through the bridge runtime."
            return KnowledgeSourceSyncPosture(
                state="attention_required",
                next_step=next_step,
            )
        if row.status == "paused":
            return KnowledgeSourceSyncPosture(
                state="paused",
                next_step=configured_next_step or "Resume or reconfigure the connector before expecting fresh recall results.",
            )
        if row.last_synced_at is None:
            return KnowledgeSourceSyncPosture(
                state="never_synced",
                next_step=configured_next_step or "Run the source sync from the connector runtime or bridge; this control plane does not expose a direct sync trigger here.",
            )
        return KnowledgeSourceSyncPosture(
            state="synced",
            next_step=configured_next_step or "Use this source for recall, then promote verified durable facts into Memory when they must survive connector drift.",
        )

    @classmethod
    def _source_connector_fields(cls, row: KnowledgeSourceORM, *, redacted: bool = False) -> list[KnowledgeSourceConfigField]:
        metadata = cls._metadata_record(row.metadata_json)
        connector = cls._metadata_record(metadata.get("connector"))
        boundary = cls._metadata_record(metadata.get("knowledge_boundary"))
        label_by_kind = {
            "mail": "Mailbox target",
            "calendar": "Calendar target",
            "contacts": "Directory target",
            "drive": "Library target",
            "knowledge_base": "Knowledge target",
        }
        fields = [
            KnowledgeSourceConfigField(
                key="connection_target",
                label=label_by_kind.get(row.source_kind, "Connector target"),
                value="[redacted]" if redacted else row.connection_target,
                redacted=redacted,
            ),
        ]
        structured_fields = [
            ("connector_account", "Connector account", cls._string_value(connector.get("account")) or cls._string_value(metadata.get("connector_account"))),
            ("connector_collection", "Collection / folder", cls._string_value(connector.get("collection")) or cls._string_value(metadata.get("collection"))),
            ("index_mode", "Index mode", cls._string_value(connector.get("index_mode")) or cls._string_value(metadata.get("index_mode"))),
            ("recall_class", "Recall class", cls._string_value(boundary.get("recall_class")) or cls._string_value(metadata.get("recall_class"))),
            ("scope_note", "Scope note", cls._string_value(boundary.get("scope_note")) or cls._string_value(metadata.get("scope_note"))),
        ]
        for key, label, value in structured_fields:
            if value:
                fields.append(KnowledgeSourceConfigField(key=key, label=label, value=value))
        return fields

    @staticmethod
    def _source_conversation_ids_for_contact_refs(session: Session, *, instance: InstanceRecord, contact_refs: list[str]) -> list[str]:
        if not contact_refs:
            return []
        return list(dict.fromkeys(session.execute(
            select(ConversationORM.id).where(
                ConversationORM.company_id == instance.company_id,
                ConversationORM.instance_id == instance.instance_id,
                ConversationORM.contact_ref.in_(contact_refs),
            ),
        ).scalars().all()))

    @staticmethod
    def _skill_matches_source(skill: SkillORM, source_id: str) -> bool:
        provenance = dict(skill.provenance_json or {})
        if not provenance:
            return False
        direct_source_id = provenance.get("source_id") or provenance.get("knowledge_source_id")
        if isinstance(direct_source_id, str) and direct_source_id.strip() == source_id:
            return True
        source_block = provenance.get("source")
        if isinstance(source_block, dict):
            nested_source_id = source_block.get("source_id") or source_block.get("knowledge_source_id")
            if isinstance(nested_source_id, str) and nested_source_id.strip() == source_id:
                return True
        return False

    def _contact_summary(self, session: Session, row: ContactORM) -> ContactSummary:
        source_row = session.get(KnowledgeSourceORM, row.source_id) if row.source_id else None
        if source_row is not None and (source_row.company_id != row.company_id or source_row.instance_id != row.instance_id):
            source_row = None
        channels, route_warnings = self._contact_channels(row)
        conversation_count = int(
            session.scalar(
                select(func.count()).select_from(ConversationORM).where(
                    ConversationORM.company_id == row.company_id,
                    ConversationORM.instance_id == row.instance_id,
                    ConversationORM.contact_ref == row.contact_ref,
                ),
            )
            or 0,
        )
        last_contact_at = session.scalar(
            select(func.max(ConversationORM.updated_at)).where(
                ConversationORM.company_id == row.company_id,
                ConversationORM.instance_id == row.instance_id,
                ConversationORM.contact_ref == row.contact_ref,
            ),
        )
        memory_count = int(
            session.scalar(
                select(func.count()).select_from(MemoryEntryORM).where(
                    MemoryEntryORM.company_id == row.company_id,
                    MemoryEntryORM.contact_id == row.id,
                ),
            )
            or 0,
        )
        return ContactSummary(
            contact_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            contact_ref=row.contact_ref,
            source_id=row.source_id,
            source_label=source_row.label if source_row is not None else None,
            source_kind=source_row.source_kind if source_row is not None else None,  # type: ignore[arg-type]
            display_name=row.display_name,
            primary_email=row.primary_email,
            primary_phone=row.primary_phone,
            organization=row.organization,
            title=row.title,
            status=row.status,  # type: ignore[arg-type]
            visibility_scope=row.visibility_scope,  # type: ignore[arg-type]
            metadata=dict(row.metadata_json or {}),
            channels=channels,
            reachable_channel_count=sum(1 for channel in channels if channel.route_status == "reachable"),
            route_warnings=route_warnings,
            conversation_count=conversation_count,
            memory_count=memory_count,
            last_contact_at=last_contact_at,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def _source_index_counts(self, session: Session, row: KnowledgeSourceORM) -> KnowledgeSourceIndexCounts:
        contact_count = int(
            session.scalar(
                select(func.count()).select_from(ContactORM).where(
                    ContactORM.company_id == row.company_id,
                    ContactORM.source_id == row.id,
                ),
            )
            or 0,
        )
        memory_count = int(
            session.scalar(
                select(func.count()).select_from(MemoryEntryORM).where(
                    MemoryEntryORM.company_id == row.company_id,
                    MemoryEntryORM.source_id == row.id,
                ),
            )
            or 0,
        )
        contact_refs = session.execute(
            select(ContactORM.contact_ref).where(
                ContactORM.company_id == row.company_id,
                ContactORM.source_id == row.id,
            ),
        ).scalars().all()
        conversation_ids = set(session.execute(
            select(MemoryEntryORM.conversation_id).where(
                MemoryEntryORM.company_id == row.company_id,
                MemoryEntryORM.source_id == row.id,
                MemoryEntryORM.conversation_id.is_not(None),
            ),
        ).scalars().all())
        if contact_refs:
            conversation_ids.update(
                session.execute(
                    select(ConversationORM.id).where(
                        ConversationORM.company_id == row.company_id,
                        ConversationORM.instance_id == row.instance_id,
                        ConversationORM.contact_ref.in_(contact_refs),
                    ),
                ).scalars().all(),
            )
        skills = [
            skill
            for skill in session.execute(
                select(SkillORM).where(
                    SkillORM.company_id == row.company_id,
                    SkillORM.instance_id == row.instance_id,
                ),
            ).scalars().all()
            if self._skill_matches_source(skill, row.id)
        ]
        return KnowledgeSourceIndexCounts(
            contacts=contact_count,
            durable_memory=memory_count,
            linked_conversations=len({conversation_id for conversation_id in conversation_ids if conversation_id}),
            linked_skills=len(skills),
        )

    def _source_summary(self, session: Session, row: KnowledgeSourceORM) -> KnowledgeSourceSummary:
        indexed_objects = self._source_index_counts(session, row)
        return KnowledgeSourceSummary(
            source_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            source_kind=row.source_kind,  # type: ignore[arg-type]
            label=row.label,
            description=row.description,
            connection_target=row.connection_target,
            status=row.status,  # type: ignore[arg-type]
            visibility_scope=row.visibility_scope,  # type: ignore[arg-type]
            scope_label=self._source_scope_label(row),
            last_synced_at=row.last_synced_at,
            last_error=row.last_error,
            sync=self._source_sync_posture(row),
            metadata=dict(row.metadata_json or {}),
            contact_count=indexed_objects.contacts,
            memory_count=indexed_objects.durable_memory,
            indexed_objects=indexed_objects,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def _memory_summary(self, row: MemoryEntryORM) -> MemorySummary:
        truth_state = row.truth_state
        if row.status == "deleted":
            truth_state = "deleted"
        elif row.expires_at is not None and row.expires_at <= self._now():
            truth_state = "expired"
        return MemorySummary(
            memory_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            source_id=row.source_id,
            contact_id=row.contact_id,
            conversation_id=row.conversation_id,
            task_id=row.task_id,
            notification_id=row.notification_id,
            workspace_id=row.workspace_id,
            memory_kind=row.memory_kind,  # type: ignore[arg-type]
            title=row.title,
            body=row.body,
            status=row.status,  # type: ignore[arg-type]
            truth_state=truth_state,  # type: ignore[arg-type]
            source_trust_class=row.source_trust_class,  # type: ignore[arg-type]
            visibility_scope=row.visibility_scope,  # type: ignore[arg-type]
            sensitivity=row.sensitivity,  # type: ignore[arg-type]
            correction_note=row.correction_note,
            supersedes_memory_id=row.supersedes_memory_id,
            learned_from_event_id=row.learned_from_event_id,
            human_override=row.human_override,
            expires_at=row.expires_at,
            deleted_at=row.deleted_at,
            metadata=dict(row.metadata_json or {}),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def _sanitize_contact(self, summary: ContactSummary, *, actor: AuthenticatedAdmin) -> ContactSummary:
        if self._can_view_sensitive(actor) or summary.visibility_scope not in {"personal", "restricted"}:
            return summary
        redacted_channels = [
            channel.model_copy(update={
                "address": "[redacted]" if channel.address and channel.address != "[missing address]" else channel.address,
            })
            for channel in summary.channels
        ]
        return summary.model_copy(update={
            "primary_email": None,
            "primary_phone": None,
            "channels": redacted_channels,
            "metadata": {"redacted": True},
        })

    def _sanitize_source(self, summary: KnowledgeSourceSummary, *, actor: AuthenticatedAdmin) -> KnowledgeSourceSummary:
        if self._can_view_sensitive(actor) or summary.visibility_scope not in {"personal", "restricted"}:
            return summary
        return summary.model_copy(update={
            "connection_target": "[redacted]",
            "last_error": None,
            "metadata": {"redacted": True},
        })

    def _sanitize_memory(self, summary: MemorySummary, *, actor: AuthenticatedAdmin) -> MemorySummary:
        sensitive = summary.visibility_scope in {"personal", "restricted"} or summary.sensitivity in {"sensitive", "restricted"}
        if self._can_view_sensitive(actor) or not sensitive:
            return summary
        return summary.model_copy(update={
            "body": "[redacted]",
            "metadata": {"redacted": True},
        })

    @staticmethod
    def _record_link(record_id: str, label: str, status: str | None = None) -> RecordLink:
        return RecordLink(record_id=record_id, label=label, status=status)

    def _validate_memory_links(
        self,
        session: Session,
        *,
        instance: InstanceRecord,
        source_id: str | None,
        contact_id: str | None,
        conversation_id: str | None,
        task_id: str | None,
        notification_id: str | None,
        workspace_id: str | None,
    ) -> None:
        source = self._load_source(session, instance=instance, source_id=source_id) if source_id else None
        contact = self._load_contact(session, instance=instance, contact_id=contact_id) if contact_id else None
        if source and contact and contact.source_id and contact.source_id != source.id:
            raise ValueError("Contact and knowledge source links disagree.")
        if conversation_id:
            self._load_conversation(session, instance=instance, conversation_id=conversation_id)
        if task_id:
            self._load_task(session, instance=instance, task_id=task_id)
        if notification_id:
            self._load_notification(session, instance=instance, notification_id=notification_id)
        if workspace_id:
            self._load_workspace(session, instance=instance, workspace_id=workspace_id)

    def list_contacts(
        self,
        *,
        instance: InstanceRecord,
        actor: AuthenticatedAdmin,
        status: str | None = None,
        limit: int = 100,
    ) -> list[ContactSummary]:
        with self._session_factory() as session:
            stmt = select(ContactORM).where(
                ContactORM.company_id == instance.company_id,
                ContactORM.instance_id == instance.instance_id,
            )
            if status is not None:
                stmt = stmt.where(ContactORM.status == status)
            rows = session.execute(stmt.order_by(ContactORM.updated_at.desc()).limit(max(1, min(limit, 200)))).scalars().all()
            return [self._sanitize_contact(self._contact_summary(session, row), actor=actor) for row in rows]

    def get_contact(self, *, instance: InstanceRecord, actor: AuthenticatedAdmin, contact_id: str) -> ContactDetail:
        with self._session_factory() as session:
            row = self._load_contact(session, instance=instance, contact_id=contact_id)
            summary = self._sanitize_contact(self._contact_summary(session, row), actor=actor)
            source_row = session.get(KnowledgeSourceORM, row.source_id) if row.source_id else None
            if source_row is not None and (source_row.company_id != instance.company_id or source_row.instance_id != instance.instance_id):
                source_row = None
            source = self._sanitize_source(self._source_summary(session, source_row), actor=actor) if source_row is not None else None
            provenance = self._contact_provenance(row)
            consent = self._contact_consent(row)
            visibility_note = self._contact_visibility_note(row)
            conversation_rows = session.execute(
                select(ConversationORM).where(
                    ConversationORM.company_id == instance.company_id,
                    ConversationORM.instance_id == instance.instance_id,
                    ConversationORM.contact_ref == row.contact_ref,
                ).order_by(ConversationORM.updated_at.desc()).limit(10),
            ).scalars().all()
            recent_conversations = [
                self._record_link(record_id=item.id, label=item.subject, status=item.status)
                for item in conversation_rows
            ]
            recent_memory_rows = session.execute(
                select(MemoryEntryORM).where(
                    MemoryEntryORM.company_id == instance.company_id,
                    MemoryEntryORM.contact_id == contact_id,
                ).order_by(MemoryEntryORM.updated_at.desc()).limit(10),
            ).scalars().all()
            recent_memory = [
                self._sanitize_memory(self._memory_summary(item), actor=actor)
                for item in recent_memory_rows
            ]
            task_ids = [item.task_id for item in recent_memory_rows if item.task_id]
            task_rows = []
            if task_ids:
                task_rows = session.execute(
                    select(TaskORM).where(
                        TaskORM.company_id == instance.company_id,
                        TaskORM.id.in_(task_ids),
                    ).order_by(TaskORM.updated_at.desc()).limit(10),
                ).scalars().all()
            recent_tasks = [
                self._record_link(record_id=item.id, label=item.title, status=item.status)
                for item in task_rows
            ]
            conversation_ids = [item.id for item in conversation_rows]
            notification_rows = []
            if conversation_ids or task_ids:
                notification_stmt = select(NotificationORM).where(NotificationORM.company_id == instance.company_id)
                clauses = []
                if conversation_ids:
                    clauses.append(NotificationORM.conversation_id.in_(conversation_ids))
                if task_ids:
                    clauses.append(NotificationORM.task_id.in_(task_ids))
                if clauses:
                    notification_stmt = notification_stmt.where(or_(*clauses))
                notification_rows = session.execute(
                    notification_stmt.order_by(NotificationORM.updated_at.desc()).limit(10),
                ).scalars().all()
            recent_notifications = [
                self._record_link(record_id=item.id, label=item.title, status=item.delivery_status)
                for item in notification_rows
            ]
            if not self._can_view_sensitive(actor) and summary.visibility_scope in {"personal", "restricted"}:
                provenance = provenance.model_copy(update={"import_reference": None, "note": None})
                consent = consent.model_copy(update={"note": None})
                visibility_note = None
            return ContactDetail(
                **summary.model_dump(),
                source=source,
                provenance=provenance,
                consent=consent,
                visibility_note=visibility_note,
                recent_conversations=recent_conversations,
                recent_tasks=recent_tasks,
                recent_notifications=recent_notifications,
                recent_memory=recent_memory,
            )

    def create_contact(self, *, instance: InstanceRecord, payload: CreateContact) -> ContactDetail:
        with self._session_factory() as session, session.begin():
            if payload.source_id:
                self._load_source(session, instance=instance, source_id=payload.source_id)
            contact_id = payload.contact_id or self._new_id("contact")
            if session.get(ContactORM, contact_id) is not None:
                raise ValueError(f"Contact '{contact_id}' already exists.")
            contact_ref = (payload.contact_ref or f"contact://{instance.instance_id}/{contact_id}").strip()
            existing_ref = session.execute(
                select(ContactORM).where(ContactORM.company_id == instance.company_id, ContactORM.contact_ref == contact_ref),
            ).scalar_one_or_none()
            if existing_ref is not None:
                raise ValueError(f"Contact ref '{contact_ref}' already exists.")
            session.add(
                ContactORM(
                    id=contact_id,
                    instance_id=instance.instance_id,
                    company_id=instance.company_id,
                    contact_ref=contact_ref,
                    source_id=payload.source_id,
                    display_name=payload.display_name.strip(),
                    primary_email=payload.primary_email,
                    primary_phone=payload.primary_phone,
                    organization=payload.organization,
                    title=payload.title,
                    status=payload.status,
                    visibility_scope=payload.visibility_scope,
                    metadata_json=dict(payload.metadata),
                    created_at=self._now(),
                    updated_at=self._now(),
                ),
            )
        return self.get_contact(instance=instance, actor=AuthenticatedAdmin(
            session_id="system",
            user_id="system",
            username="system",
            display_name="system",
            role="admin",
        ), contact_id=contact_id)

    def update_contact(self, *, instance: InstanceRecord, contact_id: str, payload: UpdateContact) -> ContactDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_contact(session, instance=instance, contact_id=contact_id)
            fields_set = payload.model_fields_set
            if "source_id" in fields_set and payload.source_id:
                self._load_source(session, instance=instance, source_id=payload.source_id)
            if "contact_ref" in fields_set:
                candidate = (payload.contact_ref or "").strip()
                if not candidate:
                    raise ValueError("Contact ref cannot be empty.")
                existing_ref = session.execute(
                    select(ContactORM).where(
                        ContactORM.company_id == instance.company_id,
                        ContactORM.contact_ref == candidate,
                        ContactORM.id != contact_id,
                    ),
                ).scalar_one_or_none()
                if existing_ref is not None:
                    raise ValueError(f"Contact ref '{candidate}' already exists.")
                row.contact_ref = candidate
            if "source_id" in fields_set:
                row.source_id = payload.source_id
            if "display_name" in fields_set:
                candidate_name = (payload.display_name or "").strip()
                if not candidate_name:
                    raise ValueError("Display name cannot be empty.")
                row.display_name = candidate_name
            if "primary_email" in fields_set:
                row.primary_email = payload.primary_email
            if "primary_phone" in fields_set:
                row.primary_phone = payload.primary_phone
            if "organization" in fields_set:
                row.organization = payload.organization
            if "title" in fields_set:
                row.title = payload.title
            if "status" in fields_set and payload.status is not None:
                row.status = payload.status
            if "visibility_scope" in fields_set and payload.visibility_scope is not None:
                row.visibility_scope = payload.visibility_scope
            if "metadata" in fields_set:
                row.metadata_json = dict(payload.metadata or {})
            row.updated_at = self._now()
        return self.get_contact(instance=instance, actor=AuthenticatedAdmin(
            session_id="system",
            user_id="system",
            username="system",
            display_name="system",
            role="admin",
        ), contact_id=contact_id)

    def list_sources(
        self,
        *,
        instance: InstanceRecord,
        actor: AuthenticatedAdmin,
        source_kind: str | None = None,
        status: str | None = None,
        limit: int = 100,
    ) -> list[KnowledgeSourceSummary]:
        with self._session_factory() as session:
            stmt = select(KnowledgeSourceORM).where(
                KnowledgeSourceORM.company_id == instance.company_id,
                KnowledgeSourceORM.instance_id == instance.instance_id,
            )
            if source_kind is not None:
                stmt = stmt.where(KnowledgeSourceORM.source_kind == source_kind)
            if status is not None:
                stmt = stmt.where(KnowledgeSourceORM.status == status)
            rows = session.execute(stmt.order_by(KnowledgeSourceORM.updated_at.desc()).limit(max(1, min(limit, 200)))).scalars().all()
            return [self._sanitize_source(self._source_summary(session, row), actor=actor) for row in rows]

    def get_source(self, *, instance: InstanceRecord, actor: AuthenticatedAdmin, source_id: str) -> KnowledgeSourceDetail:
        with self._session_factory() as session:
            row = self._load_source(session, instance=instance, source_id=source_id)
            summary = self._sanitize_source(self._source_summary(session, row), actor=actor)
            contacts = [
                self._sanitize_contact(self._contact_summary(session, item), actor=actor)
                for item in session.execute(
                    select(ContactORM).where(
                        ContactORM.company_id == instance.company_id,
                        ContactORM.source_id == source_id,
                    ).order_by(ContactORM.updated_at.desc()).limit(10),
                ).scalars().all()
            ]
            memory_entries = [
                self._sanitize_memory(self._memory_summary(item), actor=actor)
                for item in session.execute(
                    select(MemoryEntryORM).where(
                        MemoryEntryORM.company_id == instance.company_id,
                        MemoryEntryORM.source_id == source_id,
                    ).order_by(MemoryEntryORM.updated_at.desc()).limit(10),
                ).scalars().all()
            ]
            contact_refs = [item.contact_ref for item in session.execute(
                select(ContactORM).where(
                    ContactORM.company_id == instance.company_id,
                    ContactORM.source_id == source_id,
                ),
            ).scalars().all()]
            conversation_ids = set(self._source_conversation_ids_for_contact_refs(session, instance=instance, contact_refs=contact_refs))
            conversation_ids.update(item.conversation_id for item in memory_entries if item.conversation_id)
            conversation_rows = []
            if conversation_ids:
                conversation_rows = session.execute(
                    select(ConversationORM).where(
                        ConversationORM.company_id == instance.company_id,
                        ConversationORM.instance_id == instance.instance_id,
                        ConversationORM.id.in_(conversation_ids),
                    ).order_by(ConversationORM.updated_at.desc()).limit(10),
                ).scalars().all()
            linked_conversations = [
                self._record_link(record_id=item.id, label=item.subject, status=item.status)
                for item in conversation_rows
            ]
            skill_rows = [
                skill
                for skill in session.execute(
                    select(SkillORM).where(
                        SkillORM.company_id == instance.company_id,
                        SkillORM.instance_id == instance.instance_id,
                    ).order_by(SkillORM.updated_at.desc()),
                ).scalars().all()
                if self._skill_matches_source(skill, source_id)
            ][:10]
            linked_skills = [
                self._record_link(record_id=item.id, label=item.display_name, status=item.status)
                for item in skill_rows
            ]
            connector_fields = self._source_connector_fields(
                row,
                redacted=not self._can_view_sensitive(actor) and summary.visibility_scope in {"personal", "restricted"},
            )
            recall_vs_memory_note = (
                "Source recall stays connector-backed and can drift after the next sync. Durable Memory is the governed, operator-correctable layer for facts that must outlive connector state."
            )
            return KnowledgeSourceDetail(
                **summary.model_dump(),
                contacts=contacts,
                memory_entries=memory_entries,
                connector_fields=connector_fields,
                linked_conversations=linked_conversations,
                linked_skills=linked_skills,
                recall_vs_memory_note=recall_vs_memory_note,
            )

    def create_source(self, *, instance: InstanceRecord, payload: CreateKnowledgeSource) -> KnowledgeSourceDetail:
        with self._session_factory() as session, session.begin():
            source_id = payload.source_id or self._new_id("source")
            if session.get(KnowledgeSourceORM, source_id) is not None:
                raise ValueError(f"Knowledge source '{source_id}' already exists.")
            session.add(
                KnowledgeSourceORM(
                    id=source_id,
                    instance_id=instance.instance_id,
                    company_id=instance.company_id,
                    source_kind=payload.source_kind,
                    label=payload.label.strip(),
                    description=payload.description.strip(),
                    connection_target=payload.connection_target.strip(),
                    status=payload.status,
                    visibility_scope=payload.visibility_scope,
                    last_synced_at=payload.last_synced_at,
                    last_error=payload.last_error,
                    metadata_json=dict(payload.metadata),
                    created_at=self._now(),
                    updated_at=self._now(),
                ),
            )
        return self.get_source(instance=instance, actor=AuthenticatedAdmin(
            session_id="system",
            user_id="system",
            username="system",
            display_name="system",
            role="admin",
        ), source_id=source_id)

    def update_source(self, *, instance: InstanceRecord, source_id: str, payload: UpdateKnowledgeSource) -> KnowledgeSourceDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_source(session, instance=instance, source_id=source_id)
            fields_set = payload.model_fields_set
            if "label" in fields_set:
                candidate_label = (payload.label or "").strip()
                if not candidate_label:
                    raise ValueError("Knowledge source label cannot be empty.")
                row.label = candidate_label
            if "description" in fields_set:
                row.description = (payload.description or "").strip()
            if "connection_target" in fields_set:
                candidate_target = (payload.connection_target or "").strip()
                if not candidate_target:
                    raise ValueError("Connection target cannot be empty.")
                row.connection_target = candidate_target
            if "status" in fields_set and payload.status is not None:
                row.status = payload.status
            if "visibility_scope" in fields_set and payload.visibility_scope is not None:
                row.visibility_scope = payload.visibility_scope
            if "last_synced_at" in fields_set:
                row.last_synced_at = payload.last_synced_at
            if "last_error" in fields_set:
                row.last_error = payload.last_error
            if "metadata" in fields_set:
                row.metadata_json = dict(payload.metadata or {})
            row.updated_at = self._now()
        return self.get_source(instance=instance, actor=AuthenticatedAdmin(
            session_id="system",
            user_id="system",
            username="system",
            display_name="system",
            role="admin",
        ), source_id=source_id)

    def list_memory(
        self,
        *,
        instance: InstanceRecord,
        actor: AuthenticatedAdmin,
        status: str | None = None,
        visibility_scope: str | None = None,
        limit: int = 100,
    ) -> list[MemorySummary]:
        with self._session_factory() as session:
            stmt = select(MemoryEntryORM).where(
                MemoryEntryORM.company_id == instance.company_id,
                MemoryEntryORM.instance_id == instance.instance_id,
            )
            if status is not None:
                stmt = stmt.where(MemoryEntryORM.status == status)
            if visibility_scope is not None:
                stmt = stmt.where(MemoryEntryORM.visibility_scope == visibility_scope)
            rows = session.execute(stmt.order_by(MemoryEntryORM.updated_at.desc()).limit(max(1, min(limit, 200)))).scalars().all()
            return [self._sanitize_memory(self._memory_summary(row), actor=actor) for row in rows]

    def get_memory(self, *, instance: InstanceRecord, actor: AuthenticatedAdmin, memory_id: str) -> MemoryDetail:
        with self._session_factory() as session:
            row = self._load_memory(session, instance=instance, memory_id=memory_id)
            summary = self._sanitize_memory(self._memory_summary(row), actor=actor)
            source = self._sanitize_source(self._source_summary(session, self._load_source(session, instance=instance, source_id=row.source_id)), actor=actor) if row.source_id else None
            contact = self._sanitize_contact(self._contact_summary(session, self._load_contact(session, instance=instance, contact_id=row.contact_id)), actor=actor) if row.contact_id else None
            conversation = None
            if row.conversation_id:
                conversation_row = self._load_conversation(session, instance=instance, conversation_id=row.conversation_id)
                conversation = self._record_link(conversation_row.id, conversation_row.subject, conversation_row.status)
            task = None
            if row.task_id:
                task_row = self._load_task(session, instance=instance, task_id=row.task_id)
                task = self._record_link(task_row.id, task_row.title, task_row.status)
            notification = None
            if row.notification_id:
                notification_row = self._load_notification(session, instance=instance, notification_id=row.notification_id)
                notification = self._record_link(notification_row.id, notification_row.title, notification_row.delivery_status)
            workspace = None
            if row.workspace_id:
                workspace_row = self._load_workspace(session, instance=instance, workspace_id=row.workspace_id)
                workspace = self._record_link(workspace_row.id, workspace_row.title, workspace_row.status)
            return MemoryDetail(**summary.model_dump(), source=source, contact=contact, conversation=conversation, task=task, notification=notification, workspace=workspace)

    def create_memory(self, *, instance: InstanceRecord, payload: CreateMemory) -> MemoryDetail:
        if payload.expires_at is not None and payload.expires_at <= self._now():
            raise ValueError("Memory expiry must lie in the future.")
        with self._session_factory() as session, session.begin():
            self._validate_memory_links(
                session,
                instance=instance,
                source_id=payload.source_id,
                contact_id=payload.contact_id,
                conversation_id=payload.conversation_id,
                task_id=payload.task_id,
                notification_id=payload.notification_id,
                workspace_id=payload.workspace_id,
            )
            memory_id = payload.memory_id or self._new_id("memory")
            if session.get(MemoryEntryORM, memory_id) is not None:
                raise ValueError(f"Memory entry '{memory_id}' already exists.")
            session.add(
                MemoryEntryORM(
                    id=memory_id,
                    instance_id=instance.instance_id,
                    company_id=instance.company_id,
                    source_id=payload.source_id,
                    contact_id=payload.contact_id,
                    conversation_id=payload.conversation_id,
                    task_id=payload.task_id,
                    notification_id=payload.notification_id,
                    workspace_id=payload.workspace_id,
                    memory_kind=payload.memory_kind,
                    title=payload.title.strip(),
                    body=payload.body.strip(),
                    status="active",
                    truth_state="active",
                    source_trust_class=payload.source_trust_class,
                    visibility_scope=payload.visibility_scope,
                    sensitivity=payload.sensitivity,
                    correction_note=payload.correction_note,
                    learned_from_event_id=payload.learned_from_event_id,
                    human_override=payload.human_override,
                    expires_at=payload.expires_at,
                    metadata_json=dict(payload.metadata),
                    created_at=self._now(),
                    updated_at=self._now(),
                ),
            )
        return self.get_memory(instance=instance, actor=AuthenticatedAdmin(
            session_id="system",
            user_id="system",
            username="system",
            display_name="system",
            role="admin",
        ), memory_id=memory_id)

    def update_memory(self, *, instance: InstanceRecord, memory_id: str, payload: UpdateMemory) -> MemoryDetail:
        if payload.expires_at is not None and payload.expires_at <= self._now():
            raise ValueError("Memory expiry must lie in the future.")
        with self._session_factory() as session, session.begin():
            row = self._load_memory(session, instance=instance, memory_id=memory_id)
            if row.status != "active":
                raise ValueError("Only active memory entries can be updated.")
            source_id = payload.source_id if payload.source_id is not None else row.source_id
            contact_id = payload.contact_id if payload.contact_id is not None else row.contact_id
            conversation_id = payload.conversation_id if payload.conversation_id is not None else row.conversation_id
            task_id = payload.task_id if payload.task_id is not None else row.task_id
            notification_id = payload.notification_id if payload.notification_id is not None else row.notification_id
            workspace_id = payload.workspace_id if payload.workspace_id is not None else row.workspace_id
            self._validate_memory_links(
                session,
                instance=instance,
                source_id=source_id,
                contact_id=contact_id,
                conversation_id=conversation_id,
                task_id=task_id,
                notification_id=notification_id,
                workspace_id=workspace_id,
            )
            row.source_id = source_id
            row.contact_id = contact_id
            row.conversation_id = conversation_id
            row.task_id = task_id
            row.notification_id = notification_id
            row.workspace_id = workspace_id
            row.memory_kind = payload.memory_kind or row.memory_kind
            row.title = payload.title.strip() if payload.title is not None else row.title
            row.body = payload.body.strip() if payload.body is not None else row.body
            row.visibility_scope = payload.visibility_scope or row.visibility_scope
            row.sensitivity = payload.sensitivity or row.sensitivity
            row.source_trust_class = payload.source_trust_class or row.source_trust_class
            row.correction_note = payload.correction_note if payload.correction_note is not None else row.correction_note
            row.learned_from_event_id = payload.learned_from_event_id if payload.learned_from_event_id is not None else row.learned_from_event_id
            row.human_override = payload.human_override if payload.human_override is not None else row.human_override
            row.expires_at = payload.expires_at if payload.expires_at is not None else row.expires_at
            row.metadata_json = dict(payload.metadata) if payload.metadata is not None else dict(row.metadata_json or {})
            row.updated_at = self._now()
        return self.get_memory(instance=instance, actor=AuthenticatedAdmin(
            session_id="system",
            user_id="system",
            username="system",
            display_name="system",
            role="admin",
        ), memory_id=memory_id)

    def correct_memory(self, *, instance: InstanceRecord, memory_id: str, payload: CorrectMemory) -> MemoryActionResult:
        if payload.expires_at is not None and payload.expires_at <= self._now():
            raise ValueError("Corrected memory expiry must lie in the future.")
        with self._session_factory() as session, session.begin():
            row = self._load_memory(session, instance=instance, memory_id=memory_id)
            if row.status != "active":
                raise ValueError("Only active memory entries can be corrected.")
            now = self._now()
            corrected_memory_id = self._new_id("memory")
            row.status = "corrected"
            row.truth_state = "superseded"
            row.correction_note = payload.correction_note
            row.human_override = True
            row.updated_at = now
            session.add(
                MemoryEntryORM(
                    id=corrected_memory_id,
                    instance_id=row.instance_id,
                    company_id=row.company_id,
                    source_id=row.source_id,
                    contact_id=row.contact_id,
                    conversation_id=row.conversation_id,
                    task_id=row.task_id,
                    notification_id=row.notification_id,
                    workspace_id=row.workspace_id,
                    memory_kind=payload.memory_kind or row.memory_kind,
                    title=payload.title.strip(),
                    body=payload.body.strip(),
                    status="active",
                    truth_state="active",
                    source_trust_class=payload.source_trust_class or "human_verified",
                    visibility_scope=payload.visibility_scope or row.visibility_scope,
                    sensitivity=payload.sensitivity or row.sensitivity,
                    correction_note=payload.correction_note,
                    supersedes_memory_id=row.id,
                    learned_from_event_id=row.learned_from_event_id,
                    human_override=True,
                    expires_at=payload.expires_at if payload.expires_at is not None else row.expires_at,
                    metadata_json=dict(payload.metadata) if payload.metadata is not None else dict(row.metadata_json or {}),
                    created_at=now,
                    updated_at=now,
                ),
            )
        memory = self.get_memory(instance=instance, actor=AuthenticatedAdmin(
            session_id="system",
            user_id="system",
            username="system",
            display_name="system",
            role="admin",
        ), memory_id=corrected_memory_id)
        return MemoryActionResult(memory=memory, action="correct")

    def delete_memory(self, *, instance: InstanceRecord, memory_id: str, payload: DeleteMemory) -> MemoryActionResult:
        with self._session_factory() as session, session.begin():
            row = self._load_memory(session, instance=instance, memory_id=memory_id)
            now = self._now()
            row.status = "deleted"
            row.truth_state = "deleted"
            row.deleted_at = now
            if payload.deletion_note:
                row.correction_note = payload.deletion_note
            row.updated_at = now
        memory = self.get_memory(instance=instance, actor=AuthenticatedAdmin(
            session_id="system",
            user_id="system",
            username="system",
            display_name="system",
            role="admin",
        ), memory_id=memory_id)
        return MemoryActionResult(memory=memory, action="delete")

    def revoke_memory(self, *, instance: InstanceRecord, memory_id: str, payload: RevokeMemory) -> MemoryActionResult:
        with self._session_factory() as session, session.begin():
            row = self._load_memory(session, instance=instance, memory_id=memory_id)
            if row.status == "deleted":
                raise ValueError("Deleted memory entries cannot be revoked.")
            row.truth_state = "revoked"
            row.correction_note = payload.revocation_note
            row.human_override = True
            row.updated_at = self._now()
        memory = self.get_memory(instance=instance, actor=AuthenticatedAdmin(
            session_id="system",
            user_id="system",
            username="system",
            display_name="system",
            role="admin",
        ), memory_id=memory_id)
        return MemoryActionResult(memory=memory, action="revoke")
