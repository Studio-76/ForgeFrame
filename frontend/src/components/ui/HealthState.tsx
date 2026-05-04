import type { StatusTone } from "./types";
import { toneToTailwind } from "./types";

/**
 * A compact health indicator showing a name + status dot + value.
 *
 * Designed for readiness/health summary displays (e.g. in hero
 * sections, status strips, and dashboard headers).
 *
 * @example
 * ```tsx
 * <HealthState label="API" tone="success" value="3/3" />
 * <HealthState label="Database" tone="danger" value="1/3" />
 * ```
 */
export function HealthState({
  label,
  tone = "neutral",
  value,
  meta,
}: {
  label: string;
  tone?: StatusTone;
  value?: string;
  meta?: string;
}) {
  const classes = toneToTailwind(tone);

  return (
    <div className="ff-summary-card inline-flex flex-col gap-0.5">
      <span className="ff-summary-header flex items-center gap-1.5 text-meta text-muted font-medium uppercase tracking-wider">
        <span
          aria-hidden="true"
          className={`inline-block w-2 h-2 rounded-full ${classes.bg} shadow-[0_0_6px] ${tone === "success" ? "shadow-success/50" : tone === "danger" ? "shadow-danger/50" : tone === "warning" ? "shadow-warning/50" : "shadow-transparent"}`}
        />
        {label}
      </span>
      {value ? <strong className="text-title text-primary font-bold">{value}</strong> : null}
      {meta ? <span className="text-meta text-muted">{meta}</span> : null}
    </div>
  );
}
