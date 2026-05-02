import type { MutableSettingEntry } from "../../api/admin";
import { CATEGORY_LABELS, type CategoryFilter } from "./types";
import {
  formatBooleanLabel,
  formatSettingValue,
  riskTone,
  showRiskBadge,
  sourceDescription,
  statusKey,
} from "./utils";

/**
 * Props for the SettingsList component.
 */
export interface SettingsListProps {
  /** Search text filter value. */
  searchText: string;
  /** Callback to update search text. */
  onSearchChange: (value: string) => void;
  /** Current category filter value. */
  categoryFilter: CategoryFilter;
  /** Callback to update category filter. */
  onCategoryChange: (value: CategoryFilter) => void;
  /** Whether to show high-risk settings. */
  showHighRisk: boolean;
  /** Callback to toggle high-risk visibility. */
  onHighRiskToggle: (value: boolean) => void;
  /** Load state indicator. */
  loadState: "idle" | "loading" | "success" | "error";
  /** Total settings count (before filtering). */
  totalCount: number;
  /** Total overridden settings count (before filtering). */
  overriddenCount: number;
  /** Total high-risk settings count (before filtering). */
  highRiskCount: number;
  /** Filtered and grouped settings organized by category. */
  groupedSettings: Array<{
    category: string;
    label: string;
    items: MutableSettingEntry[];
  }>;
  /** Currently selected setting key. */
  selectedKey: string;
  /** Callback when a setting is clicked to select it. */
  onSelect: (key: string) => void;
  /** Count of hidden high-risk settings. */
  hiddenHighRiskCount: number;
}

/**
 * Settings inventory panel with summary stats, search, category filter,
 * and a clean grouped settings list.
 *
 * Shows human-readable values, concise source/danger indicators, and
 * hides raw keys behind secondary text. Low-risk settings do not display
 * a risk badge. Booleans are shown as Enabled/Disabled.
 */
