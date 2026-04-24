import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";

import type {
  ExecutionOperatorActionResult,
  ExecutionReplayResult,
  ExecutionRunDetail,
  ExecutionRunSummary,
} from "../../api/admin";
import { buildArtifactsPath, buildWorkspacePath } from "../../app/workInteractionRoutes";
import {
  countAttentionRuns,
  countReplayableRuns,
  countTerminalRuns,
  describeExecutionScopeOption,
  formatJson,
  formatTimestamp,
  getStateTone,
  STATE_OPTIONS,
  type ExecutionAccessState,
  type ExecutionScopeOption,
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
  onInstanceDraftChange: (value: string) => void;
  onStateDraftChange: (value: string) => void;
  onScopeSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onScopeClear: () => void;
  onScopeChoice: (instanceId: string) => void;
};

type ExecutionRunsSectionProps = {
  instanceId: string;
  companyId: string;
  stateFilter: string;
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
  onOperatorAction: (action: "pause" | "resume" | "interrupt" | "quarantine" | "restart" | "escalate") => void;
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

function describeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  return String(value);
}

function describeTimestamp(value: unknown, fallback = "Not scheduled"): string {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }
  return formatTimestamp(value, fallback);
}

function RunExplainabilitySection({
  title,
  tone,
  children,
  detail,
  detailLabel,
}: {
  title: string;
  tone: "neutral" | "success" | "warning" | "danger";
  children: ReactNode;
  detail: unknown;
  detailLabel: string;
}) {
  return (
    <article className="fg-subcard">
      <div className="fg-panel-heading">
        <h4>{title}</h4>
        <span className="fg-pill" data-tone={tone}>
          Structured truth
        </span>
      </div>
      {children}
      <details>
        <summary>{detailLabel}</summary>
        <pre>{formatJson(detail)}</pre>
      </details>
    </article>
  );
}

function RunExplainabilityCard({ detail }: { detail: ExecutionRunDetail }) {
  const resultSummary = asRecord(detail.result_summary);
  const routing = asRecord(resultSummary?.routing);
  const dispatch = asRecord(resultSummary?.dispatch);
  const wakeGate = asRecord(resultSummary?.wake_gate);
  const lastFailure = asRecord(resultSummary?.last_failure);

  return (
    <article className="fg-subcard">
      <div className="fg-panel-heading">
        <div>
          <h4>Run Explainability</h4>
          <p className="fg-muted">Routing, dispatch, wake gating, and failure truth are surfaced from durable run state instead of staying hidden in backend-only payloads.</p>
        </div>
        <span className="fg-pill" data-tone={resultSummary ? "success" : "warning"}>
          {resultSummary ? "Run truth recorded" : "Run truth missing"}
        </span>
      </div>

      {!resultSummary ? (
        <p className="fg-muted">No result summary was recorded for this run.</p>
      ) : (
        <div className="fg-stack">
          <div className="fg-card-grid">
            {routing ? (
              <RunExplainabilitySection
                title="Routing decision"
                tone="neutral"
                detail={routing.structured_details ?? routing}
                detailLabel="Structured routing detail"
              >
                <ul className="fg-list">
                  <li>Summary: {describeValue(routing.summary)}</li>
                  <li>Selected target: {describeValue(routing.selected_target_key)}</li>
                  <li>Classification: {describeValue(routing.classification)}</li>
                  <li>Policy stage: {describeValue(routing.policy_stage)}</li>
                  <li>Decision ID: {describeValue(routing.decision_id)}</li>
                </ul>
                {routing.raw_details ? (
                  <details>
                    <summary>Raw routing detail</summary>
                    <pre>{formatJson(routing.raw_details)}</pre>
                  </details>
                ) : null}
              </RunExplainabilitySection>
            ) : null}

            {dispatch ? (
              <RunExplainabilitySection
                title="Dispatch state"
                tone="neutral"
                detail={dispatch}
                detailLabel="Structured dispatch detail"
              >
                <ul className="fg-list">
                  <li>Stage: {describeValue(dispatch.stage)}</li>
                  <li>Execution lane: {describeValue(dispatch.execution_lane)}</li>
                  <li>Operator state: {describeValue(dispatch.operator_state)}</li>
                  <li>Attempt ID: {describeValue(dispatch.attempt_id)}</li>
                  <li>Run ID: {describeValue(dispatch.run_id)}</li>
                </ul>
              </RunExplainabilitySection>
            ) : null}

            {wakeGate ? (
              <RunExplainabilitySection
                title="Wake gate"
                tone={wakeGate.spurious_wake_blocked ? "warning" : "success"}
                detail={wakeGate}
                detailLabel="Structured wake detail"
              >
                <ul className="fg-list">
                  <li>Claim allowed: {describeValue(wakeGate.claim_allowed)}</li>
                  <li>Spurious wake blocked: {describeValue(wakeGate.spurious_wake_blocked)}</li>
                  <li>Next wakeup: {describeTimestamp(wakeGate.next_wakeup_at)}</li>
                  <li>Scheduled at: {describeTimestamp(wakeGate.scheduled_at)}</li>
                  <li>Resumed at: {describeTimestamp(wakeGate.resumed_at)}</li>
                  <li>Paused at: {describeTimestamp(wakeGate.paused_at)}</li>
                </ul>
              </RunExplainabilitySection>
            ) : null}

            {lastFailure ? (
              <RunExplainabilitySection
                title="Failure posture"
                tone="danger"
                detail={lastFailure}
                detailLabel="Structured failure detail"
              >
                <ul className="fg-list">
                  <li>Error code: {describeValue(lastFailure.error_code)}</li>
                  <li>Retryable: {describeValue(lastFailure.retryable)}</li>
                  <li>Attempt no: {describeValue(lastFailure.attempt_no)}</li>
                  <li>Retry count: {describeValue(lastFailure.retry_count)}</li>
                  <li>Max attempts: {describeValue(lastFailure.max_attempts)}</li>
                  <li>Next attempt: {describeValue(lastFailure.next_attempt_id)}</li>
                </ul>
              </RunExplainabilitySection>
            ) : null}
          </div>

          {!routing && !dispatch && !wakeGate && !lastFailure ? (
            <p className="fg-muted">A raw result summary exists, but the run did not record structured routing, dispatch, wake, or failure sections.</p>
          ) : null}

          <details>
            <summary>Raw result summary payload</summary>
            <pre>{formatJson(detail.result_summary)}</pre>
          </details>
        </div>
      )}
    </article>
  );
}

