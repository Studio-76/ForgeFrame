import {
  AdminApiError,
  type AdminSessionUser,
  type InstanceRecord,
  type ExecutionRunDetail,
  type ExecutionRunSummary,
} from "../../api/admin";
import {
  sessionCanMutateScopedOrAnyInstance,
  sessionHasScopedOrAnyInstancePermission,
} from "../../app/adminAccess";
import { normalizeExecutionCompanyId, normalizeExecutionInstanceId } from "../../app/executionReview";

export type LoadState = "idle" | "loading" | "success" | "error";
export type ReplayState = "idle" | "submitting" | "success" | "error";
export type OperatorActionState = "idle" | "submitting" | "success" | "error";
export type BadgeTone = "success" | "warning" | "danger" | "neutral";
export type ExecutionApprovalWaitFilter = "all" | "waiting_only";
export type ExecutionErrorFilter = "all" | "with_error";
export type ExecutionWindowFilter = "all" | "24h" | "72h" | "7d" | "30d";
export type ExecutionOperatorActionKey = "pause" | "resume" | "interrupt" | "quarantine" | "restart" | "escalate";

export type ExecutionScopeOption = {
  instanceId: string;
  displayName: string;
  tenantId: string;
  companyId: string;
  deploymentMode: InstanceRecord["deployment_mode"];
  exposureMode: InstanceRecord["exposure_mode"];
  status: InstanceRecord["status"];
};

export type ExecutionAccessState = {
  badgeLabel: string;
  badgeTone: BadgeTone;
  summaryDetail: string;
  canReplay: boolean;
  mutationTitle: string;
  mutationDetail: string;
};

export type ExecutionStateOption = {
  value: string;
  label: string;
};

export type ExecutionFilterOption = {
  value: string;
  label: string;
};

export type ExecutionLifecycleSummary = {
  label: string;
  detail: string;
  tone: BadgeTone;
};

export type ExecutionNextActionSummary = {
  label: string;
  detail: string;
  tone: BadgeTone;
};

export type OperatorActionAvailability = {
  enabled: boolean;
  reason: string;
};

export const DEFAULT_STATE_FILTER = "dead_lettered";
export const DEFAULT_LANE_FILTER = "";
export const DEFAULT_TARGET_FILTER = "";
export const DEFAULT_APPROVAL_WAIT_FILTER: ExecutionApprovalWaitFilter = "all";
export const DEFAULT_ERROR_FILTER: ExecutionErrorFilter = "all";
export const DEFAULT_WINDOW_FILTER: ExecutionWindowFilter = "all";

const IN_FLIGHT_ATTEMPT_STATES = new Set(["dispatching", "executing", "cancel_requested", "compensating"]);
const TERMINAL_OPERATOR_STATES = new Set(["completed", "quarantined", "failed"]);

export const STATE_OPTIONS: readonly ExecutionStateOption[] = [
  { value: "all", label: "All states" },
  { value: "quarantined", label: "Quarantined" },
  { value: "retry_scheduled", label: "Retry scheduled" },
  { value: "paused", label: "Paused" },
  { value: "dead_lettered", label: "Dead-lettered" },
  { value: "waiting_on_approval", label: "Waiting on approval" },
  { value: "retry_backoff", label: "Retry backoff" },
  { value: "failed", label: "Failed" },
  { value: "cancel_requested", label: "Cancel requested" },
  { value: "queued", label: "Queued" },
  { value: "dispatching", label: "Dispatching" },
  { value: "executing", label: "Executing" },
  { value: "compensating", label: "Compensating" },
  { value: "timed_out", label: "Timed out" },
  { value: "succeeded", label: "Succeeded" },
] as const;

export const LANE_OPTIONS: readonly ExecutionFilterOption[] = [
  { value: "", label: "All lanes" },
  { value: "interactive_low_latency", label: "interactive_low_latency" },
  { value: "interactive_heavy", label: "interactive_heavy" },
  { value: "background_agentic", label: "background_agentic" },
  { value: "oauth_serialized", label: "oauth_serialized" },
] as const;