export function SettingsList({
  searchText,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  showHighRisk,
  onHighRiskToggle,
  loadState,
  totalCount,
  overriddenCount,
  highRiskCount,
  groupedSettings,
  selectedKey,
  onSelect,
  hiddenHighRiskCount,
}: SettingsListProps) {
  const totalFiltered = groupedSettings.reduce((sum, g) => sum + g.items.length, 0);
  const defaultCount = totalCount - overriddenCount;

  return (
    <div className="ff-settings-inventory">
      {/* ── Summary stats bar ── */}
      <div className="ff-settings-summary">
        <div className="ff-settings-summary-stat">
          <span className="ff-settings-summary-stat-value">{totalCount}</span>
          <span className="ff-settings-summary-stat-label">Total</span>
        </div>
        {overriddenCount > 0 ? (
          <div className="ff-settings-summary-stat" data-tone="changed">
            <span className="ff-settings-summary-stat-value">{overriddenCount}</span>
            <span className="ff-settings-summary-stat-label">Overridden</span>
          </div>
        ) : null}
        <div className="ff-settings-summary-stat">
          <span className="ff-settings-summary-stat-value">{defaultCount}</span>
          <span className="ff-settings-summary-stat-label">Default</span>
        </div>
        {!showHighRisk && highRiskCount > 0 ? (
          <div className="ff-settings-summary-stat" data-tone="danger">
            <span className="ff-settings-summary-stat-value">{highRiskCount}</span>
            <span className="ff-settings-summary-stat-label">High-risk hidden</span>
          </div>
        ) : null}
      </div>

      {/* ── Header ── */}
      <div className="ff-settings-inventory-header">
        <div className="ff-settings-inventory-header-copy">
          <h3>Settings</h3>
          <p className="fg-muted">{totalFiltered} of {totalCount} settings shown</p>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="ff-settings-toolbar">
        <label className="ff-settings-search">
          <span className="ff-settings-search-label">Search settings</span>
          <div className="ff-settings-search-row">
            <span className="ff-settings-search-icon">&#x1F50D;</span>
            <input
              value={searchText}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by name, key, or description…"
              aria-label="Search settings"
            />
          </div>
        </label>

        <label className="ff-settings-filter-label">
          <span>Category</span>
          <select
            value={categoryFilter}
            onChange={(event) => onCategoryChange(event.target.value as CategoryFilter)}
            aria-label="Filter by category"
          >
            {(Object.entries(CATEGORY_LABELS) as [CategoryFilter, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        {hiddenHighRiskCount > 0 ? (
          <label className="ff-settings-toggle-label">
            <input
              type="checkbox"
              checked={showHighRisk}
              onChange={(event) => onHighRiskToggle(event.target.checked)}
              aria-label="Show high-risk settings"
            />
            <span>Show {hiddenHighRiskCount} high-risk setting{hiddenHighRiskCount === 1 ? "" : "s"}</span>
          </label>
        ) : null}
      </div>

      {/* ── Loading state ── */}
      {loadState === "loading" ? (
        <div className="ff-settings-loading">
          <p className="fg-muted">Loading settings…</p>
        </div>
      ) : null}

      {/* ── Empty state ── */}
      {loadState === "success" && totalFiltered === 0 ? (
        <div className="ff-settings-empty">
          {searchText ? (
            <>
              <strong>No matching settings</strong>
              <p className="fg-muted">
                No settings match "<strong>{searchText}</strong>". Try a different search term or clear the filter.
              </p>
              <button
                type="button"
                className="ff-settings-empty-action"
                onClick={() => onSearchChange("")}
              >
                Clear search
              </button>
            </>
          ) : categoryFilter !== "all" ? (
            <>
              <strong>No settings in this category</strong>
              <p className="fg-muted">
                Try selecting a different category or expanding to all settings.
              </p>
              <button
                type="button"
                className="ff-settings-empty-action"
                onClick={() => onCategoryChange("all")}
              >
                Show all categories
              </button>
            </>
          ) : !showHighRisk && highRiskCount > 0 ? (
            <>
              <strong>High-risk settings are hidden</strong>
              <p className="fg-muted">
                Some settings are filtered out because they are marked as high risk.
              </p>
              <button
                type="button"
                className="ff-settings-empty-action"
                onClick={() => onHighRiskToggle(true)}
              >
                Show high-risk settings
              </button>
            </>
          ) : (
            <>
              <strong>No settings found</strong>
              <p className="fg-muted">
                No settings match the current filters and search criteria.
              </p>
            </>
          )}
        </div>
      ) : null}

      {/* ── Error state ── */}
      {loadState === "error" ? (
        <div className="ff-settings-empty" data-tone="error">
          <strong>Failed to load settings</strong>
          <p className="fg-muted">Check the system status and try again.</p>
        </div>
      ) : null}

      {/* ── Grouped settings list ── */}
      <div className="ff-settings-groups">
        {groupedSettings.map((group) => (
          <div key={group.category} className="ff-settings-group">
            <div className="ff-settings-group-header">
              <span className="ff-settings-group-label">{group.label}</span>
              <span className="ff-settings-group-count">{group.items.length}</span>
            </div>
            <div className="ff-settings-list">
              {group.items.map((item) => {
                const isSelected = item.key === selectedKey;
                const sk = statusKey(item.source, item.overridden);
                const showRisk = showRiskBadge(item.risk_level);
                const displayValue = item.value_type === "bool"
                  ? formatBooleanLabel(item.effective_value)
                  : formatSettingValue(item.effective_value);

                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`ff-settings-item${isSelected ? " is-selected" : ""}`}
                    onClick={() => onSelect(item.key)}
                    aria-current={isSelected ? "true" : undefined}
                  >
                    <div className="ff-settings-item-main">
                      <span className="ff-settings-item-label">{item.label}</span>
                      {showRisk ? (
                        <span
                          className="ff-settings-item-badge"
                          data-tone={riskTone(item.risk_level)}
                          title={item.risk_label}
                        >
                          {item.risk_level === "high" ? "HIGH" : "MOD"}
                        </span>
                      ) : null}
                    </div>
                    <div className="ff-settings-item-meta">
                      <span
                        className="ff-settings-item-value"
                        title={formatSettingValue(item.effective_value)}
                      >
                        {displayValue}
                      </span>
                      <span
                        className={`ff-settings-item-status ff-settings-item-status--${sk}`}
                        title={item.source_label}
                      >
                        {sourceDescription(item.source, item.overridden)}
                      </span>
                      {item.group === "providers" ? (
                        <span className="ff-settings-item-context">Provider</span>
                      ) : null}
                    </div>
                    <span className="ff-settings-item-key">{item.key}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
