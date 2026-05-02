import type { MutableSettingEntry } from "../../api/admin";
import { CATEGORY_LABELS, type CategoryFilter } from "./types";
import { formatSettingValue, riskTone, sourceDescription, sourceTone } from "./utils";

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
 * Settings list panel with search, category filter, high-risk toggle,
 * and grouped settings display. Each setting shows human-readable label,
 * effective value (truncated), override/default status, and risk level.
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
  groupedSettings,
  selectedKey,
  onSelect,
  hiddenHighRiskCount,
}: SettingsListProps) {
  const totalFiltered = groupedSettings.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="ff-settings-inventory">
      <div className="ff-settings-inventory-header">
        <div className="ff-settings-inventory-header-copy">
          <h3>Settings</h3>
          <p className="fg-muted">{totalFiltered} of {totalCount} settings shown</p>
        </div>
      </div>

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

      {loadState === "loading" ? (
        <div className="ff-settings-loading">
          <p className="fg-muted">Loading settings…</p>
        </div>
      ) : null}

      {loadState === "success" && totalFiltered === 0 ? (
        <div className="ff-settings-empty">
          <strong>No settings match your filters</strong>
          <p className="fg-muted">
            {searchText
              ? "Try a different search term or clear the search."
              : "Try selecting a different category or enabling high-risk settings."}
          </p>
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className="ff-settings-empty" data-tone="error">
          <strong>Failed to load settings</strong>
          <p className="fg-muted">Check the system status and try again.</p>
        </div>
      ) : null}

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
                const overrideState = sourceDescription(item.source, item.overridden);
                const overrideActive = item.source === "override" && item.overridden;

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
                      <span className="ff-settings-item-key">{item.key}</span>
                    </div>
                    <div className="ff-settings-item-meta">
                      <span className="ff-settings-item-value" title={formatSettingValue(item.effective_value)}>
                        {formatSettingValue(item.effective_value)}
                      </span>
                      <span
                        className={`ff-settings-item-source${overrideActive ? " is-override" : ""}`}
                        title={item.source_label}
                      >
                        {overrideState}
                      </span>
                      <span
                        className="ff-settings-item-risk"
                        data-tone={riskTone(item.risk_level)}
                        title={item.risk_label}
                      >
                        {item.risk_label}
                      </span>
                    </div>
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
