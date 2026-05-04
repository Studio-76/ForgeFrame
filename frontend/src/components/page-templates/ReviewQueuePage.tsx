import type { ReactNode } from "react";

import { PageHeader } from "../ui/PageHeader";
import { Section } from "../ui/Section";
import { SummaryStrip } from "../ui/SummaryStrip";
import type { SummaryStripItem } from "../ui/SummaryStrip";
import { AdvancedDiagnostics } from "../ui/AdvancedDiagnostics";
import { EmptyState } from "../ui/EmptyState";
import type { Density } from "../ui/types";

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

  // ── Queue summary ────────────────────────────────────────
  /** Summary strip items. Pending count should be most prominent. */
  summaryItems?: SummaryStripItem[];

  // ── Queue table ──────────────────────────────────────────
  /** The review queue table or list content. */
  children?: ReactNode;
  /** Single primary action (e.g. "Review all"). */
  primaryAction?: ReactNode;

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
 * Renders a header, queue status summary, a review table (or empty state),
 * a detail section for the selected item, and a collapsed diagnostics
 * section at the bottom.
 *
 * @example
 * ```tsx
 * <ReviewQueuePage
 *   eyebrow="Work"
 *   title="Learning Review"
 *   description="Review learning events for promotion"
 *   summaryItems={[
 *     { key: "pending", label: "Pending", value: 12, tone: "warning" },
 *     { key: "overdue", label: "Overdue", value: 3, tone: "danger" },
 *     { key: "total", label: "Total", value: 45 },
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
  summaryItems,
  children,
  primaryAction,
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

  return (
    <section className="fg-page">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      {/* ── Queue summary ── */}
      {summaryItems && summaryItems.length > 0 ? (
        <SummaryStrip items={summaryItems} />
      ) : null}

      {/* ── Primary action ── */}
      {primaryAction ? (
        <div className={`flex justify-end ${compact ? "mb-2" : "mb-3"}`}>
          {primaryAction}
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

      {/* ── Diagnostics ── */}
      {diagnostics ? (
        <AdvancedDiagnostics title={diagnosticsTitle}>
          {diagnostics}
        </AdvancedDiagnostics>
      ) : null}
    </section>
  );
}
