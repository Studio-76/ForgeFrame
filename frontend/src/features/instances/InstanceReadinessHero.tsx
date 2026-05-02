/**
 * Top-level readiness hero for the selected instance.
 * Shows instance identity, readiness state, primary blocker, and next action.
 *
 * @packageDocumentation
 */

import type { InstanceRecord, InstanceSetupStatus } from "../../api/domain/instances";
import { toneForSetupStatus, nextStepTone, formatReadinessSummary, getInstanceBlocker } from "./utils";

/**
 * Props for the InstanceReadinessHero component.
 */
export type InstanceReadinessHeroProps = {
  /** The selected instance record. */
  instance: InstanceRecord;
};

/**
 * Readiness hero banner showing the selected instance state, primary blocker,
 * blocker count, passed check count, and the dominant next action.
 *
 * Designed so an operator can identify the instance state and primary blocker
 * within 5 seconds.
 */
export function InstanceReadinessHero({ instance }: InstanceReadinessHeroProps) {
  const blocker = getInstanceBlocker(instance);
  const ready =
    instance.readiness?.status === "ready";
  const blockerCount =
    instance.readiness?.checks.filter((c) => c.status !== "ready").length ?? 0;
  const passCount =
    instance.readiness?.ready_check_count ?? 0;
  const totalChecks =
    instance.readiness?.check_count ?? 0;

  return (
    <section className="ff-status-hero" aria-label="Selected instance status">
      {/* Identity row */}
      <div className="ff-status-hero-top">
        <div>
          <h3 className="ff-status-hero-label">{instance.display_name}</h3>
          <p className="ff-status-hero-line">
            <span className="fg-code">{instance.instance_id}</span>
            {" · "}
            {instance.deployment_mode}
            {" · "}
            {instance.exposure_mode}
            {instance.is_default ? " · default instance" : ""}
          </p>
        </div>
        <span className="fg-pill" data-tone={toneForSetupStatus(instance.readiness?.status)}>
          {instance.readiness?.status ?? "unknown"}
        </span>
      </div>

      {/* Compact stat strip */}
      <div className="ff-status-hero-stats ff-instance-hero-stats">
        <span>{totalChecks > 0 ? `${passCount}/${totalChecks} checks passing` : "No readiness checks"}</span>
        {blockerCount > 0 ? (
          <span data-tone="danger">{blockerCount} blocker{blockerCount !== 1 ? "s" : ""}</span>
        ) : null}
        {instance.operator_agent?.status === "ready" ? null : (
          <span data-tone="danger">Operator agent missing</span>
        )}
      </div>

      {/* Blocker / next step */}
      {blocker ? (
        <div className="ff-next-step" data-tone={nextStepTone(instance.readiness?.status)}>
          <div className="ff-next-step-content">
            <span className="ff-next-step-label">
              Next: {blocker.blocker}
            </span>
            <span className="ff-next-step-impact">{blocker.impact}</span>
          </div>
          {blocker.actionLabel ? (
            <span className="ff-primary-action">{blocker.actionLabel}</span>
          ) : null}
        </div>
      ) : ready ? (
        <div className="ff-next-step" data-tone="success">
          <span className="ff-next-step-label">Instance is ready</span>
          <span>All readiness checks pass. The instance can execute work normally.</span>
        </div>
      ) : null}
    </section>
  );
}
