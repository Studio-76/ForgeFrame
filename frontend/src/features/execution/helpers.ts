import {
  AdminApiError,
  type AdminSessionUser,
  type InstanceRecord,
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

export const DEFAULT_STATE_FILTER = "dead_lettered";

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
  { value: "executing", label: "Executing" },
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
