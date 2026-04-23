import { Link } from "react-router-dom";

import type { ApprovalDetail, ApprovalStatus, ApprovalSummary, ArtifactRecord } from "../../api/admin";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import type { ApprovalBanner, ApprovalDecisionConfirmation } from "./presentation";
import {
  formatApprovalActor,
  formatApprovalSourceKind,
  formatApprovalStatus,
  formatApprovalType,
  formatDetailValue,
  formatSessionStatus,
  formatTimestamp,
  humanizeApprovalField,
} from "./presentation";
import {
  describeApprovalQueueItem,
  describeApprovalQueueSection,
  describeEmptyQueueState,
  formatApprovalQueueUrgency,
  formatOpenedAtFilter,
  formatStatusFilterLabel,
  type ApprovalQueueSection,
  type ApprovalTypeFilter,
  type OpenedAtFilter,
  type RequesterFilterOption,
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

type ApprovalFiltersCardProps = {
  statusFilter: ApprovalStatus | "all";
  typeFilter: ApprovalTypeFilter;
  requesterFilter: string;
  requesterOptions: RequesterFilterOption[];
  openedAtFilter: OpenedAtFilter;
  search: string;
  orderedVisibleCount: number;
  activeQueueFilters: string[];
  onStatusFilterChange: (value: ApprovalStatus | "all") => void;
  onTypeFilterChange: (value: ApprovalTypeFilter) => void;
  onRequesterFilterChange: (value: string) => void;
  onOpenedAtFilterChange: (value: OpenedAtFilter) => void;
  onSearchChange: (value: string) => void;
};

export function ApprovalFiltersCard({
  statusFilter,
  typeFilter,
  requesterFilter,
  requesterOptions,
  openedAtFilter,
  search,
  orderedVisibleCount,
  activeQueueFilters,
  onStatusFilterChange,
  onTypeFilterChange,
  onRequesterFilterChange,
  onOpenedAtFilterChange,
  onSearchChange,
}: ApprovalFiltersCardProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Queue filters</h3>
          <p className="fg-muted">Filter by status, approval type, requester, and opened-at window before using free search for targets, titles, runs, or IDs. Matching rows stay grouped by derived urgency so expiring and requester-ready work does not get buried.</p>
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
          Approval type
          <select value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value as ApprovalTypeFilter)}>
            <option value="all">All approval types</option>
            <option value="execution_run">Execution run</option>
            <option value="break_glass">Break-glass</option>
            <option value="impersonation">Impersonation</option>
          </select>
        </label>
        <label>
          Requester
          <select value={requesterFilter} onChange={(event) => onRequesterFilterChange(event.target.value)}>
            <option value="all">All requesters</option>
            {requesterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Opened at
          <select value={openedAtFilter} onChange={(event) => onOpenedAtFilterChange(event.target.value as OpenedAtFilter)}>
            <option value="all">Any time</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </label>
        <label>
          Search
          <input
            placeholder="Search target, title, issue, or ID"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>
      <p className="fg-muted">
        Reviewing {orderedVisibleCount} matching item{orderedVisibleCount === 1 ? "" : "s"} in this queue slice. ForgeFrame derives the queue urgency from current status, expiry, and issuance state in the live payload.
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
  queueSections: ApprovalQueueSection[];
  selectedApprovalId: string | null;
  statusFilter: ApprovalStatus | "all";
  approvalsLoaded: number;
  hasClientSideQueueFilters: boolean;
  onSelectApproval: (approvalId: string) => void;
};

