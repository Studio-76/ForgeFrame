/**
 * Dispatch feature module — worker lease monitoring, outbox pressure analysis,
 * and lease reconciliation.
 *
 * Provides extracted components and helpers for the Dispatch incident-response
 * surface: worker lease tables, attempt tables, timestamp formatting, lease
 * risk analysis, and route building.
 *
 * @packageDocumentation
 */

export { DispatchWorkerTable } from "./components/DispatchWorkerTable";
export type { DispatchWorkerTableProps } from "./components/DispatchWorkerTable";

export { DispatchAttemptTable } from "./components/DispatchAttemptTable";
export type { DispatchAttemptTableProps } from "./components/DispatchAttemptTable";

export type { DispatchRisk, DispatchRiskTone } from "./types";

export {
  parseUtcTimestamp,
  formatTimestamp,
  formatAgeSeconds,
  formatLeaseWindow,
  describeDispatchTarget,
  describeAttemptLeaseRisk,
  describeWorkerLeaseRisk,
  describeOutboxCause,
  buildScopedRoute,
  summarizeReconcileResults,
} from "./helpers";
