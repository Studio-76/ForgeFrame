/**
 * Operational summary hero for the Logs surface.
 *
 * Displays the active incident summary and a compact status strip. The layout
 * adapts GridCN data-card and status-dot references to ForgeFrame tokens so the
 * surface stays business-oriented instead of neon-heavy.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";

import { withInstanceScope } from "../../app/tenantScope";
import type { LogsSummaryCounts } from "./types";
import { formatExactTime, formatRelativeTime } from "./utils";

/** Props for LogsSummaryHero. */
export interface LogsSummaryHeroProps {
  /** Derived summary counts. */
  counts: LogsSummaryCounts;
  /** Whether data is still loading. */
  loading: boolean;
  /** Selected instance ID. */
  instanceId: string | null;
}

/** Status tone for a hero card. */
type HeroTone = "danger" | "warning" | "success" | "neutral";

interface HeroCard {
  key: string;
  label: string;
  value: string;
  meta: string;
  tone: HeroTone;
}

/**
 * Build hero cards from summary counts.
 * @param counts - Summary counts.
 * @param loading - Whether data is loading.
 * @returns Array of hero cards.
 */
function buildHeroCards(counts: LogsSummaryCounts, loading: boolean): HeroCard[] {
  if (loading) {
    return Array.from({ length: 5 }, (_, i) => ({
      key: `skeleton-${i}`,
      label: "\u00A0".repeat(8),
      value: "\u00A0".repeat(3),
      meta: "\u00A0".repeat(16),
      tone: "neutral" as HeroTone,
    }));
  }

  return [
    {
      key: "active-errors",
      label: "Active errors",
      value: String(counts.activeErrors),
      meta: counts.activeErrors > 0
        ? "Requires immediate operator action."
        : "No critical errors detected.",
      tone: counts.activeErrors > 0 ? "danger" : "success",
    },
    {
      key: "open-incidents",
      label: "Open incidents",
      value: String(counts.openIncidents),
      meta: counts.openIncidents > 0
        ? "Warning-level incidents require review."
        : "No open warning incidents.",
      tone: counts.openIncidents > 0 ? "warning" : "success",
    },
    {
      key: "recent-warnings",
      label: "Recent warnings",
      value: String(counts.recentWarnings),
      meta: counts.recentWarnings > 0
        ? `${counts.recentWarnings} event${counts.recentWarnings === 1 ? "" : "s"} in current window.`
        : "No recent warning events.",
      tone: counts.recentWarnings > 0 ? "warning" : "success",
    },
    {
      key: "audit-events",
      label: "Audit events",
      value: String(counts.auditEventCount),
      meta: "Governance events in the current scope.",
      tone: "neutral",
    },
    {
      key: "last-critical",
      label: "Last critical event",
      value: counts.lastCriticalEvent
        ? new Date(counts.lastCriticalEvent).toLocaleDateString()
        : "None",
      meta: counts.lastCriticalEvent
        ? `Latest critical at ${new Date(counts.lastCriticalEvent).toLocaleTimeString()}`
        : "No critical event recorded.",
      tone: counts.lastCriticalEvent ? "danger" : "success",
    },
  ];
}

/**
 * Operational summary hero for the Logs surface.
 *
 * Uses a GridCN-inspired data-card pattern adapted to the ForgeFrame
 * design system — thin borders, compact labels, corner accent lines,
 * and status-driven tones. Builds on the existing fg-card / fg-panel-heading
 * vocabulary for consistency.
 *
 * @param props - Component props.
 * @returns The summary hero section.
 */
export function LogsSummaryHero({ counts, loading, instanceId }: LogsSummaryHeroProps) {
  const cards = buildHeroCards(counts, loading);
  const healthTone = counts.activeErrors > 0
    ? "danger"
    : counts.openIncidents > 0 || counts.recentWarnings > 0
      ? "warning"
      : "success";
  const healthLabel = counts.activeErrors > 0
    ? "Action required"
    : counts.openIncidents > 0 || counts.recentWarnings > 0
      ? "Review needed"
      : "No active incident";

  return (
    <section className="ff-logs-hero" aria-label="Operational summary">
      <article className="ff-logs-incident-hero" data-tone={healthTone}>
        <div className="ff-logs-status-line">
          <span className="ff-logs-status-dot" data-tone={healthTone} aria-hidden="true" />
          <span className="ff-logs-hero-label">Current health state</span>
          <strong>{healthLabel}</strong>
        </div>
        <div className="ff-logs-incident-copy">
          <h2>
            {counts.activeErrors > 0
              ? `${counts.activeErrors} active error${counts.activeErrors === 1 ? "" : "s"} require operator action.`
              : "No active errors require operator action."}
          </h2>
          <p>{counts.impact}</p>
        </div>
        <dl className="ff-logs-incident-fields">
          <div>
            <dt>Top affected subsystem</dt>
            <dd>{counts.topSubsystem}</dd>
          </div>
          <div>
            <dt>Last critical event</dt>
            <dd title={formatExactTime(counts.lastCriticalEvent)}>
              {formatRelativeTime(counts.lastCriticalEvent)}
            </dd>
          </div>
          <div>
            <dt>Primary recommendation</dt>
            <dd>{counts.nextAction}</dd>
          </div>
        </dl>
        <div className="ff-logs-remediation-callout">
          <div>
            <strong>Recommended action</strong>
            <p>{counts.nextAction}</p>
          </div>
          {counts.primaryActionHref ? (
            <Link
              className="ff-primary-action"
              to={withInstanceScope(counts.primaryActionHref, instanceId)}
            >
              {counts.primaryActionLabel}
            </Link>
          ) : (
            <span className="fg-muted">No remediation route needed.</span>
          )}
        </div>
      </article>

      <div className="ff-logs-status-strip">
        {cards.map((card) => (
          <article
            key={card.key}
            className="ff-logs-hero-card"
            data-tone={card.tone}
          >
            <span className="ff-logs-hero-label">{card.label}</span>
            <span className="ff-logs-hero-value">{card.value}</span>
            <span className="ff-logs-hero-meta">{card.meta}</span>
            {/* Corner accent brackets */}
            <span className="ff-logs-hero-corner tl" aria-hidden="true" />
            <span className="ff-logs-hero-corner tr" aria-hidden="true" />
            <span className="ff-logs-hero-corner bl" aria-hidden="true" />
            <span className="ff-logs-hero-corner br" aria-hidden="true" />
            {/* Bottom accent line */}
            <span className="ff-logs-hero-accent" aria-hidden="true" />
          </article>
        ))}
      </div>
    </section>
  );
}
