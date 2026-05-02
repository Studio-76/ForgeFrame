/**
 * Ordered remediation checklist for instance blockers.
 * Each blocker shows what is wrong, why it matters, how to fix it,
 * and one clear action link.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";
import type { BlockerItem } from "./types";

/**
 * Props for the InstanceRemediationChecklist component.
 */
export type InstanceRemediationChecklistProps = {
  /** List of blocking checks to remediate. */
  blockers: BlockerItem[];
};

/**
 * Ordered numbered remediation checklist.
 * Renders each blocker with what is wrong, why it matters, how to fix it,
 * and a dominant action link. Designed as a guided remediation workflow
 * rather than a diagnostic report.
 */
export function InstanceRemediationChecklist({
  blockers,
}: InstanceRemediationChecklistProps) {
  if (blockers.length === 0) {
    return null;
  }

  return (
    <article className="fg-card ff-instance-checklist">
      <div className="fg-panel-heading">
        <div>
          <h3>Remediation checklist</h3>
          <p className="fg-muted">
            {blockers.length} step{blockers.length !== 1 ? "s" : ""} required before this instance can operate.
          </p>
        </div>
      </div>
      <ol className="ff-instance-checklist-steps">
        {blockers.map((check, index) => (
          <li key={check.id} className="ff-instance-checklist-step" data-step={index + 1}>
            <div className="ff-instance-checklist-marker" data-status="blocked">
              <span className="ff-instance-checklist-number">{index + 1}</span>
            </div>
            <div className="ff-instance-checklist-body">
              <h4 className="ff-instance-checklist-title">{check.label}</h4>
              <p className="ff-instance-checklist-what">
                <strong>What is wrong:</strong> {check.detail || "This check has not passed."}
              </p>
              <p className="ff-instance-checklist-why">
                <strong>Why it matters:</strong>{" "}
                {check.id === "operator_agent" || check.id === "operator"
                  ? "Without an operator agent, the instance cannot execute any work."
                  : check.id === "provider_targets" || check.id === "provider_target"
                    ? "Provider targets define where requests are routed. Without them, no backend is available."
                    : check.id === "routing" || check.id === "routing_policy"
                      ? "Routing policy controls how requests are dispatched. Without it, requests cannot reach targets."
                      : check.id === "work_interaction" || check.id === "work"
                        ? "Work interaction channels (conversations, tasks) must be enabled for the instance to process requests."
                        : check.id === "runtime_access" || check.id === "api_keys"
                          ? "Runtime access keys are required for the instance to authenticate API calls."
                          : "This check must pass before the instance can operate."}
              </p>
              <p className="ff-instance-checklist-how">
                <strong>How to fix:</strong>{" "}
                {check.actionPath
                  ? "Use the link below to navigate to the configuration page."
                  : "Resolve this condition in the instance settings."}
              </p>
              {check.actionPath ? (
                <Link
                  className="fg-nav-link ff-checklist-action"
                  to={check.actionPath}
                >
                  {check.actionLabel ?? "Fix this issue"}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
