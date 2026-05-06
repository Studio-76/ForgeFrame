/**
 * Top-level learning summary hero — shows event counts, pattern scan status,
 * and the most important next action.
 *
 * @packageDocumentation
 */

import type { LearningEventSummary } from "../../api/domain/learning";
import type { LoadState } from "./types";

/** Props for LearningSummaryHero. */
export interface LearningSummaryHeroProps {
  /** Total event count. */
  totalEvents: number;
  /** Count of suggested events. */
  suggestedCount: number;
  /** Count of events needing review. */
  reviewRequiredCount: number;
  /** Count of approved/promoted events. */
  promotedCount: number;
  /** Count of rejected events. */
  rejectedCount: number;
  /** Whether the user has mutate permission. */
  canMutate: boolean;
  /** Whether the instance ID is available. */
  hasInstance: boolean;
  /** Whether a pattern scan is currently running. */
  scanningPatterns: boolean;
  /** Result from the last pattern scan. */
  scanResult: LearningEventSummary[] | null;
  /** Completion timestamp from the last pattern scan. */
  lastScanCompletedAt: string | null;
  /** Load state for the events list. */
  listState: LoadState;
  /** Whether to show the scan explanation. */
  showScanInfo: boolean;
  /** Toggle scan info display. */
  onToggleScanInfo: () => void;
}

/**
 * Summary hero banner showing learning event totals and primary actions.
 */
export function LearningSummaryHero({
  totalEvents,
  suggestedCount,
  reviewRequiredCount,
  promotedCount,
  rejectedCount,
  canMutate,
  hasInstance,
  scanningPatterns,
  scanResult,
  lastScanCompletedAt,
  listState,
  showScanInfo,
  onToggleScanInfo,
}: LearningSummaryHeroProps) {
  const hasEvents = totalEvents > 0;
  const isLoading = listState === "loading";
  const allCountsZero =
    !isLoading &&
    totalEvents === 0 &&
    suggestedCount === 0 &&
    reviewRequiredCount === 0 &&
    promotedCount === 0 &&
    rejectedCount === 0;
  const lastScanSummary = scanResult
    ? scanResult.length === 0
      ? "No events found"
      : `${scanResult.length} event${scanResult.length === 1 ? "" : "s"} found`
    : "Not run this session";
  const scanStateLabel = scanningPatterns ? "Running" : lastScanSummary;

  return (
    <article className="fg-card ff-learning-summary ff-frame-accent">
      <div className="ff-learning-summary-header">
        <div>
          <p className="ff-learning-kicker">Learning review queue</p>
          <h3>{hasEvents ? "Review queue active" : "No learning review required"}</h3>
        </div>
        <span
          className="ff-learning-status-led"
          data-state={reviewRequiredCount > 0 ? "warning" : "success"}
        >
          {reviewRequiredCount > 0 ? "Operator review needed" : "Queue clear"}
        </span>
      </div>

      {!allCountsZero && (
        <div className="ff-learning-summary-strip" aria-label="Learning review counts">
          <div className="ff-learning-stat">
            <span className="ff-learning-stat-value">
              {isLoading ? "—" : totalEvents}
            </span>
            <span className="ff-learning-stat-label">Total events</span>
          </div>
          <div className="ff-learning-stat">
            <span className="ff-learning-stat-value">
              {isLoading ? "—" : suggestedCount}
            </span>
            <span className="ff-learning-stat-label">Suggested</span>
          </div>
          <div className="ff-learning-stat">
            <span className="ff-learning-stat-value ff-learning-stat-warning">
              {isLoading ? "—" : reviewRequiredCount}
            </span>
            <span className="ff-learning-stat-label">Needs review</span>
          </div>
          <div className="ff-learning-stat">
            <span className="ff-learning-stat-value ff-learning-stat-success">
              {isLoading ? "—" : promotedCount}
            </span>
            <span className="ff-learning-stat-label">Promoted</span>
          </div>
          <div className="ff-learning-stat">
            <span className="ff-learning-stat-value ff-learning-stat-muted">
              {isLoading ? "—" : rejectedCount}
            </span>
            <span className="ff-learning-stat-label">Rejected</span>
          </div>
        </div>
      )}

      <div className="ff-learning-scan-compact" aria-label="Last pattern scan status">
        <div>
          <span className="ff-learning-stat-label">Last scan result</span>
          <strong>{scanStateLabel}</strong>
        </div>
        <div>
          <span className="ff-learning-stat-label">Last scan time</span>
          <strong>{lastScanCompletedAt ?? "Not recorded"}</strong>
        </div>
        <div>
          <span className="ff-learning-stat-label">Events found</span>
          <strong>{scanResult ? scanResult.length : "—"}</strong>
        </div>
      </div>

      <div className="ff-learning-hero-actions">
        {hasEvents && reviewRequiredCount > 0 && (
          <p className="ff-learning-next-action">
            Next action: Review {reviewRequiredCount} event{reviewRequiredCount === 1 ? "" : "s"} needing review
          </p>
        )}

        <div className="ff-learning-hero-buttons">
          <span className="ff-learning-admin-status">
            {canMutate ? "Admin mutations available" : "Read-only access"}
          </span>
          {!hasInstance ? (
            <span className="ff-learning-admin-status">Select an instance</span>
          ) : null}
          <button
            type="button"
            className="ff-learning-info-toggle"
            onClick={onToggleScanInfo}
            aria-label={showScanInfo ? "Hide scan explanation" : "Show scan explanation"}
          >
            {showScanInfo ? "Hide scan info" : "About pattern scans"}
          </button>
        </div>

        {showScanInfo && (
          <div className="ff-learning-scan-info">
            <p>
              A pattern scan searches recent conversations, execution runs, and
              session rotations for repeated patterns that may warrant memory
              promotion or skill drafting. Scans are <strong>read-only</strong>{" "}
              — they create review suggestions without modifying any persistent
              state. Review the results, then decide whether to promote to
              memory, create a skill draft, keep as historical record, or
              reject.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
