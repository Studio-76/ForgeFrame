import type { ReactNode } from "react";

import { PageHeader } from "../ui/PageHeader";
import { Section } from "../ui/Section";
import { SummaryStrip } from "../ui/SummaryStrip";
import type { SummaryStripItem } from "../ui/SummaryStrip";
import { AdvancedDiagnostics } from "../ui/AdvancedDiagnostics";
import { EmptyState } from "../ui/EmptyState";
import { PrimaryBlockerCallout } from "../ui/PrimaryBlockerCallout";
import { NextRecommendedAction } from "../ui/NextRecommendedAction";
import type { Density } from "../ui/types";

/**
 * A blocker configuration for when there is an active blocker.
 */
export type BlockerViewConfig = {
  /** What is wrong. */
  title: string;
  /** Why it matters. */
  description?: string;
  /** Action to resolve the blocker. */
  action?: ReactNode;
};

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

  // ── Blocker callout ──────────────────────────────────────
  /** Prominent blocker at the top of the content area. */
  blocker?: BlockerViewConfig;

  // ── Degraded recommendation ──────────────────────────────
  /** Shown below blocker or at top when no blocker. */
  degradedAction?: DegradedActionConfig;

  // ── Summary strip ────────────────────────────────────────
  /** Summary strip with non-zero incident counts. */
  summaryItems?: SummaryStripItem[];

  // ── Content area ─────────────────────────────────────────
  /** The incident list, DataTable, or triage content. */
  children?: ReactNode;

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
 * a summary strip, the incident list/triage content, optional detail panel, and a
 * collapsed diagnostics section at the bottom.
 *
 * @example
 * ```tsx
 * <IncidentResponsePage
 *   eyebrow="Runtime"
 *   title="Health Status"
 *   description="System health and active incidents"
 *   blocker={incidents.certExpired ? { title: "Certificate expired", description: "API calls will fail", action: <Button variant="primary">Renew certificate</Button> } : undefined}
 *   summaryItems={[
 *     { key: "active", label: "Active incidents", value: 3, tone: "danger" },
 *     { key: "blocked", label: "Blocked executions", value: 2, tone: "warning" },
 *   ]}
 *   noIncidents={incidents.activeCount === 0}
 * >
 *   <DataTable ... />
 * </IncidentResponsePage>
 * ```
 */
export function IncidentResponsePage({
  eyebrow,
  title,
  description,
  blocker,
  degradedAction,
  summaryItems,
  children,
  selectedItemContent,
  hasSelection,
  noIncidents,
  noIncidentsConfig,
  diagnostics,
  diagnosticsTitle = "Incident diagnostics",
  density = "default",
}: IncidentResponsePageProps) {
  const compact = density === "compact";

  return (
    <section className="fg-page">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      {/* ── Blocker callout (most prominent) ── */}
      {blocker ? (
        <PrimaryBlockerCallout
          title={blocker.title}
          description={blocker.description}
          action={blocker.action}
        />
      ) : null}

      {/* ── Degraded recommendation (below blocker or at top if no blocker) ── */}
      {degradedAction ? (
        <NextRecommendedAction action={degradedAction.action}>
          {degradedAction.message}
        </NextRecommendedAction>
      ) : null}

      {/* ── Summary strip ── */}
      {summaryItems && summaryItems.length > 0 ? (
        <SummaryStrip items={summaryItems} />
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

      {/* ── Diagnostics ── */}
      {diagnostics ? (
        <AdvancedDiagnostics title={diagnosticsTitle}>
          {diagnostics}
        </AdvancedDiagnostics>
      ) : null}
    </section>
  );
}