export const APPROVAL_WAIT_OPTIONS: readonly ExecutionFilterOption[] = [
  { value: "all", label: "All runs" },
  { value: "waiting_only", label: "Approval wait only" },
] as const;

export const ERROR_FILTER_OPTIONS: readonly ExecutionFilterOption[] = [
  { value: "all", label: "All runs" },
  { value: "with_error", label: "With errors" },
] as const;

export const WINDOW_OPTIONS: readonly ExecutionFilterOption[] = [
  { value: "all", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "72h", label: "Last 72 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

export function buildExecutionScopeOptions(instances: InstanceRecord[]): ExecutionScopeOption[] {
  return instances
    .filter((instance) => instance.status === "active")
    .map((instance) => ({
      instanceId: normalizeExecutionInstanceId(instance.instance_id) ?? instance.instance_id,
      displayName: instance.display_name,
      tenantId: instance.tenant_id,
      companyId: normalizeExecutionCompanyId(instance.company_id) ?? instance.company_id,
      deploymentMode: instance.deployment_mode,
      exposureMode: instance.exposure_mode,
      status: instance.status,
    }))
    .sort((left, right) => {
      if (left.instanceId === right.instanceId) {
        return left.companyId.localeCompare(right.companyId);
      }
      return left.instanceId.localeCompare(right.instanceId);
    });
}

export function describeExecutionScopeOption(option: ExecutionScopeOption): string {
  return `${option.displayName} · tenant ${option.tenantId} · execution ${option.companyId} · ${option.deploymentMode} · ${option.exposureMode}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function describeExecutionRunTarget(run: ExecutionRunSummary): string {
  const resultSummary = asRecord(run.result_summary);
  const routing = asRecord(resultSummary?.routing);
  const direct = routing?.selected_target_key;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  for (const key of ["structured_details", "structured_explainability", "raw_details", "raw_explainability"]) {
    const candidate = asRecord(routing?.[key]);
    const selected = candidate?.selected_target_key ?? candidate?.selected_target;
    if (typeof selected === "string" && selected.trim()) {
      return selected.trim();
    }
  }
  const providerKey = resultSummary?.provider_key;
  const resolvedModel = resultSummary?.resolved_model;
  if (typeof providerKey === "string" && providerKey.trim() && typeof resolvedModel === "string" && resolvedModel.trim()) {
    return `${providerKey.trim()}::${resolvedModel.trim()}`;
  }
  return "Target not recorded";
}

export function describeExecutionRunCostClass(run: ExecutionRunSummary): string {
  const resultSummary = asRecord(run.result_summary);
  const routing = asRecord(resultSummary?.routing);
  for (const key of ["selected_cost_class", "cost_class"]) {
    const value = routing?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  const rawExplainability = asRecord(routing?.raw_explainability);
  const selectionBasis = asRecord(rawExplainability?.selection_basis);
  const selectedCandidate = asRecord(selectionBasis?.selected_candidate);
  const selectedCostClass = selectedCandidate?.cost_class;
  if (typeof selectedCostClass === "string" && selectedCostClass.trim()) {
    return selectedCostClass.trim();
  }
  const blockedCostClasses = Array.isArray(selectionBasis?.blocked_cost_classes)
    ? selectionBasis?.blocked_cost_classes.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  return blockedCostClasses.length > 0 ? `blocked: ${blockedCostClasses.join(", ")}` : "Not recorded";
}

export function describeExecutionError(run: ExecutionRunSummary): string {
  const resultSummary = asRecord(run.result_summary);
  const lastFailure = asRecord(resultSummary?.last_failure);
  const errorCode = run.current_attempt?.last_error_code
    ?? (typeof resultSummary?.error_code === "string" ? resultSummary.error_code : null)
    ?? (typeof lastFailure?.error_code === "string" ? lastFailure.error_code : null)
    ?? run.failure_class
    ?? run.status_reason;
  return typeof errorCode === "string" && errorCode.trim() ? errorCode.trim() : "No error recorded";
}

export function hasApprovalWait(run: ExecutionRunSummary): boolean {
  return run.state === "waiting_on_approval" || run.operator_state === "waiting_on_approval" || Boolean(run.current_approval_id);
}

export function hasRecordedError(run: ExecutionRunSummary): boolean {
  return describeExecutionError(run) !== "No error recorded";
}

export function describeExecutionLifecycle(run: ExecutionRunSummary): ExecutionLifecycleSummary {
  if (hasApprovalWait(run)) {
    return {
      label: "Approval gate holding execution",
      detail: "The active attempt is parked behind an approval decision. Operators should open the linked approval instead of forcing resume outside the approval flow.",
      tone: "warning",
    };
  }
  if (run.operator_state === "paused") {
    return {
      label: "Operator pause is active",
      detail: "Execution is intentionally frozen by an operator command and can only move again through resume or restart logic.",
      tone: "warning",
    };
  }
  if (run.state === "dead_lettered" || run.operator_state === "quarantined") {
    return {
      label: "Run is quarantined or terminal",
      detail: "The current attempt ended in a terminal lane and needs replay or restart instead of passive waiting.",
      tone: "danger",
    };
  }
  if (run.state === "failed" || run.state === "timed_out") {
    return {
      label: "Run terminated with failure",
      detail: "ForgeFrame has durable failure state for this run. Inspect the last error and decide whether replay, restart, or quarantine is appropriate.",
      tone: "danger",
    };
  }
  if (run.state === "cancel_requested" || run.operator_state === "interrupted") {
    return {
      label: "Cancellation is in flight",
      detail: "The worker path has already been told to stop. Review the outbox and recent commands before issuing further control actions.",
      tone: "warning",
    };
  }
  if (run.state === "executing" || run.operator_state === "waiting_external") {
    return {
      label: "Run is executing or waiting on external work",
      detail: "Execution is currently in the worker path or blocked on upstream runtime work. Interrupt is the correct control when damage must be limited immediately.",
      tone: "neutral",
    };
  }
  if (run.state === "dispatching" || run.operator_state === "leased") {
    return {
      label: "Run has been admitted to a worker",
      detail: "The attempt is already leased for dispatch. Monitor dispatch jobs or interrupt if the work must be cancelled.",
      tone: "neutral",
    };
  }
  if (run.state === "queued" || run.operator_state === "admitted" || run.operator_state === "retry_scheduled") {
    return {
      label: "Run is queued for another attempt",
      detail: "The run is eligible to move through the lane once scheduling and policy gates allow it. Pause or escalate are the safe control levers here.",
      tone: "success",
    };
  }
  if (run.state === "succeeded" || run.operator_state === "completed") {
    return {
      label: "Run finished successfully",
      detail: "Execution completed and the remaining work is post-run review, evidence checks, or restart from scratch if a fresh rerun is required.",
      tone: "success",
    };
  }
  return {
    label: "Lifecycle truth requires inspection",
    detail: "ForgeFrame has durable run state for this item, but the next operator move depends on the attempt, command, and outbox evidence below.",
    tone: "neutral",
  };
}

export function describeNextExecutionAction(run: ExecutionRunSummary): ExecutionNextActionSummary {
  if (hasApprovalWait(run)) {
    return {
      label: run.current_approval_id ? "Open approval" : "Review approval wait",
      detail: "The run is blocked on an approval decision rather than a worker lease.",
      tone: "warning",
    };
  }
  if (run.operator_state === "paused") {
    return {
      label: "Resume or restart",
      detail: "This run is intentionally paused by an operator.",
      tone: "warning",
    };
  }
  if (run.replayable) {
    return {
      label: "Replay or restart",
      detail: "The current state is terminal enough for a new attempt admission path.",
      tone: "danger",
    };
  }
  if (run.state === "cancel_requested" || run.operator_state === "interrupted") {
    return {
      label: "Watch cancellation",
      detail: "Further action should wait for the cancellation outbox path unless a clean restart is needed.",
      tone: "warning",
    };
  }
  if (run.state === "executing" || run.operator_state === "waiting_external") {
    return {
      label: "Monitor or interrupt",
      detail: "The worker path is active right now.",
      tone: "neutral",
    };
  }
  if (run.state === "queued" || run.operator_state === "admitted" || run.operator_state === "retry_scheduled") {
    return {
      label: "Pause or escalate",
      detail: "The run is still schedulable and can be redirected before execution advances.",
      tone: "success",
    };
  }
  return {
    label: "Inspect detail",
    detail: "The safe next step depends on the latest commands and approvals.",
    tone: "neutral",
  };
}

export function getStartedAt(run: ExecutionRunSummary): string {
  return run.current_attempt?.started_at ?? run.current_attempt?.scheduled_at ?? run.created_at;
}

export function getExecutionAccess(
  session: AdminSessionUser | null,
  sessionReady: boolean,
  instanceId?: string | null,
): ExecutionAccessState {
  const canReadExecution = sessionHasScopedOrAnyInstancePermission(session, instanceId, "execution.read");
  const canOperateExecution = sessionCanMutateScopedOrAnyInstance(session, instanceId, "execution.operate");

  if (!sessionReady) {
    return {
      badgeLabel: "Checking session",
      badgeTone: "neutral",
      summaryDetail: "ForgeFrame is still confirming whether this session can admit replay or only inspect execution truth.",
      canReplay: false,
      mutationTitle: "Checking replay permissions",
      mutationDetail: "Replay remains blocked until the current session role and read-only posture are confirmed.",
    };
  }

  if (!canReadExecution) {
    return {
      badgeLabel: "Operator or admin required",
      badgeTone: "warning",
      summaryDetail: "Execution review stays closed until the current session is operator or admin because the backend does not expose instance-scoped execution truth to viewers.",
      canReplay: false,
      mutationTitle: "Replay unavailable",
      mutationDetail: "Viewer sessions cannot open the execution route, and replay remains blocked until an operator or admin session is active.",
    };
  }

  if (session?.read_only) {
    return {
      badgeLabel: "Read-only execution review",
      badgeTone: "warning",
      summaryDetail: "Read-only sessions can inspect run detail and instance-scoped truth here, but replay is blocked to match impersonation and other read-only backend guards.",
      canReplay: false,
      mutationTitle: "Replay blocked by read-only session",
      mutationDetail: "ForgeFrame treats this session as inspect-only, even if the underlying role is operator or admin.",
    };
  }

  if (!canOperateExecution) {
    return {
      badgeLabel: "Execution review only",
      badgeTone: "warning",
      summaryDetail: "This session can inspect instance-scoped execution truth, but mutation controls stay blocked because execution.operate is not granted on the current scope.",
      canReplay: false,
      mutationTitle: "Replay unavailable",
      mutationDetail: "ForgeFrame keeps replay and operator actions blocked until execution.operate is granted on the selected instance.",
    };
  }

  return {
    badgeLabel: "Replay enabled",
    badgeTone: "success",
    summaryDetail: "Standard operator and admin sessions can inspect list/detail state and admit replay when the selected run state allows it.",
    canReplay: true,
    mutationTitle: "Replay available for eligible runs",
    mutationDetail: "Replay still depends on explicit company scope and the selected run's current state. Conflicts are surfaced directly from the backend.",
  };
}

export function getStateTone(state: string): BadgeTone {
  if (["succeeded", "completed", "published"].includes(state)) {
    return "success";
  }
  if (["dead_lettered", "quarantined", "failed", "timed_out", "cancelled", "dead", "interrupted", "stale", "lease_only"].includes(state)) {
    return "danger";
  }
  if (["waiting_on_approval", "retry_backoff", "retry_scheduled", "cancel_requested", "paused", "leased", "busy", "starting", "stopping"].includes(state)) {
    return "warning";
  }
  return "neutral";
}

export function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  return typeof value === "string" && value ? value : fallback;
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

export function countReplayableRuns(runs: ExecutionRunSummary[]): number {
  return runs.filter((run) => run.replayable).length;
}

export function countTerminalRuns(runs: ExecutionRunSummary[]): number {
  return runs.filter((run) => Boolean(run.terminal_at)).length;
}

export function countAttentionRuns(runs: ExecutionRunSummary[]): number {
  return runs.filter((run) => ["dead_lettered", "quarantined", "waiting_on_approval", "failed", "timed_out", "paused"].includes(run.operator_state || run.state)).length;
}

export function countApprovalWaitRuns(runs: ExecutionRunSummary[]): number {
  return runs.filter((run) => hasApprovalWait(run)).length;
}

export function countErrorRuns(runs: ExecutionRunSummary[]): number {
  return runs.filter((run) => hasRecordedError(run)).length;
}

export function getOperatorActionAvailability(
  detail: ExecutionRunDetail | null,
  access: ExecutionAccessState,
  action: ExecutionOperatorActionKey,
  selectedLane: string,
): OperatorActionAvailability {
  if (!access.canReplay) {
    return { enabled: false, reason: access.mutationDetail };
  }
  if (!detail) {
    return { enabled: false, reason: "Select a run first." };
  }

  const attemptState = detail.current_attempt?.attempt_state ?? "";
  const hasCurrentApproval = Boolean(detail.current_approval_id);

  if (action === "pause") {
    if (TERMINAL_OPERATOR_STATES.has(detail.operator_state) || detail.operator_state === "paused") {
      return { enabled: false, reason: `Pause is not valid from operator state '${detail.operator_state}'.` };
    }
    if (IN_FLIGHT_ATTEMPT_STATES.has(attemptState)) {
      return { enabled: false, reason: "In-flight attempts must be interrupted instead of paused." };
    }
    return { enabled: true, reason: "Pause is allowed for schedulable or approval-bound runs." };
  }

  if (action === "resume") {
    if (detail.operator_state !== "paused") {
      return { enabled: false, reason: "Only paused runs can resume." };
    }
    if (hasCurrentApproval) {
      return { enabled: false, reason: "Approval-gated runs cannot resume outside the approval flow." };
    }
    return { enabled: true, reason: "Resume will return the run to its backend-calculated operator state." };
  }

  if (action === "interrupt") {
    if (TERMINAL_OPERATOR_STATES.has(detail.operator_state)) {
      return { enabled: false, reason: `Interrupt is not valid from operator state '${detail.operator_state}'.` };
    }
    return { enabled: true, reason: "Interrupt is allowed while the run is still active or cancellable." };
  }

  if (action === "quarantine") {
    if (detail.operator_state === "quarantined") {
      return { enabled: false, reason: "This run is already quarantined." };
    }
    return { enabled: true, reason: "Quarantine will dead-letter the current attempt immediately." };
  }

  if (action === "restart") {
    return { enabled: true, reason: "Restart creates a fresh run from scratch." };
  }

  if (!selectedLane.trim()) {
    return { enabled: false, reason: "Choose a target lane before escalating." };
  }
  if (selectedLane.trim() === detail.execution_lane) {
    return { enabled: false, reason: "Choose a lane that differs from the current run lane." };
  }
  return { enabled: true, reason: "Escalation moves the run onto a different execution lane." };
}

/**
 * Tab keys for the execution review navigation.
 */
export type ExecutionTab = "runs" | "approvals" | "errors" | "health";

/**
 * Tab configuration with label and badge.
 */
export type ExecutionTabConfig = {
  key: ExecutionTab;
  label: string;
  badge: string | null;
  badgeTone: BadgeTone;
};

/**
 * Build tab configurations from the current run state.
 */
export function buildExecutionTabs(
  runs: ExecutionRunSummary[],
): ExecutionTabConfig[] {
  const attentionCount = countAttentionRuns(runs);
  const approvalCount = countApprovalWaitRuns(runs);
  const errorCount = countErrorRuns(runs);
  const replayableCount = countReplayableRuns(runs);

  return [
    {
      key: "runs",
      label: "Run review",
      badge: attentionCount > 0 ? `${attentionCount} need attention` : null,
      badgeTone: attentionCount > 0 ? "danger" : "success",
    },
    {
      key: "approvals",
      label: "Approval waits",
      badge: approvalCount > 0 ? `${approvalCount} waiting` : null,
      badgeTone: approvalCount > 0 ? "warning" : "neutral",
    },
    {
      key: "errors",
      label: "Errors & activity",
      badge: errorCount > 0 ? `${errorCount} with errors` : null,
      badgeTone: errorCount > 0 ? "danger" : "neutral",
    },
    {
      key: "health",
      label: "Provider health",
      badge: null,
      badgeTone: "neutral",
    },
  ];
}

/**
 * Build a compact status summary for the execution review header.
 */
export type ExecutionStatusSummaryData = {
  totalRuns: number;
  attentionCount: number;
  deadLetteredCount: number;
  approvalWaitCount: number;
  replayableCount: number;
  errorCount: number;
  primaryNextAction: string;
  primaryNextActionTone: BadgeTone;
};

/**
 * Build a status summary from a list of runs.
 */
export function buildExecutionStatusSummary(
  runs: ExecutionRunSummary[],
): ExecutionStatusSummaryData {
  const attentionCount = countAttentionRuns(runs);
  const deadLetteredCount = runs.filter(
    (r) => r.state === "dead_lettered" || r.operator_state === "quarantined",
  ).length;
  const approvalWaitCount = countApprovalWaitRuns(runs);
  const replayableCount = countReplayableRuns(runs);
  const errorCount = countErrorRuns(runs);

  let primaryNextAction = "No runs to review";
  let primaryNextActionTone: BadgeTone = "neutral";

  if (attentionCount > 0) {
    if (deadLetteredCount > 0) {
      primaryNextAction = "Review dead-lettered runs";
      primaryNextActionTone = "danger";
    } else if (approvalWaitCount > 0) {
      primaryNextAction = "Review approval waits";
      primaryNextActionTone = "warning";
    } else {
      primaryNextAction = `Review ${attentionCount} run${attentionCount > 1 ? "s" : ""} needing attention`;
      primaryNextActionTone = "warning";
    }
  } else if (runs.length > 0) {
    primaryNextAction = "All runs accounted for";
    primaryNextActionTone = "success";
  }

  return {
    totalRuns: runs.length,
    attentionCount,
    deadLetteredCount,
    approvalWaitCount,
    replayableCount,
    errorCount,
    primaryNextAction,
    primaryNextActionTone,
  };
}

/**
 * Build the "why replay" explanation for the confirmation flow.
 */
export function buildReplayConfirmation(
  run: ExecutionRunDetail,
  instanceId: string,
): string {
  return [
    `Re-run ${run.run_id} on lane ${run.execution_lane}.`,
    run.current_approval_id
      ? "Approval may be required before execution continues."
      : null,
    "This will create a new attempt on the same instance scope.",
    run.result_summary
      ? "The previous failure will be retried."
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function describeReplayError(error: unknown): string {
  if (error instanceof AdminApiError) {
    if (error.code === "run_transition_conflict") {
      return `${error.message} The selected run changed state before replay could be admitted.`;
    }
    if (error.code === "idempotency_fingerprint_mismatch") {
      return `${error.message} Reuse the same replay reason for that key or provide a new idempotency key.`;
    }
    if (error.code === "run_not_found") {
      return `${error.message} Verify that the selected run still exists inside the current instance scope.`;
    }
    if (error.code === "execution_operator_action_invalid") {
      return error.message;
    }
    return error.message;
  }

  return error instanceof Error ? error.message : "Replay failed.";
}
