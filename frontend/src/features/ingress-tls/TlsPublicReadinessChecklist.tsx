import { Link } from "react-router-dom";

import { StatusBadge } from "../../components/ui/StatusBadge";
import type { RemediationItem } from "./types";

/**
 * Public HTTPS readiness checklist for local-only instances.
 *
 * Shows configuration requirements framed as preparatory steps
 * rather than active blockers. Items are informational/neutral
 * and describe what would be needed to promote to public HTTPS.
 */
export function TlsPublicReadinessChecklist({ items }: { items: RemediationItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="ff-table-card" aria-label="Public HTTPS readiness checklist">
      <div className="ff-table-card-header">
        <div>
          <h3>Public HTTPS readiness</h3>
          <p>Required only if this instance should accept public HTTPS traffic.</p>
        </div>
      </div>
      <div className="ff-table-scroll">
        <table className="ff-data-table" aria-label="Public readiness requirements">
          <thead>
            <tr>
              <th>Status</th>
              <th>Requirement</th>
              <th>Why it matters</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.key}>
                <td className="ff-itt-status-cell">
                  <StatusBadge tone={item.tone} status={item.status}>
                    {item.status === "completed" ? "Ready" : "Required"}
                  </StatusBadge>
                </td>
                <td>
                  <div className="ff-itt-check-label">{item.label}</div>
                  <div className="fg-muted ff-itt-check-detail">{item.detail}</div>
                </td>
                <td className="ff-itt-why-cell">
                  <span className="fg-muted">{item.why}</span>
                </td>
                <td className="ff-itt-action-cell">
                  {item.status === "completed" ? (
                    <span className="fg-muted">Ready</span>
                  ) : (
                    <Link className="fg-nav-link ff-itt-action-link" to={item.actionTo}>
                      {item.actionLabel}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
