import { Link } from "react-router-dom";

import type { GateRecord } from "./types";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ManualEvidenceFlow } from "./ManualEvidenceFlow";

type GateDetailSidebarProps = {
  gate: GateRecord | null;
};

/**
 * Remediation-focused detail sidebar for the selected gate.
 * Shows what is blocking, why it matters, how to fix it, evidence source,
 * primary action, and collapsed advanced details.
 */
export function GateDetailSidebar({ gate }: GateDetailSidebarProps) {
  if (!gate) {
    return (
      <aside className="ff-release-sidebar" aria-label="Gate detail">
        <div className="ff-release-sidebar-empty">
          <p>Select a gate to see remediation details.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="ff-release-sidebar" aria-label={`Detail for ${gate.category}`}>
      <div className="ff-release-sidebar-header">
        <h3 className="ff-release-sidebar-title">{gate.category}</h3>
        <StatusBadge tone={gate.tone} status={gate.statusKey}>
          {gate.statusLabel}
        </StatusBadge>
      </div>

      {/* Blocking reason */}
      <section className="ff-release-sidebar-section">
        <h4 className="ff-release-sidebar-section-title">
          {gate.ready ? "Status" : "What is blocking release"}
        </h4>
        <p className="ff-release-sidebar-text">{gate.blocker}</p>
      </section>

      {/* Why it matters */}
      <section className="ff-release-sidebar-section">
        <h4 className="ff-release-sidebar-section-title">Why it matters</h4>
        <p className="ff-release-sidebar-text">{gate.evidenceSource}</p>
      </section>

      {/* How to fix */}
      {!gate.ready ? (
        <section className="ff-release-sidebar-section">
          <h4 className="ff-release-sidebar-section-title">How to fix it</h4>
          {gate.acceptsManualEvidence ? (
            <ManualEvidenceFlow
              gateKey={gate.key}
              gateCategory={gate.category}
              evidenceGuidance={gate.evidenceGuidance}
              evidenceProvider={gate.evidenceProvider}
              evidenceAt={gate.evidenceAt}
            />
          ) : (
            <Link className="ff-release-sidebar-action" to={gate.primaryActionTo}>
              {gate.primaryAction}
            </Link>
          )}
        </section>
      ) : null}

      {/* Evidence source */}
      <section className="ff-release-sidebar-section">
        <h4 className="ff-release-sidebar-section-title">Current evidence</h4>
        <dl className="ff-release-sidebar-dl">
          <dt>Source</dt>
          <dd>{gate.evidenceSource}</dd>
          <dt>Last checked</dt>
          <dd>{gate.evidenceAt ?? "Not recorded"}</dd>
          {gate.evidenceProvider ? (
            <>
              <dt>Provided by</dt>
              <dd>{gate.evidenceProvider}</dd>
            </>
          ) : null}
        </dl>
      </section>

      {/* Primary action */}
      <div className="ff-release-sidebar-primary-action">
        <Link className="ff-release-sidebar-action" to={gate.primaryActionTo}>
          {gate.primaryAction}
        </Link>
      </div>

      {/* Secondary nav links */}
      {gate.secondaryActions.length > 0 ? (
        <div className="ff-release-sidebar-nav-links">
          {gate.secondaryActions.map((action) => (
            <Link key={action.to} className="fg-nav-link" to={action.to}>
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}

      {/* Advanced details */}
      <details className="ff-release-sidebar-advanced">
        <summary>Advanced details</summary>
        <div className="ff-release-sidebar-advanced-body">
          <dl className="ff-release-sidebar-dl">
            <dt>Status key</dt>
            <dd>{gate.statusKey}</dd>
            <dt>Severity</dt>
            <dd>{gate.severity}</dd>
            <dt>Priority</dt>
            <dd>{gate.priority}</dd>
          </dl>
          {gate.notes.length > 0 ? (
            <>
              <h5 className="ff-release-sidebar-notes-title">Notes</h5>
              <ul className="ff-release-sidebar-notes">
                {gate.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </details>
    </aside>
  );
}
