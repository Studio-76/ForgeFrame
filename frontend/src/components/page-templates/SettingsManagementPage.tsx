import type { ReactNode } from "react";

import { PageHeader } from "../ui/PageHeader";
import { Section } from "../ui/Section";
import { AdvancedDiagnostics } from "../ui/AdvancedDiagnostics";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import type { Density } from "../ui/types";
import type { Action } from "../ui/models/action";
import { validateActions } from "../ui/models/action";
import type { AttentionPayload } from "../ui/models/attention";
import { groupAttentionItems, toneForLevel } from "../ui/models/attention";
import { PrimaryBlockerCallout } from "../ui/PrimaryBlockerCallout";

/**
 * Props for the SettingsManagementPage template.
 */
export type SettingsManagementPageProps = {
  /** Page header eyebrow (defaults to "Settings"). */
  eyebrow?: string;
  /** Page title. */
  title: string;
  /** Page description. */
  description?: string;

  // ── Attention ─────────────────────────────────────────
  /**
   * Attention-tagged items.
   * primary_blocker → blocker callout, diagnostic → AdvancedDiagnostics.
   */
  attentionItems?: AttentionPayload[];

  // ── Settings inventory ───────────────────────────────────
  /** The settings group list or inventory content. */
  children?: ReactNode;
  /** Actions for the settings page (e.g. edit, reset). */
  actions?: Action[];

  // ── Detail panel ─────────────────────────────────────────
  /** Content for the selected settings group detail. */
  selectedGroupContent?: ReactNode;
  /** Whether a settings group is selected. */
  hasSelection?: boolean;

  // ── Empty state ──────────────────────────────────────────
  /** When true, renders an empty state. */
  isEmpty?: boolean;
  /** Empty state title. */
  emptyTitle?: string;
  /** Empty state description. */
  emptyDescription?: string;
  /** Empty state primary action. */
  emptyAction?: ReactNode;

  // ── Search ───────────────────────────────────────────────
  /** Optional search input rendered above the inventory. */
  searchControl?: ReactNode;

  // ── Diagnostics ──────────────────────────────────────────
  /** Collapsible diagnostics at the bottom with raw config data. */
  diagnostics?: ReactNode;
  /** Diagnostics section title. Defaults to "System diagnostics". */
  diagnosticsTitle?: string;

  // ── Mode ─────────────────────────────────────────────────
  /** Density variant. */
  density?: Density;
};

/**
 * SettingsManagementPage — a page template for system configuration pages.
 *
 * Renders a header with "Settings" eyebrow, attention items, a settings
 * inventory (groups list), optional search, actions, a detail panel for
 * the selected group, and a collapsed diagnostics section at the bottom
 * with raw config data.
 *
 * @example
 * ```tsx
 * <SettingsManagementPage
 *   title="System Settings"
 *   description="Environment-level configuration and defaults"
 *   actions={[
 *     { label: "Reset to defaults", kind: "destructive", intent: "configure", onClick: handleReset },
 *   ]}
 *   searchControl={<SearchInput ... />}
 *   selectedGroupContent={<SettingDetailPanel />}
 *   hasSelection={selectedGroup != null}
 * >
 *   <SettingsInventory groups={settingsGroups} />
 * </SettingsManagementPage>
 * ```
 */
export function SettingsManagementPage({
  eyebrow = "Settings",
  title,
  description,
  attentionItems,
  children,
  actions,
  selectedGroupContent,
  hasSelection,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyAction,
  searchControl,
  diagnostics,
  diagnosticsTitle = "System diagnostics",
  density = "default",
}: SettingsManagementPageProps) {
  const compact = density === "compact";

  // ── Derive display elements from attention model ──────
  const { blockers: blockerItems, visible: visibleAttention, collapsed: collapsedAttention, advanced: diagnosticAttention } = groupAttentionItems(attentionItems);

  // Validate action rules (dev-mode warning only)
  if (import.meta.env.DEV && actions) {
    const validation = validateActions(actions, "detail");
    if (!validation.valid) {
      console.warn("[SettingsManagementPage] Action rule violations:", validation.violations);
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
              className="ff-status-badge"
              data-tone={item.tone ?? toneForLevel(item.level)}
            >
              {item.title}
            </span>
          ))}
        </div>
      ) : null}

      {/* ── Actions ── */}
      {actions && actions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 mb-3">
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

      {/* ── Search ── */}
      {searchControl ? (
        <div className={`${compact ? "mb-2" : "mb-3"}`}>
          {searchControl}
        </div>
      ) : null}

      {/* ── Settings inventory or empty state ── */}
      {isEmpty ? (
        <EmptyState
          title={emptyTitle ?? "No settings available"}
          description={emptyDescription}
          primaryAction={emptyAction}
        />
      ) : (
        <Section
          title="Settings"
          className={compact ? "ff-dense" : undefined}
        >
          {children}
        </Section>
      )}

      {/* ── Selected group detail ── */}
      {hasSelection && selectedGroupContent ? (
        <div className={`${compact ? "mt-3" : "mt-4"}`}>
          {selectedGroupContent}
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
