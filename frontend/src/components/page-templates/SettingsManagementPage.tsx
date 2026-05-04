import type { ReactNode } from "react";

import { PageHeader } from "../ui/PageHeader";
import { Section } from "../ui/Section";
import { AdvancedDiagnostics } from "../ui/AdvancedDiagnostics";
import { EmptyState } from "../ui/EmptyState";
import type { Density } from "../ui/types";

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

  // ── Settings inventory ───────────────────────────────────
  /** The settings group list or inventory content. */
  children?: ReactNode;

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
 * Renders a header with "Settings" eyebrow, a settings inventory (groups list),
 * optional search, a detail panel for the selected group, and a collapsed
 * diagnostics section at the bottom with raw config data.
 *
 * @example
 * ```tsx
 * <SettingsManagementPage
 *   title="System Settings"
 *   description="Environment-level configuration and defaults"
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
  children,
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

  return (
    <section className="fg-page">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

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

      {/* ── Diagnostics ── */}
      {diagnostics ? (
        <AdvancedDiagnostics title={diagnosticsTitle}>
          {diagnostics}
        </AdvancedDiagnostics>
      ) : null}
    </section>
  );
}
