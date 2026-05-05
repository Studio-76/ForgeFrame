/**
 * Shared types for the Errors & Incident Review feature.
 *
 * @packageDocumentation
 */

import type { LogsResponse } from "../../api/domain/logs";

/**
 * Standard async load state for the errors page.
 */
export type LoadState = "idle" | "loading" | "success" | "error";

/**
 * Incident review payload sourced from the logs API or fallback construction.
 */
export type IncidentReview = NonNullable<LogsResponse["incident_review"]>;

/**
 * A single incident axis row — represents one system axis grouped by
 * severity, incident count, effect, next step, and evidence.
 */
export type IncidentAxisRow = IncidentReview["axes"][number];

/**
 * A blocked routing failure row — represents one decision that could not
 * be routed and was blocked by policy, budget, circuit, or capability posture.
 */
export type BlockedRoutingFailureRow = IncidentReview["blocked_routing_failures"][number];

/**
 * Describes which item the operator has selected in the detail panel.
 * - `"axis"` — a grouped incident axis
 * - `"routing"` — a blocked routing failure
 */
export type DetailSelection =
  | { kind: "axis"; id: string }
  | { kind: "routing"; id: string };

/**
 * Canonical order for incident axes in the fallback review.
 * Mirrors the backend-defined axis union order.
 */
export const AXIS_ORDER: IncidentAxisRow["axis"][] = [
  "runtime",
  "provider",
  "oauth",
  "routing",
  "queue_dispatch",
  "security",
  "tls",
  "work_interaction",
];
