import type { ReactNode } from "react";

import { PageHeader } from "../ui/PageHeader";
import { PrimaryBlockerCallout } from "../ui/PrimaryBlockerCallout";
import { Section } from "../ui/Section";
import { AdvancedDiagnostics } from "../ui/AdvancedDiagnostics";
import { EmptyState } from "../ui/EmptyState";
import { ActionBar } from "../ui/ActionBar";
import type { Density } from "../ui/types";

/**
 * A blocker configuration for when the workflow is blocked.
 * Shows what's wrong, why it matters, and what to do about it.
 */
export type BlockerConfig = {
  /** What is wrong. */
  title: string;
  /** Why it matters. */
  description?: string;
  /** Action to resolve the blocker. */
  action?: ReactNode;
};

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

  // ── Blocker ───────────────────────────────────────────
  /** When set, renders a PrimaryBlockerCallout above the step content. */
  blocker?: BlockerConfig;

  // ── Empty state ────────────────────────────────────────
  /** When set, renders an EmptyState instead of the step content. */
  emptyState?: EmptyStateConfig;

  // ── Actions ────────────────────────────────────────────
  /** Single primary action for the current step. */
  primaryAction?: ReactNode;

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
 * Renders a header with eyebrow, a progress bar, the current step's
 * content, an optional blocker callout, and a collapsed diagnostics
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
 *   primaryAction={<Button variant="primary">Continue</Button>}
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
  blocker,
  emptyState,
  primaryAction,
  children,
  diagnostics,
  diagnosticsTitle = "Setup diagnostics",
  density = "default",
}: SetupWorkflowPageProps) {
  const compact = density === "compact";
  const progressPercent = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;

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

      {/* ── Blocker ── */}
      {blocker ? (
        <PrimaryBlockerCallout
          title={blocker.title}
          description={blocker.description}
          action={blocker.action}
        />
      ) : null}

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
          {primaryAction ? (
            <div className="flex justify-end mt-4">{primaryAction}</div>
          ) : null}
        </Section>
      )}

      {/* ── Diagnostics ── */}
      {diagnostics ? (
        <AdvancedDiagnostics title={diagnosticsTitle}>
          {diagnostics}
        </AdvancedDiagnostics>
      ) : null}
    </section>
  );
}
