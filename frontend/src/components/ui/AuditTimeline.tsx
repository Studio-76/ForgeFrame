import type { ReactNode } from "react";

/**
 * A single audit event entry.
 */
export type AuditEvent = {
  id: string;
  timestamp: string;
  label: string;
  description?: string;
  /** Optional actor who performed the action. */
  actor?: string;
  /** Optional status tone for the event dot. */
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
  /** Optional action rendered inline. */
  action?: ReactNode;
};

/**
 * A vertical timeline of audit or activity events.
 *
 * Use for audit history, change logs, and event sequences where
 * chronological ordering matters.
 *
 * @example
 * ```tsx
 * <AuditTimeline
 *   events={[
 *     { id: "1", timestamp: "2024-01-15 14:30", label: "Provider created", actor: "admin", tone: "info" },
 *     { id: "2", timestamp: "2024-01-15 14:35", label: "Key rotated", actor: "admin", tone: "success" },
 *   ]}
 * />
 * ```
 */
export function AuditTimeline({
  events,
  title,
}: {
  events: AuditEvent[];
  title?: ReactNode;
}) {
  if (events.length === 0) {
    return null;
  }

  const dotColor: Record<string, string> = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
    neutral: "bg-border",
  };

  return (
    <div className="flex flex-col gap-3">
      {title ? (
        typeof title === "string" ? (
          <strong className="text-body text-primary font-semibold">{title}</strong>
        ) : (
          title
        )
      ) : null}
      <div className="relative pl-5">
        {/* Vertical connector line */}
        <div
          className="absolute left-[7px] top-2 bottom-2 w-px bg-border"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-4">
          {events.map((event) => (
            <div key={event.id} className="relative flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`absolute -left-[17px] top-1.5 w-[14px] h-[14px] rounded-full border-2 border-surface ${dotColor[event.tone ?? "neutral"]}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-body text-primary font-medium">{event.label}</span>
                  <span className="text-meta text-muted whitespace-nowrap">
                    {event.timestamp}
                  </span>
                </div>
                {event.description ? (
                  <p className="text-meta text-muted mt-0.5">{event.description}</p>
                ) : null}
                {event.actor ? (
                  <span className="text-meta text-muted mt-0.5 inline-block">
                    by {event.actor}
                  </span>
                ) : null}
              </div>
              {event.action ? <div className="flex-shrink-0">{event.action}</div> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
