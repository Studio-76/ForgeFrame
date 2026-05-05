import type { Severity, StatusTone } from "./types";

/**
 * Maps a severity level to a display tone.
 */
function severityTone(severity: Severity): StatusTone {
  switch (severity) {
    case "critical":
      return "danger";
    case "high":
      return "danger";
    case "medium":
      return "warning";
    case "low":
      return "info";
    case "info":
      return "neutral";
  }
}

/**
 * Maps a severity level to an icon character.
 */
function severityIcon(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "⚡";
    case "high":
      return "▲";
    case "medium":
      return "●";
    case "low":
      return "▼";
    case "info":
      return "○";
  }
}

/**
 * A severity indicator with icon and label.
 *
 * Used in incident lists, diagnostics, audit timelines, and
 * any surface requiring attention-level communication.
 *
 * @example
 * ```tsx
 * <SeverityIndicator severity="critical" />
 * <SeverityIndicator severity="low" showLabel />
 * ```
 */
export function SeverityIndicator({
  severity,
  showLabel = false,
}: {
  severity: Severity;
  /** Also render the severity level name. */
  showLabel?: boolean;
}) {
  const tone = severityTone(severity);
  const toneClasses: Record<StatusTone, string> = {
    danger: "text-danger",
    warning: "text-warning",
    info: "text-info",
    success: "text-success",
    neutral: "text-muted",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-xs font-semibold ${toneClasses[tone]}`}
      aria-label={`Severity: ${severity}`}
    >
      <span aria-hidden="true">{severityIcon(severity)}</span>
      {showLabel ? (
        <span className="capitalize text-meta text-muted">{severity}</span>
      ) : null}
    </span>
  );
}
