/**
 * Runtime health API function and types.
 *
 * @packageDocumentation
 */

import {
  AdminApiError,
} from "./_internal";

// ---------------------------------------------------------------------------
// Health types
// ---------------------------------------------------------------------------

/** Runtime health response. */
export type RuntimeHealthResponse = {
  status: string;
  app: string;
  version: string;
  api_base: string;
  readiness: {
    state: string;
    accepting_traffic: boolean;
    checked_at?: string;
    checks: Array<{
      id: string;
      ok: boolean;
      severity: string;
    }>;
    warning_count: number;
    critical_count: number;
  };
};

// ---------------------------------------------------------------------------
// Health API function
// ---------------------------------------------------------------------------

/**
 * Fetch the runtime health status.
 * @returns Runtime health response.
 * @throws {AdminApiError} If the health endpoint returns an error.
 */
export async function fetchRuntimeHealth(): Promise<RuntimeHealthResponse> {
  const response = await fetch("/health", {
    headers: {
      "Content-Type": "application/json",
    },
  });

  let payload: RuntimeHealthResponse | null = null;
  try {
    payload = (await response.json()) as RuntimeHealthResponse;
  } catch {
    payload = null;
  }

  if (payload && (response.ok || response.status === 503)) {
    return payload;
  }

  if (payload) {
    throw new AdminApiError(
      typeof payload.status === "string"
        ? `Runtime health request failed with status '${payload.status}'.`
        : `Failed to load /health (${response.status}).`,
      response.status,
    );
  }

  throw new AdminApiError(`Failed to load /health (${response.status}).`, response.status);
}
