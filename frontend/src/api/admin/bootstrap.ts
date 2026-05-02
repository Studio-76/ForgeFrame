/**
 * Bootstrap API functions.
 *
 * @packageDocumentation
 */

import {
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Bootstrap API functions
// ---------------------------------------------------------------------------

/**
 * Fetch bootstrap readiness status.
 * @returns Response with readiness checks and next steps.
 */
export function fetchBootstrapReadiness() {
  return fetchJson<{ status: string; ready: boolean; checks: Array<Record<string, unknown>>; next_steps: string[]; checked_at?: string }>("/admin/providers/bootstrap/readiness");
}
