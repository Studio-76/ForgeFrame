import type { ReactNode } from "react";

import { SeverityIndicator } from "./SeverityIndicator";
import type { Severity } from "./types";

/**
 * A single incident entry in an incident list.
 */
export type Incident = {
  id: string;
  title: string;
  severity: Severity;
  timestamp: string;
  status: "active" | "acknowledged" | "resolved";
  description?: string;
  action?: ReactNode;
};

type IncidentListProps = {
  incidents: Incident[];
  title?: ReactNode;
};

/**
 * A compact incident list for monitoring surfaces.
 *
 * Shows severity, title, timestamp, and status for each incident.
 * Use in health dashboards, error panels, and system status views.
 *
 * @example
 * ```tsx
 * <IncidentList
 *   title="Active Incidents"
 *   incidents={[
 *     { id: "1", title: "API rate limit exceeded", severity: "high", timestamp: "2m ago", status: "active" },
 *   ]}
 * />
 * ```
 */
export function IncidentList({ incidents, title }: IncidentListProps) {
  if (incidents.length === 0) {
    return null;
  }

  const statusColors: Record<string, string> = {
    active: "bg-danger",
    acknowledged: "bg-warning",
    resolved: "bg-success",
  };

  return (
    <div className="flex flex-col gap-2">
      {title ? (
        typeof title === "string" ? (
          <strong className="text-body text-primary font-semibold">{title}</strong>
        ) : (
          title
        )
      ) : null}
      <div className="flex flex-col gap-1">
        {incidents.map((incident) => (
          <div
            key={incident.id}
            className="flex items-start gap-3 p-2.5 rounded-md border border-border hover:border-border/80 transition-colors duration-75"
          >
            <SeverityIndicator severity={incident.severity} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-body text-primary font-medium truncate">
                  {incident.title}
                </span>
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColors[incident.status] ?? "bg-muted"}`}
                  aria-label={incident.status}
                />
              </div>
              {incident.description ? (
                <p className="text-meta text-muted mt-0.5 truncate">{incident.description}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-meta text-muted whitespace-nowrap">{incident.timestamp}</span>
              {incident.action ? <div>{incident.action}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
