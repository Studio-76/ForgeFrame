"""Admin-facing work interaction service for conversations, thread history, and inbox triage."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.approvals.models import parse_shared_approval_id
from app.conversations.models import (
    AppendConversationMessage,
    ConversationDetail,
    ConversationMessageRecord,
    ConversationSessionRecord,
    ConversationSummary,
    ConversationThreadSummary,
    CreateConversation,
    CreateInboxItem,
    InboxDetail,
    InboxSummary,
    UpdateConversation,
    UpdateInboxItem,
)
from app.instances.models import InstanceRecord
from app.storage.artifact_repository import ArtifactORM
from app.storage.conversation_repository import (
    ConversationMessageORM,
    ConversationORM,
    ConversationSessionORM,
    ConversationThreadORM,
    InboxItemORM,
)
from app.storage.execution_repository import RunApprovalLinkORM, RunORM
from app.storage.workspace_repository import WorkspaceORM

SessionFactory = Callable[[], Session]


class ConversationInboxAdminService:
    def __init__(self, session_factory: SessionFactory) -> None:
        self._session_factory = session_factory

    @staticmethod
    def _now() -> datetime:
        return datetime.now(tz=UTC)

    @staticmethod
    def _new_id(prefix: str) -> str:
        return f"{prefix}_{uuid4().hex[:24]}"

    @staticmethod
    def _normalize_approval_id(approval_id: str) -> str:
        source_kind, parts = parse_shared_approval_id(approval_id)
        if source_kind == "execution_run":
            return parts["approval_id"]
        return approval_id

    @staticmethod
    def _message_record(row: ConversationMessageORM) -> ConversationMessageRecord:
        return ConversationMessageRecord(
            message_id=row.id,
            conversation_id=row.conversation_id,
            thread_id=row.thread_id,
            session_id=row.session_id,
            message_role=row.message_role,  # type: ignore[arg-type]
            author_type=row.author_type,
            author_id=row.author_id,
            body=row.body,
            structured_payload=dict(row.structured_payload_json or {}),
            created_at=row.created_at,
        )

    @staticmethod
    def _session_record(session_row: ConversationSessionORM, *, message_count: int) -> ConversationSessionRecord:
        return ConversationSessionRecord(
            session_id=session_row.id,
            conversation_id=session_row.conversation_id,
            thread_id=session_row.thread_id,
            session_kind=session_row.session_kind,  # type: ignore[arg-type]
            continuity_key=session_row.continuity_key,
            started_by_type=session_row.started_by_type,
            started_by_id=session_row.started_by_id,
            message_count=message_count,
            metadata=dict(session_row.metadata_json or {}),
            started_at=session_row.started_at,
            ended_at=session_row.ended_at,
        )

    @staticmethod
    def _thread_summary(row: ConversationThreadORM, *, message_count: int, session_count: int) -> ConversationThreadSummary:
        return ConversationThreadSummary(
            thread_id=row.id,
            conversation_id=row.conversation_id,
            title=row.title,
            status=row.status,  # type: ignore[arg-type]
            latest_message_at=row.latest_message_at,
            message_count=message_count,
            session_count=session_count,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    def _inbox_summary(row: InboxItemORM) -> InboxSummary:
        return InboxSummary(
            inbox_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            conversation_id=row.conversation_id,
            thread_id=row.thread_id,
            workspace_id=row.workspace_id,
            title=row.title,
            summary=row.summary,
            triage_status=row.triage_status,  # type: ignore[arg-type]
            priority=row.priority,  # type: ignore[arg-type]
            status=row.status,  # type: ignore[arg-type]
            contact_ref=row.contact_ref,
            run_id=row.run_id,
            artifact_id=row.artifact_id,
            approval_id=row.approval_id,
            decision_id=row.decision_id,
            metadata=dict(row.metadata_json or {}),
            latest_message_at=row.latest_message_at,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def _conversation_summary(self, session: Session, row: ConversationORM) -> ConversationSummary:
        thread_count = session.scalar(
            select(func.count()).select_from(ConversationThreadORM).where(
                ConversationThreadORM.company_id == row.company_id,
                ConversationThreadORM.conversation_id == row.id,
            )
        ) or 0
        session_count = session.scalar(
            select(func.count()).select_from(ConversationSessionORM).where(
                ConversationSessionORM.company_id == row.company_id,
                ConversationSessionORM.conversation_id == row.id,
            )
        ) or 0
        message_count = session.scalar(
            select(func.count()).select_from(ConversationMessageORM).where(
                ConversationMessageORM.company_id == row.company_id,
                ConversationMessageORM.conversation_id == row.id,
            )
        ) or 0
        inbox_count = session.scalar(
            select(func.count()).select_from(InboxItemORM).where(
                InboxItemORM.company_id == row.company_id,
                InboxItemORM.conversation_id == row.id,
            )
        ) or 0
        return ConversationSummary(
            conversation_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            workspace_id=row.workspace_id,
            subject=row.subject,
            summary=row.summary,
            status=row.status,  # type: ignore[arg-type]
            triage_status=row.triage_status,  # type: ignore[arg-type]
            priority=row.priority,  # type: ignore[arg-type]
            contact_ref=row.contact_ref,
            run_id=row.run_id,
            artifact_id=row.artifact_id,
            approval_id=row.approval_id,
            decision_id=row.decision_id,
            metadata=dict(row.metadata_json or {}),
            active_thread_id=row.active_thread_id,
            thread_count=int(thread_count),
            session_count=int(session_count),
            message_count=int(message_count),
            inbox_count=int(inbox_count),
            latest_message_at=row.latest_message_at,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    def _ensure_workspace_exists(session: Session, *, company_id: str, workspace_id: str) -> None:
        row = session.get(WorkspaceORM, workspace_id)
        if row is None or row.company_id != company_id:
            raise ValueError(f"Workspace '{workspace_id}' was not found.")

    @staticmethod
    def _ensure_run_exists(session: Session, *, company_id: str, run_id: str) -> None:
        row = session.get(RunORM, run_id)
        if row is None or row.company_id != company_id:
            raise ValueError(f"Run '{run_id}' was not found.")

    @staticmethod
    def _ensure_artifact_exists(session: Session, *, company_id: str, artifact_id: str) -> None:
        row = session.get(ArtifactORM, artifact_id)
        if row is None or row.company_id != company_id:
            raise ValueError(f"Artifact '{artifact_id}' was not found.")

    def _ensure_execution_approval_exists(self, session: Session, *, company_id: str, approval_id: str) -> None:
        native_approval_id = self._normalize_approval_id(approval_id)
        row = session.execute(
            select(RunApprovalLinkORM).where(
                RunApprovalLinkORM.company_id == company_id,
                RunApprovalLinkORM.approval_id == native_approval_id,
            )
        ).scalar_one_or_none()
        if row is None:
            raise ValueError(f"Approval '{approval_id}' was not found.")

    def _validate_links(
        self,
        session: Session,
        *,
        instance: InstanceRecord,
        workspace_id: str | None = None,
        run_id: str | None = None,
        artifact_id: str | None = None,
        approval_id: str | None = None,
    ) -> None:
        if workspace_id:
            self._ensure_workspace_exists(session, company_id=instance.company_id, workspace_id=workspace_id)
        if run_id:
            self._ensure_run_exists(session, company_id=instance.company_id, run_id=run_id)
        if artifact_id:
            self._ensure_artifact_exists(session, company_id=instance.company_id, artifact_id=artifact_id)
        if approval_id:
            self._ensure_execution_approval_exists(session, company_id=instance.company_id, approval_id=approval_id)

    @staticmethod
    def _load_conversation(
        session: Session,
        *,
        instance: InstanceRecord,
        conversation_id: str,
    ) -> ConversationORM:
        conversation = session.get(ConversationORM, conversation_id)
        if conversation is None or conversation.company_id != instance.company_id or conversation.instance_id != instance.instance_id:
            raise ValueError(f"Conversation '{conversation_id}' was not found.")
        return conversation

    @staticmethod
    def _load_thread(
        session: Session,
        *,
        company_id: str,
        thread_id: str,
    ) -> ConversationThreadORM:
        thread = session.get(ConversationThreadORM, thread_id)
        if thread is None or thread.company_id != company_id:
            raise ValueError(f"Thread '{thread_id}' was not found.")
        return thread

    def list_conversations(
        self,
        *,
        instance: InstanceRecord,
        status: str | None = None,
        triage_status: str | None = None,
        limit: int = 100,
    ) -> list[ConversationSummary]:
        with self._session_factory() as session:
            stmt = select(ConversationORM).where(
                ConversationORM.company_id == instance.company_id,
                ConversationORM.instance_id == instance.instance_id,
            )
            if status is not None:
                stmt = stmt.where(ConversationORM.status == status)
            if triage_status is not None:
                stmt = stmt.where(ConversationORM.triage_status == triage_status)
            rows = session.execute(
                stmt.order_by(ConversationORM.updated_at.desc()).limit(max(1, min(limit, 200)))
            ).scalars().all()
            return [self._conversation_summary(session, row) for row in rows]

    def get_conversation(self, *, instance: InstanceRecord, conversation_id: str) -> ConversationDetail:
        with self._session_factory() as session:
            row = self._load_conversation(session, instance=instance, conversation_id=conversation_id)

            summary = self._conversation_summary(session, row)
            thread_rows = session.execute(
                select(ConversationThreadORM)
                .where(
                    ConversationThreadORM.company_id == instance.company_id,
                    ConversationThreadORM.conversation_id == conversation_id,
                )
                .order_by(ConversationThreadORM.updated_at.desc())
            ).scalars().all()
            session_rows = session.execute(
                select(ConversationSessionORM)
                .where(
                    ConversationSessionORM.company_id == instance.company_id,
                    ConversationSessionORM.conversation_id == conversation_id,
                )
                .order_by(ConversationSessionORM.started_at.desc())
            ).scalars().all()
            message_rows = session.execute(
                select(ConversationMessageORM)
                .where(
                    ConversationMessageORM.company_id == instance.company_id,
                    ConversationMessageORM.conversation_id == conversation_id,
                )
                .order_by(ConversationMessageORM.created_at.desc())
            ).scalars().all()
            inbox_rows = session.execute(
                select(InboxItemORM)
                .where(
                    InboxItemORM.company_id == instance.company_id,
                    InboxItemORM.conversation_id == conversation_id,
                )
                .order_by(InboxItemORM.updated_at.desc())
            ).scalars().all()

            return ConversationDetail(
                **summary.model_dump(),
                threads=[
                    self._thread_summary(
                        thread,
                        message_count=int(session.scalar(
                            select(func.count()).select_from(ConversationMessageORM).where(
                                ConversationMessageORM.company_id == instance.company_id,
                                ConversationMessageORM.thread_id == thread.id,
                            )
                        ) or 0),
                        session_count=int(session.scalar(
                            select(func.count()).select_from(ConversationSessionORM).where(
                                ConversationSessionORM.company_id == instance.company_id,
                                ConversationSessionORM.thread_id == thread.id,
                            )
                        ) or 0),
                    )
                    for thread in thread_rows
                ],
                sessions=[
                    self._session_record(
                        session_row,
                        message_count=int(session.scalar(
                            select(func.count()).select_from(ConversationMessageORM).where(
                                ConversationMessageORM.company_id == instance.company_id,
                                ConversationMessageORM.session_id == session_row.id,
                            )
                        ) or 0),
                    )
                    for session_row in session_rows
                ],
                messages=[self._message_record(message) for message in message_rows],
                inbox_items=[self._inbox_summary(item) for item in inbox_rows],
            )

    def _create_inbox_row(
        self,
        session: Session,
        *,
        instance: InstanceRecord,
        conversation_id: str | None,
        thread_id: str | None,
        workspace_id: str | None,
        title: str,
        summary: str,
        triage_status: str,
        priority: str,
        status: str,
        contact_ref: str | None,
        run_id: str | None,
        artifact_id: str | None,
        approval_id: str | None,
        decision_id: str | None,
        metadata: dict[str, object],
        latest_message_at: datetime | None,
    ) -> InboxItemORM:
        now = self._now()
        row = InboxItemORM(
            id=self._new_id("inbox"),
            instance_id=instance.instance_id,
            company_id=instance.company_id,
            conversation_id=conversation_id,
            thread_id=thread_id,
            workspace_id=workspace_id,
            title=title,
            summary=summary,
            triage_status=triage_status,
            priority=priority,
            status=status,
            contact_ref=contact_ref,
            run_id=run_id,
            artifact_id=artifact_id,
            approval_id=approval_id,
            decision_id=decision_id,
            latest_message_at=latest_message_at,
            metadata_json=dict(metadata),
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        return row

    def create_conversation(
        self,
        *,
        instance: InstanceRecord,
        payload: CreateConversation,
        actor_type: str,
        actor_id: str | None,
    ) -> ConversationDetail:
        with self._session_factory() as session, session.begin():
            self._validate_links(
                session,
                instance=instance,
                workspace_id=payload.workspace_id,
                run_id=payload.run_id,
                artifact_id=payload.artifact_id,
                approval_id=payload.approval_id,
            )
            conversation_id = (payload.conversation_id or "").strip() or self._new_id("conversation")
            existing = session.get(ConversationORM, conversation_id)
            if existing is not None and existing.company_id == instance.company_id:
                raise ValueError(f"Conversation '{conversation_id}' already exists.")

            now = self._now()
            thread_id = self._new_id("thread")
            session_id = self._new_id("session")
            row = ConversationORM(
                id=conversation_id,
                instance_id=instance.instance_id,
                company_id=instance.company_id,
                workspace_id=payload.workspace_id,
                subject=payload.subject.strip(),
                summary=payload.summary.strip(),
                status=payload.status,
                triage_status=payload.triage_status,
                priority=payload.priority,
                contact_ref=payload.contact_ref,
                run_id=payload.run_id,
                artifact_id=payload.artifact_id,
                approval_id=payload.approval_id,
                decision_id=payload.decision_id,
                active_thread_id=thread_id,
                latest_message_at=now,
                metadata_json=dict(payload.metadata),
                created_at=now,
                updated_at=now,
            )
            session.add(row)
            session.add(
                ConversationThreadORM(
                    id=thread_id,
                    company_id=instance.company_id,
                    conversation_id=conversation_id,
                    title=payload.initial_thread_title.strip(),
                    status="open",
                    latest_message_at=now,
                    created_at=now,
                    updated_at=now,
                )
            )
            session.add(
                ConversationSessionORM(
                    id=session_id,
                    company_id=instance.company_id,
                    conversation_id=conversation_id,
                    thread_id=thread_id,
                    session_kind=payload.initial_session_kind,
                    continuity_key=payload.initial_continuity_key,
                    started_by_type=actor_type,
                    started_by_id=actor_id,
                    metadata_json={},
                    started_at=now,
                )
            )
            session.add(
                ConversationMessageORM(
                    id=self._new_id("message"),
                    company_id=instance.company_id,
                    conversation_id=conversation_id,
                    thread_id=thread_id,
                    session_id=session_id,
                    message_role=payload.initial_message_role,
                    author_type=actor_type,
                    author_id=actor_id,
                    body=payload.initial_message_body.strip(),
                    structured_payload_json={},
                    created_at=now,
                )
            )
            if payload.create_inbox_entry:
                self._create_inbox_row(
                    session,
                    instance=instance,
                    conversation_id=conversation_id,
                    thread_id=thread_id,
                    workspace_id=payload.workspace_id,
                    title=(payload.inbox_title or payload.subject).strip(),
                    summary=(payload.inbox_summary or payload.summary or payload.initial_message_body).strip(),
                    triage_status=payload.triage_status,
                    priority=payload.priority,
                    status="open",
                    contact_ref=payload.contact_ref,
                    run_id=payload.run_id,
                    artifact_id=payload.artifact_id,
                    approval_id=payload.approval_id,
                    decision_id=payload.decision_id,
                    metadata={},
                    latest_message_at=now,
                )
        return self.get_conversation(instance=instance, conversation_id=conversation_id)

    def update_conversation(
        self,
        *,
        instance: InstanceRecord,
        conversation_id: str,
        payload: UpdateConversation,
    ) -> ConversationDetail:
        with self._session_factory() as session, session.begin():
            row = session.get(ConversationORM, conversation_id)
            if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
                raise ValueError(f"Conversation '{conversation_id}' was not found.")

            self._validate_links(
                session,
                instance=instance,
                workspace_id=payload.workspace_id if payload.workspace_id is not None else row.workspace_id,
                run_id=payload.run_id if payload.run_id is not None else row.run_id,
                artifact_id=payload.artifact_id if payload.artifact_id is not None else row.artifact_id,
                approval_id=payload.approval_id if payload.approval_id is not None else row.approval_id,
            )
            if payload.active_thread_id is not None:
                thread = session.get(ConversationThreadORM, payload.active_thread_id)
                if thread is None or thread.company_id != instance.company_id or thread.conversation_id != conversation_id:
                    raise ValueError(f"Thread '{payload.active_thread_id}' was not found.")

            row.subject = payload.subject.strip() if payload.subject is not None else row.subject
            row.summary = payload.summary.strip() if payload.summary is not None else row.summary
            row.workspace_id = payload.workspace_id if payload.workspace_id is not None else row.workspace_id
            row.status = payload.status or row.status
            row.triage_status = payload.triage_status or row.triage_status
            row.priority = payload.priority or row.priority
            row.contact_ref = payload.contact_ref if payload.contact_ref is not None else row.contact_ref
            row.run_id = payload.run_id if payload.run_id is not None else row.run_id
            row.artifact_id = payload.artifact_id if payload.artifact_id is not None else row.artifact_id
            row.approval_id = payload.approval_id if payload.approval_id is not None else row.approval_id
            row.decision_id = payload.decision_id if payload.decision_id is not None else row.decision_id
            row.active_thread_id = payload.active_thread_id if payload.active_thread_id is not None else row.active_thread_id
            row.metadata_json = dict(payload.metadata) if payload.metadata is not None else dict(row.metadata_json or {})
            row.updated_at = self._now()
        return self.get_conversation(instance=instance, conversation_id=conversation_id)

    def append_message(
        self,
        *,
        instance: InstanceRecord,
        conversation_id: str,
        payload: AppendConversationMessage,
        actor_type: str,
        actor_id: str | None,
    ) -> ConversationDetail:
        with self._session_factory() as session, session.begin():
            conversation = session.get(ConversationORM, conversation_id)
            if conversation is None or conversation.company_id != instance.company_id or conversation.instance_id != instance.instance_id:
                raise ValueError(f"Conversation '{conversation_id}' was not found.")

            thread: ConversationThreadORM | None = None
            if payload.thread_id is not None:
                thread = self._load_thread(session, company_id=instance.company_id, thread_id=payload.thread_id)
                if thread.conversation_id != conversation_id:
                    raise ValueError(f"Thread '{payload.thread_id}' was not found.")
            elif conversation.active_thread_id:
                thread = session.get(ConversationThreadORM, conversation.active_thread_id)

            now = self._now()
            if thread is None:
                thread = ConversationThreadORM(
                    id=self._new_id("thread"),
                    company_id=instance.company_id,
                    conversation_id=conversation_id,
                    title=(payload.thread_title or "Follow-up").strip(),
                    status="open",
                    latest_message_at=now,
                    created_at=now,
                    updated_at=now,
                )
                session.add(thread)
                conversation.active_thread_id = thread.id

            session_row: ConversationSessionORM | None = None
            if payload.session_id is not None:
                session_row = session.get(ConversationSessionORM, payload.session_id)
                if session_row is None or session_row.company_id != instance.company_id or session_row.conversation_id != conversation_id:
                    raise ValueError(f"Session '{payload.session_id}' was not found.")
                if thread is not None and session_row.thread_id != thread.id:
                    raise ValueError(
                        f"Session '{payload.session_id}' does not belong to thread '{thread.id}'."
                    )
            elif payload.start_new_session or conversation.latest_message_at is None:
                session_row = ConversationSessionORM(
                    id=self._new_id("session"),
                    company_id=instance.company_id,
                    conversation_id=conversation_id,
                    thread_id=thread.id,
                    session_kind=payload.session_kind,
                    continuity_key=payload.continuity_key,
                    started_by_type=actor_type,
                    started_by_id=actor_id,
                    metadata_json={},
                    started_at=now,
                )
                session.add(session_row)
            else:
                session_row = session.execute(
                    select(ConversationSessionORM)
                    .where(
                        ConversationSessionORM.company_id == instance.company_id,
                        ConversationSessionORM.thread_id == thread.id,
                    )
                    .order_by(ConversationSessionORM.started_at.desc())
                ).scalars().first()
                if session_row is None:
                    session_row = ConversationSessionORM(
                        id=self._new_id("session"),
                        company_id=instance.company_id,
                        conversation_id=conversation_id,
                        thread_id=thread.id,
                        session_kind=payload.session_kind,
                        continuity_key=payload.continuity_key,
                        started_by_type=actor_type,
                        started_by_id=actor_id,
                        metadata_json={},
                        started_at=now,
                    )
                    session.add(session_row)

            session.add(
                ConversationMessageORM(
                    id=self._new_id("message"),
                    company_id=instance.company_id,
                    conversation_id=conversation_id,
                    thread_id=thread.id,
                    session_id=session_row.id if session_row is not None else None,
                    message_role=payload.message_role,
                    author_type=actor_type,
                    author_id=actor_id,
                    body=payload.body.strip(),
                    structured_payload_json=dict(payload.structured_payload),
                    created_at=now,
                )
            )
            thread.latest_message_at = now
            thread.updated_at = now
            conversation.latest_message_at = now
            conversation.updated_at = now
            conversation.active_thread_id = thread.id
            for inbox_row in session.execute(
                select(InboxItemORM).where(
                    InboxItemORM.company_id == instance.company_id,
                    InboxItemORM.conversation_id == conversation_id,
                )
            ).scalars().all():
                inbox_row.latest_message_at = now
                inbox_row.updated_at = now
        return self.get_conversation(instance=instance, conversation_id=conversation_id)

    def list_inbox(
        self,
        *,
        instance: InstanceRecord,
        triage_status: str | None = None,
        status: str | None = None,
        priority: str | None = None,
        limit: int = 100,
    ) -> list[InboxSummary]:
        with self._session_factory() as session:
            stmt = select(InboxItemORM).where(
                InboxItemORM.company_id == instance.company_id,
                InboxItemORM.instance_id == instance.instance_id,
            )
            if triage_status is not None:
                stmt = stmt.where(InboxItemORM.triage_status == triage_status)
            if status is not None:
                stmt = stmt.where(InboxItemORM.status == status)
            if priority is not None:
                stmt = stmt.where(InboxItemORM.priority == priority)
            rows = session.execute(
                stmt.order_by(InboxItemORM.updated_at.desc()).limit(max(1, min(limit, 200)))
            ).scalars().all()
            return [self._inbox_summary(row) for row in rows]

    def get_inbox_item(self, *, instance: InstanceRecord, inbox_id: str) -> InboxDetail:
        with self._session_factory() as session:
            row = session.get(InboxItemORM, inbox_id)
            if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
                raise ValueError(f"Inbox item '{inbox_id}' was not found.")
            summary = self._inbox_summary(row)
            conversation = session.get(ConversationORM, row.conversation_id) if row.conversation_id else None
            return InboxDetail(
                **summary.model_dump(),
                conversation=self._conversation_summary(session, conversation) if conversation is not None else None,
            )

    def create_inbox_item(
        self,
        *,
        instance: InstanceRecord,
        payload: CreateInboxItem,
    ) -> InboxDetail:
        with self._session_factory() as session, session.begin():
            self._validate_links(
                session,
                instance=instance,
                workspace_id=payload.workspace_id,
                run_id=payload.run_id,
                artifact_id=payload.artifact_id,
                approval_id=payload.approval_id,
            )
            conversation_id = payload.conversation_id
            if conversation_id is not None:
                self._load_conversation(session, instance=instance, conversation_id=conversation_id)

            thread_id = payload.thread_id
            if thread_id is not None:
                thread = self._load_thread(session, company_id=instance.company_id, thread_id=thread_id)
                if conversation_id is not None and thread.conversation_id != conversation_id:
                    raise ValueError(
                        f"Thread '{thread_id}' does not belong to conversation '{conversation_id}'."
                    )
                if conversation_id is None:
                    conversation = self._load_conversation(session, instance=instance, conversation_id=thread.conversation_id)
                    conversation_id = conversation.id

            inbox_id = (payload.inbox_id or "").strip() or self._new_id("inbox")
            existing = session.get(InboxItemORM, inbox_id)
            if existing is not None and existing.company_id == instance.company_id:
                raise ValueError(f"Inbox item '{inbox_id}' already exists.")
            now = self._now()
            row = InboxItemORM(
                id=inbox_id,
                instance_id=instance.instance_id,
                company_id=instance.company_id,
                conversation_id=conversation_id,
                thread_id=thread_id,
                workspace_id=payload.workspace_id,
                title=payload.title.strip(),
                summary=payload.summary.strip(),
                triage_status=payload.triage_status,
                priority=payload.priority,
                status=payload.status,
                contact_ref=payload.contact_ref,
                run_id=payload.run_id,
                artifact_id=payload.artifact_id,
                approval_id=payload.approval_id,
                decision_id=payload.decision_id,
                latest_message_at=now,
                metadata_json=dict(payload.metadata),
                created_at=now,
                updated_at=now,
            )
            session.add(row)
        return self.get_inbox_item(instance=instance, inbox_id=inbox_id)

    def update_inbox_item(
        self,
        *,
        instance: InstanceRecord,
        inbox_id: str,
        payload: UpdateInboxItem,
    ) -> InboxDetail:
        with self._session_factory() as session, session.begin():
            row = session.get(InboxItemORM, inbox_id)
            if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
                raise ValueError(f"Inbox item '{inbox_id}' was not found.")
            self._validate_links(
                session,
                instance=instance,
                workspace_id=payload.workspace_id if payload.workspace_id is not None else row.workspace_id,
                run_id=payload.run_id if payload.run_id is not None else row.run_id,
                artifact_id=payload.artifact_id if payload.artifact_id is not None else row.artifact_id,
                approval_id=payload.approval_id if payload.approval_id is not None else row.approval_id,
            )
            next_conversation_id = payload.conversation_id if payload.conversation_id is not None else row.conversation_id
            if next_conversation_id is not None:
                self._load_conversation(session, instance=instance, conversation_id=next_conversation_id)

            next_thread_id = payload.thread_id if payload.thread_id is not None else row.thread_id
            if next_thread_id is not None:
                thread = self._load_thread(session, company_id=instance.company_id, thread_id=next_thread_id)
                if next_conversation_id is not None and thread.conversation_id != next_conversation_id:
                    raise ValueError(
                        f"Thread '{next_thread_id}' does not belong to conversation '{next_conversation_id}'."
                    )
                next_conversation_id = thread.conversation_id

            row.conversation_id = next_conversation_id
            row.thread_id = next_thread_id
            row.workspace_id = payload.workspace_id if payload.workspace_id is not None else row.workspace_id
            row.title = payload.title.strip() if payload.title is not None else row.title
            row.summary = payload.summary.strip() if payload.summary is not None else row.summary
            row.triage_status = payload.triage_status or row.triage_status
            row.priority = payload.priority or row.priority
            row.status = payload.status or row.status
            row.contact_ref = payload.contact_ref if payload.contact_ref is not None else row.contact_ref
            row.run_id = payload.run_id if payload.run_id is not None else row.run_id
            row.artifact_id = payload.artifact_id if payload.artifact_id is not None else row.artifact_id
            row.approval_id = payload.approval_id if payload.approval_id is not None else row.approval_id
            row.decision_id = payload.decision_id if payload.decision_id is not None else row.decision_id
            row.metadata_json = dict(payload.metadata) if payload.metadata is not None else dict(row.metadata_json or {})
            row.updated_at = self._now()
        return self.get_inbox_item(instance=instance, inbox_id=inbox_id)
