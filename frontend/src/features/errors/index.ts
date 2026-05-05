/**
 * Errors & Incident Review feature module.
 *
 * Provides types, helpers, and components for the incident-triage surface:
 * grouped failure axes, blocked routing failures, current effect, next
 * action, and evidence handoff into specialist routes.
 *
 * @packageDocumentation
 */

// ── Types ───────────────────────────────────────────────────────────────

export type {
  LoadState,
  IncidentReview,
  IncidentAxisRow,
  BlockedRoutingFailureRow,
  DetailSelection,
} from "./types";
export { AXIS_ORDER } from "./types";

// ── Helpers ─────────────────────────────────────────────────────────────

export {
  stringifyValue,
  formatMetric,
  formatTimestamp,
  severityTone,
  severityStatusKey,
  severityRank,
  fallbackIncidentReview,
  routeLinkItems,
  isActiveIncidentAxis,
} from "./helpers";

// ── Components ──────────────────────────────────────────────────────────

export { IncidentDetailContent } from "./components/IncidentDetailContent";
export type {
  IncidentDetailContentProps,
  ResolvedRouteLink,
} from "./components/IncidentDetailContent";
