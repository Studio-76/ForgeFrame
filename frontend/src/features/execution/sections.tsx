import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import type {
  ExecutionOperatorActionResult,
  ExecutionReplayResult,
  ExecutionRunApprovalLinkView,
  ExecutionRunDetail,
  ExecutionRunSummary,
} from "../../api/admin";
import { buildArtifactsPath, buildWorkspacePath } from "../../app/workInteractionRoutes";
import {
  APPROVAL_WAIT_OPTIONS,
  countApprovalWaitRuns,
  countAttentionRuns,
  countErrorRuns,
  countReplayableRuns,
  describeExecutionError,
  describeExecutionLifecycle,
  describeExecutionRunCostClass,
  describeExecutionRunTarget,
  describeExecutionScopeOption,
  describeNextExecutionAction,
  ERROR_FILTER_OPTIONS,
  formatJson,
  formatTimestamp,
  getOperatorActionAvailability,
  getStartedAt,
  getStateTone,
  LANE_OPTIONS,
  STATE_OPTIONS,
  WINDOW_OPTIONS,
  type ExecutionAccessState,
  type ExecutionApprovalWaitFilter,
  type ExecutionErrorFilter,
  type ExecutionOperatorActionKey,
  type ExecutionScopeOption,
  type ExecutionWindowFilter,
  type LoadState,
  type OperatorActionState,
  type ReplayState,
} from "./helpers";

type ScopeFilterCardProps = {
  instanceId: string;
  companyId: string;
  scopeOptionsState: LoadState;
  scopeOptions: ExecutionScopeOption[];
  scopeOptionsError: string;
  instanceDraft: string;
  stateDraft: string;
  laneDraft: string;
  targetDraft: string;
  approvalWaitDraft: ExecutionApprovalWaitFilter;
  errorDraft: ExecutionErrorFilter;
  windowDraft: ExecutionWindowFilter;
  onInstanceDraftChange: (value: string) => void;
  onStateDraftChange: (value: string) => void;
  onLaneDraftChange: (value: string) => void;
  onTargetDraftChange: (value: string) => void;
  onApprovalWaitDraftChange: (value: ExecutionApprovalWaitFilter) => void;
  onErrorDraftChange: (value: ExecutionErrorFilter) => void;
  onWindowDraftChange: (value: ExecutionWindowFilter) => void;
  onScopeSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onScopeClear: () => void;
  onScopeChoice: (instanceId: string) => void;
};

type ExecutionRunsSectionProps = {
  instanceId: string;
  companyId: string;
  stateFilter: string;
  laneFilter: string;
  targetFilter: string;
  approvalWaitFilter: ExecutionApprovalWaitFilter;
  errorFilter: ExecutionErrorFilter;
  windowFilter: ExecutionWindowFilter;
  runsState: LoadState;
  runs: ExecutionRunSummary[];
  runsError: string;
  selectedRunId: string;
  selectedSummary: ExecutionRunSummary | null;
  detailState: LoadState;
  detail: ExecutionRunDetail | null;
  detailError: string;
  access: ExecutionAccessState;
  showReplayForm: boolean;
  replayReason: string;
  idempotencyKey: string;
  replayState: ReplayState;
  replayError: string;
  replayResult: ExecutionReplayResult | null;
  replayAuditHistoryPath: string | null;
  operatorReason: string;
  operatorLane: string;
  operatorActionState: OperatorActionState;
  operatorActionError: string;
  operatorActionResult: ExecutionOperatorActionResult | null;
  onRunSelection: (runId: string) => void;
  onReplayReasonChange: (value: string) => void;
  onIdempotencyKeyChange: (value: string) => void;
  onReplaySubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOperatorReasonChange: (value: string) => void;
  onOperatorLaneChange: (value: string) => void;
  onOperatorAction: (action: ExecutionOperatorActionKey) => void;
};

type TimelineItem = {
  id: string;
  at: string;
  label: string;
  detail: string;
  tone: "neutral" | "success" | "warning" | "danger";
  linkTo?: string;
  linkLabel?: string;
  raw?: unknown;
};

