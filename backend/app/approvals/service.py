"""Shared approval queue/detail service spanning execution and elevated access."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.approvals.models import (
    APPROVAL_CLASSES,
    APPROVAL_DUE_STATES,
    APPROVAL_RISK_LEVELS,
    APPROVAL_STATUSES,
    APPROVAL_TYPES,
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
from app.storage.execution_repository import RunApprovalLinkORM, RunCommandORM, RunORM
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
    def _normalize_type_filter(approval_type: str | None) -> str | None:
        if approval_type is None:
            return None
        normalized = approval_type.strip().lower()
        if not normalized:
            return None
        if normalized not in APPROVAL_TYPES:
            raise ValueError("approval_type_invalid")
        return normalized

    @staticmethod
    def _normalize_risk_filter(risk_level: str | None) -> str | None:
        if risk_level is None:
            return None
        normalized = risk_level.strip().lower()
        if not normalized:
            return None
        if normalized not in APPROVAL_RISK_LEVELS:
            raise ValueError("approval_risk_invalid")
        return normalized

    @staticmethod
    def _normalize_due_filter(due_state: str | None) -> str | None:
        if due_state is None:
            return None
        normalized = due_state.strip().lower()
        if not normalized:
            return None
        if normalized not in APPROVAL_DUE_STATES:
            raise ValueError("approval_due_invalid")
        return normalized

    @staticmethod
    def _normalize_class_filter(approval_class: str | None) -> str | None:
        if approval_class is None:
            return None
        normalized = approval_class.strip().lower()
        if not normalized:
            return None
        if normalized not in APPROVAL_CLASSES:
            raise ValueError("approval_class_invalid")
        return normalized

    @staticmethod
    def _due_state(*, status: str, expires_at: datetime | None) -> str:
        if status != "open":
            return "resolved"
        if expires_at is None:
            return "no_deadline"
        now = datetime.now(UTC)
        if expires_at <= now + timedelta(minutes=15):
            return "due_now"
        if expires_at <= now + timedelta(hours=24):
            return "due_soon"
        return "later"

    @staticmethod
    def _target_label_for_run(run: RunORM) -> str:
        if run.issue_id and run.workspace_id:
            return f"Issue {run.issue_id} in workspace {run.workspace_id}"
        if run.issue_id:
            return f"Issue {run.issue_id}"
        if run.workspace_id:
            return f"Workspace {run.workspace_id}"
        return f"Run {run.run_kind}"

    def _command_actor_summary(self, actor_type: str | None, actor_id: str | None) -> ApprovalActorSummary | None:
        normalized_actor_id = (actor_id or "").strip()
        if not normalized_actor_id:
            return None
        normalized_actor_type = (actor_type or "").strip() or None
        if normalized_actor_type == "user":
            user_lookup = getattr(self._governance, "_find_user_by_id", None)
            if callable(user_lookup):
                user = user_lookup(normalized_actor_id)
                if user is not None:
                    return ApprovalActorSummary(
                        user_id=user.user_id,
                        username=user.username,
                        display_name=user.display_name,
                        role=user.role,
                    )
        return ApprovalActorSummary(
            user_id=normalized_actor_id,
            display_name=normalized_actor_id,
            role=normalized_actor_type,
        )

    @staticmethod
    def _actor_label(actor: ApprovalActorSummary | None) -> str:
        if actor is None:
            return "Not recorded"
        return actor.display_name or actor.username or actor.user_id or "Not recorded"

    def _audit_actor_label(self, actor_type: str, actor_id: str | None) -> str:
        normalized_actor_id = (actor_id or "").strip()
        if actor_type == "admin_user" and normalized_actor_id:
            actor = self._command_actor_summary("user", normalized_actor_id)
            if actor is not None:
                return actor.display_name or actor.username or actor.user_id or "Admin user"
        if actor_type == "system":
            return "System"
        if actor_type == "anonymous":
            return "Anonymous"
        return normalized_actor_id or actor_type.replace("_", " ")

    def _approval_audit_history(
        self,
        *,
        target_type: str,
        target_id: str,
        company_id: str | None = None,
        tenant_id: str | None = None,
        limit: int = 6,
    ) -> dict[str, object]:
        events = self._governance.list_audit_events(limit=200, tenant_id=tenant_id, company_id=company_id)
        matching = [event for event in events if event.target_type == target_type and event.target_id == target_id][:limit]
        entries = [
            {
                "event_id": event.event_id,
                "created_at": event.created_at,
                "action": event.action,
                "status": event.status,
                "actor": self._audit_actor_label(event.actor_type, event.actor_id),
                "details": event.details,
                "decision_note": event.metadata.get("decision_note"),
            }
            for event in matching
        ]
        return {
            "target_type": target_type,
            "target_id": target_id,
            "entry_count": len(entries),
            "latest_event_at": matching[0].created_at if matching else None,
            "entries": entries,
        }

    @staticmethod
    def _with_fallback_audit_entry(
        audit_history: dict[str, object],
        fallback_entry: dict[str, object],
    ) -> dict[str, object]:
        entries = audit_history.get("entries")
        if isinstance(entries, list) and entries:
            return audit_history
        return {
            **audit_history,
            "entry_count": 1,
            "latest_event_at": fallback_entry.get("created_at"),
            "entries": [fallback_entry],
        }

    @staticmethod
    def _execution_risk_profile(run: RunORM, link: RunApprovalLinkORM) -> tuple[str, str, bool]:
        run_kind = run.run_kind.strip().lower()
        if "recovery" in run_kind or "restore" in run_kind or "backup" in run_kind:
            return "high", "Recovery or restore flow", True
        if "release" in run_kind or "migration" in run_kind:
            return "high", "Release or migration control", True
        if link.resume_disposition in {"fail", "cancel", "compensate"}:
            return "high", "Reject path triggers irreversible downstream handling", True
        if "dispatch" in run_kind or "routing" in run_kind:
            return "medium", "Queued runtime work resumes after approval", False
        return "medium", "Execution progress gate", False

    @staticmethod
    def _elevated_access_risk_profile(request_type: str) -> tuple[str, str, bool]:
        if request_type == "break_glass":
            return "critical", "Break-glass admin access", True
        return "high", "User impersonation access", True

    @staticmethod
    def _execution_next_step(status: str) -> str:
        if status == "open":
            return "Review evidence and record approve or reject. Run pause/resume/retry stays on Execution Review."
        if status == "approved":
            return "Verify the downstream run state on Execution Review."
        if status == "rejected":
            return "Check the deny path on Execution Review and confirm the final run outcome."
        return "Review retained audit history and linked execution state."

    @staticmethod
    def _elevated_access_next_step(*, status: str, ready_to_issue: bool, session_status: str | None) -> str:
        if status == "open":
            return "Review access evidence and record approve or reject. Session issuance stays on Security & Policies."
        if ready_to_issue:
            return "Requester must start the approved elevated session from Security & Policies."
        if session_status == "active":
            return "Review the active elevated session on Security & Policies."
        return "Review retained audit history and access-session posture."

    @staticmethod
    def _requester_from_payload(
        payload: dict[str, object],
    ) -> ApprovalActorSummary | None:
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
    def _decision_actor_from_payload(
        payload: dict[str, object],
    ) -> ApprovalActorSummary | None:
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
        risk_level, risk_label, irreversible = self._elevated_access_risk_profile(request_type)
        gate_status = str(payload["gate_status"])
        ready_to_issue = bool(payload.get("ready_to_issue", False))
        session_status = payload.get("session_status")
        expires_at = self._parse_dt(payload.get("approval_expires_at"))
        return ApprovalSummary(
            approval_id=str(payload.get("approval_id") or build_elevated_access_approval_id(str(payload["request_id"]))),
            source_kind="elevated_access",
            native_approval_id=str(payload["request_id"]),
            approval_type=request_type,  # type: ignore[arg-type]
            approval_class="elevated_access",
            status=gate_status,  # type: ignore[arg-type]
            title=f"{title_prefix} approval for {target_label}",
            opened_at=self._parse_dt(payload["created_at"]),
            decided_at=self._parse_dt(payload.get("decided_at")),
            expires_at=expires_at,
            requester=self._requester_from_payload(payload),
            target=self._target_from_payload(payload),
            decision_actor=self._decision_actor_from_payload(payload),
            ready_to_issue=ready_to_issue,
            session_status=session_status,  # type: ignore[arg-type]
            risk_level=risk_level,  # type: ignore[arg-type]
            risk_label=risk_label,
            due_state=self._due_state(status=gate_status, expires_at=expires_at),  # type: ignore[arg-type]
            next_step=self._elevated_access_next_step(
                status=gate_status,
                ready_to_issue=ready_to_issue,
                session_status=str(session_status) if session_status is not None else None,
            ),
            consequence_summary=("Approving records access eligibility only. The requester must still issue the session from Security & Policies."),
            irreversible=irreversible,
        )

    def _build_elevated_access_detail(
        self,
        payload: dict[str, object],
        *,
        actor: AuthenticatedAdmin,
    ) -> ApprovalDetail:
        summary = self._build_elevated_access_summary(payload)
        request_type = str(payload["request_type"])
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
        audit_history = self._with_fallback_audit_entry(
            self._approval_audit_history(
                target_type="elevated_access_request",
                target_id=str(payload["request_id"]),
            ),
            {
                "event_id": f"{summary.approval_id}:requested",
                "created_at": payload.get("created_at"),
                "action": f"{request_type}_requested",
                "status": "ok",
                "actor": self._actor_label(summary.requester),
                "details": "Elevated-access request entered the shared approvals queue.",
                "decision_note": payload.get("decision_note"),
            },
        )
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
            action_preview={
                "decision_surface": "Approve or reject only",
                "decision_boundary": "This page records the approval outcome. Session issuance, expiry review, and revocation stay on Security & Policies.",
                "approve_effect": ("Marks the request approved and makes the session eligible to start; it does not issue the elevated session."),
                "reject_effect": "Closes the request as rejected and prevents any session issuance from this approval item.",
                "risk_level": summary.risk_level,
                "risk_label": summary.risk_label,
                "irreversible": summary.irreversible,
            },
            affected_identity={
                "requester": summary.requester.model_dump(mode="json") if summary.requester is not None else None,
                "target": summary.target.model_dump(mode="json") if summary.target is not None else None,
                "decision_actor": summary.decision_actor.model_dump(mode="json") if summary.decision_actor is not None else None,
            },
            affected_scope={
                "request_id": payload.get("request_id"),
                "request_type": payload.get("request_type"),
                "approval_reference": payload.get("approval_reference"),
                "duration_minutes": payload.get("duration_minutes"),
                "session_role": payload.get("session_role"),
                "target_role": payload.get("target_role"),
                "notification_targets": list(payload.get("notification_targets", [])),
            },
            consequence={
                "approve": "Requester can start the approved elevated session from Security & Policies.",
                "reject": "Request is denied and no elevated session can be issued from this approval item.",
                "irreversible": summary.irreversible,
                "follow_up_surface": "Security & Policies",
            },
            audit_history={
                **audit_history,
                "approval_id": summary.approval_id,
                "status": summary.status,
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

    def _list_execution_requesters(
        self,
        session: Session,
        *,
        company_ids: set[str],
        run_ids: set[str],
    ) -> dict[str, ApprovalActorSummary | None]:
        if not company_ids or not run_ids:
            return {}
        rows = session.execute(
            select(
                RunCommandORM.run_id,
                RunCommandORM.actor_type,
                RunCommandORM.actor_id,
            )
            .where(
                RunCommandORM.company_id.in_(company_ids),
                RunCommandORM.run_id.in_(run_ids),
                RunCommandORM.command_type == "create",
            )
            .order_by(RunCommandORM.issued_at.asc())
        ).all()
        requester_by_run: dict[str, ApprovalActorSummary | None] = {}
        for run_id, actor_type, actor_id in rows:
            if run_id not in requester_by_run:
                requester_by_run[run_id] = self._command_actor_summary(actor_type, actor_id)
        return requester_by_run

    def _build_execution_summary(
        self,
        link: RunApprovalLinkORM,
        run: RunORM,
        *,
        instance: InstanceRecord | None = None,
        requester: ApprovalActorSummary | None = None,
    ) -> ApprovalSummary:
        instance = instance or self._resolve_instance_for_company(link.company_id)
        risk_level, risk_label, irreversible = self._execution_risk_profile(run, link)
        return ApprovalSummary(
            approval_id=build_execution_approval_id(
                instance_id=instance.instance_id if instance is not None else None,
                company_id=link.company_id,
                approval_id=link.approval_id,
            ),
            source_kind="execution_run",
            native_approval_id=link.approval_id,
            approval_type="execution_run",
            approval_class="execution_control",
            status=link.gate_status,  # type: ignore[arg-type]
            title=f"Execution approval for {run.run_kind}",
            opened_at=link.opened_at,
            decided_at=link.decided_at,
            instance_id=instance.instance_id if instance is not None else None,
            company_id=link.company_id,
            issue_id=run.issue_id,
            workspace_id=run.workspace_id,
            requester=requester,
            target=ApprovalActorSummary(display_name=self._target_label_for_run(run), role="execution_scope"),
            decision_actor=ApprovalActorSummary(user_id=link.decision_actor_id),
            risk_level=risk_level,  # type: ignore[arg-type]
            risk_label=risk_label,
            due_state=self._due_state(status=link.gate_status, expires_at=None),  # type: ignore[arg-type]
            next_step=self._execution_next_step(link.gate_status),
            consequence_summary=("Approving re-opens the paused execution path. Rejecting sends the run into its configured deny flow."),
            irreversible=irreversible,
        )

    def _build_execution_detail(
        self,
        link: RunApprovalLinkORM,
        run: RunORM,
        *,
        actor: AuthenticatedAdmin,
        instance: InstanceRecord | None = None,
        requester: ApprovalActorSummary | None = None,
    ) -> ApprovalDetail:
        instance = instance or self._resolve_instance_for_company(link.company_id)
        summary = self._build_execution_summary(link, run, instance=instance, requester=requester)
        workspace = self._work.get_workspace_summary(company_id=link.company_id, workspace_id=run.workspace_id) if run.workspace_id else None
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
        audit_history = self._with_fallback_audit_entry(
            self._approval_audit_history(
                target_type="execution_approval",
                target_id=summary.approval_id,
                company_id=link.company_id,
                tenant_id=instance.tenant_id if instance is not None else None,
            ),
            {
                "event_id": f"{summary.approval_id}:opened",
                "created_at": link.opened_at.isoformat(),
                "action": "execution_approval_opened",
                "status": "ok",
                "actor": self._actor_label(summary.requester),
                "details": "Execution approval is waiting for a decision.",
                "decision_note": None,
            },
        )
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
            action_preview={
                "decision_surface": "Approve or reject only",
                "decision_boundary": "This page records the approval outcome. Pause, resume, retry, and replay controls remain on Execution Review.",
                "approve_effect": "Approving lets the waiting execution path continue according to the stored resume disposition.",
                "reject_effect": "Rejecting sends the run into its configured deny path such as failed, cancel, or compensating.",
                "risk_level": summary.risk_level,
                "risk_label": summary.risk_label,
                "irreversible": summary.irreversible,
            },
            affected_identity={
                "requester": summary.requester.model_dump(mode="json") if summary.requester is not None else None,
                "target": summary.target.model_dump(mode="json") if summary.target is not None else None,
                "decision_actor": summary.decision_actor.model_dump(mode="json") if summary.decision_actor is not None else None,
            },
            affected_scope={
                "instance_id": instance.instance_id if instance is not None else None,
                "tenant_id": instance.tenant_id if instance is not None else None,
                "company_id": link.company_id,
                "workspace_id": run.workspace_id,
                "issue_id": run.issue_id,
                "run_id": run.id,
                "attempt_id": link.attempt_id,
                "run_kind": run.run_kind,
                "current_step_key": run.current_step_key,
            },
            consequence={
                "approve": "Paused execution becomes eligible to continue or re-queue.",
                "reject": "The configured deny flow runs next and may fail, cancel, or compensate the run.",
                "irreversible": summary.irreversible,
                "follow_up_surface": "Execution Review",
            },
            audit_history={
                **audit_history,
                "native_approval_id": link.approval_id,
                "status": summary.status,
                "instance_id": instance.instance_id if instance is not None else None,
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
            requester_by_run = self._list_execution_requesters(
                session,
                company_ids=allowed_company_ids,
                run_ids={run.id for _link, run in rows},
            )
            return [
                self._build_execution_summary(
                    link,
                    run,
                    instance=instance_by_company.get(link.company_id),
                    requester=requester_by_run.get(run.id),
                )
                for link, run in rows
            ]

    def _get_execution_approval(
        self,
        *,
        company_id: str,
        approval_id: str,
    ) -> tuple[RunApprovalLinkORM, RunORM, ApprovalActorSummary | None]:
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
            requester_by_run = self._list_execution_requesters(
                session,
                company_ids={company_id},
                run_ids={row[1].id} if row is not None else set(),
            )
        if row is None:
            raise LookupError("approval_not_found")
        link, run = row
        return link, run, requester_by_run.get(run.id)

    @staticmethod
    def _matches_summary_filters(
        approval: ApprovalSummary,
        *,
        approval_type: str | None,
        risk_level: str | None,
        due_state: str | None,
        approval_class: str | None,
    ) -> bool:
        if approval_type is not None and approval.approval_type != approval_type:
            return False
        if risk_level is not None and approval.risk_level != risk_level:
            return False
        if due_state is not None and approval.due_state != due_state:
            return False
        if approval_class is not None and approval.approval_class != approval_class:
            return False
        return True

    def list_approvals(
        self,
        *,
        actor: AuthenticatedAdmin,
        status: str | None = None,
        approval_type: str | None = None,
        risk_level: str | None = None,
        due_state: str | None = None,
        approval_class: str | None = None,
        limit: int = 100,
        instance: InstanceRecord | None = None,
    ) -> list[ApprovalSummary]:
        normalized_status = self._normalize_status(status)
        normalized_type = self._normalize_type_filter(approval_type)
        normalized_risk = self._normalize_risk_filter(risk_level)
        normalized_due = self._normalize_due_filter(due_state)
        normalized_class = self._normalize_class_filter(approval_class)
        approvals: list[ApprovalSummary] = []
        if instance is None:
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
        approvals = [
            item
            for item in approvals
            if self._matches_summary_filters(
                item,
                approval_type=normalized_type,
                risk_level=normalized_risk,
                due_state=normalized_due,
                approval_class=normalized_class,
            )
        ]
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
        link, run, requester = self._get_execution_approval(company_id=parts["company_id"], approval_id=parts["approval_id"])
        return self._build_execution_detail(
            link,
            run,
            actor=actor,
            instance=resolved_instance,
            requester=requester,
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
        link, run, requester = self._get_execution_approval(company_id=parts["company_id"], approval_id=parts["approval_id"])
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
            requester=requester,
        )

    @staticmethod
    def _sort_opened_at(item: ApprovalSummary) -> datetime:
        return item.opened_at if item.opened_at.tzinfo is not None else item.opened_at.replace(tzinfo=UTC)
