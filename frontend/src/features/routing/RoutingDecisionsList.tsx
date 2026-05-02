import { Link } from "react-router-dom";
import { AdvancedDiagnostics } from "../../components/ui/AdvancedDiagnostics";
import { EmptyState } from "../../components/ui/StateBlocks";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import type { RoutingControlPlaneResponse } from "../../api/domain/routing";
import { selectedCandidate, rejectedCandidates, formatJson, listValue } from "./utils";

/**
 * Props for the recent decisions list section.
 */
type RoutingDecisionsListProps = {
  snapshot: RoutingControlPlaneResponse | null;
};

/**
 * Recent routing decisions list with drill-down into candidates.
 */
export function RoutingDecisionsList({ snapshot }: RoutingDecisionsListProps) {
  const recentDecisions = snapshot?.recent_decisions ?? [];

  if (recentDecisions.length === 0) {
    return (
      <EmptyState
        title="No routing decisions are persisted yet"
        description="Run a simulation or wait for runtime dispatch traffic to create explainable routing history."
      />
    );
  }

  return (
    <div className="fg-card-grid">
      {recentDecisions.map((decision) => {
        const chosenCandidate = selectedCandidate(decision);
        const rejected = rejectedCandidates(decision);
        return (
          <article key={decision.decision_id} className="fg-subcard">
            <div className="fg-panel-heading">
              <div>
                <h4>{decision.summary}</h4>
                <p className="fg-muted">
                  {decision.created_at} · {titleCase(decision.classification)} · stage={decision.policy_stage}
                </p>
              </div>
              <StatusBadge
                tone={decision.error_type ? "danger" : decision.policy_stage === "preferred" ? "success" : "warning"}
                status={decision.error_type ? "blocked" : decision.policy_stage === "preferred" ? "ready" : "partial"}
              >
                {decision.error_type ?? decision.policy_stage}
              </StatusBadge>
            </div>

            <ul className="fg-list">
              <li>{decision.classification_summary}</li>
              <li>Selected target: {decision.selected_target_key ?? "none"}</li>
              <li>Execution lane: {decision.execution_lane}</li>
              <li>Classification rules: {listValue(decision.classification_rules)}</li>
              <li>
                Chosen because:{chosenCandidate?.selection_reasons.length
                  ? chosenCandidate.selection_reasons.join(", ")
                  : "no selected-candidate reason recorded"}
              </li>
            </ul>

            <section className="fg-subcard">
              <h5>Rejected candidates</h5>
              {rejected.length > 0 ? (
                <ul className="fg-list">
                  {rejected.map((candidate) => (
                    <li key={candidate.target_key}>
                      {candidate.label} · {candidate.target_key} · {candidate.exclusion_reasons.join(", ")}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="fg-muted">No rejected candidates were recorded for this decision.</p>
              )}
            </section>

            <div className="fg-actions">
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.logs, decision.instance_id)}>
                Open Logs
              </Link>
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.execution, decision.instance_id)}>
                Execution Review
              </Link>
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, decision.instance_id)}>
                Provider Targets
              </Link>
            </div>

            <AdvancedDiagnostics
              title="Raw decision payload"
              description="Raw structured and technical details remain collapsed so the main card stays decision-oriented."
              status={decision.error_type ? "blocked" : "decision"}
              statusTone={decision.error_type ? "danger" : "neutral"}
            >
              <pre>{formatJson(decision)}</pre>
            </AdvancedDiagnostics>
          </article>
        );
      })}
    </div>
  );
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
