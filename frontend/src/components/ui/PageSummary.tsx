import type { ReactNode } from "react";

/**
 * A hero section for page-level summary metrics and status.
 *
 * Renders a compact stat strip with optional status pills.
 * Use below PageHeader for operational overview context.
 *
 * @example
 * ```tsx
 * <PageSummary
 *   items={[
 *     { label: "Total", value: "12" },
 *     { label: "Active", value: "8", tone: "success" },
 *     { label: "Degraded", value: "2", tone: "warning" },
 *     { label: "Down", value: "0", tone: "neutral" },
 *   ]}
 * />
 * ```
 */
export function PageSummary({
  items,
}: {
  items: Array<{
    key?: string;
    label: ReactNode;
    value: ReactNode;
    tone?: "success" | "warning" | "danger" | "info" | "neutral";
    meta?: ReactNode;
  }>;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className="ff-summary-strip mt-4"
      aria-label="Page summary"
    >
      {items.map((item, index) => {
        const key = item.key ?? `${index}`;
        const toneClass = item.tone
          ? item.tone === "success"
            ? "border-l-success"
            : item.tone === "warning"
              ? "border-l-warning"
              : item.tone === "danger"
                ? "border-l-danger"
                : item.tone === "info"
                  ? "border-l-info"
                  : "border-l-border"
          : "border-l-border";

        return (
          <article
            key={key}
            className={`ff-summary-card border-l-2 ${toneClass}`}
          >
            <span className="ff-summary-label text-meta text-muted font-medium">
              {item.label}
            </span>
            <strong className="ff-summary-value text-kpi text-primary font-bold">
              {item.value}
            </strong>
            {item.meta ? (
              <span className="ff-summary-meta text-meta text-muted">
                {item.meta}
              </span>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
