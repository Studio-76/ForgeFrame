/**
 * Harness status hero — top-level summary bar.
 *
 * Shows the active profile, verification state, last successful verification,
 * primary issue, and next recommended action. This is the first thing an
 * operator sees and should communicate readiness at a glance.
 */
import { formatMetric } from "../providers/providersShared";
import type { HarnessStatusSummary } from "./types";

type HarnessStatusHeroProps = {
  summary: HarnessStatusSummary;
  profileCount: number;
  runCount: number;
  templateCount: number;
};

/**
 * Top-level harness status hero with at-a-glance readiness summary.
 */
export function HarnessStatusHero({
  summary,
  profileCount,
  runCount,
  templateCount,
}: HarnessStatusHeroProps) {
  return (
    <div className="ff-status-hero">
      <div className="ff-status-hero-top">
        <div>
          <h2 className="ff-status-hero-label">Harness Status</h2>
          <p className="ff-status-hero-line">
            {summary.activeProfile
              ? `Active: ${summary.activeProfile} \u00B7 Last verify: ${summary.lastVerify}`
              : "No harness profiles configured yet"}
            {summary.primaryIssue ? ` \u00B7 Issue: ${summary.primaryIssue}` : ""}
          </p>
        </div>
        <div className="ff-status-hero-stats">
          <span className="ff-stat-block">
            <span className="ff-stat-value">{formatMetric(profileCount)}</span>
            <span className="ff-stat-label">profiles</span>
          </span>
          <span className="ff-stat-block">
            <span className="ff-stat-value">{formatMetric(runCount)}</span>
            <span className="ff-stat-label">runs</span>
          </span>
          <span className="ff-stat-block">
            <span className="ff-stat-value">{formatMetric(templateCount)}</span>
            <span className="ff-stat-label">templates</span>
          </span>
        </div>
      </div>
      <div className="ff-next-step" data-tone={summary.nextStepTone}>
        <span className="ff-next-step-label">Next step:</span>
        <span>{summary.nextStep}</span>
      </div>
    </div>
  );
}
