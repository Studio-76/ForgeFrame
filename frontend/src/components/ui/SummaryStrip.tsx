import type { ReactNode } from "react";

import { StatusBadge, type StatusTone } from "./StatusBadge";

export type SummaryStripItem = {
  key: string;
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  tone?: StatusTone;
  status?: string | null;
};

type SummaryStripProps = {
  items: SummaryStripItem[];
};

export function SummaryStrip({ items }: SummaryStripProps) {
  return (
    <section className="ff-summary-strip" aria-label="Summary metrics">
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