export function ApprovalQueueCard({
  listLoading,
  orderedVisibleApprovals,
  queueSections,
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
          <p className="fg-muted">
            {orderedVisibleApprovals.length} matching item{orderedVisibleApprovals.length === 1 ? "" : "s"}, grouped by urgency first and approval type second.
          </p>
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

      {orderedVisibleApprovals.length > 0 ? (
        <div className="fg-approval-queue-groups" aria-label="Approval queue">
          {queueSections.map((section) => (
            <section key={section.key} className="fg-approval-queue-group">
              <div className="fg-wayfinding-label">
                <div>
                  <h4>{formatApprovalQueueUrgency(section.urgency)} · {formatApprovalType(section.approval_type)}</h4>
                  <p className="fg-muted">{describeApprovalQueueSection(section.urgency, section.approval_type)}</p>
                </div>
                <span className="fg-pill" data-tone={section.tone}>
                  {section.items.length} item{section.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="fg-approval-list">
                {section.items.map((item) => {
                  const isSelected = item.approval_id === selectedApprovalId;
                  const sessionLabel = formatSessionStatus(item.session_status, item.ready_to_issue);

                  return (
                    <button
                      key={item.approval_id}
                      type="button"
                      className={`fg-approval-item${isSelected ? " is-selected" : ""}`}
                      onClick={() => onSelectApproval(item.approval_id)}
                    >
                      <div className="fg-approval-item-header">
                        <strong>{item.title}</strong>
                        <div className="fg-actions">
                          <span className="fg-pill" data-tone={section.tone}>
                            {formatApprovalQueueUrgency(section.urgency)}
                          </span>
                          <span className="fg-pill" data-tone={section.tone === "neutral" ? "neutral" : undefined}>
                            {formatApprovalStatus(item.status)}
                          </span>
                        </div>
                      </div>
                      <p className="fg-muted">{describeApprovalQueueItem(item)}</p>
                      <div className="fg-approval-meta">
                        <span>Opened {formatTimestamp(item.opened_at)}</span>
                        {item.status === "open" && item.expires_at ? <span>Decision window {formatTimestamp(item.expires_at)}</span> : null}
                        <span>Requester {formatApprovalActor(item.requester)}</span>
                        <span>Target {formatApprovalActor(item.target)}</span>
                        <span>Source {formatApprovalSourceKind(item.source_kind)}</span>
                        {sessionLabel ? <span>Session {sessionLabel}</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </article>
  );
}

type ApprovalDetailSectionProps = {
  detailLoading: boolean;
  detail: ApprovalDetail | null;
  banner: ApprovalBanner | null;
  executionReviewRoute: string | null;
  canOpenSecurity: boolean;
  primaryEvidenceEntries: Array<[string, unknown]>;
  evidenceEntries: Array<[string, unknown]>;
  auditScopeLabel: string;
  auditNextActorLabel: string;
  detailAuditHistoryRoute: string;
  decisionEntries: Array<[string, unknown]>;
  referenceEntries: Array<[string, unknown]>;
  sourceEntries: Array<[string, unknown]>;
  workspaceEntries: Array<[string, unknown]>;
  workspaceRoute: string | null;
  artifactRoute: string | null;
  artifacts: ArtifactRecord[];
  hasDecisionAction: boolean;
  decisionBlockedReason: string;
  decisionNote: string;
  decisionReady: boolean;
  decisionPending: boolean;
  canApprove: boolean;
  canReject: boolean;
  approveDecisionFlow: ApprovalDecisionConfirmation | null;
  rejectDecisionFlow: ApprovalDecisionConfirmation | null;
  pendingDecisionFlow: ApprovalDecisionConfirmation | null;
  pendingDecisionIntent: "approve" | "reject" | null;
  hasPendingDecisionFlow: boolean;
  approveBlockedReason: string;
  rejectBlockedReason: string;
  onDecisionNoteChange: (value: string) => void;
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
  primaryEvidenceEntries,
  evidenceEntries,
  auditScopeLabel,
  auditNextActorLabel,
  detailAuditHistoryRoute,
  decisionEntries,
  referenceEntries,
  sourceEntries,
  workspaceEntries,
  workspaceRoute,
  artifactRoute,
  artifacts,
  hasDecisionAction,
  decisionBlockedReason,
  decisionNote,
  decisionReady,
  decisionPending,
  canApprove,
  canReject,
  approveDecisionFlow,
  rejectDecisionFlow,
  pendingDecisionFlow,
  pendingDecisionIntent,
  hasPendingDecisionFlow,
  approveBlockedReason,
  rejectBlockedReason,
  onDecisionNoteChange,
  onStartDecisionConfirmation,
  onCancelDecisionConfirmation,
  onDecision,
}: ApprovalDetailSectionProps) {
  return (
    <section className="fg-stack">
      <article className="fg-card">
        {detailLoading ? <p className="fg-muted">Loading approval detail…</p> : null}

        {!detailLoading && !detail ? (
          <p className="fg-muted">Select an approval item to review evidence, impact, and available actions.</p>
        ) : null}

        {!detailLoading && detail ? (
          <div className="fg-stack">
            <div className="fg-panel-heading">
              <div>
                <h3>{detail.title}</h3>
                <p className="fg-muted">
                  Request opened {formatTimestamp(detail.opened_at)} · Requester {formatApprovalActor(detail.requester)} · Target {formatApprovalActor(detail.target)}
                </p>
              </div>
              <div className="fg-actions">
                <span className="fg-pill" data-tone={detail.status === "approved" ? "success" : detail.status === "open" || detail.status === "timed_out" ? "warning" : detail.status === "rejected" ? "danger" : "neutral"}>
                  {formatApprovalStatus(detail.status)}
                </span>
                <span className="fg-pill">{formatApprovalType(detail.approval_type)}</span>
                <span className="fg-pill">{formatApprovalSourceKind(detail.source_kind)}</span>
                {formatSessionStatus(detail.session_status, detail.ready_to_issue) ? (
                  <span className="fg-pill">{formatSessionStatus(detail.session_status, detail.ready_to_issue)}</span>
                ) : null}
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
                <Link className="fg-nav-link" to={executionReviewRoute}>
                  Open Execution Review
                </Link>
              ) : null}
              {workspaceRoute ? (
                <Link className="fg-nav-link" to={workspaceRoute}>
                  Open Workspace
                </Link>
              ) : null}
              {artifactRoute ? (
                <Link className="fg-nav-link" to={artifactRoute}>
                  Open Artifacts
                </Link>
              ) : null}
              {detail.source_kind === "elevated_access" && canOpenSecurity ? (
                <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.security}>
                  Open Security & Policies
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </article>

      {detail ? (
        <>
          <article className="fg-card">
            <h3>Evidence</h3>
            <p className="fg-muted">Review the operator-facing request facts first, then the recorded evidence payload before you inspect raw IDs or source metadata.</p>
            <div className="fg-stack">
              {renderMetadataGrid(primaryEvidenceEntries)}
              {evidenceEntries.length > 0 ? (
                <div className="fg-stack">
                  <span className="fg-section-label">Recorded evidence</span>
                  {renderMetadataGrid(evidenceEntries)}
                </div>
              ) : (
                <p className="fg-muted">No additional evidence fields were recorded for this approval item.</p>
              )}
            </div>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Audit history</h3>
                <p className="fg-muted">
                  Open the scoped audit trail next. ForgeFrame resolves the newest retained event for this approval when one exists, then leaves raw metadata below as secondary context.
                </p>
              </div>
            </div>
            <div className="fg-card-grid">
              <article className="fg-subcard">
                <span className="fg-section-label">Audit scope</span>
                <p>{auditScopeLabel}</p>
              </article>
              <article className="fg-subcard">
                <span className="fg-section-label">Next actor</span>
                <p>{auditNextActorLabel}</p>
              </article>
            </div>
            <div className="fg-actions">
              <Link className="fg-nav-link" to={detailAuditHistoryRoute}>
                Open Audit History
              </Link>
            </div>
          </article>

          <article className="fg-card">
            <h3>Secondary metadata</h3>
            <p className="fg-muted">Decision timing, raw IDs, and source payloads stay visible here after the evidence and audit pass.</p>
            <div className="fg-stack">
              <div className="fg-stack">
                <span className="fg-section-label">Workspace context</span>
                {workspaceEntries.length > 0 ? (
                  renderMetadataGrid(workspaceEntries)
                ) : (
                  <p className="fg-muted">No workspace summary was attached to this approval detail.</p>
                )}
              </div>
              <div className="fg-stack">
                <span className="fg-section-label">Artifacts</span>
                {artifacts.length > 0 ? (
                  <div className="fg-card-grid">
                    {artifacts.map((artifact) => (
                      <article key={artifact.artifact_id} className="fg-subcard">
                        <span className="fg-section-label">{artifact.label}</span>
                        <p>{artifact.artifact_type} · {artifact.status}</p>
                        <p><span className="fg-code">{artifact.artifact_id}</span></p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="fg-muted">No artifacts were attached to this approval detail.</p>
                )}
              </div>
              <div className="fg-stack">
                <span className="fg-section-label">Decision record</span>
                {renderMetadataGrid(decisionEntries)}
              </div>
              <div className="fg-stack">
                <span className="fg-section-label">Identifiers</span>
                {renderMetadataGrid(referenceEntries)}
              </div>
              <div className="fg-stack">
                <span className="fg-section-label">System source</span>
                {sourceEntries.length > 0 ? (
                  renderMetadataGrid(sourceEntries)
                ) : (
                  <p className="fg-muted">No source metadata was recorded for this approval item.</p>
                )}
              </div>
            </div>
          </article>

          <article className="fg-card">
            <h3>Decision panel</h3>
            {detail.status === "open" ? (
              hasDecisionAction ? (
                <div className="fg-stack">
                  <label className="fg-stack">
                    Decision note
                    <textarea
                      rows={5}
                      value={decisionNote}
                      onChange={(event) => onDecisionNoteChange(event.target.value)}
                      placeholder="Record the decision rationale that should land in audit history."
                    />
                  </label>
                  <p className="fg-muted">A decision note is required. Use at least 8 characters so the audit trail carries real operator intent, then review the confirmation state before ForgeFrame records the decision.</p>
                  <div className="fg-actions">
                    <button
                      type="button"
                      disabled={!decisionReady || decisionPending || !canApprove}
                      onClick={() => onStartDecisionConfirmation("approve")}
                    >
                      {approveDecisionFlow?.reviewLabel ?? "Review approval"}
                    </button>
                    <button
                      type="button"
                      disabled={!decisionReady || decisionPending || !canReject}
                      onClick={() => onStartDecisionConfirmation("reject")}
                    >
                      {rejectDecisionFlow?.reviewLabel ?? "Review rejection"}
                    </button>
                  </div>
                  {hasPendingDecisionFlow && pendingDecisionFlow ? (
                    <div className="fg-stack">
                      <div className="fg-approval-banner" data-tone={pendingDecisionFlow.tone}>
                        <strong>{pendingDecisionFlow.title}</strong>
                        <p>{pendingDecisionFlow.body}</p>
                        <p><strong>Decision note:</strong> {decisionNote.trim()}</p>
                      </div>
                      <div className="fg-actions">
                        <button type="button" disabled={decisionPending} onClick={onCancelDecisionConfirmation}>
                          Back to edit
                        </button>
                        <button
                          type="button"
                          disabled={!decisionReady || decisionPending || pendingDecisionIntent === null}
                          onClick={() => pendingDecisionIntent && onDecision(pendingDecisionIntent)}
                        >
                          {pendingDecisionFlow.confirmLabel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="fg-muted">Choose an action to review its confirmation state before ForgeFrame records the decision.</p>
                  )}
                  {approveBlockedReason ? <p className="fg-muted">{approveBlockedReason}</p> : null}
                  {rejectBlockedReason ? <p className="fg-muted">{rejectBlockedReason}</p> : null}
                </div>
              ) : (
                <p className="fg-muted">{decisionBlockedReason}</p>
              )
            ) : (
              <p className="fg-muted">This approval is already resolved. Review the recorded outcome, evidence, and linked source state instead of issuing another decision.</p>
            )}
          </article>
        </>
      ) : null}
    </section>
  );
}
