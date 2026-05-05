/**
 * Harness status bar — compact readiness announcement.
 *
 * Shows active profile, verification state, issue, and next recommended step.
 * Summary metrics (profiles, runs, templates) are rendered by the
 * RegistryManagementPage template — this component provides only the
 * contextual status line and next-step guidance.
 */
import type { HarnessStatusSummary } from "./types";

type HarnessStatusHeroProps = {
  summary: HarnessStatusSummary;
};

/**
 * Compact harness status bar with at-a-glance readiness and next step.
 */
export function HarnessStatusHero({
  summary,
}: HarnessStatusHeroProps) {
  return (
    <div className="ff-status-hero">
      <div className="ff-status-hero-top">
        <p className="ff-status-hero-label">Harness Status</p>
        <p className="ff-status-hero-line">
          {summary.activeProfile
            ? `Active: ${summary.activeProfile} \u00B7 Last verify: ${summary.lastVerify}`
            : "No harness profiles configured yet"}
          {summary.primaryIssue ? ` \u00B7 Issue: ${summary.primaryIssue}` : ""}
        </p>
      </div>
      <div className="ff-next-step" data-tone={summary.nextStepTone}>
        <span className="ff-next-step-label">Next step:</span>
        <span>{summary.nextStep}</span>
      </div>
    </div>
  );
}
