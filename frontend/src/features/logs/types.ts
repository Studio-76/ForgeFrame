/**
 * Types for the Logs feature module (Incidents, Logs, Activity, Audit History).
 *
 * @packageDocumentation
 */

import type {
  AuditExportFormat,
  AuditExportWindow,
  AuditHistoryResponse,
  AuditHistoryRow,
  AuditHistoryStatus,
  AuditHistoryWindow,
  LogsResponse,
} from "../../api/domain";

/** Active log tab. */
export type LogTab = "incidents" | "logs" | "activity" | "audit" | "diagnostics";

/** Summary counts derived from logs + audit data. */
export interface LogsSummaryCounts {
  /** Number of critical / blocked error axes. */
  activeErrors: number;
  /** Number of open incidents (warning or higher). */
  openIncidents: number;
  /** Number of recent warning-level events. */
  recentWarnings: number;
  /** Number of audit events in current window. */
  auditEventCount: number;
  /** Timestamp of the last critical event. */
  lastCriticalEvent: string | null;
  /** Prescribed next action string. */
  nextAction: string;
  /** Human-readable top affected subsystem. */
  topSubsystem: string;
  /** Current impact of the top issue. */
  impact: string;
  /** Primary remediation action label. */
  primaryActionLabel: string;
  /** Primary remediation action href. */
  primaryActionHref: string | null;
}

/** Filter preset identifier. */
export type FilterPreset =
  | "needsAttention"
  | "errorsOnly"
  | "warnings"
  | "adminMutations"
  | "runtimeEvents"
  | "last24h"
  | "last7d";

/** A single summary card entry for the hero section. */
export interface SummaryCardEntry {
  /** Unique key for the card. */
  key: string;
  /** Short label. */
  label: string;
  /** Numeric or short string value. */
  value: string;
  /** Extended description / detail. */
  meta: string;
  /** Status tone. */
  tone: "success" | "warning" | "danger" | "neutral" | "info";
}

/** LoadState reused across the module. */
export type LoadState = "idle" | "loading" | "success" | "error";

/** Props shared by tab panels. */
export interface TabPanelProps {
  /** Selected instance ID. */
  instanceId: string | null;
  /** Company ID for scoping. */
  companyId: string | null;
  /** Whether the session can read audit. */
  canReadAudit: boolean;
}

export type {
  AuditHistoryResponse,
  AuditHistoryRow,
  AuditHistoryStatus,
  AuditHistoryWindow,
  AuditExportFormat,
  AuditExportWindow,
  LogsResponse,
};
