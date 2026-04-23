"""Shared admin-facing work interaction service for workspaces and artifacts."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.approvals.models import build_execution_approval_id, parse_shared_approval_id
from app.artifacts.models import ArtifactAttachmentRecord, ArtifactRecord, CreateArtifact, UpdateArtifact
from app.instances.models import InstanceRecord
from app.storage.artifact_repository import ArtifactAttachmentORM, ArtifactORM
from app.storage.execution_repository import RunApprovalLinkORM, RunORM
from app.storage.workspace_repository import WorkspaceEventORM, WorkspaceORM
from app.workspaces.models import (
    CreateWorkspace,
    UpdateWorkspace,
    WorkspaceApprovalSummary,
    WorkspaceDetail,
    WorkspaceEventRecord,
    WorkspaceEventKind,
    WorkspaceRunSummary,
    WorkspaceSummary,
)

SessionFactory = Callable[[], Session]


class WorkInteractionAdminService:
    def __init__(self, session_factory: SessionFactory) -> None:
        self._session_factory = session_factory

    @staticmethod
    def _now() -> datetime:
        return datetime.now(tz=UTC)

    @staticmethod
    def _new_id(prefix: str) -> str:
        return f"{prefix}_{uuid4().hex[:16]}"

    @staticmethod
    def _workspace_status(preview_status: str, review_status: str, handoff_status: str, *, archived: bool = False) -> str:
        if archived:
            return "archived"
        if handoff_status == "delivered":
            return "handed_off"
        if handoff_status == "ready":
            return "handoff_ready"
        if review_status in {"pending", "approved", "rejected"}:
            return "in_review"
        if preview_status in {"draft", "ready", "approved", "rejected"}:
            return "previewing"
        return "draft"

    @staticmethod
    def _workspace_update_event_kind(*, workspace: WorkspaceORM, payload: UpdateWorkspace) -> WorkspaceEventKind:
        if payload.handoff_status == "delivered":
            return "handoff_delivered"
        if payload.handoff_status == "ready":
            return "handoff_prepared"
        if payload.review_status == "approved":
            return "review_approved"
        if payload.review_status == "rejected":
            return "review_rejected"
        if payload.review_status == "pending":
            return "review_requested"
        if payload.preview_status == "ready":
            return "preview_ready"
        return "updated"

    def _artifact_attachments(self, session: Session, *, company_id: str, artifact_ids: list[str]) -> dict[str, list[ArtifactAttachmentRecord]]:
        if not artifact_ids:
            return {}
        rows = session.execute(
            select(ArtifactAttachmentORM)
            .where(ArtifactAttachmentORM.company_id == company_id, ArtifactAttachmentORM.artifact_id.in_(artifact_ids))
            .order_by(ArtifactAttachmentORM.created_at.asc())
        ).scalars().all()
        grouped: dict[str, list[ArtifactAttachmentRecord]] = {}
        for row in rows:
            grouped.setdefault(row.artifact_id, []).append(
                ArtifactAttachmentRecord(
                    attachment_id=row.id,
                    artifact_id=row.artifact_id,
                    target_kind=row.target_kind,  # type: ignore[arg-type]
                    target_id=row.target_id,
                    role=row.role,
                    created_at=row.created_at,
                )
            )
        return grouped

    def _artifact_record(self, row: ArtifactORM, *, attachments: dict[str, list[ArtifactAttachmentRecord]]) -> ArtifactRecord:
        return ArtifactRecord(
            artifact_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            workspace_id=row.workspace_id,
            artifact_type=row.artifact_type,  # type: ignore[arg-type]
            label=row.label,
            uri=row.uri,
            media_type=row.media_type,
            preview_url=row.preview_url,
            size_bytes=row.size_bytes,
            status=row.status,  # type: ignore[arg-type]
            created_by_type=row.created_by_type,
            created_by_id=row.created_by_id,
            metadata=dict(row.metadata_json or {}),
            attachments=list(attachments.get(row.id, [])),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    def _ensure_run_exists(session: Session, *, company_id: str, run_id: str) -> None:
        row = session.get(RunORM, run_id)
        if row is None or row.company_id != company_id:
            raise ValueError(f"Run '{run_id}' was not found.")

    @staticmethod
    def _ensure_workspace_exists(session: Session, *, company_id: str, workspace_id: str) -> None:
        row = session.get(WorkspaceORM, workspace_id)
        if row is None or row.company_id != company_id:
            raise ValueError(f"Workspace '{workspace_id}' was not found.")

    @staticmethod
    def _ensure_execution_approval_exists(session: Session, *, company_id: str, approval_id: str) -> None:
        source_kind, parts = parse_shared_approval_id(approval_id)
        if source_kind != "execution_run":
            raise ValueError("Only execution approval attachments are supported on instance-scoped artifacts.")
        if parts["company_id"] != company_id:
            raise ValueError(f"Approval '{approval_id}' does not belong to the current instance scope.")
        row = session.execute(
            select(RunApprovalLinkORM).where(
                RunApprovalLinkORM.company_id == company_id,
                RunApprovalLinkORM.approval_id == parts["approval_id"],
            )
        ).scalar_one_or_none()
        if row is None:
            raise ValueError(f"Approval '{approval_id}' was not found.")

    def _validate_attachment_target(
        self,
        session: Session,
        *,
        instance: InstanceRecord,
        target_kind: str,
        target_id: str,
    ) -> None:
        if target_kind == "run":
            self._ensure_run_exists(session, company_id=instance.company_id, run_id=target_id)
            return
        if target_kind == "workspace":
            self._ensure_workspace_exists(session, company_id=instance.company_id, workspace_id=target_id)
            return
        if target_kind == "approval":
            self._ensure_execution_approval_exists(session, company_id=instance.company_id, approval_id=target_id)
            return
        if target_kind == "instance":
            if target_id != instance.instance_id:
                raise ValueError(f"Instance attachment '{target_id}' does not match the current scope.")
            return

    def _list_artifact_records(
        self,
        session: Session,
        *,
        company_id: str,
        instance_id: str | None = None,
        workspace_id: str | None = None,
        target_kind: str | None = None,
        target_id: str | None = None,
        artifact_ids: list[str] | None = None,
        limit: int = 100,
    ) -> list[ArtifactRecord]:
        stmt = select(ArtifactORM).where(ArtifactORM.company_id == company_id)
        if instance_id is not None:
            stmt = stmt.where(ArtifactORM.instance_id == instance_id)
        if workspace_id is not None:
            stmt = stmt.where(ArtifactORM.workspace_id == workspace_id)
        if artifact_ids:
            stmt = stmt.where(ArtifactORM.id.in_(artifact_ids))
        if target_kind is not None and target_id is not None:
            stmt = stmt.join(
                ArtifactAttachmentORM,
                and_(
                    ArtifactAttachmentORM.company_id == ArtifactORM.company_id,
                    ArtifactAttachmentORM.artifact_id == ArtifactORM.id,
                ),
            ).where(
                ArtifactAttachmentORM.target_kind == target_kind,
                ArtifactAttachmentORM.target_id == target_id,
            )
        rows = session.execute(
            stmt.order_by(ArtifactORM.created_at.desc()).limit(max(1, min(limit, 200)))
        ).scalars().all()
        attachments = self._artifact_attachments(session, company_id=company_id, artifact_ids=[row.id for row in rows])
        return [self._artifact_record(row, attachments=attachments) for row in rows]

    def list_artifacts(
        self,
        *,
        instance: InstanceRecord,
        workspace_id: str | None = None,
        target_kind: str | None = None,
        target_id: str | None = None,
        limit: int = 100,
    ) -> list[ArtifactRecord]:
        with self._session_factory() as session:
            return self._list_artifact_records(
                session,
                company_id=instance.company_id,
                instance_id=instance.instance_id,
                workspace_id=workspace_id,
                target_kind=target_kind,
                target_id=target_id,
                limit=limit,
            )

    def get_artifact(self, *, instance: InstanceRecord, artifact_id: str) -> ArtifactRecord:
        with self._session_factory() as session:
            row = session.get(ArtifactORM, artifact_id)
            if row is None or row.company_id != instance.company_id:
                raise ValueError(f"Artifact '{artifact_id}' was not found.")
            attachments = self._artifact_attachments(session, company_id=instance.company_id, artifact_ids=[row.id])
            return self._artifact_record(row, attachments=attachments)

    def list_artifacts_for_target(self, *, company_id: str, target_kind: str, target_id: str) -> list[ArtifactRecord]:
        with self._session_factory() as session:
            return self._list_artifact_records(
                session,
                company_id=company_id,
                target_kind=target_kind,
                target_id=target_id,
                limit=200,
            )

    def _workspace_summary(self, session: Session, row: WorkspaceORM) -> WorkspaceSummary:
        artifact_count = session.execute(
            select(func.count(ArtifactORM.id)).where(
                ArtifactORM.company_id == row.company_id,
                ArtifactORM.workspace_id == row.id,
            )
        ).scalar_one()
        run_count = session.execute(
            select(func.count(RunORM.id)).where(
                RunORM.company_id == row.company_id,
                RunORM.workspace_id == row.id,
            )
        ).scalar_one()
        approval_count = session.execute(
            select(func.count(RunApprovalLinkORM.id))
            .join(
                RunORM,
                and_(
                    RunORM.id == RunApprovalLinkORM.run_id,
                    RunORM.company_id == RunApprovalLinkORM.company_id,
                ),
            )
            .where(
                RunApprovalLinkORM.company_id == row.company_id,
                RunORM.workspace_id == row.id,
            )
        ).scalar_one()
        latest_event_at = session.execute(
            select(func.max(WorkspaceEventORM.created_at)).where(
                WorkspaceEventORM.company_id == row.company_id,
                WorkspaceEventORM.workspace_id == row.id,
            )
        ).scalar_one()
        return WorkspaceSummary(
            workspace_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            issue_id=row.issue_id,
            title=row.title,
            summary=row.summary,
            status=row.status,  # type: ignore[arg-type]
            preview_status=row.preview_status,  # type: ignore[arg-type]
            review_status=row.review_status,  # type: ignore[arg-type]
            handoff_status=row.handoff_status,  # type: ignore[arg-type]
            owner_type=row.owner_type,
            owner_id=row.owner_id,
            active_run_id=row.active_run_id,
            latest_approval_id=row.latest_approval_id,
            preview_artifact_id=row.preview_artifact_id,
            handoff_artifact_id=row.handoff_artifact_id,
            pr_reference=row.pr_reference,
            handoff_reference=row.handoff_reference,
            metadata=dict(row.metadata_json or {}),
            artifact_count=int(artifact_count or 0),
            run_count=int(run_count or 0),
            approval_count=int(approval_count or 0),
            latest_event_at=latest_event_at,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def get_workspace_summary(self, *, company_id: str, workspace_id: str) -> WorkspaceSummary | None:
        with self._session_factory() as session:
            row = session.get(WorkspaceORM, workspace_id)
            if row is None or row.company_id != company_id:
                return None
            return self._workspace_summary(session, row)

    def list_workspaces(self, *, instance: InstanceRecord, status: str | None = None, limit: int = 100) -> list[WorkspaceSummary]:
        with self._session_factory() as session:
            stmt = select(WorkspaceORM).where(
                WorkspaceORM.company_id == instance.company_id,
                WorkspaceORM.instance_id == instance.instance_id,
            )
            if status is not None:
                stmt = stmt.where(WorkspaceORM.status == status)
            rows = session.execute(
                stmt.order_by(WorkspaceORM.updated_at.desc()).limit(max(1, min(limit, 200)))
            ).scalars().all()
            return [self._workspace_summary(session, row) for row in rows]

    def get_workspace(self, *, instance: InstanceRecord, workspace_id: str) -> WorkspaceDetail:
        with self._session_factory() as session:
            row = session.get(WorkspaceORM, workspace_id)
            if row is None or row.company_id != instance.company_id:
                raise ValueError(f"Workspace '{workspace_id}' was not found.")

            summary = self._workspace_summary(session, row)
            run_rows = session.execute(
                select(RunORM)
                .where(RunORM.company_id == instance.company_id, RunORM.workspace_id == workspace_id)
                .order_by(RunORM.updated_at.desc())
            ).scalars().all()
            approval_rows = session.execute(
                select(RunApprovalLinkORM, RunORM)
                .join(
                    RunORM,
                    and_(
                        RunORM.id == RunApprovalLinkORM.run_id,
                        RunORM.company_id == RunApprovalLinkORM.company_id,
                    ),
                )
                .where(RunApprovalLinkORM.company_id == instance.company_id, RunORM.workspace_id == workspace_id)
                .order_by(RunApprovalLinkORM.opened_at.desc())
            ).all()
            event_rows = session.execute(
                select(WorkspaceEventORM)
                .where(WorkspaceEventORM.company_id == instance.company_id, WorkspaceEventORM.workspace_id == workspace_id)
                .order_by(WorkspaceEventORM.created_at.desc())
            ).scalars().all()
            artifacts = self._list_artifact_records(
                session,
                company_id=instance.company_id,
                workspace_id=workspace_id,
                limit=200,
            )
            return WorkspaceDetail(
                **summary.model_dump(),
                runs=[
                    WorkspaceRunSummary(
                        run_id=run.id,
                        run_kind=run.run_kind,
                        state=run.state,
                        execution_lane=run.execution_lane,
                        issue_id=run.issue_id,
                        updated_at=run.updated_at,
                    )
                    for run in run_rows
                ],
                approvals=[
                    WorkspaceApprovalSummary(
                        approval_id=link.approval_id,
                        shared_approval_id=build_execution_approval_id(
                            instance_id=instance.instance_id,
                            company_id=link.company_id,
                            approval_id=link.approval_id,
                        ),
                        gate_status=link.gate_status,
                        gate_key=link.gate_key,
                        opened_at=link.opened_at,
                        decided_at=link.decided_at,
                    )
                    for link, _run in approval_rows
                ],
                events=[
                    WorkspaceEventRecord(
                        event_id=event.id,
                        workspace_id=event.workspace_id,
                        event_kind=event.event_kind,  # type: ignore[arg-type]
                        note=event.note,
                        artifact_id=event.artifact_id,
                        approval_id=event.approval_id,
                        run_id=event.run_id,
                        actor_type=event.actor_type,
                        actor_id=event.actor_id,
                        created_at=event.created_at,
                    )
                    for event in event_rows
                ],
                artifacts=artifacts,
            )

    def _record_workspace_event(
        self,
        session: Session,
        *,
        company_id: str,
        workspace_id: str,
        event_kind: WorkspaceEventKind,
        actor_type: str,
        actor_id: str | None,
        note: str | None = None,
        artifact_id: str | None = None,
        approval_id: str | None = None,
        run_id: str | None = None,
    ) -> WorkspaceEventORM:
        event = WorkspaceEventORM(
            id=self._new_id("workspace_event"),
            company_id=company_id,
            workspace_id=workspace_id,
            event_kind=event_kind,
            note=note,
            artifact_id=artifact_id,
            approval_id=approval_id,
            run_id=run_id,
            actor_type=actor_type,
            actor_id=actor_id,
            created_at=self._now(),
        )
        session.add(event)
        return event

    def create_workspace(
        self,
        *,
        instance: InstanceRecord,
        payload: CreateWorkspace,
        actor_type: str,
        actor_id: str | None,
    ) -> WorkspaceDetail:
        with self._session_factory() as session, session.begin():
            workspace_id = (payload.workspace_id or "").strip() or self._new_id("workspace")
            existing = session.get(WorkspaceORM, workspace_id)
            if existing is not None and existing.company_id == instance.company_id:
                raise ValueError(f"Workspace '{workspace_id}' already exists.")
            if payload.active_run_id is not None:
                self._ensure_run_exists(session, company_id=instance.company_id, run_id=payload.active_run_id)
            if payload.latest_approval_id is not None:
                self._ensure_execution_approval_exists(
                    session,
                    company_id=instance.company_id,
                    approval_id=payload.latest_approval_id,
                )
            created_at = self._now()
            status = self._workspace_status(
                payload.preview_status,
                payload.review_status,
                payload.handoff_status,
            )
            row = WorkspaceORM(
                id=workspace_id,
                instance_id=instance.instance_id,
                company_id=instance.company_id,
                issue_id=payload.issue_id,
                title=payload.title.strip(),
                summary=payload.summary.strip(),
                status=status,
                preview_status=payload.preview_status,
                review_status=payload.review_status,
                handoff_status=payload.handoff_status,
                owner_type=payload.owner_type,
                owner_id=payload.owner_id,
                active_run_id=payload.active_run_id,
                latest_approval_id=payload.latest_approval_id,
                pr_reference=payload.pr_reference,
                handoff_reference=payload.handoff_reference,
                metadata_json=dict(payload.metadata),
                created_at=created_at,
                updated_at=created_at,
            )
            session.add(row)
            self._record_workspace_event(
                session,
                company_id=instance.company_id,
                workspace_id=workspace_id,
                event_kind="created",
                actor_type=actor_type,
                actor_id=actor_id,
                note="Workspace created in ForgeFrame control plane.",
                approval_id=payload.latest_approval_id,
                run_id=payload.active_run_id,
            )
        return self.get_workspace(instance=instance, workspace_id=workspace_id)

    def update_workspace(
        self,
        *,
        instance: InstanceRecord,
        workspace_id: str,
        payload: UpdateWorkspace,
        actor_type: str,
        actor_id: str | None,
    ) -> WorkspaceDetail:
        with self._session_factory() as session, session.begin():
            row = session.get(WorkspaceORM, workspace_id)
            if row is None or row.company_id != instance.company_id:
                raise ValueError(f"Workspace '{workspace_id}' was not found.")
            if payload.active_run_id is not None:
                self._ensure_run_exists(session, company_id=instance.company_id, run_id=payload.active_run_id)
            if payload.latest_approval_id is not None:
                self._ensure_execution_approval_exists(
                    session,
                    company_id=instance.company_id,
                    approval_id=payload.latest_approval_id,
                )
            if payload.preview_artifact_id is not None:
                preview_artifact = session.get(ArtifactORM, payload.preview_artifact_id)
                if preview_artifact is None or preview_artifact.company_id != instance.company_id:
                    raise ValueError(f"Preview artifact '{payload.preview_artifact_id}' was not found.")
            if payload.handoff_artifact_id is not None:
                handoff_artifact = session.get(ArtifactORM, payload.handoff_artifact_id)
                if handoff_artifact is None or handoff_artifact.company_id != instance.company_id:
                    raise ValueError(f"Handoff artifact '{payload.handoff_artifact_id}' was not found.")

            row.title = payload.title.strip() if payload.title is not None else row.title
            row.summary = payload.summary.strip() if payload.summary is not None else row.summary
            row.issue_id = payload.issue_id if payload.issue_id is not None else row.issue_id
            row.preview_status = payload.preview_status or row.preview_status
            row.review_status = payload.review_status or row.review_status
            row.handoff_status = payload.handoff_status or row.handoff_status
            row.owner_type = payload.owner_type or row.owner_type
            row.owner_id = payload.owner_id if payload.owner_id is not None else row.owner_id
            row.active_run_id = payload.active_run_id if payload.active_run_id is not None else row.active_run_id
            row.latest_approval_id = payload.latest_approval_id if payload.latest_approval_id is not None else row.latest_approval_id
            row.preview_artifact_id = payload.preview_artifact_id if payload.preview_artifact_id is not None else row.preview_artifact_id
            row.handoff_artifact_id = payload.handoff_artifact_id if payload.handoff_artifact_id is not None else row.handoff_artifact_id
            row.pr_reference = payload.pr_reference if payload.pr_reference is not None else row.pr_reference
            row.handoff_reference = payload.handoff_reference if payload.handoff_reference is not None else row.handoff_reference
            row.metadata_json = dict(payload.metadata) if payload.metadata is not None else dict(row.metadata_json or {})
            row.status = self._workspace_status(
                row.preview_status,
                row.review_status,
                row.handoff_status,
                archived=payload.archive,
            )
            row.updated_at = self._now()
            self._record_workspace_event(
                session,
                company_id=instance.company_id,
                workspace_id=workspace_id,
                event_kind=self._workspace_update_event_kind(workspace=row, payload=payload),
                actor_type=actor_type,
                actor_id=actor_id,
                note=payload.event_note,
                artifact_id=payload.handoff_artifact_id or payload.preview_artifact_id,
                approval_id=payload.latest_approval_id,
                run_id=payload.active_run_id,
            )
        return self.get_workspace(instance=instance, workspace_id=workspace_id)

    def create_artifact(
        self,
        *,
        instance: InstanceRecord,
        payload: CreateArtifact,
        actor_type: str,
        actor_id: str | None,
    ) -> ArtifactRecord:
        with self._session_factory() as session, session.begin():
            workspace: WorkspaceORM | None = None
            if payload.workspace_id is not None:
                workspace = session.get(WorkspaceORM, payload.workspace_id)
                if workspace is None or workspace.company_id != instance.company_id:
                    raise ValueError(f"Workspace '{payload.workspace_id}' was not found.")

            now = self._now()
            artifact_id = self._new_id("artifact")
            row = ArtifactORM(
                id=artifact_id,
                instance_id=instance.instance_id,
                company_id=instance.company_id,
                workspace_id=payload.workspace_id,
                artifact_type=payload.artifact_type,
                label=payload.label.strip(),
                uri=payload.uri.strip(),
                media_type=payload.media_type.strip() if payload.media_type else None,
                preview_url=payload.preview_url.strip() if payload.preview_url else None,
                size_bytes=payload.size_bytes,
                status=payload.status,
                created_by_type=actor_type,
                created_by_id=actor_id,
                metadata_json=dict(payload.metadata),
                created_at=now,
                updated_at=now,
            )
            session.add(row)

            attachments = list(payload.attachments)
            if payload.workspace_id is not None:
                attachments.append(
                    {
                        "target_kind": "workspace",
                        "target_id": payload.workspace_id,
                        "role": payload.workspace_role or "artifact",
                    }
                )

            dedupe: set[tuple[str, str, str]] = set()
            for attachment_payload in attachments:
                if hasattr(attachment_payload, "target_kind"):
                    target_kind = attachment_payload.target_kind
                    target_id = attachment_payload.target_id
                    role = attachment_payload.role
                else:
                    target_kind = str(attachment_payload["target_kind"])
                    target_id = str(attachment_payload["target_id"])
                    role = str(attachment_payload["role"])
                self._validate_attachment_target(
                    session,
                    instance=instance,
                    target_kind=target_kind,
                    target_id=target_id,
                )
                key = (target_kind, target_id, role)
                if key in dedupe:
                    continue
                dedupe.add(key)
                session.add(
                    ArtifactAttachmentORM(
                        id=self._new_id("artifact_attachment"),
                        company_id=instance.company_id,
                        artifact_id=artifact_id,
                        target_kind=target_kind,
                        target_id=target_id,
                        role=role,
                        created_at=now,
                    )
                )

            if workspace is not None:
                workspace.updated_at = now
                if payload.workspace_role == "preview":
                    workspace.preview_artifact_id = artifact_id
                    workspace.preview_status = "ready"
                elif payload.workspace_role == "handoff":
                    workspace.handoff_artifact_id = artifact_id
                    workspace.handoff_status = "ready"
                workspace.status = self._workspace_status(
                    workspace.preview_status,
                    workspace.review_status,
                    workspace.handoff_status,
                    archived=workspace.status == "archived",
                )
                self._record_workspace_event(
                    session,
                    company_id=instance.company_id,
                    workspace_id=workspace.id,
                    event_kind="preview_ready" if payload.workspace_role == "preview" else "handoff_prepared" if payload.workspace_role == "handoff" else "updated",
                    actor_type=actor_type,
                    actor_id=actor_id,
                    note=f"Artifact '{payload.label.strip()}' attached to workspace.",
                    artifact_id=artifact_id,
                )
        return self.get_artifact(instance=instance, artifact_id=artifact_id)

    def update_artifact(
        self,
        *,
        instance: InstanceRecord,
        artifact_id: str,
        payload: UpdateArtifact,
    ) -> ArtifactRecord:
        with self._session_factory() as session, session.begin():
            row = session.get(ArtifactORM, artifact_id)
            if row is None or row.company_id != instance.company_id:
                raise ValueError(f"Artifact '{artifact_id}' was not found.")
            row.label = payload.label.strip() if payload.label is not None else row.label
            row.uri = payload.uri.strip() if payload.uri is not None else row.uri
            row.media_type = payload.media_type.strip() if payload.media_type else row.media_type
            row.preview_url = payload.preview_url.strip() if payload.preview_url else row.preview_url
            row.size_bytes = payload.size_bytes if payload.size_bytes is not None else row.size_bytes
            row.status = payload.status or row.status
            row.metadata_json = dict(payload.metadata) if payload.metadata is not None else dict(row.metadata_json or {})
            row.updated_at = self._now()
        return self.get_artifact(instance=instance, artifact_id=artifact_id)
