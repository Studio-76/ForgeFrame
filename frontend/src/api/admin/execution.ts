/**
 * Execution run management API functions and types.
 *
 * @packageDocumentation
 */

import {
  appendTenantScope,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Execution types
// ---------------------------------------------------------------------------

/** Execution run attempt view. */
export type ExecutionRunAttemptView = {
  id: string;
  attempt_no: number;
  attempt_state: string;
  operator_state: string;
  lease_status: string;
  worker_key?: string | null;
  retry_count: number;
  scheduled_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  backoff_until?: string | null;
  last_error_code?: string | null;
  last_error_detail?: string | null;
  version: number;
};

/** Execution run command view. */
export type ExecutionRunCommandView = {
  id: string;
  command_type: string;
  command_status: string;
  actor_type: string;
  actor_id: string;
  idempotency_key: string;
  accepted_transition?: string | null;
  response_snapshot?: Record<string, unknown> | null;
  issued_at: string;
  completed_at?: string | null;
};

/** ForgeFrame native object reference. */
export type ForgeFrameNativeObjectRef = {
  kind: string;
  object_id: string;
  relation: string;
  lifecycle_state?: string | null;
  label?: string | null;
  details: Record<string, unknown>;
};

/** ForgeFrame native event. */
export type ForgeFrameNativeEvent = {
  event_kind: string;
  related_object_kind?: string | null;
  related_object_id?: string | null;
  status?: string | null;
  details: Record<string, unknown>;
};

/** ForgeFrame native command. */
export type ForgeFrameNativeCommand = {
  command_kind: string;
  command_id?: string | null;
  status?: string | null;
  actor_type?: string | null;
  actor_id?: string | null;
  details: Record<string, unknown>;
};

/** ForgeFrame native view. */
export type ForgeFrameNativeView = {
  view_kind: string;
  available: boolean;
  label?: string | null;
  details: Record<string, unknown>;
};

/** Runtime native mapping. */
export type RuntimeNativeMapping = {
  object: "forgeframe.native_mapping";
  mapping_version: string;
  contract_surface: string;
  request_path: string;
  response_id?: string | null;
  processing_mode: string;
  stream: boolean;
  background: boolean;
  primary_native_object_kind?: string | null;
  objects: ForgeFrameNativeObjectRef[];
  events: ForgeFrameNativeEvent[];
  commands: ForgeFrameNativeCommand[];
  views: ForgeFrameNativeView[];
  route_context: Record<string, unknown>;
  notes: string[];
};

/** Execution run outbox view. */
export type ExecutionRunOutboxView = {
  id: string;
  event_type: string;
  publish_state: string;
  available_at: string;
  publish_attempts: number;
  published_at?: string | null;
  dead_lettered_at?: string | null;
  last_publish_error?: string | null;
  payload: Record<string, unknown>;
};

/** Execution run approval link view. */
export type ExecutionRunApprovalLinkView = {
  id: string;
  approval_id: string;
  gate_key: string;
  gate_status: string;
  resume_disposition: string;
  opened_at: string;
  decided_at?: string | null;
  resume_enqueued_at?: string | null;
  decision_actor_type?: string | null;
  decision_actor_id?: string | null;
  attempt_id: string;
  version: number;
};

/** Execution run summary. */
export type ExecutionRunSummary = {
  run_id: string;
  instance_id?: string | null;
  workspace_id?: string | null;
  run_kind: string;
  state: string;
  operator_state: string;
  execution_lane: string;
  issue_id?: string | null;
  active_attempt_no: number;
  failure_class?: string | null;
  status_reason?: string | null;
  current_attempt?: ExecutionRunAttemptView | null;
  next_wakeup_at?: string | null;
  terminal_at?: string | null;
  result_summary?: Record<string, unknown> | null;
  replayable: boolean;
  current_approval_id?: string | null;
  created_at: string;
  updated_at: string;
};

import type { WorkspaceSummary } from "./workspaces";
import type { ArtifactRecord } from "./artifacts";

/** Execution run detail. */
export type ExecutionRunDetail = ExecutionRunSummary & {
  attempts: ExecutionRunAttemptView[];
  commands: ExecutionRunCommandView[];
  outbox: ExecutionRunOutboxView[];
  approval_links: ExecutionRunApprovalLinkView[];
  workspace?: WorkspaceSummary | null;
  artifacts: ArtifactRecord[];
  native_mapping?: RuntimeNativeMapping | null;
};

/** Execution replay audit reference. */
export type ExecutionReplayAuditReference = {
  event_id: string;
  action: string;
  target_type: string;
  target_id?: string | null;
  status: string;
  instance_id?: string | null;
  tenant_id: string;
  company_id?: string | null;
};

/** Execution replay result. */
export type ExecutionReplayResult = {
  command_id: string;
  run_id: string;
  attempt_id?: string | null;
  run_state: string;
  operator_state?: string | null;
  execution_lane?: string | null;
  outbox_event?: string | null;
  deduplicated: boolean;
  replay_reason: string;
  audit?: ExecutionReplayAuditReference | null;
};

/** Execution operator action result. */
export type ExecutionOperatorActionResult = {
  command_id: string;
  run_id: string;
  attempt_id?: string | null;
  related_run_id?: string | null;
  run_state: string;
  operator_state?: string | null;
  execution_lane?: string | null;
  outbox_event?: string | null;
  reason: string;
};

/** Execution queue lane summary. */
export type ExecutionQueueLaneSummary = {
  execution_lane: string;
  display_name: string;
  total_runs: number;
  runnable_runs: number;
  running_runs: number;
  paused_runs: number;
  waiting_on_approval_runs: number;
  retry_scheduled_runs: number;
  quarantined_runs: number;
  oldest_scheduled_at?: string | null;
  longest_wait_seconds?: number | null;
};

/** Execution queue run view. */
export type ExecutionQueueRunView = {
  run_id: string;
  workspace_id?: string | null;
  run_kind: string;
  state: string;
  operator_state: string;
  execution_lane: string;
  issue_id?: string | null;
  attempt_id?: string | null;
  attempt_state?: string | null;
  lease_status?: string | null;
  selected_target_key?: string | null;
  current_approval_id?: string | null;
  wait_reason: string;
  next_allowed_action: string;
  wait_age_seconds?: number | null;
  scheduled_at?: string | null;
  next_wakeup_at?: string | null;
  status_reason?: string | null;
  updated_at: string;
};

/** Execution dispatch worker view. */
export type ExecutionDispatchWorkerView = {
  worker_key: string;
  worker_state: string;
  instance_id: string;
  execution_lane: string;
  active_attempts: number;
  leased_runs: string[];
  current_run_id?: string | null;
  current_attempt_id?: string | null;
  oldest_lease_expires_at?: string | null;
  heartbeat_expires_at?: string | null;
  last_heartbeat_at?: string | null;
  last_claimed_at?: string | null;
  last_completed_at?: string | null;
  last_error_code?: string | null;
  last_error_detail?: string | null;
};

/** Execution dispatch attempt view. */
export type ExecutionDispatchAttemptView = {
  run_id: string;
  attempt_id: string;
  run_kind: string;
  state: string;
  operator_state: string;
  execution_lane: string;
  workspace_id?: string | null;
  issue_id?: string | null;
  selected_target_key?: string | null;
  worker_key?: string | null;
  lease_status: string;
  lease_expires_at?: string | null;
  last_heartbeat_at?: string | null;
  next_wakeup_at?: string | null;
  status_reason?: string | null;
  updated_at: string;
};

/** Execution dispatch snapshot. */
export type ExecutionDispatchSnapshot = {
  outbox_counts: Record<string, number>;
  event_counts: Record<string, number>;
  leased_attempts: ExecutionDispatchAttemptView[];
  stalled_attempts: ExecutionDispatchAttemptView[];
  workers: ExecutionDispatchWorkerView[];
  quarantined_runs: number;
  paused_runs: number;
  waiting_on_approval_runs: number;
};

/** Execution lease reconcile result. */
export type ExecutionLeaseReconcileResult = {
  run_id: string;
  attempt_id: string;
  reconciled_to_state: string;
  dead_letter_reason: string;
};

// ---------------------------------------------------------------------------
// Execution API functions
// ---------------------------------------------------------------------------

/**
 * Fetch execution runs with optional filters.
 * @param options - Filter options.
 * @returns Response with execution runs.
 */
export function fetchExecutionRuns(options: {
  instanceId?: string | null;
  companyId?: string | null;
  state?: string;
  executionLane?: string | null;
  target?: string | null;
  approvalWait?: boolean;
  hasError?: boolean;
  window?: string | null;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (options.instanceId?.trim()) {
    params.set("instanceId", options.instanceId.trim());
  }
  if (options.companyId?.trim()) {
    params.set("companyId", options.companyId.trim());
  }
  if (options.state && options.state !== "all") {
    params.set("state", options.state);
  }
  if (options.executionLane?.trim()) {
    params.set("execution_lane", options.executionLane.trim());
  }
  if (options.target?.trim()) {
    params.set("target", options.target.trim());
  }
  if (options.approvalWait) {
    params.set("approval_wait", "true");
  }
  if (options.hasError) {
    params.set("has_error", "true");
  }
  if (options.window?.trim() && options.window.trim() !== "all") {
    params.set("window", options.window.trim());
  }
  if (options.limit) {
    params.set("limit", String(options.limit));
  }
  return fetchJson<{ status: string; runs: ExecutionRunSummary[] }>(`/admin/execution/runs?${params.toString()}`);
}

/**
 * Fetch execution queues with optional filters.
 * @param options - Filter options.
 * @returns Response with queue lanes and views.
 */
export function fetchExecutionQueues(options: {
  instanceId?: string | null;
  companyId?: string | null;
  executionLane?: string | null;
  state?: string | null;
  target?: string | null;
  age?: string | null;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (options.instanceId?.trim()) {
    params.set("instanceId", options.instanceId.trim());
  }
  if (options.companyId?.trim()) {
    params.set("companyId", options.companyId.trim());
  }
  if (options.executionLane?.trim()) {
    params.set("execution_lane", options.executionLane.trim());
  }
  if (options.state?.trim() && options.state.trim() !== "all") {
    params.set("state", options.state.trim());
  }
  if (options.target?.trim()) {
    params.set("target", options.target.trim());
  }
  if (options.age?.trim() && options.age.trim() !== "all") {
    params.set("age", options.age.trim());
  }
  if (options.limit) {
    params.set("limit", String(options.limit));
  }
  return fetchJson<{ status: string; lanes: ExecutionQueueLaneSummary[]; runs: ExecutionQueueRunView[] }>(`/admin/execution/queues?${params.toString()}`);
}

/**
 * Fetch execution dispatch snapshot.
 * @param options - Filter options.
 * @returns Response with dispatch snapshot.
 */
export function fetchExecutionDispatch(options: { instanceId?: string | null; companyId?: string | null }) {
  const params = new URLSearchParams();
  if (options.instanceId?.trim()) {
    params.set("instanceId", options.instanceId.trim());
  }
  if (options.companyId?.trim()) {
    params.set("companyId", options.companyId.trim());
  }
  return fetchJson<{ status: string; dispatch: ExecutionDispatchSnapshot }>(`/admin/execution/dispatch?${params.toString()}`);
}

/**
 * Fetch execution run detail by ID.
 * @param runId - The run ID.
 * @param options - Scope options.
 * @returns Response with run detail.
 */
export function fetchExecutionRunDetail(runId: string, options: { instanceId?: string | null; companyId?: string | null }) {
  const params = new URLSearchParams();
  if (options.instanceId?.trim()) {
    params.set("instanceId", options.instanceId.trim());
  }
  if (options.companyId?.trim()) {
    params.set("companyId", options.companyId.trim());
  }
  return fetchJson<{ status: string; run: ExecutionRunDetail }>(`/admin/execution/runs/${encodeURIComponent(runId)}?${params.toString()}`);
}

/**
 * Internal helper to post an execution operator action.
 * @param runId - The run ID.
 * @param action - The action type.
 * @param payload - Action payload.
 * @returns Response with action result.
 */
function postExecutionOperatorAction(
  runId: string,
  action: "pause" | "resume" | "interrupt" | "quarantine" | "restart" | "escalate",
  payload: { instanceId?: string | null; companyId?: string | null; reason: string; executionLane?: string | null; idempotencyKey?: string },
) {
  const params = new URLSearchParams();
  if (payload.instanceId?.trim()) {
    params.set("instanceId", payload.instanceId.trim());
  }
  if (payload.companyId?.trim()) {
    params.set("companyId", payload.companyId.trim());
  }
  return fetchJson<{ status: string; action: ExecutionOperatorActionResult }>(`/admin/execution/runs/${encodeURIComponent(runId)}/${action}?${params.toString()}`, {
    method: "POST",
    body: JSON.stringify({
      reason: payload.reason,
      execution_lane: payload.executionLane?.trim() ? payload.executionLane.trim() : null,
      idempotency_key: payload.idempotencyKey?.trim() ? payload.idempotencyKey.trim() : null,
    }),
  });
}

/**
 * Pause an execution run.
 * @param runId - The run ID.
 * @param payload - Action payload.
 * @returns Response with action result.
 */
export function pauseExecutionRun(runId: string, payload: { instanceId?: string | null; companyId?: string | null; reason: string; idempotencyKey?: string }) {
  return postExecutionOperatorAction(runId, "pause", payload);
}

/**
 * Resume an execution run.
 * @param runId - The run ID.
 * @param payload - Action payload.
 * @returns Response with action result.
 */
export function resumeExecutionRun(runId: string, payload: { instanceId?: string | null; companyId?: string | null; reason: string; idempotencyKey?: string }) {
  return postExecutionOperatorAction(runId, "resume", payload);
}

/**
 * Interrupt an execution run.
 * @param runId - The run ID.
 * @param payload - Action payload.
 * @returns Response with action result.
 */
export function interruptExecutionRun(runId: string, payload: { instanceId?: string | null; companyId?: string | null; reason: string; idempotencyKey?: string }) {
  return postExecutionOperatorAction(runId, "interrupt", payload);
}

/**
 * Quarantine an execution run.
 * @param runId - The run ID.
 * @param payload - Action payload.
 * @returns Response with action result.
 */
export function quarantineExecutionRun(runId: string, payload: { instanceId?: string | null; companyId?: string | null; reason: string; idempotencyKey?: string }) {
  return postExecutionOperatorAction(runId, "quarantine", payload);
}

/**
 * Restart an execution run.
 * @param runId - The run ID.
 * @param payload - Action payload.
 * @returns Response with action result.
 */
export function restartExecutionRun(runId: string, payload: { instanceId?: string | null; companyId?: string | null; reason: string; executionLane?: string | null; idempotencyKey?: string }) {
  return postExecutionOperatorAction(runId, "restart", payload);
}

/**
 * Escalate an execution run.
 * @param runId - The run ID.
 * @param payload - Action payload (requires executionLane).
 * @returns Response with action result.
 */
export function escalateExecutionRun(runId: string, payload: { instanceId?: string | null; companyId?: string | null; reason: string; executionLane: string; idempotencyKey?: string }) {
  return postExecutionOperatorAction(runId, "escalate", payload);
}

/**
 * Reconcile execution leases.
 * @param options - Scope options.
 * @returns Response with reconciled leases.
 */
export function reconcileExecutionLeases(options: { instanceId?: string | null; companyId?: string | null }) {
  const params = new URLSearchParams();
  if (options.instanceId?.trim()) {
    params.set("instanceId", options.instanceId.trim());
  }
  if (options.companyId?.trim()) {
    params.set("companyId", options.companyId.trim());
  }
  return fetchJson<{ status: string; reconciled: ExecutionLeaseReconcileResult[] }>(`/admin/execution/dispatch/reconcile-leases?${params.toString()}`, {
    method: "POST",
    body: "{}",
  });
}

/**
 * Replay an execution run.
 * @param runId - The run ID.
 * @param payload - Replay parameters.
 * @returns Response with replay result.
 */
export function replayExecutionRun(runId: string, payload: { instanceId?: string | null; companyId?: string | null; reason: string; idempotencyKey?: string }) {
  const params = new URLSearchParams();
  if (payload.instanceId?.trim()) {
    params.set("instanceId", payload.instanceId.trim());
  }
  if (payload.companyId?.trim()) {
    params.set("companyId", payload.companyId.trim());
  }
  return fetchJson<{ status: string; replay: ExecutionReplayResult }>(`/admin/execution/runs/${encodeURIComponent(runId)}/replay?${params.toString()}`, {
    method: "POST",
    body: JSON.stringify({
      reason: payload.reason,
      idempotency_key: payload.idempotencyKey?.trim() ? payload.idempotencyKey.trim() : null,
    }),
  });
}

/**
 * Fetch client operational view.
 * @param window - Time window (default "24h").
 * @param instanceId - Optional instance ID.
 * @returns Response with client operational data.
 */
export function fetchClientOperationalView(
  window: "1h" | "24h" | "7d" | "all" = "24h",
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; window: string; clients: Array<Record<string, string | number | boolean>> }>(
    appendTenantScope(`/admin/usage/clients?window=${window}`, undefined, instanceId),
  );
}
