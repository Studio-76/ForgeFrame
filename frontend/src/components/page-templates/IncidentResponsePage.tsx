import type { ReactNode } from "react";

import { PageHeader } from "../ui/PageHeader";
import { Section } from "../ui/Section";
import { SummaryStrip } from "../ui/SummaryStrip";
import type { SummaryStripItem } from "../ui/SummaryStrip";
import { EmptyState } from "../ui/EmptyState";
import { NextRecommendedAction } from "../ui/NextRecommendedAction";
import { Button } from "../ui/Button";
import type { Density } from "../ui/types";
import type { Action } from "../ui/models/action";
import { validateActions } from "../ui/models/action";
import type { AttentionPayload } from "../ui/models/attention";
import { renderBlockers, renderVisibleAttention, renderCollapsedAttention, renderDiagnosticAttention } from "./shared";
import type { ScopeConfig } from "./RegistryManagementPage";

/**
 * A degraded-state recommendation.
 */
export type DegradedActionConfig = {
  /** Explanation of the degraded state and what to do. */
  message: string;
  /** Action to address the degradation. */
  action?: ReactNode;
};

/**
 * An empty state configuration for when there are no incidents.
 */
export type NoIncidentsConfig = {
  /** Message like "All systems operational. No active incidents." */
  title?: string;
  /** Optional secondary message. */
  description?: string;
};

/**
 * Props for the IncidentResponsePage template.
 */
export type IncidentResponsePageProps = {
  /** Page header eyebrow (category). */
  eyebrow?: string;
  /** Page title. */
  title: string;
  /** Page description. */
  description?: string;

  // ── Scope ────────────────────────────────────────────────
  /** When set, shows a compact scope indicator. */
  scope?: ScopeConfig;

  // ── Attention items ──────────────────────────────────────
  /**
   * Attention-tagged items.
   * primary_blocker → blocker callout, needs_action/warning → visible,
   * informational/healthy → collapsed, diagnostic → AdvancedDiagnostics.
   */
  attentionItems?: AttentionPayload[];

  // ── Degraded recommendation ──────────────────────────────
  /** Shown below blocker or at top when no blocker. */
  degradedAction?: DegradedActionConfig;

  // ── Summary strip ────────────────────────────────────────
  /** Summary strip with non-zero incident counts. */
  summaryItems?: SummaryStripItem[];

  // ── Content area ─────────────────────────────────────────
  /** The incident list, DataTable, or triage content. */
  children?: ReactNode;

  // ── Page-level actions ───────────────────────────────────
  /** Actions rendered in the page content area. */
  actions?: Action[];

  // ── Detail panel ─────────────────────────────────────────
  /** Content for the selected incident detail. */
  selectedItemContent?: ReactNode;
  /** Whether an incident is selected. When true, renders selectedItemContent. */
  hasSelection?: boolean;

  // ── No-incidents empty state ─────────────────────────────
  /** When true, renders an empty "all clear" state. */
  noIncidents?: boolean;
  /** Configuration for the no-incidents state. */
  noIncidentsConfig?: NoIncidentsConfig;

  // ── Diagnostics ──────────────────────────────────────────
  /** Collapsible diagnostics at the bottom. */
  diagnostics?: ReactNode;
  /** Diagnostics section title. Defaults to "Incident diagnostics". */
  diagnosticsTitle?: string;

  // ── Mode ─────────────────────────────────────────────────
  /** Density variant. */
  density?: Density;
};

/**
 * IncidentResponsePage — a page template for detecting, diagnosing, and resolving
 * active incidents, blockers, and degraded states.
 *
 * Renders a header, optional blocker callout, optional degraded-action recommendation,
 * attention items, a summary strip, the incident list/triage content, optional actions,
 * optional detail panel, and a collapsed diagnostics section at the bottom.
 *
 * @example
 * ```tsx
 * <IncidentResponsePage
 *   eyebrow="Runtime"
 *   title="Health Status"
 *   description="System health and active incidents"
 *   attentionItems={[
 *     { key: "cert", level: "primary_blocker", title: "Certificate expired", description: "API calls will fail" },
 *     { key: "degraded", level: "warning", title: "High latency on 2 targets" },
 *   ]}
 *   summaryItems={[
 *     { key: "active", label: "Active incidents", value: 3, tone: "danger" },
 *   ]}
 * >
 *   <DataTable ... />
 * </IncidentResponsePage>
 * ```
 */
export function IncidentResponsePage({
  eyebrow,
  title,
  description,
  scope,
  attentionItems,
  degradedAction,
  summaryItems,
  children,
  actions,
  selectedItemContent,
  hasSelection,
  noIncidents,
  noIncidentsConfig,
  diagnostics,
  diagnosticsTitle = "Incident diagnostics",
  density = "default",
}: IncidentResponsePageProps) {
  const compact = density === "compact";

  // ── Derive display elements from attention model ────────

  // Validate action rules (dev-mode warning only)
  if (import.meta.env.DEV && actions) {
    const validation = validateActions(actions, "detail");
    if (!validation.valid) {
      console.warn("[IncidentResponsePage] Action rule violations:", validation.violations);
    }
  }

  return (
    <section className="fg-page">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      {/* ── Scope compact bar ── */}
      {scope ? (
        <div className="flex items-center gap-2 px-1 py-1.5 mb-2 text-meta text-muted">
          <span className="font-medium">Scope:</span>
          <span className="text-primary">{scope.label}</span>
          {scope.onChange ? (
            <Button variant="navigation" density="compact" onPress={scope.onChange}>
              Change
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* ── Blocker callout ── */}
      {renderBlockers(attentionItems)}

      {/* ── Degraded recommendation ── */}
      {degradedAction ? (
        <NextRecommendedAction action={degradedAction.action}>
          {degradedAction.message}
        </NextRecommendedAction>
      ) : null}

      {/* ── Visible attention items ── */}
      {renderVisibleAttention(attentionItems)}

      {/* ── Summary strip ── */}
      {summaryItems && summaryItems.length > 0 ? (
        <SummaryStrip items={summaryItems} />
      ) : null}

      {/* ── Actions area ── */}
      {actions && actions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.kind ?? "secondary"}
              isDisabled={action.disabled}
              onPress={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}

      {/* ── Main content: incident list or no-incidents state ── */}
      {noIncidents ? (
        <EmptyState
          title={noIncidentsConfig?.title ?? "All systems operational"}
          description={noIncidentsConfig?.description ?? "No active incidents."}
        />
      ) : (
        <Section className={compact ? "ff-dense" : undefined}>
          {children}
        </Section>
      )}

      {/* ── Detail panel ── */}
      {hasSelection && selectedItemContent ? (
        <div className={`${compact ? "mt-3" : "mt-4"}`}>
          {selectedItemContent}
        </div>
      ) : null}

      {/* ── Collapsed attention (informational / healthy) ── */}
      {renderCollapsedAttention(attentionItems)}

      {/* ── Diagnostics ── */}
      {renderDiagnosticAttention(attentionItems, diagnosticsTitle, diagnostics)}
    </section>
  );
}
