import { CONTROL_PLANE_ROUTES } from "./navigation";

export const EXECUTION_INSTANCE_QUERY_PARAM = "instanceId";
export const EXECUTION_COMPANY_QUERY_PARAM = "companyId";
export const EXECUTION_STATE_QUERY_PARAM = "state";
export const EXECUTION_RUN_QUERY_PARAM = "runId";

const EXECUTION_STATE_ALIASES: Record<string, string> = {
  waiting_approval: "waiting_on_approval",
};

const EXECUTION_STATE_VALUES = new Set([
  "all",
  "dead_lettered",
  "quarantined",
  "waiting_on_approval",
  "retry_backoff",
  "retry_scheduled",
  "failed",
  "paused",
  "cancel_requested",
  "queued",
  "executing",
]);

function normalizeExecutionParam(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeExecutionCompanyId(value: string | null | undefined): string | null {
  return normalizeExecutionParam(value);
}

export function normalizeExecutionInstanceId(value: string | null | undefined): string | null {
  return normalizeExecutionParam(value);
}

export function normalizeExecutionRunId(value: string | null | undefined): string | null {
  return normalizeExecutionParam(value);
}

export function normalizeExecutionState(value: string | null | undefined): string | null {
  const normalized = normalizeExecutionParam(value);
  if (!normalized) {
    return null;
  }
  const canonical = EXECUTION_STATE_ALIASES[normalized] ?? normalized;
  return EXECUTION_STATE_VALUES.has(canonical) ? canonical : null;
}

export function buildExecutionReviewPath(options: {
  instanceId?: string | null;
  companyId?: string | null;
  state?: string | null;
  runId?: string | null;
}): string {
  const url = new URL(CONTROL_PLANE_ROUTES.execution, "https://forgeframe.local");
  const instanceId = normalizeExecutionInstanceId(options.instanceId);
  const companyId = normalizeExecutionCompanyId(options.companyId);
  const state = normalizeExecutionState(options.state);
  const runId = normalizeExecutionRunId(options.runId);

  if (!instanceId && !companyId) {
    return CONTROL_PLANE_ROUTES.execution;
  }

  if (instanceId) {
    url.searchParams.set(EXECUTION_INSTANCE_QUERY_PARAM, instanceId);
  }
  if (companyId) {
    url.searchParams.set(EXECUTION_COMPANY_QUERY_PARAM, companyId);
  }
  if (state) {
    url.searchParams.set(EXECUTION_STATE_QUERY_PARAM, state);
  }
  if (runId) {
    url.searchParams.set(EXECUTION_RUN_QUERY_PARAM, runId);
  }

  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}
