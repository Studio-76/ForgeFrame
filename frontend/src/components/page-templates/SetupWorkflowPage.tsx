import type { ReactNode } from "react";

import { PageHeader } from "../ui/PageHeader";
import { PrimaryBlockerCallout } from "../ui/PrimaryBlockerCallout";
import { Section } from "../ui/Section";
import { AdvancedDiagnostics } from "../ui/AdvancedDiagnostics";
import { EmptyState } from "../ui/EmptyState";
import { ActionBar } from "../ui/ActionBar";
import { Button } from "../ui/Button";
import type { Density } from "../ui/types";
import type { Action } from "../ui/models/action";
import { validateActions } from "../ui/models/action";
import type { AttentionPayload } from "../ui/models/attention";
import { heroItems, advancedItems, toneForLevel } from "../ui/models/attention";

/**
 * An empty state configuration for step-zero of the workflow.
 */
export type EmptyStateConfig = {
  /** Clear state description. */
  title: string;
  /** Short explanation of why there's nothing yet. */
  description?: string;
  /** Single primary action to start. */
  action?: ReactNode;
};

/**
 * Props for the SetupWorkflowPage template.
 */
export type SetupWorkflowPageProps = {
  /** Page header eyebrow (e.g. "Setup"). */
  eyebrow?: string;
  /** Page title. */
  title: string;
  /** Page description. */
  description?: string;

  // ── Progress ──────────────────────────────────────────
  /** Current step index (1-based). */
  currentStep: number;
  /** Total number of steps. */
  totalSteps: number;
  /** Human-readable label for the current step (shown as "Step N: label"). */
  stepLabel?: string;

  // ── Attention ─────────────────────────────────────────
  /**
   * Attention-tagged items.
   * primary_blocker → blocker callout, diagnostic → AdvancedDiagnostics.
   */
  attentionItems?: AttentionPayload[];

  // ── Empty state ────────────────────────────────────────
  /** When set, renders an EmptyState instead of the step content. */
  emptyState?: EmptyStateConfig;

  // ── Actions ────────────────────────────────────────────
  /** Actions for the current step. */
  actions?: Action[];

  // ── Content ────────────────────────────────────────────
  /** Current step form or configuration content. */
  children?: ReactNode;

  // ── Diagnostics ────────────────────────────────────────
  /** Collapsible diagnostics content at the bottom. */
  diagnostics?: ReactNode;
  /** Diagnostics section title. Defaults to "Setup diagnostics". */
  diagnosticsTitle?: string;

  // ── Mode ───────────────────────────────────────────────
  /** Density variant. */
  density?: Density;
};

/**
 * SetupWorkflowPage — a page template for guided setup flows.
 *
 * Renders a header with eyebrow, a progress bar, attention items (blockers),
 * the current step's content with actions, and a collapsed diagnostics
 * section at the bottom.
 *
 * @example
 * ```tsx
 * <SetupWorkflowPage
 *   eyebrow="Setup"
 *   title="System Configuration"
 *   currentStep={2}
 *   totalSteps={5}
 *   stepLabel="Configure Provider"
 *   actions={[
 *     { label: "Continue", kind: "primary", intent: "configure", onClick: handleContinue },
 *   ]}
 * >
 *   <ProviderConfigForm />
 * </SetupWorkflowPage>
 * ```
 */
export function SetupWorkflowPage({
  eyebrow,
  title,
  description,
  currentStep,
  totalSteps,
  stepLabel,
  attentionItems,
  emptyState,
  actions,
  children,
  diagnostics,
  diagnosticsTitle = "Setup diagnostics",
  density = "default",
}: SetupWorkflowPageProps) {
  const compact = density === "compact";
  const progressPercent = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;

  // ── Derive display elements from attention model ──────
  const blockerItems = attentionItems ? heroItems(attentionItems) : [];
  const diagnosticAttention = attentionItems ? advancedItems(attentionItems) : [];

  // Validate action rules (dev-mode warning only)
  if (import.meta.env.DEV && actions) {
    const validation = validateActions(actions, "detail");
    if (!validation.valid) {
      console.warn("[SetupWorkflowPage] Action rule violations:", validation.violations);
    }
  }

  return (
    <section className="fg-page">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      {/* ── Progress bar ── */}
      <Section
        title={`Step ${currentStep} of ${totalSteps}${stepLabel ? `: ${stepLabel}` : ""}`}
        description={`${progressPercent}% complete`}
        className={compact ? "ff-dense" : undefined}
      >
        <div
          className="h-2 rounded-full bg-surface-subtle overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.max(1, Math.min(currentStep, totalSteps))}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-label={`Step ${currentStep} of ${totalSteps}`}
        >
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </Section>

      {/* ── Blockers ── */}
      {blockerItems.length > 0
        ? blockerItems.map((item) => (
            <div key={item.key} className="mb-3">
              <PrimaryBlockerCallout
                title={item.title}
                description={item.description}
                tone={item.tone ?? toneForLevel(item.level)}
              />
            </div>
          ))
        : null}

      {/* ── Step content or empty state ── */}
      {emptyState ? (
        <EmptyState
          title={emptyState.title}
          description={emptyState.description}
          primaryAction={emptyState.action}
        />
      ) : (
        <Section className={compact ? "ff-dense" : undefined}>
          {children ? <div className="flex flex-col gap-4">{children}</div> : null}
          {actions && actions.length > 0 ? (
            <div className="flex items-center gap-2 justify-end mt-4">
              {actions.map((action) => {
                const kind = action.kind ?? "secondary";
                return (
                  <Button
                    key={action.label}
                    variant={kind}
                    isDisabled={action.disabled}
                    onPress={action.onClick}
                  >
                    {action.label}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </Section>
      )}

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
