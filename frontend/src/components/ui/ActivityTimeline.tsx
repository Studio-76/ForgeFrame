/**
 * Re-export of AuditTimeline for activity/recent events.
 *
 * Semantically distinct name for recent activity feeds that shows
 * what happened recently on a resource, as opposed to formal audit
 * history which is an immutable record.
 *
 * @example
 * ```tsx
 * <ActivityTimeline
 *   title="Recent activity"
 *   events={[
 *     { id: "1", timestamp: "2m ago", label: "Execution completed", tone: "success" },
 *     { id: "2", timestamp: "5m ago", label: "Execution started", tone: "info" },
 *   ]}
 * />
 * ```
 */
export { AuditTimeline as ActivityTimeline } from "./AuditTimeline";
