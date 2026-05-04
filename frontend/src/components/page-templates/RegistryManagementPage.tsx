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
import type { Action } from "../ui/models/action";
import { validateActions, defaultKindForIntent } from "../ui/models/action";
import type { AttentionPayload } from "../ui/models/attention";
import { groupAttentionItems, toneForLevel } from "../ui/models/attention";
import { PrimaryBlockerCallout } from "../ui/PrimaryBlockerCallout";

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

  // ── Attention items ──────────────────────────────────────
  /**
   * Attention-tagged status items.
   * primary_blocker → blocker callout, needs_action/warning → visible,
   * informational/healthy → collapsed, diagnostic → AdvancedDiagnostics.
   */
  attentionItems?: AttentionPayload[];

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
  /**
   * Shared actions for this page.
   * At most one primary action is allowed in the page summary.
   * Diagnostic actions are visually secondary.
   */
  actions?: Action[];
  /**
   * Legacy single primary action ReactNode.
   * Use `actions` for new code. When both are set, `actions` takes precedence.
   */
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
 * Renders a header, optional scope compact bar, attention items (blockers/status),
 * summary strip, search/filter controls, a registry table (or empty state),
 * a detail panel for the selected item, and a collapsed diagnostics section
 * at the bottom.
 *
 * @example
 * ```tsx
 * <RegistryManagementPage
 *   eyebrow="Setup"
 *   title="Provider Targets"
 *   description="Active execution targets for routing"
 *   actions={[
 *     { label: "Add target", kind: "primary", intent: "configure", onClick: handleAdd },
 *   ]}
 *   summaryItems={[
 *     { key: "total", label: "Total", value: 12 },
 *     { key: "active", label: "Active", value: 8, tone: "success" },
 *   ]}
 *   search={{ value: searchTerm, onChange: setSearchTerm }}
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
  attentionItems,
  summaryItems,
  search,
  filterContent,
  children,
  actions,
  primaryAction: primaryActionProp,
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

  // ── Derive display elements from models ──────────────────
  const { blockers: blockerItems, visible: visibleAttention, collapsed: collapsedAttention, advanced: diagnosticAttention } = groupAttentionItems(attentionItems);

  const modelPrimaryAction = actions?.find(
    (a) => (a.kind ?? defaultKindForIntent(a.intent ?? "navigate")) === "primary",
  );
  const hasDiagnosticAction = actions?.some((a) => a.intent === "diagnose");

  // Validate action rules (dev-mode warning only)
  if (import.meta.env.DEV && actions) {
    const validation = validateActions(actions, isEmpty ? "detail" : "summary");
    if (!validation.valid) {
      console.warn("[RegistryManagementPage] Action rule violations:", validation.violations);
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

      {/* ── Blockers (always visible) ── */}
      {blockerItems.map((item) => (
        <div key={item.key} className="mb-3">
          <PrimaryBlockerCallout
            title={item.title}
            description={item.description}
            tone={item.tone ?? toneForLevel(item.level)}
          />
        </div>
      ))}

      {/* ── Visible attention items ── */}
      {visibleAttention.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-3">
          {visibleAttention.map((item) => (
            <span
              key={item.key}
              className={`ff-status-badge`}
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
          actions={
            modelPrimaryAction
              ? (
                <Button
                  variant={modelPrimaryAction.kind ?? "primary"}
                  isDisabled={modelPrimaryAction.disabled}
                  onPress={modelPrimaryAction.onClick}
                >
                  {modelPrimaryAction.label}
                </Button>
              )
              : primaryActionProp
          }
        >
          <div className={compact ? "ff-dense" : undefined}>
            {children}
          </div>
        </ActionBar>
      )}

      {/* ── Collapsed attention (informational / healthy) ── */}
      {collapsedAttention.length > 0 ? (
        <details className="ff-collapsed-details mt-3">
          <summary className="text-meta text-muted cursor-pointer font-medium">
            Status details ({collapsedAttention.length})
          </summary>
          <div className="flex flex-wrap gap-2 mt-2">
            {collapsedAttention.map((item) => (
              <span
                key={item.key}
                className={`ff-status-badge`}
                data-tone={item.tone ?? toneForLevel(item.level)}
              >
                {item.title}
              </span>
            ))}
          </div>
        </details>
      ) : null}

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
