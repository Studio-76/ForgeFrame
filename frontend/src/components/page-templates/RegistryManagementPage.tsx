import type { ReactNode } from "react";

import { PageHeader } from "../ui/PageHeader";
import { Section } from "../ui/Section";
import { SummaryStrip } from "../ui/SummaryStrip";
import type { SummaryStripItem } from "../ui/SummaryStrip";
import { AdvancedDiagnostics } from "../ui/AdvancedDiagnostics";
import { EmptyState } from "../ui/EmptyState";
import { SearchInput } from "../ui/SearchInput";
import { Button } from "../ui/Button";
import { ActionBar } from "../ui/ActionBar";
import type { Density } from "../ui/types";

/**
 * A search configuration for the registry page.
 */
export type RegistrySearchConfig = {
  /** Current search value. */
  value: string;
  /** Called when the search value changes. */
  onChange: (value: string) => void;
  /** Placeholder text for the search input. */
  placeholder?: string;
};

/**
 * A scope indicator configuration for multi-instance context.
 */
export type ScopeConfig = {
  /** Current scope label (e.g. "prod-instance"). */
  label: string;
  /** Called to change scope. */
  onChange?: () => void;
};

/**
 * Props for the RegistryManagementPage template.
 */
export type RegistryManagementPageProps = {
  /** Page header eyebrow (category). */
  eyebrow?: string;
  /** Page title. */
  title: string;
  /** Page description. */
  description?: string;

  // ── Scope ────────────────────────────────────────────────
  /** When set, shows a compact scope indicator. */
  scope?: ScopeConfig;

  // ── Summary ──────────────────────────────────────────────
  /** Summary strip items showing non-zero counts. */
  summaryItems?: SummaryStripItem[];

  // ── Search / filter ──────────────────────────────────────
  /** Optional search input config. */
  search?: RegistrySearchConfig;
  /** Optional filter content rendered inline after search. */
  filterContent?: ReactNode;

  // ── Table / registry content ─────────────────────────────
  /** The registry table or content. */
  children?: ReactNode;
  /** Single primary action (usually "Create" or "Add"). */
  primaryAction?: ReactNode;
  /** Title for the ActionBar section. Defaults to the page title. */
  actionBarTitle?: string;

  // ── Empty state ──────────────────────────────────────────
  /** When true, renders the empty state instead of the table. */
  isEmpty?: boolean;
  /** Empty state title. */
  emptyTitle?: string;
  /** Empty state description. */
  emptyDescription?: string;
  /** Empty state primary action. */
  emptyAction?: ReactNode;

  // ── Detail panel ─────────────────────────────────────────
  /** Content for the selected-item detail panel. */
  selectedItemContent?: ReactNode;
  /**
   * Whether an item is currently selected.
   * When true, renders {@link selectedItemContent}; emptyDetailHint is hidden.
   */
  hasSelection?: boolean;
  /**
   * Hint shown when no item is selected (e.g. "Select an item from the table").
   * Only rendered when hasSelection is false.
   */
  emptyDetailHint?: string;

  // ── Diagnostics ──────────────────────────────────────────
  /** Collapsible diagnostics content at the bottom. */
  diagnostics?: ReactNode;
  /** Diagnostics section title. Defaults to "Registry diagnostics". */
  diagnosticsTitle?: string;

  // ── Mode ─────────────────────────────────────────────────
  /** Density variant. */
  density?: Density;
};

/**
 * RegistryManagementPage — a page template for browse-filter-manage inventory pages.
 *
 * Renders a header, optional scope compact bar, summary strip, search/filter controls,
 * a registry table (or empty state), a detail panel for the selected item, and a
 * collapsed diagnostics section at the bottom.
 *
 * @example
 * ```tsx
 * <RegistryManagementPage
 *   eyebrow="Setup"
 *   title="Provider Targets"
 *   description="Active execution targets for routing"
 *   summaryItems={[
 *     { key: "total", label: "Total", value: 12 },
 *     { key: "active", label: "Active", value: 8, tone: "success" },
 *   ]}
 *   search={{ value: searchTerm, onChange: setSearchTerm }}
 *   primaryAction={<Button variant="primary">Add target</Button>}
 *   selectedItemContent={<TargetDetailPanel />}
 *   hasSelection={selectedId != null}
 *   emptyDetailHint="Select a target from the table to inspect its configuration."
 * >
 *   <DataTable ... />
 * </RegistryManagementPage>
 * ```
 */
export function RegistryManagementPage({
  eyebrow,
  title,
  description,
  scope,
  summaryItems,
  search,
  filterContent,
  children,
  primaryAction,
  actionBarTitle,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyAction,
  selectedItemContent,
  hasSelection,
  emptyDetailHint,
  diagnostics,
  diagnosticsTitle = "Registry diagnostics",
  density = "default",
}: RegistryManagementPageProps) {
  const compact = density === "compact";

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

      {/* ── Summary strip ── */}
      {summaryItems && summaryItems.length > 0 ? (
        <SummaryStrip items={summaryItems} />
      ) : null}

      {/* ── Search / filter ── */}
      {search || filterContent ? (
        <div className={`flex flex-wrap items-center gap-2 ${compact ? "mb-2" : "mb-3"}`}>
          {search ? (
            <SearchInput
              value={search.value}
              onChange={search.onChange}
              placeholder={search.placeholder ?? "Search..."}
            />
          ) : null}
          {filterContent ? <div className="flex items-center gap-2">{filterContent}</div> : null}
        </div>
      ) : null}

      {/* ── Main content: table (with ActionBar) or empty state ── */}
      {isEmpty ? (
        <EmptyState
          title={emptyTitle ?? "No items found"}
          description={emptyDescription}
          primaryAction={emptyAction}
        />
      ) : (
        <ActionBar
          title={actionBarTitle ?? title}
          actions={primaryAction}
        >
          <div className={compact ? "ff-dense" : undefined}>
            {children}
          </div>
        </ActionBar>
      )}

      {/* ── Detail panel ── */}
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