function buildApprovalRoute(instanceId: string, approvalId: string): string {
  const params = new URLSearchParams({ instanceId, approvalId, status: "all" });
  return `/approvals?${params.toString()}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function describeValue(value: unknown, fallback = "Not recorded"): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  return String(value);
}

function approvalLinkLabel(link: ExecutionRunApprovalLinkView): string {
  return `${link.approval_id} · ${link.gate_status} · ${link.resume_disposition}`;
}

function buildTimeline(detail: ExecutionRunDetail, instanceId: string): TimelineItem[] {
  const items: TimelineItem[] = [
    {
      id: `run-created:${detail.run_id}`,
      at: detail.created_at,
      label: "Run created",
      detail: `${detail.run_kind} entered ForgeFrame execution on lane ${detail.execution_lane}.`,
      tone: "neutral",
      raw: { run_id: detail.run_id, run_kind: detail.run_kind, execution_lane: detail.execution_lane },
    },
  ];

  for (const attempt of detail.attempts) {
    items.push({
      id: `attempt-scheduled:${attempt.id}`,
      at: attempt.scheduled_at,
      label: `Attempt ${attempt.attempt_no} scheduled`,
      detail: `Attempt ${attempt.attempt_no} entered ${attempt.attempt_state} with operator state ${attempt.operator_state}.`,
      tone: getStateTone(attempt.operator_state),
      raw: attempt,
    });
    if (attempt.started_at) {
      items.push({
        id: `attempt-started:${attempt.id}`,
        at: attempt.started_at,
        label: `Attempt ${attempt.attempt_no} started`,
        detail: `Worker lease ${attempt.lease_status} with worker ${attempt.worker_key ?? "not attached"}.`,
        tone: "neutral",
        raw: attempt,
      });
    }
    if (attempt.finished_at) {
      items.push({
        id: `attempt-finished:${attempt.id}`,
        at: attempt.finished_at,
        label: `Attempt ${attempt.attempt_no} finished`,
        detail: `Finished as ${attempt.attempt_state}${attempt.last_error_code ? ` with ${attempt.last_error_code}` : ""}.`,
        tone: getStateTone(attempt.attempt_state),
        raw: attempt,
      });
    }
  }

  for (const command of detail.commands) {
    items.push({
      id: `command:${command.id}`,
      at: command.issued_at,
      label: `Command ${command.command_type}`,
      detail: `${command.actor_type} ${command.actor_id} recorded ${command.command_status}${command.accepted_transition ? ` and accepted ${command.accepted_transition}` : ""}.`,
      tone: command.command_status === "completed" ? "success" : "warning",
      raw: command,
    });
  }

  for (const approval of detail.approval_links) {
    items.push({
      id: `approval-opened:${approval.id}`,
      at: approval.opened_at,
      label: `Approval opened`,
      detail: `${approval.approval_id} opened on gate ${approval.gate_key} with ${approval.resume_disposition} disposition.`,
      tone: approval.gate_status === "open" ? "warning" : "neutral",
      linkTo: buildApprovalRoute(instanceId, approval.approval_id),
      linkLabel: "Open approval",
      raw: approval,
    });
    if (approval.decided_at) {
      items.push({
        id: `approval-decided:${approval.id}`,
        at: approval.decided_at,
        label: `Approval ${approval.gate_status}`,
        detail: `${approval.approval_id} was decided by ${approval.decision_actor_type ?? "unknown"} ${approval.decision_actor_id ?? "unknown"}.`,
        tone: approval.gate_status === "approved" ? "success" : approval.gate_status === "rejected" ? "danger" : "warning",
        linkTo: buildApprovalRoute(instanceId, approval.approval_id),
        linkLabel: "Open approval",
        raw: approval,
      });
    }
    if (approval.resume_enqueued_at) {
      items.push({
        id: `approval-resume:${approval.id}`,
        at: approval.resume_enqueued_at,
        label: "Approval resume enqueued",
        detail: `${approval.approval_id} enqueued the follow-up resume/cancel path.`,
        tone: "success",
        linkTo: buildApprovalRoute(instanceId, approval.approval_id),
        linkLabel: "Open approval",
        raw: approval,
      });
    }
  }

  for (const entry of detail.outbox) {
    items.push({
      id: `outbox:${entry.id}`,
      at: entry.available_at,
      label: `Outbox ${entry.event_type}`,
      detail: `Publish state ${entry.publish_state} after ${entry.publish_attempts} attempts.`,
      tone: getStateTone(entry.publish_state),
      raw: entry,
    });
    if (entry.published_at) {
      items.push({
        id: `outbox-published:${entry.id}`,
        at: entry.published_at,
        label: `${entry.event_type} published`,
        detail: `The outbox event was published successfully.`,
        tone: "success",
        raw: entry,
      });
    }
    if (entry.dead_lettered_at) {
      items.push({
        id: `outbox-dead-lettered:${entry.id}`,
        at: entry.dead_lettered_at,
        label: `${entry.event_type} dead-lettered`,
        detail: entry.last_publish_error ?? "Outbox publish failed and was dead-lettered.",
        tone: "danger",
        raw: entry,
      });
    }
  }

  return items.sort((left, right) => right.at.localeCompare(left.at));
}

function ScopeFilterPills({
  stateFilter,
  laneFilter,
  approvalWaitFilter,
  errorFilter,
  windowFilter,
  targetFilter,
}: {
  stateFilter: string;
  laneFilter: string;
  approvalWaitFilter: ExecutionApprovalWaitFilter;
  errorFilter: ExecutionErrorFilter;
  windowFilter: ExecutionWindowFilter;
  targetFilter: string;
}) {
  return (
    <div className="fg-actions">
      <span className="fg-pill" data-tone="neutral">State: {stateFilter === "all" ? "all" : stateFilter}</span>
      <span className="fg-pill" data-tone="neutral">Lane: {laneFilter || "all"}</span>
      <span className="fg-pill" data-tone="neutral">Approvals: {approvalWaitFilter === "waiting_only" ? "waiting only" : "all"}</span>
      <span className="fg-pill" data-tone="neutral">Errors: {errorFilter === "with_error" ? "with errors" : "all"}</span>
      <span className="fg-pill" data-tone="neutral">Window: {windowFilter}</span>
      {targetFilter ? <span className="fg-pill" data-tone="neutral">Target: {targetFilter}</span> : null}
    </div>
  );
}

function RunTable({ runs, selectedRunId, onRunSelection, instanceId }: { runs: ExecutionRunSummary[]; selectedRunId: string; onRunSelection: (runId: string) => void; instanceId: string }) {
  return (
    <div className="fg-table-wrap">
      <table className="fg-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Title / purpose</th>
            <th>State</th>
            <th>Lane</th>
            <th>Target</th>
            <th>Attempts</th>
            <th>Cost class</th>
            <th>Started</th>
            <th>Updated</th>
            <th>Next action</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const lifecycle = describeExecutionLifecycle(run);
            const nextAction = describeNextExecutionAction(run);
            const title = run.issue_id ? `Issue ${run.issue_id}` : run.workspace_id ? `Workspace ${run.workspace_id}` : run.run_kind;
            const purpose = run.issue_id
              ? `${run.run_kind} for ${run.issue_id}`
              : run.workspace_id
                ? `${run.run_kind} linked to ${run.workspace_id}`
                : run.status_reason ?? "No explicit business context was attached.";
            return (
              <tr key={run.run_id} className={run.run_id === selectedRunId ? "is-selected" : undefined}>
                <td>
                  <button className="fg-table-trigger" type="button" onClick={() => onRunSelection(run.run_id)}>
                    {run.run_id}
                  </button>
                </td>
                <td>
                  <strong>{title}</strong>
                  <div className="fg-muted">{purpose}</div>
                </td>
                <td>
                  <span className="fg-pill" data-tone={getStateTone(run.state)}>{run.state}</span>
                  <div className="fg-muted">{lifecycle.label}</div>
                </td>
                <td>{run.execution_lane}</td>
                <td>{describeExecutionRunTarget(run)}</td>
                <td>{run.active_attempt_no}</td>
                <td>{describeExecutionRunCostClass(run)}</td>
                <td>{formatTimestamp(getStartedAt(run))}</td>
                <td>{formatTimestamp(run.updated_at)}</td>
                <td>
                  <strong>{nextAction.label}</strong>
                  <div className="fg-muted">{nextAction.detail}</div>
                  {run.current_approval_id ? (
                    <Link className="fg-nav-link" to={buildApprovalRoute(instanceId, run.current_approval_id)}>
                      Open approval
                    </Link>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RunTimeline({ detail, instanceId }: { detail: ExecutionRunDetail; instanceId: string }) {
  const items = buildTimeline(detail, instanceId);

  return (
    <article className="fg-subcard">
      <div className="fg-panel-heading">
        <div>
          <h4>Timeline</h4>
          <p className="fg-muted">Lifecycle events combine attempts, operator commands, approval gates, and outbox delivery into one reviewable sequence.</p>
        </div>
        <span className="fg-pill" data-tone="neutral">{items.length} events</span>
      </div>
      {items.length === 0 ? (
        <p className="fg-muted">No timeline events were returned for this run.</p>
      ) : (
        <div className="fg-stack">
          {items.map((item) => (
            <details key={item.id} className="fg-outline-row">
              <summary>
                {item.label} · {formatTimestamp(item.at)}
              </summary>
              <div className="fg-stack">
                <span className="fg-pill" data-tone={item.tone}>{item.detail}</span>
                {item.linkTo && item.linkLabel ? <Link className="fg-nav-link" to={item.linkTo}>{item.linkLabel}</Link> : null}
                {item.raw ? <pre>{formatJson(item.raw)}</pre> : null}
              </div>
            </details>
          ))}
        </div>
      )}
    </article>
  );
}

function RunDecisions({ detail, instanceId }: { detail: ExecutionRunDetail; instanceId: string }) {
  const resultSummary = asRecord(detail.result_summary);
  const routing = asRecord(resultSummary?.routing);
  const structuredExplainability = asRecord(routing?.structured_explainability) ?? asRecord(routing?.structured_details);
  const rawExplainability = asRecord(routing?.raw_explainability) ?? asRecord(routing?.raw_details);
  const selectionBasis = asRecord(rawExplainability?.selection_basis);
  const blockedCostClasses = Array.isArray(selectionBasis?.blocked_cost_classes)
    ? selectionBasis.blocked_cost_classes.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];
  const decisionCommands = detail.commands.filter((command) => command.command_type !== "create");

  return (
    <div className="fg-card-grid">
      <article className="fg-subcard">
        <div className="fg-panel-heading">
          <div>
            <h4>Routing and lifecycle decisions</h4>
            <p className="fg-muted">Run lifecycle is explained in operator language instead of leaving only raw status strings behind.</p>
          </div>
          <span className="fg-pill" data-tone={describeExecutionLifecycle(detail).tone}>{describeExecutionLifecycle(detail).label}</span>
        </div>
        <ul className="fg-list">
          <li>Lifecycle meaning: {describeExecutionLifecycle(detail).detail}</li>
          <li>Target: {describeExecutionRunTarget(detail)}</li>
          <li>Cost class: {describeExecutionRunCostClass(detail)}</li>
          <li>Error posture: {describeExecutionError(detail)}</li>
          <li>Routing summary: {describeValue(routing?.summary, "No routing summary was recorded.")}</li>
          <li>Classification: {describeValue(routing?.classification)}</li>
          <li>Policy stage: {describeValue(routing?.policy_stage)}</li>
          <li>Blocked cost classes: {blockedCostClasses.length > 0 ? blockedCostClasses.join(", ") : "none recorded"}</li>
          <li>Candidate count: {describeValue(structuredExplainability?.candidate_count)}</li>
        </ul>
      </article>

      <article className="fg-subcard">
        <div className="fg-panel-heading">
          <div>
            <h4>Approval links</h4>
            <p className="fg-muted">Approval waits are explicit control-plane objects, not a vague status label.</p>
          </div>
          <span className="fg-pill" data-tone={detail.approval_links.some((item) => item.gate_status === "open") ? "warning" : "neutral"}>
            {detail.approval_links.some((item) => item.gate_status === "open") ? "Open approval wait" : "No open approval"}
          </span>
        </div>
        {detail.approval_links.length === 0 ? (
          <p className="fg-muted">No approval links were recorded for this run.</p>
        ) : (
          <div className="fg-stack">
            {detail.approval_links.map((approval) => (
              <div key={approval.id} className="fg-outline-row">
                <div className="fg-panel-heading fg-data-row-heading">
                  <strong>{approvalLinkLabel(approval)}</strong>
                  <span className="fg-pill" data-tone={approval.gate_status === "approved" ? "success" : approval.gate_status === "rejected" ? "danger" : "warning"}>
                    {approval.gate_status}
                  </span>
                </div>
                <ul className="fg-list">
                  <li>Gate key: {approval.gate_key}</li>
                  <li>Opened: {formatTimestamp(approval.opened_at)}</li>
                  <li>Decided: {formatTimestamp(approval.decided_at)}</li>
                  <li>Resume enqueued: {formatTimestamp(approval.resume_enqueued_at)}</li>
                  <li>Decision actor: {approval.decision_actor_type ?? "Not recorded"} {approval.decision_actor_id ?? ""}</li>
                </ul>
                <Link className="fg-nav-link" to={buildApprovalRoute(instanceId, approval.approval_id)}>
                  Open approval
                </Link>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="fg-subcard">
        <div className="fg-panel-heading">
          <div>
            <h4>Operator decisions</h4>
            <p className="fg-muted">Every control action shown here corresponds to a durable command record.</p>
          </div>
          <span className="fg-pill" data-tone={decisionCommands.length > 0 ? "success" : "neutral"}>{decisionCommands.length} decisions</span>
        </div>
        {decisionCommands.length === 0 ? (
          <p className="fg-muted">No operator decisions have been recorded beyond the original create command.</p>
        ) : (
          <div className="fg-stack">
            {decisionCommands.map((command) => (
              <details key={command.id} className="fg-outline-row">
                <summary>
                  {command.command_type} · {command.command_status} · {formatTimestamp(command.issued_at)}
                </summary>
                <ul className="fg-list">
                  <li>Actor: {command.actor_type} · {command.actor_id}</li>
                  <li>Accepted transition: {command.accepted_transition ?? "Not recorded"}</li>
                  <li>Idempotency key: <span className="fg-code">{command.idempotency_key}</span></li>
                </ul>
                <pre>{formatJson(command.response_snapshot)}</pre>
              </details>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}

function DispatchJobs({ detail }: { detail: ExecutionRunDetail }) {
  return (
    <div className="fg-card-grid">
      <article className="fg-subcard">
        <div className="fg-panel-heading">
          <div>
            <h4>Dispatch jobs</h4>
            <p className="fg-muted">Attempts are the durable dispatch jobs behind the run lifecycle.</p>
          </div>
          <span className="fg-pill" data-tone="neutral">{detail.attempts.length} attempts</span>
        </div>
        {detail.attempts.length === 0 ? (
          <p className="fg-muted">No attempt records were returned for this run snapshot.</p>
        ) : (
          <div className="fg-stack">
            {detail.attempts.map((attempt) => (
              <div key={attempt.id} className="fg-outline-row">
                <div className="fg-panel-heading fg-data-row-heading">
                  <strong>Attempt {attempt.attempt_no}</strong>
                  <span className="fg-pill" data-tone={getStateTone(attempt.attempt_state)}>{attempt.attempt_state}</span>
                </div>
                <ul className="fg-list">
                  <li>Operator state: {attempt.operator_state}</li>
                  <li>Lease status: {attempt.lease_status}</li>
                  <li>Worker: {attempt.worker_key ?? "No worker attached"}</li>
                  <li>Scheduled: {formatTimestamp(attempt.scheduled_at)}</li>
                  <li>Started: {formatTimestamp(attempt.started_at)}</li>
                  <li>Finished: {formatTimestamp(attempt.finished_at)}</li>
                  <li>Retry count: {attempt.retry_count}</li>
                  <li>Last error: {attempt.last_error_code ?? "None"}{attempt.last_error_detail ? ` · ${attempt.last_error_detail}` : ""}</li>
                </ul>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="fg-subcard">
        <div className="fg-panel-heading">
          <div>
            <h4>Dispatch outbox</h4>
            <p className="fg-muted">Outbox events show the next concrete worker-side or approval-side effect.</p>
          </div>
          <span className="fg-pill" data-tone="neutral">{detail.outbox.length} entries</span>
        </div>
        {detail.outbox.length === 0 ? (
          <p className="fg-muted">No outbox entries were returned for this run snapshot.</p>
        ) : (
          <div className="fg-stack">
            {detail.outbox.map((entry) => (
              <details key={entry.id} className="fg-outline-row">
                <summary>
                  {entry.event_type} · {entry.publish_state} · available {formatTimestamp(entry.available_at)}
                </summary>
                <ul className="fg-list">
                  <li>Publish attempts: {entry.publish_attempts}</li>
                  <li>Published at: {formatTimestamp(entry.published_at)}</li>
                  <li>Dead-lettered at: {formatTimestamp(entry.dead_lettered_at)}</li>
                  <li>Last publish error: {entry.last_publish_error ?? "None"}</li>
                </ul>
                <pre>{formatJson(entry.payload)}</pre>
              </details>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}

function ArtifactsPanel({ detail, instanceId }: { detail: ExecutionRunDetail; instanceId: string }) {
  return (
    <article className="fg-subcard">
      <div className="fg-panel-heading">
        <div>
          <h4>Artifacts and workspace evidence</h4>
          <p className="fg-muted">Artifacts stay linked to the real workspace and run evidence instead of acting as decorative placeholders.</p>
        </div>
        <span className="fg-pill" data-tone={detail.artifacts.length > 0 ? "success" : "neutral"}>{detail.artifacts.length} artifacts</span>
      </div>
      {detail.workspace?.workspace_id ? (
        <ul className="fg-list">
          <li>Workspace ID: <Link to={buildWorkspacePath({ instanceId, workspaceId: detail.workspace.workspace_id })}>{detail.workspace.workspace_id}</Link></li>
          <li>Workspace title: {detail.workspace.title}</li>
          <li>Preview: {detail.workspace.preview_status}</li>
          <li>Review: {detail.workspace.review_status}</li>
          <li>Handoff: {detail.workspace.handoff_status}</li>
          <li>Latest approval: {detail.workspace.latest_approval_id ? <Link to={buildApprovalRoute(instanceId, detail.workspace.latest_approval_id)}>{detail.workspace.latest_approval_id}</Link> : "None"}</li>
        </ul>
      ) : (
        <p className="fg-muted">No workspace summary was attached to this run detail.</p>
      )}
      {detail.artifacts.length > 0 ? (
        <ul className="fg-list">
          {detail.artifacts.map((artifact) => (
            <li key={artifact.artifact_id}>
              <Link to={buildArtifactsPath({ instanceId, artifactId: artifact.artifact_id })}>{artifact.label}</Link>
              {" · "}{artifact.artifact_type}{" · "}{artifact.status}
            </li>
          ))}
        </ul>
      ) : (
        <p className="fg-muted">No artifacts are attached to this run.</p>
      )}
      <div className="fg-actions">
        <Link className="fg-nav-link" to={buildArtifactsPath({ instanceId, targetKind: "run", targetId: detail.run_id })}>
          Open run artifacts
        </Link>
      </div>
    </article>
  );
}

function OperatorControls({
  detail,
  access,
  operatorReason,
  operatorLane,
  operatorActionState,
  operatorActionError,
  operatorActionResult,
  onOperatorReasonChange,
  onOperatorLaneChange,
  onOperatorAction,
}: {
  detail: ExecutionRunDetail;
  access: ExecutionAccessState;
  operatorReason: string;
  operatorLane: string;
  operatorActionState: OperatorActionState;
  operatorActionError: string;
  operatorActionResult: ExecutionOperatorActionResult | null;
  onOperatorReasonChange: (value: string) => void;
  onOperatorLaneChange: (value: string) => void;
  onOperatorAction: (action: ExecutionOperatorActionKey) => void;
}) {
  const actionOrder: ExecutionOperatorActionKey[] = ["pause", "resume", "interrupt", "quarantine", "restart", "escalate"];

  return (
    <article className="fg-subcard">
      <div className="fg-panel-heading">
        <div>
          <h4>Operator controls</h4>
          <p className="fg-muted">Each control writes a durable run command. Buttons stay disabled whenever the backend state machine would reject the transition.</p>
        </div>
        <span className="fg-pill" data-tone={access.canReplay ? "success" : "warning"}>{access.canReplay ? "Writable" : "Read only"}</span>
      </div>
      <label>
        Operator reason
        <textarea
          aria-label="Execution operator reason"
          rows={3}
          placeholder="Why should ForgeFrame change this run?"
          value={operatorReason}
          onChange={(event) => onOperatorReasonChange(event.target.value)}
        />
      </label>
      <label>
        Target lane for escalate or restart
        <select aria-label="Execution operator lane" value={operatorLane} onChange={(event) => onOperatorLaneChange(event.target.value)}>
          {LANE_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.value === "" ? "Keep current lane" : option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="fg-card-grid">
        {actionOrder.map((action) => {
          const availability = getOperatorActionAvailability(detail, access, action, operatorLane);
          const label = action.charAt(0).toUpperCase() + action.slice(1);
          return (
            <div key={action} className="fg-outline-row">
              <div className="fg-panel-heading fg-data-row-heading">
                <strong>{label}</strong>
                <span className="fg-pill" data-tone={availability.enabled ? "success" : "warning"}>
                  {availability.enabled ? "Ready" : "Blocked"}
                </span>
              </div>
              <p className="fg-muted">{availability.reason}</p>
              <button
                type="button"
                disabled={!availability.enabled || operatorActionState === "submitting"}
                onClick={() => onOperatorAction(action)}
              >
                {label}
              </button>
            </div>
          );
        })}
      </div>
      {operatorActionError ? <p className="fg-danger">{operatorActionError}</p> : null}
      {operatorActionResult ? (
        <div className="fg-note">
          <ul className="fg-list">
            <li>Command ID: {operatorActionResult.command_id}</li>
            <li>Run state: {operatorActionResult.run_state}</li>
            <li>Operator state: {operatorActionResult.operator_state ?? "not returned"}</li>
            <li>Execution lane: {operatorActionResult.execution_lane ?? "not returned"}</li>
            <li>Related run: {operatorActionResult.related_run_id ?? "none"}</li>
            <li>Outbox event: {operatorActionResult.outbox_event ?? "none"}</li>
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function ReplayAdmission({
  detail,
  access,
  showReplayForm,
  replayReason,
  idempotencyKey,
  replayState,
  replayError,
  replayResult,
  replayAuditHistoryPath,
  onReplayReasonChange,
  onIdempotencyKeyChange,
  onReplaySubmit,
}: {
  detail: ExecutionRunDetail;
  access: ExecutionAccessState;
  showReplayForm: boolean;
  replayReason: string;
  idempotencyKey: string;
  replayState: ReplayState;
  replayError: string;
  replayResult: ExecutionReplayResult | null;
  replayAuditHistoryPath: string | null;
  onReplayReasonChange: (value: string) => void;
  onIdempotencyKeyChange: (value: string) => void;
  onReplaySubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <article className="fg-subcard">
      <div className="fg-panel-heading">
        <div>
          <h4>Replay admission</h4>
          <p className="fg-muted">Replay admits a new retry command against the real run state machine and writes an audit event for the decision.</p>
        </div>
        <span className="fg-pill" data-tone={showReplayForm ? "success" : "warning"}>
          {showReplayForm ? "Replay ready" : "Replay unavailable"}
        </span>
      </div>
      {showReplayForm ? (
        <form className="fg-stack" onSubmit={onReplaySubmit}>
          <label>
            Replay reason
            <textarea
              aria-label="Execution replay reason"
              rows={4}
              placeholder="Replay after the provider secret was rotated and verified."
              value={replayReason}
              onChange={(event) => onReplayReasonChange(event.target.value)}
            />
          </label>
          <label>
            Idempotency key (optional)
            <input
              aria-label="Execution replay idempotency key"
              placeholder="idem_execution_retry_1"
              value={idempotencyKey}
              onChange={(event) => onIdempotencyKeyChange(event.target.value)}
            />
          </label>
          <div className="fg-actions">
            <button type="submit" disabled={replayState === "submitting"}>
              {replayState === "submitting" ? "Submitting replay" : "Replay run"}
            </button>
          </div>
        </form>
      ) : (
        <p className="fg-muted">
          {!access.canReplay
            ? access.mutationDetail
            : `The selected run is not replayable from state '${detail.state}'. Use restart or operator controls instead of assuming replay is always legal.`}
        </p>
      )}
      {replayState === "error" ? <p className="fg-danger">{replayError}</p> : null}
      {replayResult ? (
        <div className="fg-note">
          <p>
            Replay admitted for <span className="fg-code">{replayResult.run_id}</span>.
          </p>
          <ul className="fg-list">
            <li>Run state: {replayResult.run_state}</li>
            <li>Operator state: {replayResult.operator_state ?? "not returned"}</li>
            <li>Execution lane: {replayResult.execution_lane ?? "not returned"}</li>
            <li>Attempt ID: {replayResult.attempt_id ?? "No attempt returned"}</li>
            <li>Command ID: {replayResult.command_id}</li>
            <li>Outbox event: {replayResult.outbox_event ?? "None"}</li>
            <li>Deduplicated: {replayResult.deduplicated ? "yes" : "no"}</li>
            <li>Audit event: {replayResult.audit?.event_id ?? "Not returned"}</li>
          </ul>
          {replayAuditHistoryPath ? <Link className="fg-nav-link" to={replayAuditHistoryPath}>Open Audit History</Link> : null}
        </div>
      ) : null}
    </article>
  );
}

function RawDetails({ detail }: { detail: ExecutionRunDetail }) {
  return (
    <article className="fg-subcard">
      <div className="fg-panel-heading">
        <div>
          <h4>Raw details</h4>
          <p className="fg-muted">The raw payload stays available, but collapsed behind the operational summary instead of dominating the page.</p>
        </div>
        <span className="fg-pill" data-tone="neutral">Diagnostics</span>
      </div>
      <details>
        <summary>Raw result summary payload</summary>
        <pre>{formatJson(detail.result_summary)}</pre>
      </details>
      <details>
        <summary>Raw native mapping payload</summary>
        <pre>{formatJson(detail.native_mapping)}</pre>
      </details>
      <details>
        <summary>Full run detail payload</summary>
        <pre>{formatJson(detail)}</pre>
      </details>
    </article>
  );
}

export function ScopeFilterCard({
  instanceId,
  companyId,
  scopeOptionsState,
  scopeOptions,
  scopeOptionsError,
  instanceDraft,
  stateDraft,
  laneDraft,
  targetDraft,
  approvalWaitDraft,
  errorDraft,
  windowDraft,
  onInstanceDraftChange,
  onStateDraftChange,
  onLaneDraftChange,
  onTargetDraftChange,
  onApprovalWaitDraftChange,
  onErrorDraftChange,
  onWindowDraftChange,
  onScopeSubmit,
  onScopeClear,
  onScopeChoice,
}: ScopeFilterCardProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Scope and filters</h3>
          <p className="fg-muted">Execution review now filters real run data by instance, state, lane, target, approval waits, error posture, and time window.</p>
        </div>
        <span className="fg-pill" data-tone={instanceId ? "success" : "warning"}>
          {instanceId ? `Instance: ${instanceId}` : "Instance scope required"}
        </span>
      </div>
      {!instanceId ? (
        <div className="fg-stack fg-mt-md">
          <div className="fg-subcard">
            <div className="fg-panel-heading">
              <div>
                <h4>Quick scope choices</h4>
                <p className="fg-muted">These instances come from the real instance registry, not from incidental execution history.</p>
              </div>
              <span className="fg-pill" data-tone="neutral">Instance registry</span>
            </div>
            {scopeOptionsState === "loading" ? <p className="fg-muted">Loading active instances from the control-plane registry.</p> : null}
            {scopeOptionsState === "error" ? <p className="fg-danger">{scopeOptionsError}</p> : null}
            {scopeOptionsState === "success" && scopeOptions.length > 0 ? (
              <div className="fg-stack">
                {scopeOptions.map((option) => (
                  <button
                    key={option.instanceId}
                    type="button"
                    className="fg-data-row"
                    onClick={() => onScopeChoice(option.instanceId)}
                  >
                    <div className="fg-panel-heading fg-data-row-heading">
                      <div className="fg-page-header">
                        <span className="fg-code">{option.instanceId}</span>
                        <strong>{option.displayName}</strong>
                      </div>
                      <div className="fg-actions">
                        <span className="fg-pill" data-tone="neutral">{option.status}</span>
                      </div>
                    </div>
                    <div className="fg-detail-grid">
                      <span className="fg-muted">{describeExecutionScopeOption(option)}</span>
                      <span className="fg-muted">execution scope {option.companyId}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
            {scopeOptionsState === "success" && scopeOptions.length === 0 ? (
              <p className="fg-muted">No active instances are available. Create or reactivate an instance before opening execution review.</p>
            ) : null}
          </div>
        </div>
      ) : null}
      <form className="fg-stack" onSubmit={onScopeSubmit}>
        <div className="fg-inline-form">
          <label>
            Exact instance ID
            <input
              aria-label="Execution instance ID"
              name="instanceId"
              placeholder="default"
              value={instanceDraft}
              onChange={(event) => onInstanceDraftChange(event.target.value)}
            />
          </label>
          <label>
            Run state
            <select aria-label="Execution run state filter" value={stateDraft} onChange={(event) => onStateDraftChange(event.target.value)}>
              {STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lane
            <select aria-label="Execution lane filter" value={laneDraft} onChange={(event) => onLaneDraftChange(event.target.value)}>
              {LANE_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="fg-inline-form">
          <label>
            Target or issue
            <input
              aria-label="Execution target filter"
              placeholder="openai_api::gpt-4.1-mini"
              value={targetDraft}
              onChange={(event) => onTargetDraftChange(event.target.value)}
            />
          </label>
          <label>
            Approval wait
            <select aria-label="Execution approval wait filter" value={approvalWaitDraft} onChange={(event) => onApprovalWaitDraftChange(event.target.value as ExecutionApprovalWaitFilter)}>
              {APPROVAL_WAIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Errors
            <select aria-label="Execution error filter" value={errorDraft} onChange={(event) => onErrorDraftChange(event.target.value as ExecutionErrorFilter)}>
              {ERROR_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Window
            <select aria-label="Execution window filter" value={windowDraft} onChange={(event) => onWindowDraftChange(event.target.value as ExecutionWindowFilter)}>
              {WINDOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="fg-actions fg-actions-end">
          <button type="submit">Load execution runs</button>
          <button type="button" onClick={onScopeClear}>Clear filters</button>
        </div>
      </form>
      <p className="fg-note">Deep links keep `instanceId`, `state`, `lane`, `target`, `approvalWait`, `error`, `window`, and `runId` when another route already knows the run you need.</p>
      {companyId ? <p className="fg-note">Resolved execution scope: <span className="fg-code">{companyId}</span></p> : null}
    </article>
  );
}

export function MissingExecutionScopeCard() {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Choose execution scope</h3>
          <p className="fg-muted">Execution review stays honest about explicit instance scope before it exposes run lifecycle and control actions.</p>
        </div>
        <span className="fg-pill" data-tone="warning">Scope missing</span>
      </div>
      <ul className="fg-list">
        <li>Pick an instance from the registry above when the control plane already knows the runtime boundary.</li>
        <li>Use the exact `instanceId` field when the relevant run lives outside the quick-choice list.</li>
        <li>Scoped deep links can preserve the full filter set so the route lands on the right run review context immediately.</li>
        <li>Approval decisions stay on the Approvals page even though approval waits are visible here.</li>
      </ul>
    </article>
  );
}

export function ExecutionRunsSection({
  instanceId,
  companyId,
  stateFilter,
  laneFilter,
  targetFilter,
  approvalWaitFilter,
  errorFilter,
  windowFilter,
  runsState,
  runs,
  runsError,
  selectedRunId,
  selectedSummary,
  detailState,
  detail,
  detailError,
  access,
  showReplayForm,
  replayReason,
  idempotencyKey,
  replayState,
  replayError,
  replayResult,
  replayAuditHistoryPath,
  operatorReason,
  operatorLane,
  operatorActionState,
  operatorActionError,
  operatorActionResult,
  onRunSelection,
  onReplayReasonChange,
  onIdempotencyKeyChange,
  onReplaySubmit,
  onOperatorReasonChange,
  onOperatorLaneChange,
  onOperatorAction,
}: ExecutionRunsSectionProps) {
  if (runsState === "loading") {
    return (
      <article className="fg-card">
        <h3>Loading execution runs</h3>
        <p className="fg-muted">ForgeFrame is fetching the filtered instance-scoped run set before exposing the next control decision.</p>
      </article>
    );
  }

  if (runsState === "error") {
    return (
      <article className="fg-card">
        <h3>Execution list failed</h3>
        <p className="fg-danger">{runsError}</p>
      </article>
    );
  }

  if (runsState !== "success") {
    return null;
  }

  const lifecycle = detail ? describeExecutionLifecycle(detail) : null;
  const nextAction = detail ? describeNextExecutionAction(detail) : null;

  return (
    <>
      <div className="fg-grid fg-grid-compact">
        <article className="fg-kpi">
          <span className="fg-muted">Runs loaded</span>
          <strong className="fg-kpi-value">{runs.length}</strong>
        </article>
        <article className="fg-kpi">
          <span className="fg-muted">Approval waits</span>
          <strong className="fg-kpi-value">{countApprovalWaitRuns(runs)}</strong>
        </article>
        <article className="fg-kpi">
          <span className="fg-muted">With errors</span>
          <strong className="fg-kpi-value">{countErrorRuns(runs)}</strong>
        </article>
        <article className="fg-kpi">
          <span className="fg-muted">Replayable</span>
          <strong className="fg-kpi-value">{countReplayableRuns(runs)}</strong>
        </article>
        <article className="fg-kpi">
          <span className="fg-muted">Needs attention</span>
          <strong className="fg-kpi-value">{countAttentionRuns(runs)}</strong>
        </article>
      </div>

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Run table</h3>
            <p className="fg-muted">The table is instance-scoped and filter-bound. No cross-instance fallback or hidden queue is implied.</p>
          </div>
          <span className="fg-pill" data-tone="neutral">{companyId ? `Execution scope ${companyId}` : `Instance ${instanceId}`}</span>
        </div>
        <ScopeFilterPills
          stateFilter={stateFilter}
          laneFilter={laneFilter}
          approvalWaitFilter={approvalWaitFilter}
          errorFilter={errorFilter}
          windowFilter={windowFilter}
          targetFilter={targetFilter}
        />
        {runs.length === 0 ? (
          <p className="fg-muted">No execution runs matched the current filter. The backend returned an empty filtered result for this instance.</p>
        ) : (
          <RunTable runs={runs} selectedRunId={selectedRunId} onRunSelection={onRunSelection} instanceId={instanceId} />
        )}
      </article>

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Run detail</h3>
            <p className="fg-muted">Detail remains URL-addressable through `runId` and explains lifecycle, approvals, dispatch jobs, and evidence for the selected run.</p>
          </div>
          {selectedSummary ? <span className="fg-pill" data-tone={getStateTone(selectedSummary.state)}>{selectedSummary.state}</span> : null}
        </div>

        {detailState === "idle" ? <p className="fg-muted">Select a run from the table to inspect its lifecycle, approval waits, dispatch jobs, and control actions.</p> : null}
        {detailState === "loading" ? <p className="fg-muted">Loading the selected run detail.</p> : null}
        {detailState === "error" ? <p className="fg-danger">{detailError}</p> : null}

        {detail ? (
          <div className="fg-stack">
            <div className="fg-card-grid">
              <article className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>Lifecycle summary</h4>
                    <p className="fg-muted">Lifecycle is translated into operator guidance instead of staying at raw state names.</p>
                  </div>
                  {lifecycle ? <span className="fg-pill" data-tone={lifecycle.tone}>{lifecycle.label}</span> : null}
                </div>
                <ul className="fg-list">
                  <li>Run ID: <span className="fg-code">{detail.run_id}</span></li>
                  <li>Run kind: {detail.run_kind}</li>
                  <li>Lane: {detail.execution_lane}</li>
                  <li>State: {detail.state}</li>
                  <li>Operator state: {detail.operator_state}</li>
                  <li>Status reason: {detail.status_reason ?? "Not provided"}</li>
                  <li>Failure class: {detail.failure_class ?? "None"}</li>
                  <li>Lifecycle explanation: {lifecycle?.detail ?? "Not recorded"}</li>
                  <li>Next action: {nextAction ? `${nextAction.label} - ${nextAction.detail}` : "Inspect the sections below."}</li>
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Run scope and target</h4>
                <ul className="fg-list">
                  <li>Instance scope: <span className="fg-code">{instanceId}</span></li>
                  <li>Execution scope: <span className="fg-code">{companyId || "resolved by instance"}</span></li>
                  <li>Workspace: {detail.workspace_id ?? "No workspace linked"}</li>
                  <li>Issue: {detail.issue_id ?? "No issue linked"}</li>
                  <li>Target: {describeExecutionRunTarget(detail)}</li>
                  <li>Cost class: {describeExecutionRunCostClass(detail)}</li>
                  <li>Error posture: {describeExecutionError(detail)}</li>
                  <li>Started: {formatTimestamp(getStartedAt(detail))}</li>
                  <li>Updated: {formatTimestamp(detail.updated_at)}</li>
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Current attempt</h4>
                {detail.current_attempt ? (
                  <ul className="fg-list">
                    <li>Attempt number: {detail.current_attempt.attempt_no}</li>
                    <li>Attempt state: {detail.current_attempt.attempt_state}</li>
                    <li>Operator attempt state: {detail.current_attempt.operator_state}</li>
                    <li>Lease status: {detail.current_attempt.lease_status}</li>
                    <li>Worker key: {detail.current_attempt.worker_key ?? "No worker attached"}</li>
                    <li>Scheduled at: {formatTimestamp(detail.current_attempt.scheduled_at)}</li>
                    <li>Started at: {formatTimestamp(detail.current_attempt.started_at)}</li>
                    <li>Finished at: {formatTimestamp(detail.current_attempt.finished_at)}</li>
                  </ul>
                ) : (
                  <p className="fg-muted">No active attempt is attached to this run snapshot.</p>
                )}
              </article>
            </div>

            <RunTimeline detail={detail} instanceId={instanceId} />
            <DispatchJobs detail={detail} />
            <RunDecisions detail={detail} instanceId={instanceId} />
            <ArtifactsPanel detail={detail} instanceId={instanceId} />
            <OperatorControls
              detail={detail}
              access={access}
              operatorReason={operatorReason}
              operatorLane={operatorLane}
              operatorActionState={operatorActionState}
              operatorActionError={operatorActionError}
              operatorActionResult={operatorActionResult}
              onOperatorReasonChange={onOperatorReasonChange}
              onOperatorLaneChange={onOperatorLaneChange}
              onOperatorAction={onOperatorAction}
            />
            <ReplayAdmission
              detail={detail}
              access={access}
              showReplayForm={showReplayForm}
              replayReason={replayReason}
              idempotencyKey={idempotencyKey}
              replayState={replayState}
              replayError={replayError}
              replayResult={replayResult}
              replayAuditHistoryPath={replayAuditHistoryPath}
              onReplayReasonChange={onReplayReasonChange}
              onIdempotencyKeyChange={onIdempotencyKeyChange}
              onReplaySubmit={onReplaySubmit}
            />
            <RawDetails detail={detail} />
          </div>
        ) : null}
      </article>
    </>
  );
}
