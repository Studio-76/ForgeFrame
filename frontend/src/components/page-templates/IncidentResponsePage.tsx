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
import type { Action } from "../ui/models/action";
import { validateActions, actionToButtonProps } from "../ui/models/action";
import type { AttentionPayload } from "../ui/models/attention";
import { groupAttentionItems, toneForLevel } from "../ui/models/attention";
import { Button } from "../ui/Button";

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

  // ── Attention items ──────────────────────────────────────
  /**
   * Attention-tagged items.
   * primary_blocker → blocker callout, needs_action/warning → visible,
   * informational/healthy → collapsed, diagnostic → AdvancedDiagnostics.
   */
  attentionItems?: AttentionPayload[];

  // ── Blocker callout (legacy, use attentionItems instead) ──
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
  attentionItems,
  blocker,
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
  const { blockers: blockerItems, visible: visibleAttention, collapsed: collapsedAttention, advanced: diagnosticAttention } = groupAttentionItems(attentionItems);

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

      {/* ── Blocker callout (from attention or legacy prop) ── */}
      {blockerItems.length > 0
        ? blockerItems.map((item) => (
            <div key={item.key} className="mb-3">
              <PrimaryBlockerCallout
                title={item.title}
                description={item.description}
                tone={item.tone ?? toneForLevel(item.level)}
                action={
                  item.action ? (
                    <Button
                      variant={item.action.kind ?? "primary"}
                      isDisabled={item.action.disabled}
                      onPress={item.action.onClick}
                    >
                      {item.action.label}
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ))
        : blocker
          ? (
            <PrimaryBlockerCallout
              title={blocker.title}
              description={blocker.description}
              action={blocker.action}
            />
          )
          : null}

      {/* ── Degraded recommendation ── */}
      {degradedAction ? (
        <NextRecommendedAction action={degradedAction.action}>
          {degradedAction.message}
        </NextRecommendedAction>
      ) : null}

      {/* ── Visible attention items ── */}
      {visibleAttention.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-3">
          {visibleAttention.map((item) => (
            <span
              key={item.key}
              className="ff-status-badge"
              data-tone={item.tone ?? toneForLevel(item.level)}
            >
              {item.title}
            </span>
          ))}
        </div>
      ) : null}

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
      {collapsedAttention.length > 0 ? (
        <details className="mt-3">
          <summary className="text-meta text-muted cursor-pointer font-medium">
            Status details ({collapsedAttention.length})
          </summary>
          <div className="flex flex-wrap gap-2 mt-2">
            {collapsedAttention.map((item) => (
              <span
                key={item.key}
                className="ff-status-badge"
                data-tone={item.tone ?? toneForLevel(item.level)}
              >
                {item.title}
              </span>
            ))}
          </div>
        </details>
      ) : null}

      {/* ── Diagnostics ── */}
      {(diagnostics || diagnosticAttention.length > 0) ? (
        <AdvancedDiagnostics title={diagnosticsTitle}>
          {diagnosticAttention.length > 0 ? (
            <div className="flex flex-col gap-2 mb-3">
              {diagnosticAttention.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="font-mono text-meta text-muted">{item.title}</span>
                  {item.description ? (
                    <span className="text-meta text-muted">{item.description}</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {diagnostics}
        </AdvancedDiagnostics>
      ) : null}
    </section>
  );
}