function NativeRuntimeMappingCard({ detail }: { detail: ExecutionRunDetail }) {
  const mapping = detail.native_mapping;

  return (
    <article className="fg-subcard">
      <div className="fg-panel-heading">
        <div>
          <h4>Native runtime mapping</h4>
          <p className="fg-muted">ForgeFrame shows the native object, event, command, and view taxonomy behind this runtime or execution path instead of hiding it behind OpenAI-shaped envelopes.</p>
        </div>
        <span className="fg-pill" data-tone={mapping ? "success" : "warning"}>
          {mapping ? "Mapping recorded" : "Mapping missing"}
        </span>
      </div>

      {!mapping ? (
        <p className="fg-muted">No native runtime mapping was recorded for this run detail.</p>
      ) : (
        <div className="fg-stack">
          <ul className="fg-list">
            <li>Contract surface: {mapping.contract_surface}</li>
            <li>Request path: {mapping.request_path}</li>
            <li>Primary native object: {mapping.primary_native_object_kind ?? "Not declared"}</li>
            <li>Response ID: {mapping.response_id ?? "Not attached"}</li>
            <li>Processing mode: {mapping.processing_mode}</li>
          </ul>

          <div className="fg-card-grid">
            <article className="fg-subcard">
              <h5>Objects</h5>
              {mapping.objects.length === 0 ? (
                <p className="fg-muted">No native objects were recorded.</p>
              ) : (
                <ul className="fg-list">
                  {mapping.objects.map((item) => (
                    <li key={`${item.kind}:${item.object_id}`}>
                      {item.kind} · {item.object_id} · {item.relation} · {item.lifecycle_state ?? "state not recorded"}
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="fg-subcard">
              <h5>Events</h5>
              {mapping.events.length === 0 ? (
                <p className="fg-muted">No native events were recorded.</p>
              ) : (
                <ul className="fg-list">
                  {mapping.events.map((item, index) => (
                    <li key={`${item.event_kind}:${item.related_object_id ?? index}`}>
                      {item.event_kind} · {item.related_object_kind ?? "object not recorded"} · {item.status ?? "status not recorded"}
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="fg-subcard">
              <h5>Commands</h5>
              {mapping.commands.length === 0 ? (
                <p className="fg-muted">No canonical native commands were recorded.</p>
              ) : (
                <ul className="fg-list">
                  {mapping.commands.map((item, index) => (
                    <li key={`${item.command_kind}:${item.command_id ?? index}`}>
                      {item.command_kind} · {item.command_id ?? "no command id"} · {item.status ?? "status not recorded"}
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="fg-subcard">
              <h5>Views</h5>
              {mapping.views.length === 0 ? (
                <p className="fg-muted">No native views were recorded.</p>
              ) : (
                <ul className="fg-list">
                  {mapping.views.map((item, index) => (
                    <li key={`${item.view_kind}:${item.label ?? index}`}>
                      {item.view_kind} · {item.available ? "available" : "unavailable"} · {item.label ?? "unlabeled"}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>

          {mapping.notes.length > 0 ? (
            <article className="fg-subcard">
              <h5>Notes</h5>
              <ul className="fg-list">
                {mapping.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </article>
          ) : null}

          <details>
            <summary>Raw native mapping payload</summary>
            <pre>{formatJson(mapping)}</pre>
          </details>
        </div>
      )}
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
  onInstanceDraftChange,
  onStateDraftChange,
  onScopeSubmit,
  onScopeClear,
  onScopeChoice,
}: ScopeFilterCardProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Scope and Filter</h3>
          <p className="fg-muted">Execution runs are opened through a canonical ForgeFrame instance. The backend still resolves the underlying execution company scope, but the operator path starts from a real instance boundary.</p>
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
                <p className="fg-muted">These instances come from the real instance registry, not from incidental approval history.</p>
              </div>
              <span className="fg-pill" data-tone="neutral">
                Instance registry
              </span>
            </div>

            {scopeOptionsState === "loading" ? (
              <p className="fg-muted">Loading active instances from the control-plane registry.</p>
            ) : null}

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
      <form className="fg-inline-form" onSubmit={onScopeSubmit}>
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
        <div className="fg-actions fg-actions-end">
          <button type="submit">Load execution runs</button>
          <button type="button" onClick={onScopeClear}>
            Clear scope
          </button>
        </div>
      </form>
      <p className="fg-note">Deep links keep `instanceId`, `state`, and `runId` when another route already knows the execution scope you need.</p>
    </article>
  );
}

export function MissingExecutionScopeCard() {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Choose execution scope</h3>
          <p className="fg-muted">Execution review stays honest about explicit scope, but the route now starts from the real instance registry instead of forcing raw company IDs as the default path.</p>
        </div>
        <span className="fg-pill" data-tone="warning">
          Scope missing
        </span>
      </div>
      <ul className="fg-list">
        <li>Start with a quick scope choice above when the real instance registry already exposes the runtime boundary you need.</li>
        <li>Use the exact `instanceId` field when the required run lives outside the currently visible instance list.</li>
        <li>Scoped deep links from approvals or audit evidence can preserve `instanceId`, `state`, and `runId` so the route lands on the relevant run review path.</li>
        <li>Replay remains blocked for read-only sessions even after scope is supplied.</li>
        <li>Approval metadata that is not tied to an execution run still lives on governance routes, not here.</li>
      </ul>
    </article>
  );
}

function RunDetailCollections({ detail }: { detail: ExecutionRunDetail }) {
  return (
    <div className="fg-card-grid">
      <article className="fg-subcard">
        <h4>Attempts</h4>
        {detail.attempts.length === 0 ? (
          <p className="fg-muted">No attempt records were returned for this run snapshot.</p>
        ) : (
          <div className="fg-stack">
            {detail.attempts.map((attempt) => (
              <div key={attempt.id} className="fg-outline-row">
                <div className="fg-panel-heading fg-data-row-heading">
                  <strong>Attempt {attempt.attempt_no}</strong>
                  <span className="fg-pill" data-tone={getStateTone(attempt.attempt_state)}>
                    {attempt.attempt_state}
                  </span>
                </div>
                <ul className="fg-list">
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
        <h4>Commands</h4>
        {detail.commands.length === 0 ? (
          <p className="fg-muted">No command history was returned for this run snapshot.</p>
        ) : (
          <div className="fg-stack">
            {detail.commands.map((command) => (
              <details key={command.id} className="fg-outline-row">
                <summary>
                  {command.command_type} · {command.command_status} · {formatTimestamp(command.issued_at)}
                </summary>
                <ul className="fg-list">
                  <li>Actor: {command.actor_type} · {command.actor_id}</li>
                  <li>Accepted transition: {command.accepted_transition ?? "Not recorded"}</li>
                  <li>Completed at: {formatTimestamp(command.completed_at)}</li>
                  <li>Idempotency key: <span className="fg-code">{command.idempotency_key}</span></li>
                </ul>
                <pre>{formatJson(command.response_snapshot)}</pre>
              </details>
            ))}
          </div>
        )}
      </article>

      <article className="fg-subcard">
        <h4>Outbox</h4>
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

export function ExecutionRunsSection({
  instanceId,
  companyId,
  stateFilter,
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
        <p className="fg-muted">ForgeFrame is fetching the company-scoped execution list before exposing a selected run.</p>
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

  return (
    <>
      <div className="fg-grid fg-grid-compact">
        <article className="fg-kpi">
          <span className="fg-muted">Runs loaded</span>
          <strong className="fg-kpi-value">{runs.length}</strong>
        </article>
        <article className="fg-kpi">
          <span className="fg-muted">Replayable</span>
          <strong className="fg-kpi-value">{countReplayableRuns(runs)}</strong>
        </article>
        <article className="fg-kpi">
          <span className="fg-muted">Terminal</span>
          <strong className="fg-kpi-value">{countTerminalRuns(runs)}</strong>
        </article>
        <article className="fg-kpi">
          <span className="fg-muted">Needs attention</span>
          <strong className="fg-kpi-value">{countAttentionRuns(runs)}</strong>
        </article>
      </div>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Run Queue</h3>
              <p className="fg-muted">The list reflects only the current instance and its resolved execution scope. No cross-instance fallback is implied.</p>
            </div>
            <span className="fg-pill" data-tone="neutral">
              Filter: {stateFilter === "all" ? "all states" : stateFilter}
            </span>
          </div>

          {runs.length === 0 ? (
            <p className="fg-muted">No execution runs matched the current filter. That means the backend returned an empty instance-scoped result, not that the workflow is hidden elsewhere.</p>
          ) : (
            <div className="fg-stack">
              {runs.map((run) => {
                const isCurrent = run.run_id === selectedRunId;
                return (
                  <button
                    key={run.run_id}
                    type="button"
                    className={`fg-data-row${isCurrent ? " is-current" : ""}`}
                    onClick={() => onRunSelection(run.run_id)}
                  >
                    <div className="fg-panel-heading fg-data-row-heading">
                      <div className="fg-page-header">
                        <span className="fg-code">{run.run_id}</span>
                        <strong>{run.run_kind}</strong>
                      </div>
                      <div className="fg-actions">
                        <span className="fg-pill" data-tone={getStateTone(run.state)}>
                          {run.state}
                        </span>
                        {run.replayable ? (
                          <span className="fg-pill" data-tone="warning">
                            Replayable
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="fg-detail-grid">
                      <span className="fg-muted">
                        attempt {run.active_attempt_no} · workspace {run.workspace_id ?? "unlinked"} · issue {run.issue_id ?? "unlinked"} · status reason {run.status_reason ?? "not provided"}
                      </span>
                      <span className="fg-muted">
                        updated {formatTimestamp(run.updated_at)} · terminal {formatTimestamp(run.terminal_at, "not terminal")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Run Detail</h3>
              <p className="fg-muted">Run detail is URL-addressable through `runId` and stays separate from the queue list so operators can share or return to a specific run review.</p>
            </div>
            {selectedSummary ? (
              <span className="fg-pill" data-tone={getStateTone(selectedSummary.state)}>
                {selectedSummary.state}
              </span>
            ) : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a run from the queue to inspect attempts, commands, outbox state, and replay eligibility.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading the selected run detail.</p> : null}
          {detailState === "error" ? <p className="fg-danger">{detailError}</p> : null}

          {detail ? (
            <div className="fg-stack">
              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Run Summary</h4>
                  <ul className="fg-list">
                    <li>Run ID: <span className="fg-code">{detail.run_id}</span></li>
                    <li>Instance scope: <span className="fg-code">{instanceId}</span></li>
                    <li>Execution scope: <span className="fg-code">{companyId}</span></li>
                    <li>Workspace: {detail.workspace_id ?? "No workspace linked"}</li>
                    <li>Run kind: {detail.run_kind}</li>
                    <li>Execution lane: {detail.execution_lane}</li>
                    <li>Issue link: {detail.issue_id ?? "No issue linked"}</li>
                    <li>Created at: {formatTimestamp(detail.created_at)}</li>
                    <li>Updated at: {formatTimestamp(detail.updated_at)}</li>
                  </ul>
                </article>
                <article className="fg-subcard">
                  <h4>Current State</h4>
                  <ul className="fg-list">
                    <li>Run state: {detail.state}</li>
                    <li>Operator state: {detail.operator_state}</li>
                    <li>Status reason: {detail.status_reason ?? "Not provided"}</li>
                    <li>Failure class: {detail.failure_class ?? "None"}</li>
                    <li>Next wakeup: {formatTimestamp(detail.next_wakeup_at)}</li>
                    <li>Terminal at: {formatTimestamp(detail.terminal_at)}</li>
                    <li>Replayable: {detail.replayable ? "yes" : "no"}</li>
                  </ul>
                </article>
                <article className="fg-subcard">
                  <h4>{access.mutationTitle}</h4>
                  <p className="fg-muted">{access.mutationDetail}</p>
                  {detail.current_attempt ? (
                    <ul className="fg-list">
                      <li>Current attempt: {detail.current_attempt.attempt_no}</li>
                      <li>Attempt state: {detail.current_attempt.attempt_state}</li>
                      <li>Operator attempt state: {detail.current_attempt.operator_state}</li>
                      <li>Lease status: {detail.current_attempt.lease_status}</li>
                      <li>Last error: {detail.current_attempt.last_error_code ?? "None"}</li>
                    </ul>
                  ) : (
                    <p className="fg-muted">No active attempt is attached to this run snapshot.</p>
                  )}
                </article>
                <article className="fg-subcard">
                  <h4>Workspace and artifacts</h4>
                  {detail.workspace?.workspace_id ? (
                    <>
                      <ul className="fg-list">
                        <li>Workspace ID: <Link to={buildWorkspacePath({ instanceId, workspaceId: detail.workspace.workspace_id })}>{detail.workspace.workspace_id}</Link></li>
                        <li>Preview: {detail.workspace.preview_status}</li>
                        <li>Review: {detail.workspace.review_status}</li>
                        <li>Handoff: {detail.workspace.handoff_status}</li>
                        <li>Latest approval: {detail.workspace.latest_approval_id ? <Link to={buildApprovalRoute(instanceId, detail.workspace.latest_approval_id)}>{detail.workspace.latest_approval_id}</Link> : "None"}</li>
                      </ul>
                    </>
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
              </div>

              <RunExplainabilityCard detail={detail} />
              <NativeRuntimeMappingCard detail={detail} />

              <article className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>Operator Controls</h4>
                    <p className="fg-muted">Pause, resume, interrupt, quarantine, restart, and lane escalation write durable commands into the execution fabric instead of living only in UI state.</p>
                  </div>
                  <span className="fg-pill" data-tone={access.canReplay ? "success" : "warning"}>
                    {access.canReplay ? "Write enabled" : "Read-only"}
                  </span>
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
                  Execution lane override
                  <select aria-label="Execution operator lane" value={operatorLane} onChange={(event) => onOperatorLaneChange(event.target.value)}>
                    <option value="">Keep current lane</option>
                    <option value="interactive_low_latency">interactive_low_latency</option>
                    <option value="interactive_heavy">interactive_heavy</option>
                    <option value="background_agentic">background_agentic</option>
                    <option value="oauth_serialized">oauth_serialized</option>
                  </select>
                </label>
                <div className="fg-actions">
                  <button type="button" disabled={!access.canReplay || operatorActionState === "submitting"} onClick={() => onOperatorAction("pause")}>Pause</button>
                  <button type="button" disabled={!access.canReplay || operatorActionState === "submitting"} onClick={() => onOperatorAction("resume")}>Resume</button>
                  <button type="button" disabled={!access.canReplay || operatorActionState === "submitting"} onClick={() => onOperatorAction("interrupt")}>Interrupt</button>
                  <button type="button" disabled={!access.canReplay || operatorActionState === "submitting"} onClick={() => onOperatorAction("quarantine")}>Quarantine</button>
                  <button type="button" disabled={!access.canReplay || operatorActionState === "submitting"} onClick={() => onOperatorAction("restart")}>Restart</button>
                  <button type="button" disabled={!access.canReplay || operatorActionState === "submitting"} onClick={() => onOperatorAction("escalate")}>Escalate</button>
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
                    </ul>
                  </div>
                ) : null}
              </article>

              <article className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>Replay Admission</h4>
                    <p className="fg-muted">Replay writes a new retry command and the admin audit event. It does not bypass company scope, permission checks, or the run-state machine.</p>
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
                      : "The selected run is not replayable in its current state. Inspect the run detail and queue state instead of assuming replay is always possible."}
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
                    {replayAuditHistoryPath ? (
                      <p>
                        <Link to={replayAuditHistoryPath}>Open Audit History</Link>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>

              <RunDetailCollections detail={detail} />
            </div>
          ) : null}
        </article>
      </div>
    </>
  );
}
