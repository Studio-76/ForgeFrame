import type { RoutingControlPlaneResponse } from "../../api/domain/routing";

/**
 * Props for the target reference panel.
 */
export type RoutingTargetReferenceProps = {
  snapshot: RoutingControlPlaneResponse | null;
};

/**
 * Advanced target reference moved into an expandable diagnostics panel.
 * Raw target keys are hidden by default — only readable target names are shown.
 * Expand "Technical details" to see raw target keys for policy authoring.
 */
export function RoutingTargetReference({ snapshot }: RoutingTargetReferenceProps) {
  const targets = snapshot?.targets ?? [];

  if (targets.length === 0) {
    return (
      <details className="ff-advanced-diagnostics">
        <summary>
          <span>Target reference</span>
          <span className="fg-muted">0 targets</span>
        </summary>
        <div className="ff-advanced-diagnostics-body">
          <p className="fg-muted">No routing targets are registered for this instance.</p>
        </div>
      </details>
    );
  }

  return (
    <details className="ff-advanced-diagnostics">
      <summary>
        <span>Target reference</span>
        <span className="fg-muted">{targets.length} targets</span>
      </summary>
      <div className="ff-advanced-diagnostics-body">
        <p className="fg-muted">
          Use exact target keys when editing preferred, fallback, or escalation stage lists.
        </p>
        <div className="fg-stack">
          {targets.map((target) => (
            <section key={target.target_key} className="fg-subcard">
              <h4>{target.label}</h4>
              <p className="fg-muted">
                {target.provider} · readiness={target.readiness_status} · runtime ready={String(target.runtime_ready)} · cost={target.cost_class}
              </p>
              <details className="ff-advanced-diagnostics">
                <summary>
                  <span className="fg-muted">Technical details</span>
                </summary>
                <div className="ff-advanced-diagnostics-body">
                  <code className="fg-code">{target.target_key}</code>
                </div>
              </details>
            </section>
          ))}
        </div>
      </div>
    </details>
  );
}
