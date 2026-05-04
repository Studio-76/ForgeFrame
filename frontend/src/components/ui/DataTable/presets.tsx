/**
 * Standard table column presets and page workflow helpers.
 *
 * Provides ready-to-use column configurations for common
 * ForgeFrame operational surfaces and a page workflow builder
 * that enforces the standard page structure:
 *   1. Page header (what + scope)
 *   2. Summary (state + severity + blocker)
 *   3. Next action
 *   4. Main content (table)
 *   5. Detail view
 *   6. Diagnostics (collapsed)
 *
 * @packageDocumentation
 */

import type { DataTableColumn } from "./types";

// ── Instance table columns ──────────────────────────────

export type InstanceTableRow = {
  instance_id: string;
  display_name: string;
  status: string;
  deployment_mode: string;
  exposure_mode: string;
  tenant_id: string;
  company_id: string;
  is_default: boolean;
  readiness_status?: string;
  readiness_summary?: string;
  operator_name?: string;
  operator_status?: string;
  operator_reason?: string;
  created_at?: string;
  updated_at?: string;
  readiness_tone?: "success" | "warning" | "danger" | "neutral";
};

/**
 * Standard column definition for instance inventory tables.
 */
export function instanceTableColumns(): DataTableColumn<InstanceTableRow>[] {
  return [
    {
      id: "name",
      header: "Instance",
      accessorFn: (row) => (
        <div>
          <div className="font-medium text-primary">{row.display_name}</div>
          {row.instance_id ? (
            <div className="text-muted text-xs font-mono mt-0.5">{row.instance_id}</div>
          ) : null}
        </div>
      ),
      sortingKey: (row) => row.display_name,
      alwaysVisible: true,
      className: "min-w-[180px]",
    },
    {
      id: "scope",
      header: "Scope",
      accessorFn: (row) => (
        <div>
          <div className="text-primary">{row.tenant_id}</div>
          {row.company_id ? <div className="text-muted text-xs">{row.company_id}</div> : null}
        </div>
      ),
      sortingKey: (row) => row.tenant_id,
      isTechnical: true,
    },
    {
      id: "mode",
      header: "Mode",
      accessorFn: (row) => (
        <div>
          <div className="text-primary text-sm">{row.deployment_mode}</div>
          <div className="text-muted text-xs">{row.exposure_mode}</div>
        </div>
      ),
      sortingKey: (row) => row.deployment_mode,
    },
    {
      id: "readiness",
      header: "Readiness",
      accessorFn: (row) => {
        const tone = row.readiness_tone ?? "neutral";
        const toneClasses: Record<string, string> = {
          success: "bg-success/15 text-success border-success/30",
          warning: "bg-warning/15 text-warning border-warning/30",
          danger: "bg-danger/15 text-danger border-danger/30",
          neutral: "bg-surface-subtle text-muted border-border",
        };
        return (
          <div>
            <span
              className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${toneClasses[tone] ?? toneClasses.neutral}`}
            >
              {row.readiness_status ?? "unknown"}
            </span>
            {row.readiness_summary ? (
              <div className="text-muted text-xs mt-0.5">{row.readiness_summary}</div>
            ) : null}
          </div>
        );
      },
      sortingKey: (row) => row.readiness_status ?? "",
    },
    {
      id: "operator",
      header: "Operator",
      accessorFn: (row) => (
        <div>
          {row.operator_name ? (
            <div className="text-primary text-sm">{row.operator_name}</div>
          ) : (
            <div className="text-danger text-sm font-medium">Missing Operator</div>
          )}
          <div className="text-muted text-xs">{row.operator_reason ?? "No detail"}</div>
        </div>
      ),
      sortingKey: (row) => row.operator_name ?? "",
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => {
        const isDisabled = row.status === "disabled";
        return (
          <span
            className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${
              isDisabled
                ? "bg-surface-subtle text-muted border-border"
                : "bg-success/15 text-success border-success/30"
            }`}
          >
            {row.status}
          </span>
        );
      },
      sortingKey: (row) => row.status,
    },
  ];
}

// ── Model table columns ─────────────────────────────────

export type ModelTableRow = {
  model_key: string;
  display_name: string;
  provider_label: string;
  provider: string;
  usability_state: string;
  usability_tone: "success" | "warning" | "danger" | "info" | "neutral";
  coverage_label: string;
  coverage_tone: "success" | "warning" | "danger" | "neutral";
  trust_status: string;
  trust_tone: "success" | "warning" | "danger" | "info";
  last_verified: string;
  next_action_label: string;
  next_action_tone: "success" | "warning" | "danger" | "neutral";
  is_placeholder: boolean;
  is_stale: boolean;
};

/**
 * Standard column definition for model register inventory tables.
 */
