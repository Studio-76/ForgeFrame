import type { ReleaseSummary } from "./types";

/** @private */
const STATUS_META: Record<
  ReleaseSummary["status"],
  { label: string; tone: string; detail: string }
> = {
  ready: {
    label: "release-ready",
    tone: "success",
    detail: "Every hard gate is currently backed by real evidence.",
  },
  blocked: {
    label: "release blocked",
    tone: "danger",
    detail: "At least one gate is blocking the release claim.",
  },
  "manual-evidence": {
    label: "manual evidence required",
    tone: "warning",
    detail: "One or more gates need manual operator evidence to proceed.",
  },
};

type ReleaseStatusHeroProps = {
  summary: ReleaseSummary;
};

/**
 * Top-level release status summary showing overall readiness,
 * blocker count, primary blocker, and next recommended action.
 */
export function ReleaseStatusHero({ summary }: ReleaseStatusHeroProps) {
  const meta = STATUS_META[summary.status];

  return (
    <section className="ff-release-hero" aria-label="Release status">
      <div className="ff-release-hero-top">
        <div className="ff-release-hero-copy">
          <h3 className="ff-release-hero-label">Release readiness</h3>
          <p className="ff-release-hero-line">{meta.detail}</p>
        </div>
        <span
          className="ff-release-hero-badge"
          data-tone={meta.tone}
        >
          {meta.label}
        </span>
      </div>

      <div className="ff-release-hero-stats">
        <span>
          <strong>{summary.totalGates}</strong> gates
        </span>
        {summary.blockingCount > 0 ? (
          <span>
            <strong>{summary.blockingCount}</strong> blocking
          </span>
        ) : null}
        {summary.manualEvidenceCount > 0 ? (
          <span>
            <strong>{summary.manualEvidenceCount}</strong> need evidence
          </span>
        ) : null}
      </div>

      {summary.primaryBlocker ? (
        <div
          className="ff-release-hero-blocker"
          data-tone={summary.status === "blocked" ? "danger" : "warning"}
        >
          <span className="ff-release-hero-blocker-label">Primary blocker:</span>
          <span className="ff-release-hero-blocker-text">{summary.primaryBlocker}</span>
        </div>
      ) : null}

      {summary.nextAction ? (
        <div className="ff-release-hero-next">
          <span className="ff-release-hero-next-label">Next action:</span>
          <span className="ff-release-hero-next-text">{summary.nextAction}</span>
        </div>
      ) : null}
    </section>
  );
}
