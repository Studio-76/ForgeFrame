import { Link } from "react-router-dom";

import { withInstanceScope } from "../../app/tenantScope";
import type { SetupStep, SetupStepStatus } from "./types";

/**
 * Props for the {@link SetupStepCard} component.
 */
export type SetupStepCardProps = {
  /** Step definition to render. */
  step: SetupStep;
  /** Optional instance ID for scoping navigation links. */
  instanceId?: string | null;
};

/**
 * Map step status to a CSS class suffix.
 */
function statusClass(status: SetupStepStatus): string {
  switch (status) {
    case "complete":
      return "ff-setup-step-complete";
    case "current":
      return "ff-setup-step-current";
    case "blocked":
      return "ff-setup-step-blocked";
    case "upcoming":
    default:
      return "ff-setup-step-upcoming";
  }
}

/**
 * Map step status to a tone for the status pill.
 */
function statusPillTone(status: SetupStepStatus): string {
  switch (status) {
    case "complete":
      return "success";
    case "current":
      return "warning";
    case "blocked":
      return "danger";
    case "upcoming":
    default:
      return "neutral";
  }
}

/**
 * Human-readable label for step status.
 */
function statusLabel(status: SetupStepStatus): string {
  switch (status) {
    case "complete":
      return "complete";
    case "current":
      return "current";
    case "blocked":
      return "blocked";
    case "upcoming":
      return "pending";
    default:
      return "";
  }
}

/**
 * Individual step card for the guided setup flow.
 *
 * Renders a step with:
 * - Step number badge
 * - Title and description
 * - Status pill
 * - Blockers list (when blocked)
 * - Action link (when actionable)
 */
export function SetupStepCard({ step, instanceId }: SetupStepCardProps) {
  const isCurrent = step.status === "current";
  const isBlocked = step.status === "blocked";
  const isComplete = step.status === "complete";
  const isUpcoming = step.status === "upcoming";

  return (
    <article
      className={`ff-setup-step-card ${statusClass(step.status)}`}
      aria-current={isCurrent ? "step" : undefined}
    >
      <div className="ff-setup-step-header">
        <div
          className={`ff-setup-step-number ${isComplete ? "ff-setup-step-number-done" : ""}`}
          aria-hidden="true"
        >
          {isComplete ? "\u2713" : step.stepNumber}
        </div>
        <div className="ff-setup-step-info">
          <h3 className="ff-setup-step-title">{step.title}</h3>
          <p className="ff-setup-step-description">{step.description}</p>
        </div>
        {isUpcoming ? null : (
          <span className="fg-pill" data-tone={statusPillTone(step.status)}>
            {statusLabel(step.status)}
          </span>
        )}
      </div>

      {isBlocked && step.blockers.length > 0 ? (
        <div className="ff-setup-step-blockers">
          <strong className="ff-setup-step-blocker-title">Requires attention</strong>
          <ul className="fg-list ff-setup-step-blocker-list">
            {step.blockers.map((blocker, index) => (
              <li key={`${step.id}-blocker-${index}`}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isUpcoming && step.actionLabel && step.actionTo ? (
        <div className="ff-setup-step-action">
          <Link
            className="fg-nav-link"
            to={withInstanceScope(step.actionTo, instanceId)}
          >
            {isCurrent ? step.actionLabel : `Open ${step.actionLabel}`}
          </Link>
        </div>
      ) : null}
    </article>
  );
}