export function modelTableColumns(): DataTableColumn<ModelTableRow>[] {
  return [
    {
      id: "model",
      header: "Model",
      accessorFn: (row) => (
        <div className={row.is_placeholder || row.is_stale ? "opacity-60" : ""}>
          <div className="font-medium text-primary">{row.display_name}</div>
          <div className="text-muted text-xs mt-0.5">{row.provider_label}</div>
        </div>
      ),
      sortingKey: (row) => row.display_name,
      alwaysVisible: true,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => {
        const tones: Record<string, string> = {
          success: "bg-success/15 text-success border-success/30",
          warning: "bg-warning/15 text-warning border-warning/30",
          danger: "bg-danger/15 text-danger border-danger/30",
          info: "bg-info/15 text-info border-info/30",
          neutral: "bg-surface-subtle text-muted border-border",
        };
        return (
          <span
            className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${tones[row.usability_tone] ?? tones.neutral}`}
          >
            {row.usability_state}
          </span>
        );
      },
      sortingKey: (row) => row.usability_state,
    },
    {
      id: "routing",
      header: "Routing",
      accessorFn: (row) => {
        const tones: Record<string, string> = {
          success: "bg-success/15 text-success border-success/30",
          warning: "bg-warning/15 text-warning border-warning/30",
          danger: "bg-danger/15 text-danger border-danger/30",
          neutral: "bg-surface-subtle text-muted border-border",
        };
        return (
          <span
            className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${tones[row.coverage_tone] ?? tones.neutral}`}
          >
            {row.coverage_label}
          </span>
        );
      },
      sortingKey: (row) => row.coverage_label,
    },
    {
      id: "trust",
      header: "Trust",
      accessorFn: (row) => {
        const tones: Record<string, string> = {
          success: "bg-success/15 text-success border-success/30",
          warning: "bg-warning/15 text-warning border-warning/30",
          danger: "bg-danger/15 text-danger border-danger/30",
          info: "bg-info/15 text-info border-info/30",
        };
        return (
          <span
            className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${tones[row.trust_tone] ?? ""}`}
          >
            {row.trust_status}
          </span>
        );
      },
      sortingKey: (row) => row.trust_status,
    },
    {
      id: "last_verified",
      header: "Last verified",
      accessorFn: (row) => (
        <span className="text-muted text-xs">{row.last_verified}</span>
      ),
      sortingKey: (row) => row.last_verified,
      isTechnical: true,
    },
    {
      id: "next_action",
      header: "Next action",
      accessorFn: (row) => {
        const tones: Record<string, string> = {
          success: "text-success",
          warning: "text-warning",
          danger: "text-danger",
          neutral: "text-muted",
        };
        return (
          <span className={`text-xs font-medium ${tones[row.next_action_tone] ?? "text-muted"}`}>
            {row.next_action_label}
          </span>
        );
      },
      sortingKey: (row) => row.next_action_label,
    },
  ];
}

// ── Audit / Activity table columns ──────────────────────

export type AuditTableRow = {
  event_id: string;
  action_label: string;
  summary: string;
  actor_label: string;
  target_label: string;
  status_label: string;
  status_tone: "success" | "warning" | "danger" | "info" | "neutral";
  timestamp: string;
  timestamp_title: string;
  detail_available: boolean;
};

/**
 * Standard column definition for audit/activity history tables.
 */
export function auditTableColumns(): DataTableColumn<AuditTableRow>[] {
  return [
    {
      id: "action",
      header: "Action",
      accessorFn: (row) => (
        <div>
          <div className="font-medium text-primary">{row.action_label}</div>
          <div className="text-muted text-xs mt-0.5">{row.summary}</div>
        </div>
      ),
      sortingKey: (row) => row.action_label,
      alwaysVisible: true,
    },
    {
      id: "actor",
      header: "Actor",
      accessorFn: (row) => <span className="text-primary text-sm">{row.actor_label}</span>,
      sortingKey: (row) => row.actor_label,
    },
    {
      id: "target",
      header: "Target",
      accessorFn: (row) => <span className="text-muted text-sm">{row.target_label}</span>,
      sortingKey: (row) => row.target_label,
      isTechnical: true,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => {
        const tones: Record<string, string> = {
          success: "bg-success/15 text-success border-success/30",
          warning: "bg-warning/15 text-warning border-warning/30",
          danger: "bg-danger/15 text-danger border-danger/30",
          info: "bg-info/15 text-info border-info/30",
          neutral: "bg-surface-subtle text-muted border-border",
        };
        return (
          <span
            className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${tones[row.status_tone] ?? tones.neutral}`}
          >
            {row.status_label}
          </span>
        );
      },
      sortingKey: (row) => row.status_label,
    },
    {
      id: "timestamp",
      header: "Time",
      accessorFn: (row) => (
        <span className="text-muted text-xs" title={row.timestamp_title}>
          {row.timestamp}
        </span>
      ),
      sortingKey: (row) => row.timestamp,
    },
  ];
}
