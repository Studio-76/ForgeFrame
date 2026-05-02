import { Link } from "react-router-dom";

import type {
  ApprovalClass,
  ApprovalDetail,
  ApprovalDueState,
  ApprovalRiskLevel,
  ApprovalStatus,
  ApprovalSummary,
} from "../../api/domain";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import type { ApprovalBanner, ApprovalDecisionConfirmation } from "./presentation";
import {
  approvalRiskTone,
  approvalStatusTone,
  formatApprovalActor,
  formatApprovalAge,
  formatApprovalClass,
  formatApprovalDueState,
  formatApprovalRiskLevel,
  formatApprovalSourceKind,
  formatApprovalStatus,
  formatApprovalTarget,
  formatApprovalType,
  formatDetailValue,
  formatSessionStatus,
  formatTimestamp,
  humanizeApprovalField,
} from "./presentation";
import {
  describeEmptyQueueState,
  type ApprovalClassFilter,
  type ApprovalDueFilter,
  type ApprovalInstanceFilter,
  type ApprovalRiskFilter,
  type ApprovalTypeFilter,
  type InstanceFilterOption,
} from "./helpers";

function renderMetadataGrid(entries: Array<[string, unknown]>) {
  return (
    <div className="fg-card-grid">
      {entries.map(([key, value]) => {
        const isStructuredObject = typeof value === "object" && value !== null && !Array.isArray(value);
        return (
          <article key={key} className="fg-subcard">
            <span className="fg-section-label">{humanizeApprovalField(key)}</span>
            {isStructuredObject ? <pre>{formatDetailValue(value)}</pre> : <p>{formatDetailValue(value)}</p>}
          </article>
        );
      })}
    </div>
  );
}

