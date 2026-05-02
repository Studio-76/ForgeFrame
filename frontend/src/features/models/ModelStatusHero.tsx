import { useMemo } from "react";

import { deriveUsabilityState } from "./utils";
import type { AdminModelRegisterRecord } from "../../api/admin";

/**
 * Props for the {@link ModelStatusHero} component.
 */
export interface ModelStatusHeroProps {
  /** All models (unfiltered) for computing aggregate metrics. */
  readonly models: AdminModelRegisterRecord[];
  /** Summary dict from the API. */
  readonly summary: Record<string, number>;
}

interface UsabilityCounts {
  ready: number;
  needsAttention: number;
  disabledPlaceholder: number;
}

function primaryAttentionReason(counts: UsabilityCounts): string | null {
  if (counts.needsAttention > 0) {
    return `${counts.needsAttention} need${counts.needsAttention !== 1 ? "" : "s"} attention`;
  }
  return null;
}

/**
 * Compact status-hero bar showing aggregate model health at a glance.
 *
 * Displays total models with ready/attention/disabled breakdown in a
 * single-line actionable summary — inspired by infrastructure-console
 * status strips.
 */
export function ModelStatusHero({ models, summary }: ModelStatusHeroProps) {
  const counts = useMemo<UsabilityCounts>(() => {
    let ready = 0;
    let needsAttention = 0;
    let disabledPlaceholder = 0;

    for (const model of models) {
      const state = deriveUsabilityState(model);
      switch (state) {
        case "ready":
          ready++;
          break;
        case "needs_verification":
        case "no_routable_target":
        case "degraded":
          needsAttention++;
          break;
        case "disabled":
        case "placeholder":
        case "declaration_only":
          disabledPlaceholder++;
          break;
      }
    }

    return { ready, needsAttention, disabledPlaceholder };
  }, [models]);

  const total = summary.total_models ?? models.length;
  const attentionReason = primaryAttentionReason(counts);

  return (
    <section className="ff-status-hero" aria-label="Model register summary">
      <div className="ff-status-hero-top">
        <span className="ff-status-hero-label">Model register</span>
        <span className="ff-status-hero-line">
          {total} model{total !== 1 ? "s" : ""} &middot;{" "}
          {new Set(models.map((m) => m.provider)).size} provider
          {new Set(models.map((m) => m.provider)).size !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="ff-status-hero-stats">
        <span style={{ color: "var(--fg-color-status-success)" }}>
          {counts.ready} ready
        </span>
        {counts.needsAttention > 0 ? (
          <span style={{ color: "var(--fg-color-status-warning)" }}>
            {counts.needsAttention} need{counts.needsAttention !== 1 ? "" : "s"} attention
          </span>
        ) : null}
        {counts.disabledPlaceholder > 0 ? (
          <span style={{ color: "var(--fg-color-text-tertiary, var(--fg-color-text-secondary))" }}>
            {counts.disabledPlaceholder} inactive
          </span>
        ) : null}
      </div>
      {attentionReason ? (
        <span
          style={{
            fontSize: "var(--fg-type-size-meta)",
            color: "var(--fg-color-text-secondary)",
          }}
        >
          {attentionReason}
        </span>
      ) : null}
    </section>
  );
}
