import { Link } from "react-router-dom";

import { StatusBadge } from "../../components/ui/StatusBadge";
import type { RemediationItem } from "./types";

/**
 * Prioritized remediation checklist for the TLS setup workflow.
 * Each item shows status, why it matters, and one clear action.
 * Items are sorted by priority: blocking items first, then warnings, then ready items.
 */
export function TlsRemediationChecklist({ items }: { items: RemediationItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="ff-table-card" aria-label="TLS remediation checklist">
      <div className="ff-table-card-header">
        <div>
          <h3>Remediation checklist</h3>
          <p>Prioritized steps to resolve TLS blockers. Start with the first item.</p>
        </div>
      </div>
      <div className="ff-table-scroll">
        <table className="ff-data-table" aria-label="TLS remediation steps">
          <thead>
            <tr>
              <th>Status</th>
              <th>Check</th>
              <th>Why it matters</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.key}
                className={
                  item.priority === "blocking"
                    ? "ff-itt-row-blocking"
                    : item.priority === "warning"
                      ? "ff-itt-row-warning"
                      : undefined
                }
              >
                <td className="ff-itt-status-cell">
                  <StatusBadge tone={item.tone} status={item.status}>
                    {item.status === "completed"
                      ? "Ready"
                      : item.status === "blocked"
                        ? "Blocked"
                        : item.status === "pending"
                          ? "Pending"
                          : "N/A"}
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