function renderAuditEntries(entries: Array<Record<string, unknown>>) {
  return (
    <div className="fg-stack">
      {entries.map((entry, index) => {
        const eventId = typeof entry.event_id === "string" ? entry.event_id : `audit-entry-${index}`;
        return (
          <article key={eventId} className="fg-subcard">
            <div className="fg-wayfinding-label">
              <div>
                <strong>{formatDetailValue(entry.action)}</strong>
                <p className="fg-muted">{formatDetailValue(entry.details)}</p>
              </div>
              <span className="fg-pill" data-tone={String(entry.status) === "ok" ? "success" : String(entry.status) === "warning" ? "warning" : "danger"}>
                {formatDetailValue(entry.status)}
              </span>
            </div>
            <div className="fg-approval-meta">
              <span>Actor {formatDetailValue(entry.actor)}</span>
              <span>Recorded {formatDetailValue(entry.created_at)}</span>
              <span>Decision note {formatDetailValue(entry.decision_note)}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

type ApprovalFiltersCardProps = {
  statusFilter: ApprovalStatus | "all";
  typeFilter: ApprovalTypeFilter;
  riskFilter: ApprovalRiskFilter;
  instanceFilter: ApprovalInstanceFilter;
  instanceOptions: InstanceFilterOption[];
  dueFilter: ApprovalDueFilter;
  approvalClassFilter: ApprovalClassFilter;
  search: string;
  orderedVisibleCount: number;
  activeQueueFilters: string[];
  onStatusFilterChange: (value: ApprovalStatus | "all") => void;
  onTypeFilterChange: (value: ApprovalTypeFilter) => void;
  onRiskFilterChange: (value: ApprovalRiskFilter) => void;
  onInstanceFilterChange: (value: ApprovalInstanceFilter) => void;
  onDueFilterChange: (value: ApprovalDueFilter) => void;
  onApprovalClassFilterChange: (value: ApprovalClassFilter) => void;
  onSearchChange: (value: string) => void;
};

export function ApprovalFiltersCard({
  statusFilter,
  typeFilter,
  riskFilter,
  instanceFilter,
  instanceOptions,
  dueFilter,
  approvalClassFilter,
  search,
  orderedVisibleCount,
  activeQueueFilters,
  onStatusFilterChange,
  onTypeFilterChange,
  onRiskFilterChange,
  onInstanceFilterChange,
  onDueFilterChange,
  onApprovalClassFilterChange,
  onSearchChange,
}: ApprovalFiltersCardProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Decision filters</h3>
          <p className="fg-muted">Slice the queue by approval type, class, risk, instance scope, and decision window before selecting the item to review.</p>
        </div>
      </div>
      <div className="fg-inline-form">
        <label>
          Status
          <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as ApprovalStatus | "all")}>
            <option value="open">Open only</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="timed_out">Expired</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All statuses</option>
          </select>
        </label>
        <label>
          Type
          <select value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value as ApprovalTypeFilter)}>
            <option value="all">All types</option>
            <option value="execution_run">Execution run</option>
            <option value="break_glass">Break-glass</option>
            <option value="impersonation">Impersonation</option>
          </select>
        </label>
        <label>
          Risk
          <select value={riskFilter} onChange={(event) => onRiskFilterChange(event.target.value as ApprovalRiskFilter)}>
            <option value="all">All risk bands</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>
          Instance
          <select value={instanceFilter} onChange={(event) => onInstanceFilterChange(event.target.value as ApprovalInstanceFilter)}>
            <option value="all">All instances</option>
            {instanceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Due
          <select value={dueFilter} onChange={(event) => onDueFilterChange(event.target.value as ApprovalDueFilter)}>
            <option value="all">All due states</option>
            <option value="due_now">Due now</option>
            <option value="due_soon">Due within 24h</option>
            <option value="later">Due later</option>
            <option value="no_deadline">No deadline</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <label>
          Approval class
          <select value={approvalClassFilter} onChange={(event) => onApprovalClassFilterChange(event.target.value as ApprovalClassFilter)}>
            <option value="all">All classes</option>
            <option value="execution_control">Execution control</option>
            <option value="elevated_access">Elevated access</option>
          </select>
        </label>
        <label>
          Search
          <input
            placeholder="Search requester, target, ID, issue, or next step"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>
      <p className="fg-muted">
        Reviewing {orderedVisibleCount} matching item{orderedVisibleCount === 1 ? "" : "s"} in the current decision slice.
      </p>
      <div className="fg-actions">
        {activeQueueFilters.map((filter) => (
          <span key={filter} className="fg-pill">
            {filter}
          </span>
        ))}
      </div>
    </article>
  );
}

type ApprovalQueueCardProps = {
  listLoading: boolean;
  orderedVisibleApprovals: ApprovalSummary[];
  selectedApprovalId: string | null;
  statusFilter: ApprovalStatus | "all";
  approvalsLoaded: number;
  hasClientSideQueueFilters: boolean;
  onSelectApproval: (approvalId: string) => void;
};

export function ApprovalQueueCard({
  listLoading,
  orderedVisibleApprovals,
  selectedApprovalId,
  statusFilter,
  approvalsLoaded,
  hasClientSideQueueFilters,
  onSelectApproval,
}: ApprovalQueueCardProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Approval queue</h3>
          <p className="fg-muted">The queue is sorted for decision work: open items first, then higher risk, then tighter due windows.</p>
        </div>
      </div>

      {listLoading ? <p className="fg-muted">Loading approvals queue…</p> : null}

      {!listLoading && orderedVisibleApprovals.length === 0 ? (
        <p className="fg-muted">
          {describeEmptyQueueState({
            statusFilter,
            approvalsLoaded,
            hasClientSideQueueFilters,
          })}
        </p>
      ) : null}

      {!listLoading && orderedVisibleApprovals.length > 0 ? (
        <div className="fg-table-wrap">
          <table className="fg-table" aria-label="Approvals decision queue">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Requester</th>
                <th scope="col">Target</th>
                <th scope="col">Risk</th>
                <th scope="col">Status</th>
                <th scope="col">Age</th>
                <th scope="col">Next step</th>
              </tr>
            </thead>
            <tbody>
              {orderedVisibleApprovals.map((item) => {
                const isSelected = item.approval_id === selectedApprovalId;
                const sessionLabel = formatSessionStatus(item.session_status, item.ready_to_issue);

                return (
                  <tr key={item.approval_id} className={isSelected ? "is-selected" : undefined}>
                    <td>
                      <button className="fg-table-trigger" type="button" onClick={() => onSelectApproval(item.approval_id)}>
                        {formatApprovalType(item.approval_type)}
                      </button>
                      <div className="fg-muted">{formatApprovalClass(item.approval_class)} · {formatApprovalSourceKind(item.source_kind)}</div>
                    </td>
                    <td>
                      <div>{formatApprovalActor(item.requester)}</div>
                      <div className="fg-muted">{item.company_id ? `Company ${item.company_id}` : "Shared request"}</div>
                    </td>
                    <td>
                      <div>{formatApprovalTarget(item)}</div>
                      <div className="fg-muted">
                        {item.instance_id ? `Instance ${item.instance_id}` : "Shared governance"}
                        {sessionLabel ? ` · ${sessionLabel}` : ""}
                      </div>
                    </td>
                    <td>
                      <span className="fg-pill" data-tone={approvalRiskTone(item.risk_level)}>
                        {formatApprovalRiskLevel(item.risk_level)}
                      </span>
                      <div className="fg-muted">{item.risk_label}{item.irreversible ? " · irreversible path" : ""}</div>
                    </td>
                    <td>
                      <span className="fg-pill" data-tone={approvalStatusTone(item.status)}>
                        {formatApprovalStatus(item.status)}
                      </span>
                      <div className="fg-muted">{formatApprovalDueState(item.due_state)}</div>
                    </td>
                    <td>
                      <div>{formatApprovalAge(item.opened_at)}</div>
                      <div className="fg-muted">{formatTimestamp(item.opened_at)}</div>
                    </td>
                    <td>{item.next_step}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}

type DecisionOutcomeNotice = {
  approvalId: string;
  tone: "success" | "danger";
  title: string;
  body: string;
  comment: string;
};

type ApprovalDetailSectionProps = {
  detailLoading: boolean;
  detail: ApprovalDetail | null;
  banner: ApprovalBanner | null;
  executionReviewRoute: string | null;
  canOpenSecurity: boolean;
  detailAuditHistoryRoute: string;
  workspaceRoute: string | null;
  artifactRoute: string | null;
  decisionOutcome: DecisionOutcomeNotice | null;
  hasDecisionAction: boolean;
  decisionBlockedReason: string;
  decisionComment: string;
  decisionPending: boolean;
  canApprove: boolean;
  canReject: boolean;
  approveDecisionFlow: ApprovalDecisionConfirmation | null;
  rejectDecisionFlow: ApprovalDecisionConfirmation | null;
  pendingDecisionFlow: ApprovalDecisionConfirmation | null;
  pendingDecisionIntent: "approve" | "reject" | null;
  approveBlockedReason: string;
  rejectBlockedReason: string;
  onDecisionCommentChange: (value: string) => void;
  onStartDecisionConfirmation: (intent: "approve" | "reject") => void;
  onCancelDecisionConfirmation: () => void;
  onDecision: (intent: "approve" | "reject") => void;
};

export function ApprovalDetailSection({
  detailLoading,
  detail,
  banner,
  executionReviewRoute,
  canOpenSecurity,
  detailAuditHistoryRoute,
  workspaceRoute,
  artifactRoute,
  decisionOutcome,
  hasDecisionAction,
  decisionBlockedReason,
  decisionComment,
  decisionPending,
  canApprove,
  canReject,
  approveDecisionFlow,
  rejectDecisionFlow,
  pendingDecisionFlow,
  pendingDecisionIntent,
  approveBlockedReason,
  rejectBlockedReason,
  onDecisionCommentChange,
  onStartDecisionConfirmation,
  onCancelDecisionConfirmation,
  onDecision,
}: ApprovalDetailSectionProps) {
  if (detailLoading) {
    return (
      <section className="fg-stack">
        <article className="fg-card">
          <p className="fg-muted">Loading approval detail…</p>
        </article>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="fg-stack">
        <article className="fg-card">
          <p className="fg-muted">Select an approval row to review the action preview, evidence, affected scope, and decision controls.</p>
        </article>
      </section>
    );
  }

  const overviewEntries: Array<[string, unknown]> = [
    ["approval_type", formatApprovalType(detail.approval_type)],
    ["approval_class", formatApprovalClass(detail.approval_class as ApprovalClass)],
    ["status", formatApprovalStatus(detail.status)],
    ["risk", `${formatApprovalRiskLevel(detail.risk_level as ApprovalRiskLevel)} · ${detail.risk_label}`],
    ["opened_at", formatTimestamp(detail.opened_at)],
    ["decision_window", formatApprovalDueState(detail.due_state as ApprovalDueState)],
    ["requester", formatApprovalActor(detail.requester)],
    ["target", formatApprovalTarget(detail)],
  ];
  const actionPreviewEntries = Object.entries(detail.action_preview ?? {});
  const evidenceEntries = Object.entries(detail.evidence ?? {});
  const identityEntries = Object.entries(detail.affected_identity ?? {});
  const scopeEntries = Object.entries(detail.affected_scope ?? {});
  const consequenceEntries = Object.entries(detail.consequence ?? {});
  const rawAuditEntries = detail.audit_history?.["entries"];
  const auditHistoryEntries = Array.isArray(rawAuditEntries)
    ? rawAuditEntries.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    : [];
  const auditEntries = Object.entries(detail.audit_history ?? {}).filter(([key]) => key !== "entries");
  const systemEntries = Object.entries(detail.source ?? {});
  const decisionEntries: Array<[string, unknown]> = [
    ["decided_at", formatTimestamp(detail.decided_at)],
    ["expires_at", formatTimestamp(detail.expires_at)],
    ["decision_actor", formatApprovalActor(detail.decision_actor)],
    ["session_status", formatSessionStatus(detail.session_status, detail.ready_to_issue) ?? "Not applicable"],
    ["consequence_summary", detail.consequence_summary],
  ];
  const hasPendingDecisionFlow = pendingDecisionIntent !== null && pendingDecisionFlow !== null;
  const showDecisionOutcome = decisionOutcome?.approvalId === detail.approval_id;

  return (
    <section className="fg-stack">
      <article className="fg-card">
        <div className="fg-stack">
          <div className="fg-panel-heading">
            <div>
              <h3>{detail.title}</h3>
              <p className="fg-muted">Request opened {formatTimestamp(detail.opened_at)} · Requester {formatApprovalActor(detail.requester)} · Target {formatApprovalTarget(detail)}</p>
            </div>
            <div className="fg-actions">
              <span className="fg-pill" data-tone={approvalStatusTone(detail.status)}>{formatApprovalStatus(detail.status)}</span>
              <span className="fg-pill" data-tone={approvalRiskTone(detail.risk_level)}>{formatApprovalRiskLevel(detail.risk_level)}</span>
              {detail.irreversible ? <span className="fg-pill" data-tone="danger">Irreversible path</span> : null}
            </div>
          </div>

          {banner ? (
            <div className="fg-approval-banner" data-tone={banner.tone}>
              <strong>{banner.title}</strong>
              <p>{banner.body}</p>
            </div>
          ) : null}

          <div className="fg-actions">
            {detail.source_kind === "execution_run" && executionReviewRoute && executionReviewRoute !== CONTROL_PLANE_ROUTES.execution ? (
              <Link className="fg-nav-link" to={executionReviewRoute}>Open Execution Review</Link>
            ) : null}
            {workspaceRoute ? <Link className="fg-nav-link" to={workspaceRoute}>Open Workspace</Link> : null}
            {artifactRoute ? <Link className="fg-nav-link" to={artifactRoute}>Open Artifacts</Link> : null}
            {detail.source_kind === "elevated_access" && canOpenSecurity ? (
              <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.security}>Open Security & Policies</Link>
            ) : null}
          </div>
        </div>
      </article>

      <article className="fg-card">
        <h3>Decision overview</h3>
        <p className="fg-muted">Review the scope and risk first. Approval outcome lives here; downstream run control or session issuance stays on the linked surface.</p>
        {renderMetadataGrid(overviewEntries)}
      </article>

      <article className="fg-card">
        <h3>Action preview</h3>
        <p className="fg-muted">This preview is the decision boundary for the current approval item, not a substitute for run controls or session issuance.</p>
        {actionPreviewEntries.length > 0 ? renderMetadataGrid(actionPreviewEntries) : <p className="fg-muted">No action preview is recorded for this approval.</p>}
      </article>

      <article className="fg-card">
        <h3>Evidence</h3>
        <p className="fg-muted">Use recorded evidence before falling back to raw system fields.</p>
        {evidenceEntries.length > 0 ? renderMetadataGrid(evidenceEntries) : <p className="fg-muted">No additional evidence fields were recorded.</p>}
      </article>

      <article className="fg-card">
        <h3>Affected identity and scope</h3>
        <div className="fg-stack">
          {identityEntries.length > 0 ? (
            <div className="fg-stack">
              <span className="fg-section-label">Identity</span>
              {renderMetadataGrid(identityEntries)}
            </div>
          ) : null}
          {scopeEntries.length > 0 ? (
            <div className="fg-stack">
              <span className="fg-section-label">Scope</span>
              {renderMetadataGrid(scopeEntries)}
            </div>
          ) : (
            <p className="fg-muted">No explicit scope metadata was attached.</p>
          )}
        </div>
      </article>

      <article className="fg-card">
        <h3>Consequence and audit trail</h3>
        <div className="fg-stack">
          {consequenceEntries.length > 0 ? renderMetadataGrid(consequenceEntries) : null}
          {auditHistoryEntries.length > 0 ? (
            <div className="fg-stack">
              <span className="fg-section-label">Audit history entries</span>
              {renderAuditEntries(auditHistoryEntries)}
            </div>
          ) : (
            <p className="fg-muted">No retained audit entries were attached to this approval detail.</p>
          )}
          {auditEntries.length > 0 ? renderMetadataGrid(auditEntries) : null}
          <div className="fg-actions">
            <Link className="fg-nav-link" to={detailAuditHistoryRoute}>Open Audit History</Link>
          </div>
        </div>
      </article>

      {detail.artifacts.length > 0 ? (
        <article className="fg-card">
          <h3>Attached artifacts</h3>
          <div className="fg-card-grid">
            {detail.artifacts.map((artifact) => (
              <article key={artifact.artifact_id} className="fg-subcard">
                <span className="fg-section-label">{artifact.label}</span>
                <p>{artifact.artifact_type} · {artifact.status}</p>
                <p><span className="fg-code">{artifact.artifact_id}</span></p>
              </article>
            ))}
          </div>
        </article>
      ) : null}

      <article className="fg-card">
        <h3>Decision panel</h3>
        {showDecisionOutcome ? (
          <div className="fg-approval-banner" data-tone={decisionOutcome.tone}>
            <strong>{decisionOutcome.title}</strong>
            <p>{decisionOutcome.body}</p>
            <p>Comment: {decisionOutcome.comment || "No comment supplied."}</p>
            <p><Link className="fg-nav-link" to={detailAuditHistoryRoute}>Open recorded audit evidence</Link></p>
          </div>
        ) : null}

        {detail.status === "open" ? (
          hasDecisionAction ? (
            <div className="fg-stack">
              <label className="fg-stack">
                Decision comment (optional)
                <textarea
                  rows={4}
                  value={decisionComment}
                  onChange={(event) => onDecisionCommentChange(event.target.value)}
                  placeholder="Add operator rationale when the evidence needs extra context."
                />
              </label>
              <p className="fg-muted">Comment is optional. The approval outcome is still explicit, and the audit link below remains the authoritative record.</p>
              <div className="fg-actions">
                <button type="button" disabled={decisionPending || !canApprove} onClick={() => onStartDecisionConfirmation("approve")}>
                  {approveDecisionFlow?.reviewLabel ?? "Review approval"}
                </button>
                <button type="button" disabled={decisionPending || !canReject} onClick={() => onStartDecisionConfirmation("reject")}>
                  {rejectDecisionFlow?.reviewLabel ?? "Review rejection"}
                </button>
              </div>
              {hasPendingDecisionFlow ? (
                <div className="fg-stack">
                  <div className="fg-approval-banner" data-tone={pendingDecisionFlow.tone}>
                    <strong>{pendingDecisionFlow.title}</strong>
                    <p>{pendingDecisionFlow.body}</p>
                    <p>Comment: {decisionComment.trim() || "No comment supplied."}</p>
                  </div>
                  <div className="fg-actions">
                    <button type="button" disabled={decisionPending} onClick={onCancelDecisionConfirmation}>Back to edit</button>
                    <button
                      type="button"
                      disabled={decisionPending || pendingDecisionIntent === null}
                      onClick={() => pendingDecisionIntent && onDecision(pendingDecisionIntent)}
                    >
                      {pendingDecisionFlow.confirmLabel}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="fg-muted">Review the action preview first, then choose approve or reject to confirm the outcome.</p>
              )}
              {approveBlockedReason ? <p className="fg-muted">{approveBlockedReason}</p> : null}
              {rejectBlockedReason ? <p className="fg-muted">{rejectBlockedReason}</p> : null}
            </div>
          ) : (
            <p className="fg-muted">{decisionBlockedReason}</p>
          )
        ) : (
          <p className="fg-muted">This approval is already resolved. Use the linked audit trail and downstream surface to verify the recorded outcome.</p>
        )}
      </article>

      <article className="fg-card">
        <h3>System record</h3>
        <div className="fg-stack">
          {renderMetadataGrid(decisionEntries)}
          {systemEntries.length > 0 ? renderMetadataGrid(systemEntries) : <p className="fg-muted">No additional system metadata was recorded.</p>}
        </div>
      </article>
    </section>
  );
}
