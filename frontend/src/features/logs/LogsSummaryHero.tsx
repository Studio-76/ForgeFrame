/**
 * Operational summary hero for the Logs surface.
 *
 * Displays key metrics — active errors, open incidents, blocked routing,
 * alert pressure, audit events, and signal health — using a GridCN-inspired
 * data-card layout adapted to the ForgeFrame design tokens.
 *
 * @packageDocumentation
 */

import type { LogsSummaryCounts } from "./types";

/** Props for LogsSummaryHero. */
export interface LogsSummaryHeroProps {
  /** Derived summary counts. */
  counts: LogsSummaryCounts;
  /** Whether data is still loading. */
  loading: boolean;
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
    return Array.from({ length: 6 }, (_, i) => ({
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
    {
      key: "next-action",
      label: "Next action",
      value: counts.nextAction.length > 30
        ? `${counts.nextAction.slice(0, 30)}\u2026`
        : counts.nextAction,
      meta: counts.nextAction,
      tone: counts.activeErrors > 0 || counts.openIncidents > 0 ? "warning" : "success",
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
export function LogsSummaryHero({ counts, loading }: LogsSummaryHeroProps) {
  const cards = buildHeroCards(counts, loading);

  return (
    <section className="ff-logs-hero" aria-label="Operational summary">
      <div className="ff-logs-hero-grid">
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
