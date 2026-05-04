import type { ReactNode } from "react";

import type { Severity } from "./types";
import { SeverityIndicator } from "./SeverityIndicator";

/**
 * A single diagnostic finding.
 */
export type DiagnosticFinding = {
  id: string;
  label: string;
  severity: Severity;
  description?: string;
  action?: ReactNode;
};

type DiagnosticsSummaryProps = {
  findings: DiagnosticFinding[];
  title?: ReactNode;
  /** Show only findings at or above this severity. */
  minSeverity?: Severity;
};

/**
 * A compact summary of diagnostic findings with severity indicators.
 *
 * Sorts findings by severity (critical first) and allows filtering
 * by minimum severity. Use for health checks, status pages, and
 * system diagnostics where a quick scan of issues is needed.
 *
 * @example
 * ```tsx
 * <DiagnosticsSummary
 *   title="System Diagnostics"
 *   findings={[
 *     { id: "1", label: "Database reachable", severity: "info" },
 *     { id: "2", label: "Disk space low", severity: "high", description: "15% remaining" },
 *   ]}
 * />
 * ```
 */
export function DiagnosticsSummary({
  findings,
  title,
  minSeverity = "info",
}: DiagnosticsSummaryProps) {
  const severityOrder: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  const minOrder = severityOrder[minSeverity];

  const filtered = findings
    .filter((f) => severityOrder[f.severity] >= minOrder)
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  if (filtered.length === 0) {
    return null;
  }

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
        {filtered.map((finding) => {
          const findingAction = finding.action;

          return (
            <div
              key={finding.id}
              className="flex items-start gap-3 p-2.5 rounded-md border border-border"
            >
              <SeverityIndicator severity={finding.severity} />
              <div className="flex-1 min-w-0">
                <span className="text-body text-primary font-medium">{finding.label}</span>
                {finding.description ? (
                  <p className="text-meta text-muted mt-0.5">{finding.description}</p>
                ) : null}
              </div>
              {findingAction ? <div className="flex-shrink-0">{findingAction}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
