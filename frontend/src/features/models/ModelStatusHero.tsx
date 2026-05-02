import { useMemo } from "react";

import { deriveUsabilityState } from "./utils";
import type { AdminModelRegisterRecord } from "../../api/admin";
import type { ModelUsabilityState } from "./types";

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
  disabled: number;
  declarationOnly: number;
}

/**
 * Compact status-hero panel showing aggregate model health at a glance.
 *
 * Displays total, ready, needs-attention, and disabled/degraded counts
 * with color-coded indicators inspired by infrastructure-console dashboard
 * patterns.
 */
export function ModelStatusHero({ models, summary }: ModelStatusHeroProps) {
  const counts = useMemo<UsabilityCounts>(() => {
    let ready = 0;
    let needsAttention = 0;
    let disabled = 0;
    let declarationOnly = 0;

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
          disabled++;
          break;
        case "declaration_only":
          declarationOnly++;
          break;
      }
    }

    return { ready, needsAttention, disabled, declarationOnly };
  }, [models]);

  const total = summary.total_models ?? models.length;

  return (
    <section className="ff-status-hero" aria-label="Model register summary">
      <div className="ff-status-hero-top">
        <div>
          <h3 className="ff-status-hero-label">Model register</h3>
          <p className="ff-status-hero-line">
            {total} model{total !== 1 ? "s" : ""} across{" "}
            {new Set(models.map((m) => m.provider)).size} provider
            {new Set(models.map((m) => m.provider)).size !== 1 ? "s" : ""}
          </p>
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
          {counts.declarationOnly > 0 ? (
            <span style={{ color: "var(--fg-color-text-tertiary)" }}>
              {counts.declarationOnly} declared only
            </span>
          ) : null}
          {counts.disabled > 0 ? (
            <span style={{ color: "var(--fg-color-text-tertiary)" }}>
              {counts.disabled} disabled
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
