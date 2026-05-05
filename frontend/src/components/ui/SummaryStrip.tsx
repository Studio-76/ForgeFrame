import type { ReactNode } from "react";

import { StatusBadge, type StatusTone } from "./StatusBadge";
import type { UxMetadata } from "./types";
import { uxAttributes } from "./types";

export type SummaryStripItem = {
  key: string;
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  tone?: StatusTone;
  status?: string | null;
};

export type SummaryStripProps = {
  items: SummaryStripItem[];
  /** Optional UX metadata for review tooling. */
  ux?: UxMetadata;
};

export function SummaryStrip({ items, ux }: SummaryStripProps) {
  return (
    <section className="ff-summary-strip mb-2" aria-label="Summary metrics" {...(ux ? uxAttributes(ux) : {})}>
      {items.map((item) => (
        <article key={item.key} className="ff-summary-card">
          <div className="ff-summary-card-header">
            <span className="ff-summary-label">{item.label}</span>
            {(item.tone || item.status) ? (
              <StatusBadge tone={item.tone} status={item.status}>
                {item.status ?? item.tone}
              </StatusBadge>
            ) : null}
          </div>
          <strong className="ff-summary-value">{item.value}</strong>
          {item.meta ? <p className="ff-summary-meta">{item.meta}</p> : null}
        </article>
      ))}
    </section>
  );
}
