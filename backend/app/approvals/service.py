"""Shared approval queue/detail service spanning execution and elevated access."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.approvals.models import (
    APPROVAL_STATUSES,
    ApprovalActorSummary,
    ApprovalDetail,
    ApprovalSummary,
    build_elevated_access_approval_id,
    build_execution_approval_id,
    parse_shared_approval_id,
)
from app.auth.local_auth import role_allows
from app.execution.service import ExecutionTransitionService
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService
from app.instances.models import InstanceRecord
from app.instances.service import InstanceService, get_instance_service
from app.storage.execution_repository import RunApprovalLinkORM, RunORM
from app.workspaces.service import WorkInteractionAdminService

SessionFactory = Callable[[], Session]


class ApprovalAdminService:
    def __init__(
        self,
        *,
        session_factory: SessionFactory,
        governance: GovernanceService,
        execution: ExecutionTransitionService,
        instance_service: InstanceService | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._governance = governance
        self._execution = execution
        self._instances = instance_service or get_instance_service()
        self._work = WorkInteractionAdminService(session_factory)

    @staticmethod
    def _parse_dt(value: str | datetime | None) -> datetime | None:
        if value is None or isinstance(value, datetime):
            return value
        return datetime.fromisoformat(value)

    @staticmethod
    def _normalize_status(status: str | None) -> str | None:
        if status is None:
            return None
        normalized = status.strip().lower()
        if not normalized:
            return None
        if normalized not in APPROVAL_STATUSES:
            raise ValueError("approval_status_invalid")
        return normalized

    @staticmethod
    def _requester_from_payload(payload: dict[str, object]) -> ApprovalActorSummary | None:
        requested_by_user_id = payload.get("requested_by_user_id")
        if requested_by_user_id is None:
            return None
        return ApprovalActorSummary(
            user_id=str(requested_by_user_id),
            username=payload.get("requested_by_username"),
            display_name=payload.get("requested_by_display_name"),
        )

    @staticmethod
    def _target_from_payload(payload: dict[str, object]) -> ApprovalActorSummary | None:
        target_user_id = payload.get("target_user_id")
        if target_user_id is None:
            return None
        role = payload.get("target_role")
        return ApprovalActorSummary(
            user_id=str(target_user_id),
            username=payload.get("target_username"),
            display_name=payload.get("target_display_name"),
            role=str(role) if role is not None else None,
        )

    @staticmethod
    def _decision_actor_from_payload(payload: dict[str, object]) -> ApprovalActorSummary | None:
        decided_by_user_id = payload.get("decided_by_user_id")
        if decided_by_user_id is None:
            return None
        return ApprovalActorSummary(
            user_id=str(decided_by_user_id),
            username=payload.get("decided_by_username"),
        )

    def _build_elevated_access_summary(self, payload: dict[str, object]) -> ApprovalSummary:
        request_type = str(payload["request_type"])
        target_label = payload.get("target_display_name") or payload.get("target_username") or payload.get("target_user_id")
        title_prefix = "Break-glass" if request_type == "break_glass" else "Impersonation"
        return ApprovalSummary(
            approval_id=str(payload.get("approval_id") or build_elevated_access_approval_id(str(payload["request_id"]))),
            source_kind="elevated_access",
            native_approval_id=str(payload["request_id"]),
            approval_type=request_type,  # type: ignore[arg-type]
            status=str(payload["gate_status"]),  # type: ignore[arg-type]
            title=f"{title_prefix} approval for {target_label}",
            opened_at=self._parse_dt(payload["created_at"]),
            decided_at=self._parse_dt(payload.get("decided_at")),
            expires_at=self._parse_dt(payload.get("approval_expires_at")),
            requester=self._requester_from_payload(payload),
            target=self._target_from_payload(payload),
            decision_actor=self._decision_actor_from_payload(payload),
            ready_to_issue=bool(payload.get("ready_to_issue", False)),
            session_status=payload.get("session_status"),  # type: ignore[arg-type]
        )

    def _build_elevated_access_detail(
        self,
        payload: dict[str, object],
        *,
        actor: AuthenticatedAdmin,
    ) -> ApprovalDetail:
        summary = self._build_elevated_access_summary(payload)
        is_open = summary.status == "open"
        conflict_state = self._governance.get_elevated_access_request_conflict_state(
            request_id=str(payload["request_id"]),
        )
        can_reject = role_allows(actor.role, "admin") and actor.user_id != payload.get("requested_by_user_id") and is_open
        can_approve = can_reject and not bool(conflict_state["has_conflict"])
        if not role_allows(actor.role, "admin"):
            approve_blocked_reason = "admin_role_required"
            reject_blocked_reason = "admin_role_required"
        elif actor.user_id == payload.get("requested_by_user_id"):
            approve_blocked_reason = "elevated_access_self_approval_forbidden"
            reject_blocked_reason = "elevated_access_self_approval_forbidden"
        elif not is_open:
            approve_blocked_reason = "approval_not_open"
            reject_blocked_reason = "approval_not_open"
        elif bool(conflict_state["has_conflict"]):
            approve_blocked_reason = str(conflict_state["blocked_reason"])
            reject_blocked_reason = None
        else:
            approve_blocked_reason = None
            reject_blocked_reason = None
        decision_blocked_reason = reject_blocked_reason or approve_blocked_reason
        return ApprovalDetail(
            **summary.model_dump(),
            evidence={
                "approval_reference": payload.get("approval_reference"),
                "justification": payload.get("justification"),
                "notification_targets": list(payload.get("notification_targets", [])),
                "duration_minutes": payload.get("duration_minutes"),
                "session_role": payload.get("session_role"),
                "target_role": payload.get("target_role"),
                "issuance_status": payload.get("issuance_status"),
                "decision_note": payload.get("decision_note"),
            },
            source={
                "request_id": payload.get("request_id"),
                "request_type": payload.get("request_type"),
                "issued_session_id": payload.get("issued_session_id"),
                "issued_at": payload.get("issued_at"),
                "issued_by_user_id": payload.get("issued_by_user_id"),
                "issued_by_username": payload.get("issued_by_username"),
                "active_session_conflict": conflict_state["has_conflict"],
                "conflicting_session_id": conflict_state["session_id"],
                "conflicting_session_type": conflict_state["session_type"],
                "conflicting_subject_user_id": conflict_state["subject_user_id"],
                "conflicting_session_expires_at": conflict_state["session_expires_at"],
            },
            actions={
                "can_approve": can_approve,
                "can_reject": can_reject,
                "decision_blocked_reason": decision_blocked_reason,
                "approve_blocked_reason": approve_blocked_reason,
                "reject_blocked_reason": reject_blocked_reason,
            },
        )

    def _resolve_instance_for_company(self, company_id: str) -> InstanceRecord | None:
        try:
            return self._instances.resolve_instance(
                company_id=company_id,
                allow_default=False,
                allow_legacy_backfill=True,
            )
        except ValueError:
            return None

    def _build_execution_summary(
        self,
        link: RunApprovalLinkORM,
        run: RunORM,
        *,
        instance: InstanceRecord | None = None,
    ) -> ApprovalSummary:
        instance = instance or self._resolve_instance_for_company(link.company_id)
        return ApprovalSummary(
            approval_id=build_execution_approval_id(
                instance_id=instance.instance_id if instance is not None else None,
                company_id=link.company_id,
                approval_id=link.approval_id,
            ),
            source_kind="execution_run",
            native_approval_id=link.approval_id,
            approval_type="execution_run",
            status=link.gate_status,  # type: ignore[arg-type]
            title=f"Execution approval for {run.run_kind}",
            opened_at=link.opened_at,
            decided_at=link.decided_at,
            instance_id=instance.instance_id if instance is not None else None,
            company_id=link.company_id,
            issue_id=run.issue_id,
            workspace_id=run.workspace_id,
            decision_actor=ApprovalActorSummary(user_id=link.decision_actor_id),
        )

    def _build_execution_detail(
        self,
        link: RunApprovalLinkORM,
        run: RunORM,
        *,
        actor: AuthenticatedAdmin,
        instance: InstanceRecord | None = None,
    ) -> ApprovalDetail:
        instance = instance or self._resolve_instance_for_company(link.company_id)
        summary = self._build_execution_summary(link, run, instance=instance)
        workspace = (
            self._work.get_workspace_summary(company_id=link.company_id, workspace_id=run.workspace_id)
            if run.workspace_id
            else None
        )
        decision_permission_error: str | None = None
        if instance is None:
            decision_permission_error = "instance_membership_required"
        else:
            try:
                self._governance.authorize_admin_instance_permission(
                    actor=actor,
                    instance=instance,
                    permission_key="approvals.decide",
                )
            except PermissionError as exc:
                decision_permission_error = str(exc)
        can_decide = decision_permission_error is None and summary.status == "open"
        if summary.status != "open":
            blocked_reason = "approval_not_open"
        elif decision_permission_error is not None:
            blocked_reason = decision_permission_error
        else:
            blocked_reason = None
        return ApprovalDetail(
            **summary.model_dump(),
            evidence={
                "gate_key": link.gate_key,
                "resume_disposition": link.resume_disposition,
                "run_state": run.state,
                "run_kind": run.run_kind,
            },
            source={
                "instance_id": instance.instance_id if instance is not None else None,
                "tenant_id": instance.tenant_id if instance is not None else None,
                "run_id": run.id,
                "attempt_id": link.attempt_id,
                "company_id": link.company_id,
                "issue_id": run.issue_id,
                "workspace_id": run.workspace_id,
                "current_step_key": run.current_step_key,
            },
            artifacts=self._work.list_artifacts_for_target(
                company_id=link.company_id,
                target_kind="approval",
                target_id=summary.approval_id,
            ),
            workspace=workspace.model_dump(mode="json") if workspace is not None else {},
            actions={
                "can_approve": can_decide,
                "can_reject": can_decide,
                "decision_blocked_reason": blocked_reason,
            },
        )

    def _authorized_execution_instances(
        self,
        *,
        actor: AuthenticatedAdmin,
        permission_key: str,
    ) -> list[InstanceRecord]:
        return self._governance.list_accessible_instances(
            actor=actor,
            instances=self._instances.list_instances(),
            permission_key=permission_key,
        )

    def _list_execution_approvals(
        self,
        *,
        actor: AuthenticatedAdmin,
        status: str | None,
        instance: InstanceRecord | None = None,
    ) -> list[ApprovalSummary]:
        if instance is not None:
            self._governance.authorize_admin_instance_permission(
                actor=actor,
                instance=instance,
                permission_key="approvals.read",
            )
            accessible_instances = [instance]
        else:
            accessible_instances = self._authorized_execution_instances(
                actor=actor,
                permission_key="approvals.read",
            )
            if not accessible_instances:
                return []
        allowed_company_ids = {item.company_id for item in accessible_instances}
        instance_by_company = {item.company_id: item for item in accessible_instances}
        with self._session_factory() as session:
            stmt = (
                select(RunApprovalLinkORM, RunORM)
                .join(
                    RunORM,
                    and_(
                        RunORM.id == RunApprovalLinkORM.run_id,
                        RunORM.company_id == RunApprovalLinkORM.company_id,
                    ),
                )
                .order_by(RunApprovalLinkORM.opened_at.desc())
            )
            stmt = stmt.where(RunApprovalLinkORM.company_id.in_(allowed_company_ids))
            if status is not None:
                stmt = stmt.where(RunApprovalLinkORM.gate_status == status)
            rows = session.execute(stmt).all()
            return [
                self._build_execution_summary(
                    link,
                    run,
                    instance=instance_by_company.get(link.company_id),
                )
                for link, run in rows
            ]

    def _get_execution_approval(self, *, company_id: str, approval_id: str) -> tuple[RunApprovalLinkORM, RunORM]:
        with self._session_factory() as session:
            row = session.execute(
                select(RunApprovalLinkORM, RunORM)
                .join(
                    RunORM,
                    and_(
                        RunORM.id == RunApprovalLinkORM.run_id,
                        RunORM.company_id == RunApprovalLinkORM.company_id,
                    ),
                )
                .where(
                    RunApprovalLinkORM.company_id == company_id,
                    RunApprovalLinkORM.approval_id == approval_id,
                )
            ).first()
        if row is None:
            raise LookupError("approval_not_found")
        return row

    def list_approvals(
        self,
        *,
        actor: AuthenticatedAdmin,
        status: str | None = None,
        limit: int = 100,
        instance: InstanceRecord | None = None,
    ) -> list[ApprovalSummary]:
        normalized_status = self._normalize_status(status)
        approvals: list[ApprovalSummary] = []
        approvals.extend(
            self._build_elevated_access_summary(item)
            for item in self._governance.list_elevated_access_requests_for_approval_review(
                actor=actor,
                gate_status=normalized_status,
            )
        )
        approvals.extend(
            self._list_execution_approvals(
                actor=actor,
                status=normalized_status,
                instance=instance,
            )
        )
        approvals.sort(key=self._sort_opened_at, reverse=True)
        return approvals[: max(1, min(limit, 200))]

    def get_approval_detail(
        self,
        *,
        actor: AuthenticatedAdmin,
        approval_id: str,
        instance: InstanceRecord | None = None,
    ) -> ApprovalDetail:
        source_kind, parts = parse_shared_approval_id(approval_id)
        if source_kind == "elevated_access":
            payload = self._governance.get_elevated_access_request_for_approval_review(
                request_id=parts["request_id"],
                actor=actor,
            )
            return self._build_elevated_access_detail(payload, actor=actor)
        resolved_instance = instance or self._resolve_instance_for_company(parts["company_id"])
        if resolved_instance is None:
            raise LookupError("approval_not_found")
        if parts["company_id"] != resolved_instance.company_id:
            raise LookupError("approval_not_found")
        self._governance.authorize_admin_instance_permission(
            actor=actor,
            instance=resolved_instance,
            permission_key="approvals.read",
        )
        link, run = self._get_execution_approval(company_id=parts["company_id"], approval_id=parts["approval_id"])
        return self._build_execution_detail(
            link,
            run,
            actor=actor,
            instance=resolved_instance,
        )

    def decide_approval(
        self,
        *,
        actor: AuthenticatedAdmin,
        approval_id: str,
        approved: bool,
        decision_note: str,
        idempotency_key: str,
        request_fingerprint_hash: str,
        instance: InstanceRecord | None = None,
    ) -> ApprovalDetail:
        source_kind, parts = parse_shared_approval_id(approval_id)
        if source_kind == "elevated_access":
            payload = (
                self._governance.approve_elevated_access_request(
                    request_id=parts["request_id"],
                    actor=actor,
                    decision_note=decision_note,
                )
                if approved
                else self._governance.reject_elevated_access_request(
                    request_id=parts["request_id"],
                    actor=actor,
                    decision_note=decision_note,
                )
            )
            return self._build_elevated_access_detail(payload, actor=actor)
        resolved_instance = instance or self._resolve_instance_for_company(parts["company_id"])
        if resolved_instance is None:
            raise LookupError("approval_not_found")
        if parts["company_id"] != resolved_instance.company_id:
            raise LookupError("approval_not_found")
        self._governance.authorize_admin_instance_permission(
            actor=actor,
            instance=resolved_instance,
            permission_key="approvals.decide",
        )
        result = self._execution.decide_approval(
            company_id=parts["company_id"],
            approval_id=parts["approval_id"],
            actor_type="user",
            actor_id=actor.user_id,
            idempotency_key=idempotency_key,
            request_fingerprint_hash=request_fingerprint_hash,
            approved=approved,
        )
        link, run = self._get_execution_approval(company_id=parts["company_id"], approval_id=parts["approval_id"])
        self._governance.record_admin_audit_event(
            actor=actor,
            action=f"execution_approval_{'approved' if approved else 'rejected'}",
            target_type="execution_approval",
            target_id=approval_id,
            status="ok" if approved else "warning",
            details=f"Execution approval '{parts['approval_id']}' {'approved' if approved else 'rejected'}.",
            metadata={
                "instance_id": resolved_instance.instance_id if resolved_instance is not None else None,
                "company_id": parts["company_id"],
                "native_approval_id": parts["approval_id"],
                "decision_note": decision_note.strip(),
                "command_id": result.command_id,
            },
            instance_id=resolved_instance.instance_id if resolved_instance is not None else None,
            tenant_id=resolved_instance.tenant_id if resolved_instance is not None else None,
            company_id=parts["company_id"],
        )
        return self._build_execution_detail(
            link,
            run,
            actor=actor,
            instance=resolved_instance,
        )
    @staticmethod
    def _sort_opened_at(item: ApprovalSummary) -> datetime:
        return item.opened_at if item.opened_at.tzinfo is not None else item.opened_at.replace(tzinfo=UTC)
