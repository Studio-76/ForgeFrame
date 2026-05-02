/**
 * Instance inventory table with filters.
 *
 * @packageDocumentation
 */

import type { InstanceRecord } from "../../api/domain/instances";
import {
  toneForSetupStatus,
  formatReadinessSummary,
} from "./utils";
import type {
  LoadState,
  StatusFilter,
  ModeFilter,
  ReadinessFilter,
} from "./types";

/**
 * Props for the InstanceInventoryTable component.
 */
export type InstanceInventoryTableProps = {
  /** Current load state. */
  loadState: LoadState;
  /** All loaded instances. */
  instances: InstanceRecord[];
  /** Filtered instances for display. */
  filteredInstances: InstanceRecord[];
  /** The currently selected instance. */
  selectedInstance: InstanceRecord | null;
  /** Search input value. */
  searchValue: string;
  /** Status filter value. */
  statusFilter: StatusFilter;
  /** Mode filter value. */
  modeFilter: ModeFilter;
  /** Readiness filter value. */
  readinessFilter: ReadinessFilter;
  /** Scope filter value. */
  scopeFilter: string;
  /** Whether the scoped instance is filtered out of view. */
  scopedInstanceFilteredOut: boolean;
  /** Refresh the instance list. */
  onRefresh: () => void;
  /** Select an instance. */
  onSelectInstance: (instanceId: string) => void;
  /** Update search value. */
  onSearchChange: (value: string) => void;
  /** Update status filter. */
  onStatusFilterChange: (value: StatusFilter) => void;
  /** Update mode filter. */
  onModeFilterChange: (value: ModeFilter) => void;
  /** Update readiness filter. */
  onReadinessFilterChange: (value: ReadinessFilter) => void;
  /** Update scope filter. */
  onScopeFilterChange: (value: string) => void;
};

/**
 * Instance inventory table with filter controls.
 */
export function InstanceInventoryTable({
  loadState,
  instances,
  filteredInstances,
  selectedInstance,
  searchValue,
  statusFilter,
  modeFilter,
  readinessFilter,
  scopeFilter,
  scopedInstanceFilteredOut,
  onRefresh,
  onSelectInstance,
  onSearchChange,
  onStatusFilterChange,
  onModeFilterChange,
  onReadinessFilterChange,
  onScopeFilterChange,
}: InstanceInventoryTableProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Instance Inventory</h3>
          <p className="fg-muted">
            Filter the registry, select an instance, and inspect its readiness
            state below.
          </p>
        </div>
        <div className="fg-actions">
          <span
            className="fg-pill"
            data-tone={
              loadState === "success"
                ? "success"
                : loadState === "error"
                  ? "danger"
                  : "neutral"
            }
          >
            {loadState}
          </span>
          <button type="button" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>

      <div className="fg-inline-form fg-mb-sm">
        <label>
          Search
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="ID, name, operator, reason"
          />
        </label>
        <label>
          Status
          <select
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(event.target.value as StatusFilter)
            }
          >
            <option value="all">all</option>
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
        </label>
        <label>
          Mode
          <select
            value={modeFilter}
            onChange={(event) =>
              onModeFilterChange(event.target.value as ModeFilter)
            }
          >
            <option value="all">all</option>
            <option value="linux_host_native">linux_host_native</option>
            <option value="restricted_eval">restricted_eval</option>
            <option value="container_optional">container_optional</option>
          </select>
        </label>
        <label>
          Tenant
          <input
            value={scopeFilter}
            onChange={(event) => onScopeFilterChange(event.target.value)}
            placeholder="tenant or execution scope"
          />
        </label>
        <label>
          Readiness
          <select
            value={readinessFilter}
            onChange={(event) =>
              onReadinessFilterChange(
                event.target.value as ReadinessFilter,
              )
            }
          >
            <option value="all">all</option>
            <option value="ready">ready</option>
            <option value="not-ready">not-ready</option>
            <option value="bridge-only">bridge-only</option>
            <option value="onboarding-only">onboarding-only</option>
            <option value="unsupported">unsupported</option>
          </select>
        </label>
      </div>

      {loadState === "loading" ? (
        <p className="fg-muted">Loading instance inventory.</p>
      ) : null}
      {loadState === "success" && instances.length === 0 ? (
        <p className="fg-muted">
          No instances are recorded yet. Use the create form below to add the
          first one.
        </p>
      ) : null}
      {loadState === "success" &&
      instances.length > 0 &&
      filteredInstances.length === 0 ? (
        <p className="fg-muted">No instances match the current filters.</p>
      ) : null}
      {scopedInstanceFilteredOut ? (
        <p className="fg-note">
          The current scoped instance{" "}
          <span className="fg-code">
            {selectedInstance?.instance_id}
          </span>{" "}
          is outside the filtered table. Clear or change filters to bring it
          back into the inventory list.
        </p>
      ) : null}

      {filteredInstances.length > 0 ? (
        <div className="fg-table-wrap">
          <table className="fg-table">
            <thead>
              <tr>
                <th>Instance</th>
                <th>Scope</th>
                <th>Mode</th>
                <th>Readiness</th>
                <th>Operator</th>
              </tr>
            </thead>
            <tbody>
              {filteredInstances.map((item) => {
                const isSelected =
                  item.instance_id === selectedInstance?.instance_id;
                return (
                  <tr
                    key={item.instance_id}
                    className={isSelected ? "is-selected" : ""}
                  >
                    <td>
                      <button
                        className="fg-table-trigger"
                        type="button"
                        onClick={() => onSelectInstance(item.instance_id)}
                      >
                        <strong>{item.display_name}</strong>
                      </button>
                      <div className="fg-muted">
                        <span className="fg-code">{item.instance_id}</span>
                        {item.is_default ? " · default" : ""}
                        {item.status === "disabled" ? " · disabled" : ""}
                      </div>
                    </td>
                    <td>
                      <div>{item.tenant_id}</div>
                      {item.company_id ? (
                        <div className="fg-muted">{item.company_id}</div>
                      ) : null}
                    </td>
                    <td>
                      <div>{item.deployment_mode}</div>
                      <div className="fg-muted">
                        {item.exposure_mode}
                      </div>
                    </td>
                    <td>
                      <span
                        className="fg-pill"
                        data-tone={toneForSetupStatus(
                          item.readiness?.status,
                        )}
                      >
                        {item.readiness?.status ?? "unknown"}
                      </span>
                      <div className="fg-muted">
                        {formatReadinessSummary(item.readiness)}
                      </div>
                    </td>
                    <td>
                      {item.operator_agent?.display_name ? (
                        <div>{item.operator_agent.display_name}</div>
                      ) : (
                        <div className="fg-danger">Missing Operator</div>
                      )}
                      <div className="fg-muted">
                        {item.operator_agent?.reason ??
                          "No operator detail."}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}
