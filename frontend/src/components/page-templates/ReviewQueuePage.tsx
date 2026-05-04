import type { ReactNode } from "react";

import { PageHeader } from "../ui/PageHeader";
import { Section } from "../ui/Section";
import { SummaryStrip } from "../ui/SummaryStrip";
import type { SummaryStripItem } from "../ui/SummaryStrip";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import type { Density } from "../ui/types";
import type { Action } from "../ui/models/action";
import { validateActions } from "../ui/models/action";
import type { AttentionPayload } from "../ui/models/attention";
import { renderBlockers, renderVisibleAttention, renderCollapsedAttention, renderDiagnosticAttention } from "./shared";

/**
 * Props for the ReviewQueuePage template.
 */
export type ReviewQueuePageProps = {
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

  // ── Queue summary ────────────────────────────────────────
  /** Summary strip items. Pending count should be most prominent. */
  summaryItems?: SummaryStripItem[];

  // ── Queue table ──────────────────────────────────────────
  /** The review queue table or list content. */
  children?: ReactNode;
  /** Actions for this page (review, approve, reject, etc.). */
  actions?: Action[];


  // ── Empty state ──────────────────────────────────────────
  /** When true, renders an empty state instead of the table. */
  isEmpty?: boolean;
  /** Empty state title. */
  emptyTitle?: string;
  /** Empty state description. */
  emptyDescription?: string;
  /** Empty state action to show reviewed/all items. */
  emptyAction?: ReactNode;

  // ── Detail drawer ────────────────────────────────────────
  /** Content for the selected review item detail. */
  selectedItemContent?: ReactNode;
  /**
   * Whether an item is selected.
   * When true, renders {@link selectedItemContent}; emptyDetailHint is hidden.
   */
  hasSelection?: boolean;
  /**
   * Hint shown when no item is selected.
   * Only rendered when hasSelection is false.
   */
  emptyDetailHint?: string;

  // ── Diagnostics ──────────────────────────────────────────
  /** Collapsible diagnostics at the bottom. */
  diagnostics?: ReactNode;
  /** Diagnostics section title. Defaults to "Review diagnostics". */
  diagnosticsTitle?: string;

  // ── Mode ─────────────────────────────────────────────────
  /** Density variant. */
  density?: Density;
};

/**
 * ReviewQueuePage — a page template for reviewing, approving, rejecting,
 * or triaging items in a queue.
 *
 * Renders a header, attention items, queue status summary, action buttons,
 * a review table (or empty state), a detail section for the selected item,
 * and a collapsed diagnostics section at the bottom.
 *
 * @example
 * ```tsx
 * <ReviewQueuePage
 *   eyebrow="Work"
 *   title="Learning Review"
 *   description="Review learning events for promotion"
 *   actions={[
 *     { label: "Review pending", kind: "primary", intent: "review", onClick: handleReviewAll },
 *     { label: "Run diagnostics", kind: "secondary", intent: "diagnose", onClick: handleDiagnostics },
 *   ]}
 *   summaryItems={[
 *     { key: "pending", label: "Pending", value: 12, tone: "warning" },
 *     { key: "overdue", label: "Overdue", value: 3, tone: "danger" },
 *   ]}
 *   selectedItemContent={<ReviewDetailDrawer />}
 *   hasSelection={selectedId != null}
 *   emptyDetailHint="Select an item from the queue to review its details."
 * >
 *   <DataTable ... />
 * </ReviewQueuePage>
 * ```
 */
export function ReviewQueuePage({
  eyebrow,
  title,
  description,
  attentionItems,
  summaryItems,
  children,
  actions,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyAction,
  selectedItemContent,
  hasSelection,
  emptyDetailHint,
  diagnostics,
  diagnosticsTitle = "Review diagnostics",
  density = "default",
}: ReviewQueuePageProps) {
  const compact = density === "compact";

  // ── Derive display elements from attention model ────────

  // Validate action rules (dev-mode warning only)
  if (import.meta.env.DEV && actions) {
    const validation = validateActions(actions, isEmpty ? "detail" : "summary");
    if (!validation.valid) {
      console.warn("[ReviewQueuePage] Action rule violations:", validation.violations);
    }
  }

  return (
    <section className="fg-page">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      {/* ── Blockers (always visible) ── */}
      {renderBlockers(attentionItems)}

      {/* ── Visible attention items ── */}
      {renderVisibleAttention(attentionItems)}

      {/* ── Queue summary ── */}
      {summaryItems && summaryItems.length > 0 ? (
        <SummaryStrip items={summaryItems} />
      ) : null}

      {/* ── Actions ── */}
      {actions && actions.length > 0 ? (
        <div className={`flex flex-wrap items-center gap-2 ${compact ? "mb-2" : "mb-3"}`}>
          {actions.map((action) => {
            const kind = action.kind ?? "secondary";
            return (
              <Button
                key={action.label}
                variant={kind}
                isDisabled={action.disabled}
                onPress={action.onClick}
                title={action.description}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
      ) : null}

      {/* ── Queue table or empty state ── */}
      {isEmpty ? (
        <EmptyState
          title={emptyTitle ?? "No pending items"}
          description={emptyDescription ?? "All items have been reviewed."}
          primaryAction={emptyAction}
        />
      ) : (
        <Section className={compact ? "ff-dense" : undefined}>
          {children}
        </Section>
      )}

      {/* ── Selected item detail ── */}
      {hasSelection && selectedItemContent ? (
        <div className={`${compact ? "mt-3" : "mt-4"}`}>
          {selectedItemContent}
        </div>
      ) : null}

      {/* ── Empty detail hint ── */}
      {!hasSelection && emptyDetailHint ? (
        <div className={`${compact ? "mt-3" : "mt-4"} text-meta text-muted text-center py-4 border border-dashed border-border rounded-lg`}>
          {emptyDetailHint}
        </div>
      ) : null}

      {/* ── Collapsed attention (informational / healthy) ── */}
      {renderCollapsedAttention(attentionItems)}

      {/* ── Diagnostics ── */}
      {renderDiagnosticAttention(attentionItems, diagnosticsTitle, diagnostics)}
    </section>
  );
}
