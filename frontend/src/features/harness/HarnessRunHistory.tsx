/**
 * Harness run history — collapsible run log with filters.
 *
 * Shows runs for the selected profile grouped by mode. Includes mode, status,
 * and client filters. Collapsed by default — the operator expands when
 * investigation is needed.
 */
import { useMemo } from "react";

import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import {
  asRecord,
  formatTimestamp,
  toStringValue,
} from "../providers/providersShared";
import type { ProvidersPageData } from "../providers/providersShared";
import {
  TonePill,
  toneFromStatus,
  formatHarnessMode,
} from "../providers/providersSectionUtils";
import { groupRunsByMode } from "./utils";

type HarnessRunHistoryProps = {
  runs: ProvidersPageData["runs"];
  runFilters: ProvidersPageData["runFilters"];
  runOps: ProvidersPageData["runOps"];
  runSummary: ProvidersPageData["runSummary"];
  instanceId?: string | null;
  profileLabel: string | null;
  showRunDetails: boolean;
  onToggleShowDetails: () => void;
  onSetFilter: (field: "mode" | "status" | "client" | "provider", value: string) => void;
};

/**
 * Collapsible run history with filters and grouped run display.
 */
export function HarnessRunHistory({
  runs,
  runFilters,
  runOps,
  runSummary,
  instanceId,
  profileLabel,
  showRunDetails,
  onToggleShowDetails,
  onSetFilter,
}: HarnessRunHistoryProps) {
  const groupedRuns = useMemo(() => groupRunsByMode(runs), [runs]);
  const lastFailedRun = asRecord(runOps.last_failed_run);
  const logSurfaceLink = withInstanceScope(CONTROL_PLANE_ROUTES.logs, instanceId);

  const filterOptions = {
    mode: [
      { value: "all", label: "all" },
      { value: "preview", label: "preview" },
      { value: "dry_run", label: "dry run" },
      { value: "verify", label: "verify" },
      { value: "probe", label: "probe" },
      { value: "runtime_non_stream", label: "runtime non-stream" },
      { value: "runtime_stream", label: "runtime stream" },
      { value: "sync", label: "sync" },
    ],
    status: [
      { value: "all", label: "all" },
      { value: "ok", label: "ok" },
      { value: "warning", label: "warning" },
      { value: "failed", label: "failed" },
    ],
    client: [
      { value: "all", label: "all" },
      { value: "runtime", label: "runtime" },
      { value: "control_plane", label: "control_plane" },
    ],
  };

  return (
    <details
      className="ff-collapse-section"
      open={runs.length > 0 && showRunDetails}
    >
      <summary onClick={onToggleShowDetails}>
        <div className="ff-collapse-summary-text">
          <h3>Run History</h3>
          <p>
            {runs.length} run{runs.length !== 1 ? "s" : ""}
            {profileLabel ? ` for ${profileLabel}` : ""}
            {" \u00B7 "}Filter by mode, status, or client below.
          </p>
        </div>
      </summary>
      <div className="ff-collapse-section-body">
        <div className="fg-stack">
          {/* Filters */}
          <div className="fg-grid fg-grid-compact">
            <label>
              Mode
              <select
                value={runFilters.mode}
                onChange={(e) => onSetFilter("mode", e.target.value)}
              >
                {filterOptions.mode.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={runFilters.status}
                onChange={(e) => onSetFilter("status", e.target.value)}
              >
                {filterOptions.status.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Client
              <select
                value={runFilters.client}
                onChange={(e) => onSetFilter("client", e.target.value)}
              >
                {filterOptions.client.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {lastFailedRun ? (
            <p className="fg-note">
              Last failed: {formatTimestamp(lastFailedRun.executed_at)}
              {" \u00B7 "}
              {toStringValue(lastFailedRun.provider_key)}
              {" \u00B7 "}
              {toStringValue(lastFailedRun.mode)}
              {" \u00B7 "}
              status={toStringValue(lastFailedRun.status)}
            </p>
          ) : null}

          {runs.length === 0 ? (
            <p className="fg-muted">
              No runs matched the current profile and filters.
            </p>
          ) : (
            <div className="fg-stack">
              {Object.entries(groupedRuns).map(([mode, modeRuns]) => (
                <div key={mode} className="ff-harness-run-group">
                  <div className="ff-harness-run-group-header">
                    <span>{formatHarnessMode(mode)}</span>
                    <span>
                      {modeRuns.length} run{modeRuns.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="ff-harness-run-group-body">
                    {modeRuns.slice(0, 3).map((run, index) => (
                      <div
                        key={`${toStringValue(run.run_id, "run")}-${index}`}
                        className="ff-harness-run-item"
                      >
                        <div className="ff-harness-detail-row">
                          <TonePill
                            label={run.status}
                            tone={toneFromStatus(run.status)}
                          />
                          <span>{formatTimestamp(run.executed_at)}</span>
                          <span>model={toStringValue(run.model)}</span>
                        </div>
                        <div
                          className="ff-nav-links"
                          style={{ border: 0, padding: 0 }}
                        >
                          <a className="fg-nav-link" href={logSurfaceLink}>
                            View logs
                          </a>
                          {run.run_id ? (
                            <span className="fg-muted">
                              id: {run.run_id.slice(0, 12)}...
                            </span>
                          ) : null}
                        </div>
                        {run.error ? (
                          <span className="fg-note">Error: {run.error}</span>
                        ) : null}
                      </div>
                    ))}
                    {modeRuns.length > 3 ? (
                      <details className="ff-harness-run-item">
                        <summary
                          style={{
                            cursor: "pointer",
                            fontSize: "var(--fg-type-size-meta)",
                            color: "var(--fg-color-text-secondary)",
                          }}
                        >
                          Show {modeRuns.length - 3} more
                        </summary>
                        <div className="fg-stack fg-mt-sm">
                          {modeRuns.slice(3).map((run, index) => (
                            <div
                              key={`${toStringValue(run.run_id, "run")}-${index + 3}`}
                              className="ff-harness-run-item"
                              style={{ border: 0, paddingLeft: 0 }}
                            >
                              <div className="ff-harness-detail-row">
                                <TonePill
                                  label={run.status}
                                  tone={toneFromStatus(run.status)}
                                />
                                <span>{formatTimestamp(run.executed_at)}</span>
                                <span>model={toStringValue(run.model)}</span>
                              </div>
                              <div
                                className="ff-nav-links"
                                style={{ border: 0, padding: 0 }}
                              >
                                <a
                                  className="fg-nav-link"
                                  href={logSurfaceLink}
                                >
                                  View logs
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
