"""Shared admin-facing work interaction service for workspaces and artifacts."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.approvals.models import build_execution_approval_id, parse_shared_approval_id
from app.artifacts.models import ArtifactAttachmentRecord, ArtifactRecord, CreateArtifact, UpdateArtifact
from app.instances.models import InstanceRecord
from app.storage.conversation_repository import ConversationORM
from app.storage.artifact_repository import ArtifactAttachmentORM, ArtifactORM
from app.storage.execution_repository import RunApprovalLinkORM, RunORM
from app.storage.tasking_repository import TaskORM
from app.storage.workspace_repository import WorkspaceEventORM, WorkspaceORM
from app.workspaces.models import (
    CreateWorkspace,
    UpdateWorkspace,
    WorkspaceApprovalSummary,
    WorkspaceConversationSummary,
    WorkspaceDetail,
    WorkspaceEventRecord,
    WorkspaceEventKind,
    WorkspaceRunSummary,
    WorkspaceSummary,
    WorkspaceTaskSummary,
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

    @staticmethod
    def _latest_activity(*timestamps: datetime | None) -> datetime | None:
        values = [item for item in timestamps if item is not None]
        if not values:
            return None
        return max(values)

    @staticmethod
    def _next_action(row: WorkspaceORM) -> tuple[str, str, str, str]:
        if row.status == "archived":
            return ("archived", "Archived", "done", "Workspace is archived and no further handoff action is expected.")
        if row.handoff_status == "delivered":
            return ("handoff_delivered", "Handoff delivered", "done", "The handoff already left ForgeFrame and now lives in the downstream system.")
        if row.handoff_status == "ready":
            return ("handoff_ready", "Handoff ready", "waiting", "Handoff evidence is prepared, but delivery still happens outside this page.")
        if row.review_status == "pending":
            return ("review_in_progress", "Review in progress", "waiting", "Review is already pending. Use approvals and artifacts to close the gate.")
        if row.review_status == "approved":
            if row.handoff_artifact_id or row.handoff_reference or row.pr_reference:
                return ("prepare_handoff", "Prepare handoff", "available", "Handoff evidence is linked. Mark the workspace ready for delivery.")
            return (
                "prepare_handoff",
                "Prepare handoff",
                "not_ready",
                "No dedicated handoff API exists here. Link a handoff artifact, PR reference, or handoff reference first.",
            )
        if row.preview_status in {"ready", "approved"}:
            return ("request_review", "Request review", "available", "Preview evidence is linked. Move the workspace into review.")
        if row.active_run_id or row.preview_artifact_id:
            return (
                "start_preview",
                "Start preview",
                "available",
                "No dedicated preview-start API exists here. This action records preview readiness after execution or artifact evidence is linked.",
            )
        return (
            "start_preview",
            "Start preview",
            "not_ready",
            "No dedicated preview-start API exists here. Link an execution run or preview artifact first.",
        )

    @staticmethod
    def _validate_lifecycle_state(
        *,
        preview_status: str,
        review_status: str,
        handoff_status: str,
        active_run_id: str | None,
        preview_artifact_id: str | None,
        latest_approval_id: str | None,
        handoff_artifact_id: str | None,
        pr_reference: str | None,
        handoff_reference: str | None,
        previous_handoff_status: str | None = None,
    ) -> None:
        has_preview_evidence = bool(active_run_id or preview_artifact_id)
        has_handoff_evidence = bool(handoff_artifact_id or pr_reference or handoff_reference)

        if preview_status in {"ready", "approved", "rejected"} and not has_preview_evidence:
            raise ValueError("Preview status requires a linked execution run or preview artifact.")

        if review_status in {"pending", "approved", "rejected"}:
            if preview_status not in {"ready", "approved"}:
                raise ValueError("Review status requires preview evidence before review can start.")
        if review_status in {"approved", "rejected"} and not latest_approval_id:
            raise ValueError("Approved or rejected review state requires a linked approval.")

        if handoff_status == "ready":
            if review_status != "approved":
                raise ValueError("Handoff readiness requires an approved review.")
            if not has_handoff_evidence:
                raise ValueError("Handoff readiness requires a handoff artifact, PR reference, or handoff reference.")

        if handoff_status == "delivered":
            if review_status != "approved":
                raise ValueError("Handoff delivery requires an approved review.")
            if previous_handoff_status != "ready":
                raise ValueError("Handoff delivery confirmation is not available until the workspace is already handoff-ready.")
            if not handoff_reference:
                raise ValueError("Handoff delivery requires an external handoff reference.")

    def _artifact_attachments(self, session: Session, *, company_id: str, artifact_ids: list[str]) -> dict[str, list[ArtifactAttachmentRecord]]:
        if not artifact_ids:
            return {}
        rows = session.execute(
            select(ArtifactAttachmentORM)
            .where(ArtifactAttachmentORM.company_id == company_id, ArtifactAttachmentORM.artifact_id.in_(artifact_ids))
            .order_by(ArtifactAttachmentORM.created_at.asc(), ArtifactAttachmentORM.target_kind.asc(), ArtifactAttachmentORM.target_id.asc(), ArtifactAttachmentORM.role.asc())
        ).scalars().all()
        priority = {"workspace": 0, "run": 1, "approval": 2, "instance": 3, "decision": 4}
        rows = sorted(
            rows,
            key=lambda row: (
                row.artifact_id,
                priority.get(row.target_kind, 99),
                row.created_at,
                row.target_id,
                row.role,
            ),
        )
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

    @staticmethod
    def _clean_optional_string(value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @staticmethod
    def _artifact_metadata_string(metadata: dict[str, Any], *keys: str) -> str | None:
        for key in keys:
            value = metadata.get(key)
            if isinstance(value, str):
                normalized = value.strip()
                if normalized:
                    return normalized
        return None

    @staticmethod
    def _artifact_metadata_datetime(metadata: dict[str, Any], *paths: tuple[str, ...]) -> datetime | None:
        for path in paths:
            current: Any = metadata
            for segment in path:
                if not isinstance(current, dict):
                    current = None
                    break
                current = current.get(segment)
            if isinstance(current, datetime):
                return current
            if isinstance(current, str):
                try:
                    return datetime.fromisoformat(current.replace("Z", "+00:00"))
                except ValueError:
                    continue
        return None

    @staticmethod
    def _artifact_workspace_role(*, row: ArtifactORM, artifact_attachments: list[ArtifactAttachmentRecord]) -> str | None:
        if row.workspace_id is None:
            return None
        for attachment in artifact_attachments:
            if attachment.target_kind == "workspace" and attachment.target_id == row.workspace_id:
                return attachment.role
        return "artifact"

    def _apply_structured_artifact_metadata(
        self,
        metadata: dict[str, Any],
        *,
        fields_set: set[str] | None,
        version: str | None,
        checksum_sha256: str | None,
        retention_policy: str | None,
        retained_until: datetime | None,
        archive_reason: str | None,
    ) -> dict[str, Any]:
        next_metadata = dict(metadata)

        def should_apply(field_name: str) -> bool:
            return fields_set is None or field_name in fields_set

        if should_apply("version"):
            if version:
                next_metadata["version"] = version
            else:
                next_metadata.pop("version", None)
                next_metadata.pop("artifact_version", None)
                next_metadata.pop("version_label", None)

        if should_apply("checksum_sha256"):
            if checksum_sha256:
                next_metadata["checksum_sha256"] = checksum_sha256
            else:
                next_metadata.pop("checksum_sha256", None)
                next_metadata.pop("sha256", None)
                next_metadata.pop("checksum", None)

        if should_apply("retention_policy") or should_apply("retained_until"):
            current_retention = next_metadata.get("retention")
            retention = dict(current_retention) if isinstance(current_retention, dict) else {}
            if should_apply("retention_policy"):
                if retention_policy:
                    retention["policy"] = retention_policy
                else:
                    retention.pop("policy", None)
                    retention.pop("classification", None)
            if should_apply("retained_until"):
                if retained_until is not None:
                    retention["retained_until"] = retained_until.isoformat()
                else:
                    retention.pop("retained_until", None)
            if retention:
                next_metadata["retention"] = retention
            else:
                next_metadata.pop("retention", None)
                next_metadata.pop("retention_policy", None)
                next_metadata.pop("retained_until", None)

        if should_apply("archive_reason"):
            if archive_reason:
                next_metadata["archive_reason"] = archive_reason
            else:
                next_metadata.pop("archive_reason", None)

        return next_metadata

    def _artifact_record(self, row: ArtifactORM, *, attachments: dict[str, list[ArtifactAttachmentRecord]]) -> ArtifactRecord:
        artifact_attachments = list(attachments.get(row.id, []))
        metadata = dict(row.metadata_json or {})
        workspace_role = self._artifact_workspace_role(row=row, artifact_attachments=artifact_attachments)
        scope = "workspace" if row.workspace_id else "instance"
        return ArtifactRecord(
            artifact_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            workspace_id=row.workspace_id,
            scope=scope,
            scope_label=f"Workspace · {workspace_role or 'artifact'}" if row.workspace_id else "Instance",
            workspace_role=workspace_role,  # type: ignore[arg-type]
            artifact_type=row.artifact_type,  # type: ignore[arg-type]
            label=row.label,
            uri=row.uri,
            media_type=row.media_type,
            preview_url=row.preview_url,
            size_bytes=row.size_bytes,
            version=self._artifact_metadata_string(metadata, "version", "artifact_version", "version_label"),
            checksum_sha256=self._artifact_metadata_string(metadata, "checksum_sha256", "sha256", "checksum"),
            retention_policy=self._artifact_metadata_string(metadata, "retention_policy")
            or self._artifact_metadata_string(metadata.get("retention", {}) if isinstance(metadata.get("retention"), dict) else {}, "policy", "classification"),
            retained_until=self._artifact_metadata_datetime(metadata, ("retention", "retained_until"), ("retained_until",)),
            archive_reason=self._artifact_metadata_string(metadata, "archive_reason"),
            status=row.status,  # type: ignore[arg-type]
            created_by_type=row.created_by_type,
            created_by_id=row.created_by_id,
            metadata=metadata,
            attachments=artifact_attachments,
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
        latest_artifact_at = session.execute(
            select(func.max(ArtifactORM.updated_at)).where(
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
        latest_run_at = session.execute(
            select(func.max(RunORM.updated_at)).where(
                RunORM.company_id == row.company_id,
                RunORM.workspace_id == row.id,
            )
        ).scalar_one()
        conversation_count = session.execute(
            select(func.count(ConversationORM.id)).where(
                ConversationORM.company_id == row.company_id,
                ConversationORM.workspace_id == row.id,
            )
        ).scalar_one()
        latest_conversation = session.execute(
            select(ConversationORM)
            .where(
                ConversationORM.company_id == row.company_id,
                ConversationORM.workspace_id == row.id,
            )
            .order_by(ConversationORM.updated_at.desc())
            .limit(1)
        ).scalar_one_or_none()
        task_count = session.execute(
            select(func.count(TaskORM.id)).where(
                TaskORM.company_id == row.company_id,
                TaskORM.workspace_id == row.id,
            )
        ).scalar_one()
        latest_task_at = session.execute(
            select(func.max(TaskORM.updated_at)).where(
                TaskORM.company_id == row.company_id,
                TaskORM.workspace_id == row.id,
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
        next_action_key, next_action_label, next_action_state, next_action_reason = self._next_action(row)
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
            conversation_count=int(conversation_count or 0),
            task_count=int(task_count or 0),
            approval_count=int(approval_count or 0),
            latest_conversation_id=latest_conversation.id if latest_conversation is not None else None,
            latest_conversation_subject=latest_conversation.subject if latest_conversation is not None else None,
            next_action_key=next_action_key,  # type: ignore[arg-type]
            next_action_label=next_action_label,
            next_action_state=next_action_state,  # type: ignore[arg-type]
            next_action_reason=next_action_reason,
            last_activity_at=self._latest_activity(
                row.updated_at,
                latest_event_at,
                latest_artifact_at,
                latest_run_at,
                latest_task_at,
                latest_conversation.updated_at if latest_conversation is not None else None,
            ),
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
            conversation_rows = session.execute(
                select(ConversationORM)
                .where(ConversationORM.company_id == instance.company_id, ConversationORM.workspace_id == workspace_id)
                .order_by(ConversationORM.updated_at.desc())
            ).scalars().all()
            task_rows = session.execute(
                select(TaskORM)
                .where(TaskORM.company_id == instance.company_id, TaskORM.workspace_id == workspace_id)
                .order_by(TaskORM.updated_at.desc())
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
                conversations=[
                    WorkspaceConversationSummary(
                        conversation_id=conversation.id,
                        subject=conversation.subject,
                        status=conversation.status,
                        triage_status=conversation.triage_status,
                        priority=conversation.priority,
                        latest_message_at=conversation.latest_message_at,
                        updated_at=conversation.updated_at,
                    )
                    for conversation in conversation_rows
                ],
                tasks=[
                    WorkspaceTaskSummary(
                        task_id=task.id,
                        title=task.title,
                        status=task.status,
                        priority=task.priority,
                        owner_id=task.owner_id,
                        due_at=task.due_at,
                        updated_at=task.updated_at,
                    )
                    for task in task_rows
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
            self._validate_lifecycle_state(
                preview_status=payload.preview_status,
                review_status=payload.review_status,
                handoff_status=payload.handoff_status,
                active_run_id=payload.active_run_id,
                preview_artifact_id=None,
                latest_approval_id=payload.latest_approval_id,
                handoff_artifact_id=None,
                pr_reference=payload.pr_reference,
                handoff_reference=payload.handoff_reference,
                previous_handoff_status=None,
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
            fields_set = payload.model_fields_set
            next_issue_id = payload.issue_id if "issue_id" in fields_set else row.issue_id
            next_owner_id = payload.owner_id if "owner_id" in fields_set else row.owner_id
            next_active_run_id = payload.active_run_id if "active_run_id" in fields_set else row.active_run_id
            next_latest_approval_id = payload.latest_approval_id if "latest_approval_id" in fields_set else row.latest_approval_id
            next_preview_artifact_id = payload.preview_artifact_id if "preview_artifact_id" in fields_set else row.preview_artifact_id
            next_handoff_artifact_id = payload.handoff_artifact_id if "handoff_artifact_id" in fields_set else row.handoff_artifact_id
            next_pr_reference = payload.pr_reference if "pr_reference" in fields_set else row.pr_reference
            next_handoff_reference = payload.handoff_reference if "handoff_reference" in fields_set else row.handoff_reference
            next_preview_status = payload.preview_status or row.preview_status
            next_review_status = payload.review_status or row.review_status
            next_handoff_status = payload.handoff_status or row.handoff_status

            if next_active_run_id is not None:
                self._ensure_run_exists(session, company_id=instance.company_id, run_id=next_active_run_id)
            if next_latest_approval_id is not None:
                self._ensure_execution_approval_exists(
                    session,
                    company_id=instance.company_id,
                    approval_id=next_latest_approval_id,
                )
            if next_preview_artifact_id is not None:
                preview_artifact = session.get(ArtifactORM, next_preview_artifact_id)
                if preview_artifact is None or preview_artifact.company_id != instance.company_id:
                    raise ValueError(f"Preview artifact '{next_preview_artifact_id}' was not found.")
            if next_handoff_artifact_id is not None:
                handoff_artifact = session.get(ArtifactORM, next_handoff_artifact_id)
                if handoff_artifact is None or handoff_artifact.company_id != instance.company_id:
                    raise ValueError(f"Handoff artifact '{next_handoff_artifact_id}' was not found.")

            self._validate_lifecycle_state(
                preview_status=next_preview_status,
                review_status=next_review_status,
                handoff_status=next_handoff_status,
                active_run_id=next_active_run_id,
                preview_artifact_id=next_preview_artifact_id,
                latest_approval_id=next_latest_approval_id,
                handoff_artifact_id=next_handoff_artifact_id,
                pr_reference=next_pr_reference,
                handoff_reference=next_handoff_reference,
                previous_handoff_status=row.handoff_status,
            )

            row.title = payload.title.strip() if payload.title is not None else row.title
            row.summary = payload.summary.strip() if payload.summary is not None else row.summary
            row.issue_id = next_issue_id
            row.preview_status = next_preview_status
            row.review_status = next_review_status
            row.handoff_status = next_handoff_status
            row.owner_type = payload.owner_type or row.owner_type
            row.owner_id = next_owner_id
            row.active_run_id = next_active_run_id
            row.latest_approval_id = next_latest_approval_id
            row.preview_artifact_id = next_preview_artifact_id
            row.handoff_artifact_id = next_handoff_artifact_id
            row.pr_reference = next_pr_reference
            row.handoff_reference = next_handoff_reference
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
            metadata_json = self._apply_structured_artifact_metadata(
                dict(payload.metadata),
                fields_set=None,
                version=self._clean_optional_string(payload.version),
                checksum_sha256=self._clean_optional_string(payload.checksum_sha256),
                retention_policy=self._clean_optional_string(payload.retention_policy),
                retained_until=payload.retained_until,
                archive_reason=self._clean_optional_string(payload.archive_reason),
            )
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
                metadata_json=metadata_json,
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
            fields_set = payload.model_fields_set
            row.label = payload.label.strip() if payload.label is not None else row.label
            row.uri = payload.uri.strip() if payload.uri is not None else row.uri
            if "media_type" in fields_set:
                row.media_type = payload.media_type.strip() if payload.media_type else None
            if "preview_url" in fields_set:
                row.preview_url = payload.preview_url.strip() if payload.preview_url else None
            if "size_bytes" in fields_set:
                row.size_bytes = payload.size_bytes
            if "status" in fields_set and payload.status is not None:
                row.status = payload.status
            base_metadata = (
                {}
                if "metadata" in fields_set and payload.metadata is None
                else dict(payload.metadata)
                if payload.metadata is not None
                else dict(row.metadata_json or {})
            )
            row.metadata_json = self._apply_structured_artifact_metadata(
                base_metadata,
                fields_set=fields_set,
                version=self._clean_optional_string(payload.version),
                checksum_sha256=self._clean_optional_string(payload.checksum_sha256),
                retention_policy=self._clean_optional_string(payload.retention_policy),
                retained_until=payload.retained_until,
                archive_reason=self._clean_optional_string(payload.archive_reason),
            )
            row.updated_at = self._now()
        return self.get_artifact(instance=instance, artifact_id=artifact_id)
